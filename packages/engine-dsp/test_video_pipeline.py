from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from video_pipeline import VideoInspection, parse_ffprobe, proxy_filter, transcode_session_media


class InspectionTests(unittest.TestCase):
    def test_preserves_rotation_vfr_hevc_and_hdr_evidence(self):
        inspection = parse_ffprobe({
            "format": {"duration": "12.345678"},
            "streams": [
                {
                    "codec_type": "video", "codec_name": "hevc", "width": 1080, "height": 1920,
                    "avg_frame_rate": "24000/1001", "r_frame_rate": "30/1",
                    "color_transfer": "smpte2084", "color_primaries": "bt2020",
                    "side_data_list": [{"rotation": -90}],
                },
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        })
        self.assertEqual(inspection.source_rotation_degrees, 270)
        self.assertEqual(inspection.source_frame_rate_mode, "variable")
        self.assertEqual(inspection.source_video_codec, "hevc")
        self.assertTrue(inspection.source_hdr)
        self.assertEqual(inspection.duration_us, 12_345_678)
        filters = proxy_filter(inspection)
        self.assertIn("tonemap=hable", filters)
        self.assertIn("transpose=cclock", filters)
        self.assertIn("fps=30", filters)
        self.assertIn("bt709", filters)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg fixture tools unavailable")
class TranscodeFixtureTests(unittest.TestCase):
    def test_fixture_produces_private_editing_artifacts_and_frame_bounded_map(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.mp4"
            output = root / "output"
            subprocess.run([
                shutil.which("ffmpeg"), "-y", "-v", "error",
                "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=1",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(source),
            ], check=True)
            result = transcode_session_media(
                source, output, shutil.which("ffmpeg"), shutil.which("ffprobe")
            )

            inspection = result["inspection"]
            self.assertEqual(inspection["proxyVideoCodec"], "h264")
            self.assertEqual(inspection["proxyAudioCodec"], "aac")
            self.assertLessEqual(inspection["proxyWidth"], 1280)
            self.assertLessEqual(inspection["proxyHeight"], 720)
            self.assertTrue(inspection["orientationBakedIn"])
            time_map = result["timeMap"]["segments"][0]
            self.assertLessEqual(abs(time_map["proxyEndUs"] - time_map["originalEndUs"]), 33_334)
            for artifact in result["artifacts"].values():
                self.assertRegex(artifact["sha256"], r"^[a-f0-9]{64}$")
                self.assertGreater(artifact["byteSize"], 0)
            self.assertEqual(len(result["thumbnails"]), 3)
            self.assertTrue(all(item["byteSize"] > 0 for item in result["thumbnails"]))
            waveform = json.loads(Path(result["artifacts"]["waveform"]["path"]).read_text())
            self.assertTrue(waveform["peaks"])

    def test_real_rotated_vfr_hevc_hdr_fixture_becomes_oriented_sdr_cfr_with_three_point_pts_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / "base-hevc-hdr-vfr.mp4"
            source = root / "rotated-hevc-hdr-vfr.mp4"
            output = root / "output"
            subprocess.run([
                shutil.which("ffmpeg"), "-y", "-v", "error",
                "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15:duration=1",
                "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=1",
                "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=2",
                "-filter_complex",
                "[0:v]settb=AVTB[v0];[1:v]settb=AVTB[v1];[v0][v1]concat=n=2:v=1:a=0[v]",
                "-map", "[v]", "-map", "2:a", "-fps_mode", "vfr",
                "-c:v", "libx265",
                "-x265-params",
                "log-level=error:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc",
                "-pix_fmt", "yuv420p10le",
                "-color_primaries", "bt2020",
                "-color_trc", "smpte2084",
                "-colorspace", "bt2020nc",
                "-c:a", "aac", "-shortest", str(base),
            ], check=True)
            # A display matrix is how phone containers commonly carry
            # orientation; remux without touching the encoded HEVC bytes.
            subprocess.run([
                shutil.which("ffmpeg"), "-y", "-v", "error",
                "-display_rotation", "90", "-i", str(base),
                "-c", "copy", str(source),
            ], check=True)

            result = transcode_session_media(
                source, output, shutil.which("ffmpeg"), shutil.which("ffprobe"),
            )
            inspection = result["inspection"]
            self.assertEqual(inspection["sourceVideoCodec"], "hevc")
            self.assertEqual(inspection["sourceRotationDegrees"], 90)
            self.assertEqual(inspection["sourceFrameRateMode"], "variable")
            self.assertTrue(inspection["sourceHdr"])
            self.assertEqual(inspection["proxyVideoCodec"], "h264")
            self.assertEqual(inspection["proxyColorSpace"], "rec709")
            self.assertEqual(
                (inspection["proxyFrameRateNumerator"], inspection["proxyFrameRateDenominator"]),
                (30, 1),
            )
            self.assertGreater(inspection["proxyHeight"], inspection["proxyWidth"])
            self.assertTrue(inspection["orientationBakedIn"])

            segments = result["timeMap"]["segments"]
            self.assertGreaterEqual(len(segments), 3)

            def mapped_original(proxy_us: int) -> int:
                segment = next(
                    item for item in segments
                    if item["proxyStartUs"] <= proxy_us <= item["proxyEndUs"]
                )
                proxy_span = segment["proxyEndUs"] - segment["proxyStartUs"]
                original_span = segment["originalEndUs"] - segment["originalStartUs"]
                return round(
                    segment["originalStartUs"]
                    + ((proxy_us - segment["proxyStartUs"]) / proxy_span) * original_span
                )

            proxy_duration = inspection["proxyDurationUs"]
            original_duration = inspection["originalDurationUs"]
            for fraction in (0.0, 0.5, 1.0):
                proxy_us = round(proxy_duration * fraction)
                expected_original_us = round(original_duration * fraction)
                self.assertLessEqual(
                    abs(mapped_original(proxy_us) - expected_original_us),
                    33_334,
                    f"presentation mapping drifted at {fraction:.0%}",
                )


if __name__ == "__main__":
    unittest.main()
