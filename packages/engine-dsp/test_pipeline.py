from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import soundfile as sf
from pydantic import ValidationError

from pipeline import (
    AnalysisClaim,
    AudioAnalysisPipeline,
    CanonicalMasterStorage,
    CanonicalMasterRejected,
    GeminiAudioAnalyzer,
    IngestionRequest,
    StagedMaster,
    _technical_properties,
    build_open_source_profile,
)

HASH = "a" * 64
REQUEST_DATA = {
    "storageBucket": "indii-test.firebasestorage.app",
    "storagePath": f"masters/owner-1/{HASH}/original.wav",
    "masterFingerprint": "SONIC-1",
    "contentHash": HASH,
    "generation": "987654321",
    "ownerId": "owner-1",
}


def staged_master(path: Path) -> StagedMaster:
    return StagedMaster(
        local_path=path,
        gs_uri=f"gs://indii-test.firebasestorage.app/{REQUEST_DATA['storagePath']}",
        mime_type="audio/wav",
        size_bytes=path.stat().st_size if path.exists() else 100,
        sample_rate=44_100,
        bit_depth=16,
        channels=2,
        frames=44_100,
        duration_seconds=1.0,
        container="wav",
        codec="pcm_16",
    )


class FakeReceiptStore:
    def __init__(self, cached=None):
        self.cached = cached
        self.completed = None
        self.failed = None

    def claim(self, request):
        if self.cached is not None:
            return AnalysisClaim(lease_id=None, cached_receipt=self.cached)
        return AnalysisClaim(lease_id="lease-1", cached_receipt=None)

    def complete(self, request, lease_id, staged, dsp_profile, gemini_profile, gemini_model):
        self.completed = {
            "request": request,
            "leaseId": lease_id,
            "staged": staged,
            "dsp": dsp_profile,
            "gemini": gemini_profile,
            "model": gemini_model,
        }
        return {
            "receiptId": "audio-receipt-1",
            "status": "complete",
            "contentHash": request.content_hash,
            "generation": request.generation,
        }

    def fail(self, request, lease_id, error):
        self.failed = {"request": request, "leaseId": lease_id, "error": error}


class FakeMasterStorage:
    def __init__(self, staged):
        self.staged = staged
        self.stage_calls = 0
        self.assert_calls = 0

    def stage(self, request, directory):
        self.stage_calls += 1
        return self.staged

    def assert_generation(self, request):
        self.assert_calls += 1


class FakeGeminiAnalyzer:
    model = "gemini-3-flash-preview"

    def analyze(self, staged):
        return {"summary": "audible profile"}


class IngestionContractTests(unittest.TestCase):
    def test_rejects_legacy_payload_and_extra_fields(self):
        with self.assertRaises(ValidationError):
            IngestionRequest.model_validate({"filePath": REQUEST_DATA["storagePath"], "masterAssetId": "x"})

    def test_rejects_cross_owner_storage_path(self):
        payload = {**REQUEST_DATA, "ownerId": "attacker"}
        with self.assertRaisesRegex(ValidationError, "does not match the owner"):
            IngestionRequest.model_validate(payload)


class PipelineTests(unittest.TestCase):
    def test_completed_receipt_is_replayed_without_reprocessing_or_rebilling(self):
        request = IngestionRequest.model_validate(REQUEST_DATA)
        receipt = {"receiptId": "cached", "status": "complete"}
        store = FakeReceiptStore(cached=receipt)
        master_storage = FakeMasterStorage(staged_master(Path("unused.wav")))
        pipeline = AudioAnalysisPipeline(store, master_storage, FakeGeminiAnalyzer())

        self.assertEqual(pipeline.run(request), receipt)
        self.assertEqual(master_storage.stage_calls, 0)

    def test_verified_generation_runs_both_analyzers_and_completes_one_receipt(self):
        request = IngestionRequest.model_validate(REQUEST_DATA)
        store = FakeReceiptStore()
        master_storage = FakeMasterStorage(staged_master(Path("unused.wav")))
        pipeline = AudioAnalysisPipeline(store, master_storage, FakeGeminiAnalyzer())

        with patch("pipeline.build_open_source_profile", return_value={"tempoBpm": 120.0}):
            result = pipeline.run(request)

        self.assertEqual(result["receiptId"], "audio-receipt-1")
        self.assertEqual(master_storage.stage_calls, 1)
        self.assertEqual(master_storage.assert_calls, 1)
        self.assertEqual(store.completed["leaseId"], "lease-1")
        self.assertEqual(store.completed["dsp"], {"tempoBpm": 120.0})
        self.assertEqual(store.completed["gemini"], {"summary": "audible profile"})
        self.assertIsNone(store.failed)

    def test_failure_marks_the_owned_lease_for_safe_retry(self):
        request = IngestionRequest.model_validate(REQUEST_DATA)
        store = FakeReceiptStore()
        master_storage = FakeMasterStorage(staged_master(Path("unused.wav")))
        pipeline = AudioAnalysisPipeline(store, master_storage, FakeGeminiAnalyzer())

        with patch("pipeline.build_open_source_profile", side_effect=RuntimeError("DSP failed")):
            with self.assertRaisesRegex(RuntimeError, "DSP failed"):
                pipeline.run(request)

        self.assertEqual(store.failed["leaseId"], "lease-1")
        self.assertIsNone(store.completed)


