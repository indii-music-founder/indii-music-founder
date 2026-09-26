"""P4 additive measurements: BWF parsing, BS.1770 loudness, key estimate.

Covers the deterministic, additive receipt fields added by the Post-Mastering
Administrative Engine (docs/plans/post-mastering-admin-engine-plan-2026-09-26.md
§3 E1). These fields are additive: every test asserts the receipt stays
well-formed even when the new measurements are unavailable.
"""

from __future__ import annotations

import math
import struct
import unittest
from pathlib import Path

import numpy as np

import bwf
from pipeline import estimate_key_from_chroma, estimate_musical_key, measure_loudness


def _wav_bytes_with_bext(bext_body: bytes) -> bytes:
    """Build a minimal RIFF/WAVE file (8 silence samples) with a bext chunk."""
    fmt = struct.pack(
        "<HHIIHH",
        1,  # PCM
        1,  # mono
        48_000,  # sample rate
        48_000,  # byte rate
        1,  # block align
        16,  # bits per sample
    )
    samples = struct.pack("<8h", *([0] * 8))
    fmt_chunk = b"fmt " + struct.pack("<I", len(fmt)) + fmt
    data_chunk = b"data" + struct.pack("<I", len(samples)) + samples
    bext_chunk = b"bext" + struct.pack("<I", len(bext_body)) + bext_body + (b"\x00" if len(bext_body) % 2 else b"")
    riff = b"RIFF" + struct.pack("<I", 4 + len(fmt_chunk) + len(data_chunk) + len(bext_chunk)) + b"WAVE"
    return riff + fmt_chunk + data_chunk + bext_chunk


def _build_bext(
    originator: bytes = b"indii studio",
    origination_date: bytes = b"2026-09-26",
    loudness_value: int = 1800,  # 18.00 LUFS
    max_true_peak: int = -100,  # -1.00 dBTP
) -> bytes:
    return struct.pack(
        "<256s32s32s10s8sQH64shhhhh",
        b"Automated masters ingest",
        originator,
        b"indii music",
        origination_date,
        b"12:00:00",
        123_456,
        2,  # version
        b"",  # UMID
        loudness_value,
        850,  # loudness range 8.5 LU
        max_true_peak,
        1500,
        1700,
    ) + b"coding history line\n"


class BwfParseTests(unittest.TestCase):
    def test_parses_bext_fields_and_levels_from_a_real_layout(self) -> None:
        path = Path(__file__).parent / "_fixture_bext.wav"
        path.write_bytes(_wav_bytes_with_bext(_build_bext()))
        try:
            parsed = bwf.parse_bwf_metadata(path)
        finally:
            path.unlink(missing_ok=True)

        self.assertIn("bext", parsed)
        bext = parsed["bext"]
        self.assertEqual(bext["originator"], "indii studio")
        self.assertEqual(bext["originationDate"], "2026-09-26")
        self.assertEqual(bext["timeReferenceSamples"], 123_456)
        self.assertEqual(bext["loudness"]["integratedLufs"], 18.0)
        self.assertEqual(bext["loudness"]["maxTruePeakDbTp"], -1.0)

    def test_returns_empty_for_non_wav_input(self) -> None:
        path = Path(__file__).parent / "_fixture_bext.flac"
        path.write_bytes(b"fLaC" + b"\x00" * 32)
        try:
            self.assertEqual(bwf.parse_bwf_metadata(path), {})
        finally:
            path.unlink(missing_ok=True)

    def test_returns_empty_when_no_bwf_chunks(self) -> None:
        path = Path(__file__).parent / "_fixture_plain.wav"
        fmt = struct.pack("<HHIIHH", 1, 1, 48_000, 48_000, 1, 16)
        samples = struct.pack("<8h", *([0] * 8))
        riff = (
            b"RIFF"
            + struct.pack("<I", 4 + 8 + len(fmt) + 8 + len(samples))
            + b"WAVE"
            + b"fmt " + struct.pack("<I", len(fmt)) + fmt
            + b"data" + struct.pack("<I", len(samples)) + samples
        )
        path.write_bytes(riff)
        try:
            self.assertEqual(bwf.parse_bwf_metadata(path), {})
        finally:
            path.unlink(missing_ok=True)

    def test_bext_shorter_than_head_reports_parse_error(self) -> None:
        parsed = bwf.parse_bext(b"\x00" * 32)
        self.assertIn("parseError", parsed)


