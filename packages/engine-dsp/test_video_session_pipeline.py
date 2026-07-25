from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from google.api_core.exceptions import Conflict
from unittest.mock import Mock

from google.cloud import firestore

from video_session_pipeline import (
    DerivedMediaStore,
    FirestoreVideoSessionProxyStore,
    OriginalMediaStore,
    OriginalVerificationFailed,
    ProxyClaim,
    ProxyJobConflict,
    ProxyJobInProgress,
    ProxyPipelineConfigurationError,
    SessionNotFound,
    VideoProxyRequest,
    VideoSessionProxyPipeline,
)

SESSION_ID = "session-1"
JOB_ID = "proxy-abc123"
HASH = "a" * 64

REQUEST_DATA = {
    "sessionId": SESSION_ID,
    "ownerUid": "artist-1",
    "organizationId": "org-1",
    "projectId": "project-1",
    "bucket": "private-media-bucket",
    "path": f"session-media/artist-1/{SESSION_ID}/original/{HASH}.mp4",
    "generation": "1712345678901234",
    "sha256": HASH,
    "mimeType": "video/mp4",
    "byteSize": 250_000_000,
    "jobId": JOB_ID,
}


def make_request(**overrides) -> VideoProxyRequest:
    return VideoProxyRequest.model_validate({**REQUEST_DATA, **overrides})


def original_receipt(**overrides) -> dict:
    return {
        "schemaVersion": "canonical-media-ref.v1",
        "role": "original",
        "ownerUid": REQUEST_DATA["ownerUid"],
        "organizationId": REQUEST_DATA["organizationId"],
        "projectId": REQUEST_DATA["projectId"],
        "bucket": REQUEST_DATA["bucket"],
        "path": REQUEST_DATA["path"],
        "generation": REQUEST_DATA["generation"],
        "sha256": REQUEST_DATA["sha256"],
        "mimeType": REQUEST_DATA["mimeType"],
        "byteSize": REQUEST_DATA["byteSize"],
        "createdAt": "2026-07-23T00:00:00.000Z",
        "creationReceiptId": "original-receipt-1",
        **overrides,
    }


def persisted_session(**overrides) -> dict:
    return {
        "status": "uploaded",
        "ownerUid": REQUEST_DATA["ownerUid"],
        "organizationId": REQUEST_DATA["organizationId"],
        "projectId": REQUEST_DATA["projectId"],
        "original": original_receipt(),
        "proxyJob": {
            "jobId": JOB_ID,
            "status": "queued",
            "originalGeneration": REQUEST_DATA["generation"],
            "originalSha256": REQUEST_DATA["sha256"],
        },
        **overrides,
    }


class RequestContractTests(unittest.TestCase):
    def test_rejects_extra_fields(self):
        with self.assertRaises(Exception):
            VideoProxyRequest.model_validate({**REQUEST_DATA, "extra": "nope"})

    def test_rejects_malformed_bucket(self):
        with self.assertRaises(Exception):
            make_request(bucket="!!not-a-bucket")

    def test_rejects_an_original_path_outside_the_declared_owner_session_and_hash(self):
        with self.assertRaises(Exception):
            make_request(
                path=f"session-media/artist-2/{SESSION_ID}/original/{HASH}.mp4",
            )