class AnalyzerTests(unittest.TestCase):
    def test_storage_generation_check_targets_the_current_object_with_a_precondition(self):
        request = IngestionRequest.model_validate(REQUEST_DATA)
        blob = Mock(generation=request.generation)
        bucket = Mock()
        bucket.blob.return_value = blob
        client = Mock()
        client.bucket.return_value = bucket
        master_storage = CanonicalMasterStorage(client, request.storage_bucket)

        master_storage.assert_generation(request)

        bucket.blob.assert_called_once_with(request.storage_path)
        blob.reload.assert_called_once_with(if_generation_match=int(request.generation))

    def test_open_source_profile_is_measured_from_streamed_pcm_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "master.wav"
            seconds = 1.0
            sample_rate = 44_100
            time = np.linspace(0, seconds, int(sample_rate * seconds), endpoint=False)
            mono = 0.25 * np.sin(2 * np.pi * 440 * time)
            stereo = np.column_stack([mono, mono])
            sf.write(path, stereo, sample_rate, subtype="PCM_16")
            technical = _technical_properties(path, "audio/wav", path.stat().st_size)
            measured = staged_master(path)
            measured = StagedMaster(**{**measured.__dict__, **technical.__dict__, "gs_uri": measured.gs_uri})

            profile = build_open_source_profile(measured)

        self.assertEqual(profile["analyzer"], "librosa+soundfile")
        self.assertLess(profile["rmsDbfs"], 0)
        self.assertGreater(profile["peakLinear"], 0)
        self.assertNotIn("lufs", {key.lower() for key in profile})

    def test_technical_probe_rejects_mono_even_when_extension_says_wav(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fake-master.wav"
            sf.write(path, np.zeros(44_100), 44_100, subtype="PCM_16")
            with self.assertRaisesRegex(CanonicalMasterRejected, "stereo"):
                _technical_properties(path, "audio/wav", path.stat().st_size)

    def test_gemini_receives_the_gcs_master_reference_and_schema_not_inline_bytes(self):
        profile = {
            "summary": "A concise electronic master.",
            "genres": ["electronic"],
            "moods": ["focused"],
            "instrumentation": ["synthesizer"],
            "vocal_description": "instrumental",
            "language": "none",
            "clean_or_explicit_signal": "no audible lyrics",
            "sonic_texture": "warm analog synthesizers",
            "visual_direction": "slow-moving blue neon city lights",
            "image_prompt": "Blue neon city lights, no text.",
            "video_prompt": "Slow camera drift through blue neon city lights.",
            "marketing_keywords": ["electronic", "focused"],
            "marketing_moments": [],
        }
        response = Mock(text=json.dumps(profile))
        client = Mock()
        client.models.generate_content.return_value = response
        analyzer = GeminiAudioAnalyzer(client, "gemini-3-flash-preview")
        staged = staged_master(Path("unused.wav"))

        self.assertEqual(analyzer.analyze(staged), profile)
        call = client.models.generate_content.call_args.kwargs
        self.assertEqual(call["model"], "gemini-3-flash-preview")
        self.assertEqual(call["contents"][0].file_data.file_uri, staged.gs_uri)
        self.assertIsNone(call["contents"][0].inline_data)
        self.assertEqual(call["config"].response_mime_type, "application/json")


if __name__ == "__main__":
    unittest.main()