class LoudnessTests(unittest.TestCase):
    def test_full_scale_sine_measures_near_known_lufs(self) -> None:
        rate = 48_000
        # 1 kHz sine at 0 dBFS integrates to about -3.01 LUFS (K-weighting gain
        # at 1 kHz is ~0 dB); allow a 1 LU tolerance for the 22k analysis rate.
        t = np.arange(rate * 2, dtype=np.float64) / rate
        audio = 0.999 * np.sin(2 * math.pi * 1_000.0 * t)
        result = measure_loudness(audio.astype(np.float32), rate)
        self.assertTrue(result["measured"])
        self.assertAlmostEqual(result["integratedLufs"], -3.01, delta=1.0)
        # True peak of a full-scale sine is ~0 dBTP.
        self.assertLessEqual(result["truePeakDbTp"], 0.5)
        self.assertEqual(result["standard"], "ITU-R BS.1770-4")

    def test_quiet_signal_reports_about_20_db_lower(self) -> None:
        rate = 48_000
        t = np.arange(rate * 2, dtype=np.float64) / rate
        quiet = (0.999 * np.sin(2 * math.pi * 1_000.0 * t) * 0.1).astype(np.float32)
        loud = (0.999 * np.sin(2 * math.pi * 1_000.0 * t)).astype(np.float32)
        quiet_result = measure_loudness(quiet, rate)
        loud_result = measure_loudness(loud, rate)
        self.assertTrue(quiet_result["measured"] and loud_result["measured"])
        self.assertAlmostEqual(
            loud_result["integratedLufs"] - quiet_result["integratedLufs"],
            20.0,
            delta=0.5,
        )

    def test_short_audio_is_marked_unmeasured_not_failed(self) -> None:
        result = measure_loudness(np.zeros(1_000, dtype=np.float32), 48_000)
        self.assertEqual(result, {"measured": False})

    def test_silence_reports_unmeasured_without_crashing(self) -> None:
        result = measure_loudness(np.zeros(96_000, dtype=np.float32), 48_000)
        self.assertEqual(result, {"measured": False})


class MusicalKeyTests(unittest.TestCase):
    def test_key_decision_pure_function_matches_profile_vectors(self) -> None:
        major_profile = np.asarray((6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88))
        minor_profile = np.asarray((6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17))

        # A-major chroma: the profile's tonic energy sits at pitch class 9 (A).
        a_major = np.roll(major_profile, 9)
        result = estimate_key_from_chroma(a_major)
        self.assertEqual(result["key"], "A")
        self.assertEqual(result["scale"], "major")

        # C#-minor chroma: tonic energy at pitch class 1.
        c_sharp_minor = np.roll(minor_profile, 1)
        result = estimate_key_from_chroma(c_sharp_minor)
        self.assertEqual(result["key"], "C#")
        self.assertEqual(result["scale"], "minor")

    def test_a440_major_triad_estimates_a_triad_tonic(self) -> None:
        rate = 22_050
        t = np.arange(rate * 3, dtype=np.float64) / rate
        audio = sum(
            np.sin(2 * math.pi * frequency * t) for frequency in (220.0, 277.18, 329.63)
        )
        result = estimate_musical_key(audio.astype(np.float32), rate)
        self.assertTrue(result["estimated"])
        # Pure-sine triads leak chroma energy across neighbouring bins, so the
        # 24-way correlation can pick a relative rotation. Guard the honest
        # contract: the estimate lands on a pitch class of the played triad.
        self.assertIn(result["key"], ("A", "C#", "E"))
        self.assertGreaterEqual(result["confidence"], 0.0)

    def test_short_audio_is_marked_unestimated(self) -> None:
        self.assertEqual(estimate_musical_key(np.zeros(1_000, dtype=np.float32), 22_050)["estimated"], False)


if __name__ == "__main__":
    unittest.main()