class FakeSnapshot:
    def __init__(self, data: dict | None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeTransaction:
    """Runs the wrapped function inline — enough to exercise the transaction
    body's logic without a real Firestore emulator."""

    def get(self, reference, transaction=None):
        return reference.snapshot

    def update(self, reference, patch: dict):
        reference.update(patch)


class FakeDocumentReference:
    def __init__(self, data: dict | None):
        self.snapshot = FakeSnapshot(data)
        self.updates: list[dict] = []

    def get(self, transaction=None):
        return self.snapshot

    def update(self, patch: dict):
        self.updates.append(patch)
        merged = dict(self.snapshot.to_dict() or {})
        for key, value in patch.items():
            if "." in key:
                top, nested = key.split(".", 1)
                merged.setdefault(top, {})
                if value is firestore.DELETE_FIELD:
                    merged[top].pop(nested, None)
                else:
                    merged[top][nested] = value
            elif value is firestore.DELETE_FIELD:
                merged.pop(key, None)
            else:
                merged[key] = value
        self.snapshot = FakeSnapshot(merged)


class FakeFirestoreClient:
    def __init__(self, initial: dict | None):
        self._doc = FakeDocumentReference(initial)

    def collection(self, name):
        assert name == "videoSessions"
        return self

    def document(self, session_id):
        assert session_id == SESSION_ID
        return self._doc

    def transaction(self):
        return FakeTransaction()


def patch_transactional(monkeypatch_target):
    """`@firestore.transactional` normally retries the wrapped function inside
    a real transaction context; for these tests it only needs to call the
    function once with the transaction object, since `FakeTransaction`/
    `FakeDocumentReference` are not actually transactional."""
    return lambda fn: (lambda transaction: fn(transaction))


class FirestoreVideoSessionProxyStoreTests(unittest.TestCase):
    def setUp(self):
        self._real_transactional = firestore.transactional
        firestore.transactional = patch_transactional(None)

    def tearDown(self):
        firestore.transactional = self._real_transactional

    def test_raises_not_found_for_a_missing_session(self):
        client = FakeFirestoreClient(None)
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(SessionNotFound):
            store.claim(make_request())

    def test_rejects_a_request_whose_jobid_does_not_match_the_dispatched_claim(self):
        client = FakeFirestoreClient(persisted_session(proxyJob={
            **persisted_session()["proxyJob"],
            "jobId": "some-other-job",
        }))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobConflict):
            store.claim(make_request())

    def test_rejects_matching_jobid_when_the_session_owner_does_not_match(self):
        client = FakeFirestoreClient(persisted_session(ownerUid="artist-2"))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobConflict):
            store.claim(make_request())

    def test_rejects_matching_jobid_when_the_original_receipt_does_not_match(self):
        client = FakeFirestoreClient(persisted_session(original=original_receipt(
            generation="999",
        )))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobConflict):
            store.claim(make_request())

    def test_rejects_matching_jobid_when_the_job_is_bound_to_another_original(self):
        client = FakeFirestoreClient(persisted_session(proxyJob={
            **persisted_session()["proxyJob"],
            "originalSha256": "b" * 64,
        }))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobConflict):
            store.claim(make_request())

    def test_claims_an_uploaded_session_and_sets_a_lease(self):
        client = FakeFirestoreClient(persisted_session())
        store = FirestoreVideoSessionProxyStore(client)
        claim = store.claim(make_request())

        self.assertIsNotNone(claim.lease_id)
        self.assertIsNone(claim.cached_manifest)
        self.assertIsNone(claim.cached_failure)
        self.assertEqual(claim.original_ref, original_receipt())
        updated = client._doc.snapshot.to_dict()
        self.assertEqual(updated["status"], "processing")
        self.assertEqual(updated["proxyJob"]["leaseId"], claim.lease_id)
        self.assertIn("leaseExpiresAt", updated["proxyJob"])

    def test_replays_a_completed_session_bound_to_the_same_original_without_reprocessing(self):
        manifest = {"original": {"generation": REQUEST_DATA["generation"], "sha256": HASH}}
        client = FakeFirestoreClient(persisted_session(
            status="completed",
            proxyManifest=manifest,
        ))
        store = FirestoreVideoSessionProxyStore(client)
        claim = store.claim(make_request())

        self.assertIsNone(claim.lease_id)
        self.assertEqual(claim.cached_manifest, manifest)

    def test_rejects_replay_when_completed_manifest_binds_a_different_original(self):
        manifest = {"original": {"generation": "999", "sha256": "b" * 64}}
        client = FakeFirestoreClient(persisted_session(
            status="completed",
            proxyManifest=manifest,
        ))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobConflict):
            store.claim(make_request())

    def test_returns_the_cached_failure_for_a_permanently_failed_session_without_reprocessing(self):
        failure = {"code": "original-verification-failed", "message": "boom", "retryable": False}
        client = FakeFirestoreClient(persisted_session(
            status="failed",
            failure=failure,
        ))
        store = FirestoreVideoSessionProxyStore(client)
        claim = store.claim(make_request())

        self.assertIsNone(claim.lease_id)
        self.assertEqual(claim.cached_failure, failure)

    def test_refuses_a_second_claim_while_a_lease_is_still_active(self):
        client = FakeFirestoreClient(persisted_session(
            status="processing",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-still-alive",
                "leaseExpiresAt": datetime.now(UTC) + timedelta(minutes=10),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        with self.assertRaises(ProxyJobInProgress):
            store.claim(make_request())

    def test_allows_a_new_claim_once_the_previous_lease_has_expired(self):
        client = FakeFirestoreClient(persisted_session(
            status="processing",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-crashed",
                "leaseExpiresAt": datetime.now(UTC) - timedelta(minutes=1),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        claim = store.claim(make_request())

        self.assertIsNotNone(claim.lease_id)
        self.assertNotEqual(claim.lease_id, "lease-crashed")

    def test_complete_writes_the_manifest_and_clears_the_lease(self):
        client = FakeFirestoreClient(persisted_session(
            status="processing",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-1",
                "leaseExpiresAt": datetime.now(UTC),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        manifest = {"schemaVersion": "proxy-manifest.v1"}
        outcome = store.complete(make_request(), "lease-1", manifest)

        self.assertFalse(outcome["discarded"])
        updated = client._doc.snapshot.to_dict()
        self.assertEqual(updated["status"], "completed")
        self.assertEqual(updated["proxyManifest"], manifest)
        self.assertIn("terminalReceiptId", updated)
        self.assertNotIn("leaseId", updated["proxyJob"])
        self.assertNotIn("leaseExpiresAt", updated["proxyJob"])

    def test_complete_discards_silently_when_a_newer_attempt_already_holds_the_lease(self):
        client = FakeFirestoreClient(persisted_session(
            status="processing",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-2-newer",
                "leaseExpiresAt": datetime.now(UTC),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        outcome = store.complete(make_request(), "lease-1-stale", {"schemaVersion": "proxy-manifest.v1"})

        self.assertTrue(outcome["discarded"])
        # The newer attempt's claim must survive untouched.
        self.assertEqual(client._doc.snapshot.to_dict()["status"], "processing")

    def test_complete_cannot_overwrite_a_cancellation_even_with_the_old_lease(self):
        client = FakeFirestoreClient(persisted_session(
            status="cancelled",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-1",
                "leaseExpiresAt": datetime.now(UTC),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        outcome = store.complete(make_request(), "lease-1", {"schemaVersion": "proxy-manifest.v1"})

        self.assertTrue(outcome["discarded"])
        self.assertEqual(outcome["terminalStatus"], "cancelled")
        self.assertEqual(client._doc.snapshot.to_dict()["status"], "cancelled")

    def test_fail_records_a_permanent_terminal_failure_and_clears_the_lease(self):
        client = FakeFirestoreClient(persisted_session(
            status="processing",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-1",
                "leaseExpiresAt": datetime.now(UTC),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        store.fail(make_request(), "lease-1", "original-verification-failed", "bytes changed")

        updated = client._doc.snapshot.to_dict()
        self.assertEqual(updated["status"], "failed")
        self.assertEqual(updated["failure"]["code"], "original-verification-failed")
        self.assertFalse(updated["failure"]["retryable"])
        self.assertNotIn("leaseId", updated["proxyJob"])

    def test_fail_cannot_overwrite_a_cancellation_even_with_the_old_lease(self):
        client = FakeFirestoreClient(persisted_session(
            status="cancelled",
            proxyJob={
                **persisted_session()["proxyJob"],
                "leaseId": "lease-1",
                "leaseExpiresAt": datetime.now(UTC),
            },
        ))
        store = FirestoreVideoSessionProxyStore(client)
        store.fail(make_request(), "lease-1", "original-verification-failed", "bytes changed")

        self.assertEqual(client._doc.snapshot.to_dict()["status"], "cancelled")


class OriginalMediaStoreTests(unittest.TestCase):
    def test_rejects_when_the_live_generation_no_longer_matches(self):
        blob = Mock(generation="999999999999999", size=100)
        bucket = Mock()
        bucket.blob.return_value = blob
        client = Mock()
        client.bucket.return_value = bucket

        store = OriginalMediaStore(client)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(OriginalVerificationFailed):
                store.download_verified(make_request(), Path(directory))


class DerivedMediaStoreTests(unittest.TestCase):
    def test_uploads_a_new_artifact_with_a_never_overwrite_precondition(self):
        blob = Mock(generation="1700000000000000")
        bucket = Mock()
        bucket.blob.return_value = blob
        client = Mock()
        client.bucket.return_value = bucket

        with tempfile.TemporaryDirectory() as directory:
            local_path = Path(directory) / "proxy.mp4"
            local_path.write_bytes(b"fake proxy bytes")

            store = DerivedMediaStore(client, "private-media-bucket")
            ref = store.upload(
                owner_uid="artist-1", session_id=SESSION_ID, job_id=JOB_ID,
                role="editing_proxy", local_path=local_path, mime_type="video/mp4",
            )

        blob.upload_from_filename.assert_called_once()
        _, kwargs = blob.upload_from_filename.call_args
        self.assertEqual(kwargs["if_generation_match"], 0)
        self.assertEqual(ref["path"], f"session-media/artist-1/{SESSION_ID}/proxy/{JOB_ID}/proxy.mp4")
        self.assertEqual(ref["generation"], "1700000000000000")

    def test_a_conflicting_upload_is_accepted_when_the_existing_object_has_the_same_hash(self):
        import hashlib

        with tempfile.TemporaryDirectory() as directory:
            local_path = Path(directory) / "proxy.mp4"
            local_path.write_bytes(b"identical bytes")
            expected_hash = hashlib.sha256(b"identical bytes").hexdigest()

            blob = Mock(generation="1700000000000000", metadata={"sha256": expected_hash})
            blob.upload_from_filename.side_effect = Conflict("object already exists")
            bucket = Mock()
            bucket.blob.return_value = blob
            client = Mock()
            client.bucket.return_value = bucket

            store = DerivedMediaStore(client, "private-media-bucket")
            ref = store.upload(
                owner_uid="artist-1", session_id=SESSION_ID, job_id=JOB_ID,
                role="editing_proxy", local_path=local_path, mime_type="video/mp4",
            )
            self.assertEqual(ref["sha256"], expected_hash)

    def test_a_conflicting_upload_with_different_bytes_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            local_path = Path(directory) / "proxy.mp4"
            local_path.write_bytes(b"my bytes")

            blob = Mock(generation="1700000000000000", metadata={"sha256": "f" * 64})
            blob.upload_from_filename.side_effect = Conflict("object already exists")
            bucket = Mock()
            bucket.blob.return_value = blob
            client = Mock()
            client.bucket.return_value = bucket

            store = DerivedMediaStore(client, "private-media-bucket")
            with self.assertRaises(OriginalVerificationFailed):
                store.upload(
                    owner_uid="artist-1", session_id=SESSION_ID, job_id=JOB_ID,
                    role="editing_proxy", local_path=local_path, mime_type="video/mp4",
                )

    def test_generation_deletes_only_a_job_scoped_derivative_and_refuses_the_original(self):
        blob = Mock()
        bucket = Mock()
        bucket.blob.return_value = blob
        client = Mock()
        client.bucket.return_value = bucket
        store = DerivedMediaStore(client, "private-media-bucket")
        derivative = {
            "bucket": "private-media-bucket",
            "path": f"session-media/artist-1/{SESSION_ID}/proxy/{JOB_ID}/proxy.mp4",
            "generation": "1700000000000000",
        }

        store.delete(
            derivative,
            owner_uid="artist-1",
            session_id=SESSION_ID,
            job_id=JOB_ID,
        )
        blob.delete.assert_called_once_with(if_generation_match=1700000000000000)

        with self.assertRaises(OriginalVerificationFailed):
            store.delete(
                {
                    **derivative,
                    "path": REQUEST_DATA["path"],
                    "generation": REQUEST_DATA["generation"],
                },
                owner_uid="artist-1",
                session_id=SESSION_ID,
                job_id=JOB_ID,
            )


class FakeSessionStore:
    """Drives `VideoSessionProxyPipeline.run()` without a real Firestore."""

    def __init__(self, claim: ProxyClaim, complete_outcome: dict | None = None):
        self._claim = claim
        self._complete_outcome = complete_outcome or {"discarded": False, "terminalReceiptId": "term-1"}
        self.completed: dict | None = None
        self.failed: dict | None = None

    def claim(self, request):
        return self._claim

    def complete(self, request, lease_id, manifest):
        self.completed = {"request": request, "leaseId": lease_id, "manifest": manifest}
        return self._complete_outcome

    def fail(self, request, lease_id, code, message):
        self.failed = {"request": request, "leaseId": lease_id, "code": code, "message": message}


class FakeOriginalMediaStore:
    def __init__(self, local_path: Path):
        self._local_path = local_path

    def download_verified(self, request, directory):
        return self._local_path


class FakeDerivedMediaStore:
    def __init__(self):
        self.uploads: list[dict] = []
        self.deletes: list[dict] = []

    def upload(self, **kwargs):
        self.uploads.append(kwargs)
        return {
            "ownerUid": kwargs["owner_uid"],
            "bucket": "private-media-bucket",
            "path": f"session-media/{kwargs['owner_uid']}/{kwargs['session_id']}/proxy/{kwargs['job_id']}/{kwargs['role']}",
            "generation": "1700000000000000",
            "sha256": "c" * 64,
            "mimeType": kwargs["mime_type"],
            "byteSize": 1234,
            "createdAt": "2026-07-23T00:00:00.000Z",
            "creationReceiptId": f"derived-{kwargs['role']}",
        }

    def delete(self, ref, **identity):
        self.deletes.append({"ref": ref, **identity})


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg fixture tools unavailable")
class PipelineEndToEndFixtureTests(unittest.TestCase):
    """The only test that runs the real FFmpeg pipeline end to end and proves
    the resulting manifest actually satisfies the shape
    `packages/shared/src/schemas/sessionMedia.ts`'s `ProxyManifestSchema`
    expects, field by field — a hand-typed fake result could not prove this.
    """

    def test_a_real_fixture_produces_a_schema_shaped_manifest_and_completes_the_session(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            work_directory = root / "work"
            work_directory.mkdir()
            source = work_directory / "original.mp4"
            subprocess.run([
                shutil.which("ffmpeg"), "-y", "-v", "error",
                "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=1",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(source),
            ], check=True)

            session_store = FakeSessionStore(ProxyClaim(
                lease_id="lease-1",
                cached_manifest=None,
                cached_failure=None,
                original_ref=original_receipt(),
            ))
            derived_store = FakeDerivedMediaStore()
            pipeline = VideoSessionProxyPipeline(
                sessions=session_store,
                originals=FakeOriginalMediaStore(source),
                derived=derived_store,
                ffmpeg=shutil.which("ffmpeg"),
                ffprobe=shutil.which("ffprobe"),
            )

            result = pipeline.run(make_request(), work_directory)

            self.assertEqual(result["status"], "completed")
            self.assertFalse(result["reused"])
            manifest = result["manifest"]

            # Top-level shape, matching ProxyManifestSchema's declared keys exactly.
            for key in (
                "schemaVersion", "manifestId", "sessionId", "ownerUid", "organizationId",
                "projectId", "original", "proxy", "guideAudio", "inspection", "timeMap",
                "waveform", "thumbnails", "contactSheet", "workerVersion", "createdAt",
                "processingReceiptId",
            ):
                self.assertIn(key, manifest, f"manifest is missing required key {key!r}")

            self.assertEqual(manifest["schemaVersion"], "proxy-manifest.v1")
            self.assertEqual(manifest["original"]["role"], "original")
            self.assertEqual(manifest["proxy"]["role"], "editing_proxy")
            self.assertEqual(manifest["proxy"]["mimeType"], "video/mp4")
            self.assertEqual(manifest["guideAudio"]["role"], "guide_audio")
            self.assertEqual(manifest["guideAudio"]["mimeType"], "audio/wav")
            self.assertEqual(manifest["waveform"]["role"], "waveform")
            self.assertEqual(manifest["contactSheet"]["role"], "contact_sheet")
            self.assertEqual(len(manifest["thumbnails"]), 3)
            self.assertTrue(all(t["role"] == "thumbnail" for t in manifest["thumbnails"]))

            inspection = manifest["inspection"]
            self.assertEqual(inspection["proxyVideoCodec"], "h264")
            self.assertEqual(inspection["proxyAudioCodec"], "aac")
            self.assertEqual(inspection["proxyColorSpace"], "rec709")
            self.assertTrue(inspection["orientationBakedIn"])

            time_map = manifest["timeMap"]
            self.assertEqual(time_map["version"], "presentation-time-map.v1")
            final_segment = time_map["segments"][-1]
            self.assertEqual(final_segment["proxyEndUs"], inspection["proxyDurationUs"])
            self.assertEqual(final_segment["originalEndUs"], inspection["originalDurationUs"])

            # Ownership propagated onto every derived ref, matching
            # ProxyManifestSchema's superRefine ownership cross-check.
            for ref in (manifest["proxy"], manifest["guideAudio"], manifest["waveform"], manifest["contactSheet"], *manifest["thumbnails"]):
                self.assertEqual(ref["ownerUid"], "artist-1")
                self.assertEqual(ref["organizationId"], "org-1")
                self.assertEqual(ref["projectId"], "project-1")

            # The session store actually received this exact manifest.
            self.assertEqual(session_store.completed["manifest"], manifest)
            self.assertEqual(session_store.completed["leaseId"], "lease-1")
            self.assertIsNone(session_store.failed)
            # proxy, guideAudio, waveform, contactSheet, and 3 thumbnails.
            self.assertEqual(len(derived_store.uploads), 7)


class PipelineReplayTests(unittest.TestCase):
    def test_a_cached_completed_manifest_is_returned_without_reprocessing(self):
        cached = {"schemaVersion": "proxy-manifest.v1", "sessionId": SESSION_ID}
        session_store = FakeSessionStore(ProxyClaim(lease_id=None, cached_manifest=cached, cached_failure=None))
        pipeline = VideoSessionProxyPipeline(
            sessions=session_store, originals=Mock(), derived=Mock(), ffmpeg="ffmpeg", ffprobe="ffprobe",
        )

        with tempfile.TemporaryDirectory() as directory:
            result = pipeline.run(make_request(), Path(directory))

        self.assertEqual(result, {"status": "completed", "reused": True, "manifest": cached})
        self.assertIsNone(session_store.completed)

    def test_a_cached_failure_is_returned_without_reprocessing(self):
        cached_failure = {"code": "original-verification-failed", "message": "boom", "retryable": False}
        session_store = FakeSessionStore(ProxyClaim(lease_id=None, cached_manifest=None, cached_failure=cached_failure))
        pipeline = VideoSessionProxyPipeline(
            sessions=session_store, originals=Mock(), derived=Mock(), ffmpeg="ffmpeg", ffprobe="ffprobe",
        )

        with tempfile.TemporaryDirectory() as directory:
            result = pipeline.run(make_request(), Path(directory))

        self.assertEqual(result, {"status": "failed", "reused": True, "failure": cached_failure})

    def test_a_permanent_original_verification_failure_is_recorded_and_reraised(self):
        session_store = FakeSessionStore(ProxyClaim(
            lease_id="lease-1",
            cached_manifest=None,
            cached_failure=None,
            original_ref=original_receipt(),
        ))
        originals = Mock()
        originals.download_verified.side_effect = OriginalVerificationFailed("bytes changed")
        pipeline = VideoSessionProxyPipeline(
            sessions=session_store, originals=originals, derived=Mock(), ffmpeg="ffmpeg", ffprobe="ffprobe",
        )

        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(OriginalVerificationFailed):
                pipeline.run(make_request(), Path(directory))

        self.assertEqual(session_store.failed["code"], "original-verification-failed")
        self.assertIsNone(session_store.completed)

    def test_an_unclassified_processing_failure_is_transient_and_never_recorded_as_terminal(self):
        session_store = FakeSessionStore(ProxyClaim(
            lease_id="lease-1",
            cached_manifest=None,
            cached_failure=None,
            original_ref=original_receipt(),
        ))
        originals = Mock()
        originals.download_verified.side_effect = RuntimeError("GCS hiccup")
        pipeline = VideoSessionProxyPipeline(
            sessions=session_store, originals=originals, derived=Mock(), ffmpeg="ffmpeg", ffprobe="ffprobe",
        )

        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ProxyPipelineConfigurationError):
                pipeline.run(make_request(), Path(directory))

        # Must NOT be recorded as a permanent failure — the whole point is that
        # a later retry (after lease expiry) gets to try again.
        self.assertIsNone(session_store.failed)
        self.assertIsNone(session_store.completed)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg fixture tools unavailable")
class PipelineCancellationCleanupTests(unittest.TestCase):
    def test_cancellation_wins_manifest_commit_and_deletes_only_this_jobs_derived_generations(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "original.mp4"
            subprocess.run([
                shutil.which("ffmpeg"), "-y", "-v", "error",
                "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=1",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                "-shortest", str(source),
            ], check=True)
            session_store = FakeSessionStore(
                ProxyClaim(
                    lease_id="lease-1",
                    cached_manifest=None,
                    cached_failure=None,
                    original_ref=original_receipt(),
                ),
                complete_outcome={"discarded": True, "terminalStatus": "cancelled"},
            )
            derived_store = FakeDerivedMediaStore()
            pipeline = VideoSessionProxyPipeline(
                sessions=session_store,
                originals=FakeOriginalMediaStore(source),
                derived=derived_store,
                ffmpeg=shutil.which("ffmpeg"),
                ffprobe=shutil.which("ffprobe"),
            )

            result = pipeline.run(make_request(), root)

            self.assertEqual(result, {
                "status": "discarded",
                "reused": True,
                "terminalStatus": "cancelled",
            })
            self.assertEqual(len(derived_store.deletes), 7)
            self.assertTrue(all(
                deletion["ref"]["path"].startswith(
                    f"session-media/artist-1/{SESSION_ID}/proxy/{JOB_ID}/"
                )
                for deletion in derived_store.deletes
            ))
            self.assertTrue(all(
                deletion["ref"]["path"] != REQUEST_DATA["path"]
                for deletion in derived_store.deletes
            ))


if __name__ == "__main__":
    unittest.main()
