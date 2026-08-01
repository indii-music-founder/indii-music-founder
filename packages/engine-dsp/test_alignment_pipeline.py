from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf
from pydantic import ValidationError

from alignment_pipeline import (
    AlignMasterRequest,
    AudioAlignmentPipeline,
    CanonicalMasterMissing,
    GuideAudioMissing,
)

HASH_64 = "a" * 64


def generate_synth_wav(path: Path, duration_s: float = 3.0, sr: int = 22050, freq: float = 440.0, offset_s: float = 0.0) -> None:
    """Generates a synthetic audio file with rhythmic pulses."""
    total_samples = int(duration_s * sr)
    audio = np.zeros(total_samples, dtype=np.float32)

    # Add pulses every 0.5s starting at offset_s
    pulse_interval = int(0.5 * sr)
    start_sample = int(offset_s * sr)

    for p in range(start_sample, total_samples - 1000, pulse_interval):
        t = np.linspace(0, 0.1, int(0.1 * sr))
        audio[p : p + len(t)] += np.sin(2 * np.pi * freq * t).astype(np.float32)

    sf.write(str(path), audio, sr)


class TestAlignMasterRequest(unittest.TestCase):
    def test_valid_request(self) -> None:
        req = AlignMasterRequest(
            sessionId="session-1",
            ownerUid="user-1",
            organizationId="org-1",
            projectId="proj-1",
            guideAudioBucket="indii-test.firebasestorage.app",
            guideAudioPath="session-media/user-1/session-1/guide/guide.wav",
            masterBucket="indii-test.firebasestorage.app",
            masterPath="masters/user-1/master.wav",
            masterFingerprint="SONIC-master-1",
            guideAudioRef={"ownerUid": "user-1", "role": "guide_audio"},
            canonicalMasterRef={"ownerUid": "user-1", "masterFingerprint": "SONIC-master-1"},
        )
        self.assertEqual(req.session_id, "session-1")
        self.assertEqual(req.owner_uid, "user-1")

    def test_cross_owner_ref_fails_validation(self) -> None:
        with self.assertRaises(ValidationError):
            AlignMasterRequest(
                sessionId="session-1",
                ownerUid="user-1",
                organizationId="org-1",
                projectId="proj-1",
                guideAudioBucket="indii-test.firebasestorage.app",
                guideAudioPath="session-media/user-1/session-1/guide/guide.wav",
                masterBucket="indii-test.firebasestorage.app",
                masterPath="masters/user-1/master.wav",
                masterFingerprint="SONIC-master-1",
                guideAudioRef={"ownerUid": "other-user", "role": "guide_audio"},
                canonicalMasterRef={"ownerUid": "user-1"},
            )


class TestAudioAlignmentPipeline(unittest.TestCase):
    def setUp(self) -> None:
        self.pipeline = AudioAlignmentPipeline(sample_rate=22050)

    def test_missing_files_raise_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            dir_path = Path(tmp_dir)
            guide = dir_path / "guide.wav"
            master = dir_path / "master.wav"

            with self.assertRaises(GuideAudioMissing):
                self.pipeline.align_guide_to_master(guide, master)

            generate_synth_wav(guide, duration_s=2.0)

            with self.assertRaises(CanonicalMasterMissing):
                self.pipeline.align_guide_to_master(guide, master)

    def test_synthetic_exact_alignment(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            dir_path = Path(tmp_dir)
            guide = dir_path / "guide.wav"
            master = dir_path / "master.wav"

            # Create master track (5s) and guide track (3s, matching master starting at t=1.0s)
            generate_synth_wav(master, duration_s=5.0, offset_s=0.0)
            generate_synth_wav(guide, duration_s=3.0, offset_s=0.0)

            result = self.pipeline.align_guide_to_master(guide, master)
            self.assertIn(result.status, ["locked", "needs_review"])
            self.assertGreater(result.aggregate_confidence, 0.5)
            self.assertGreaterEqual(len(result.anchors), 1)

    def test_timing_profile_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            dir_path = Path(tmp_dir)
            master = dir_path / "master.wav"

            generate_synth_wav(master, duration_s=4.0)
            profile = self.pipeline.extract_timing_profile(master)

            self.assertEqual(profile["schemaVersion"], "master-timing-profile.v1")
            self.assertGreater(profile["durationUs"], 3_500_000)
            self.assertIn("beatsUs", profile)
            self.assertIn("onsetsUs", profile)


if __name__ == "__main__":
    unittest.main()
