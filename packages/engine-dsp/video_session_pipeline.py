from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from google.api_core.exceptions import Conflict, PreconditionFailed
from google.cloud import firestore, storage
from pydantic import BaseModel, ConfigDict, Field, model_validator

from video_pipeline import require_ffmpeg, transcode_session_media

SHA256_PATTERN = r"^[a-f0-9]{64}$"
GENERATION_PATTERN = r"^[1-9][0-9]{0,29}$"
BUCKET_PATTERN = r"^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$"

# Deliberately less than the dispatcher's Cloud Tasks `dispatchDeadline`
# (1_800s / 30 min, `dispatchSessionProxyJob.ts`). If a worker instance dies
# mid-job, this lease reads as expired by the time Cloud Tasks' own retry
# arrives, so the retry can safely take over rather than being told "in
# progress" forever. Mirrors `pipeline.py`'s `LEASE_DURATION` for the audio
# worker (35 min there; shorter here because video transcoding that legitimately
# needs longer than 25 min for one session is itself something to catch, not
# paper over with a longer lease).
LEASE_DURATION = timedelta(minutes=25)

WORKER_VERSION = "session-proxy-ffmpeg.v1"


class ProxyPipelineConfigurationError(RuntimeError):
    """The worker itself is misconfigured (missing bucket, etc)."""


class SessionNotFound(RuntimeError):
    """The video session document does not exist."""


class ProxyJobConflict(ValueError):
    """This request's jobId does not match the session's dispatched claim.

    Permanent: retrying the identical request will never resolve this — the
    request itself is bound to a job the session no longer recognizes (a
    foreign or stale delivery).
    """


class ProxyJobInProgress(RuntimeError):
    """Another attempt currently holds an unexpired lease on this job."""


class OriginalVerificationFailed(ValueError):
    """The live GCS object no longer matches the original's claimed identity."""


class VideoProxyRequest(BaseModel):
    """Mirrors the exact payload `dispatchSessionProxyJob.ts` POSTs to `/proxy`."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    session_id: str = Field(alias="sessionId", min_length=1, max_length=256)
    owner_uid: str = Field(alias="ownerUid", min_length=1, max_length=256)
    organization_id: str = Field(alias="organizationId", min_length=1, max_length=256)
    project_id: str = Field(alias="projectId", min_length=1, max_length=256)
    bucket: str = Field(min_length=3, max_length=222)
    path: str = Field(min_length=1, max_length=1024)
    generation: str = Field(pattern=GENERATION_PATTERN)
    sha256: str = Field(pattern=SHA256_PATTERN)
    mime_type: str = Field(alias="mimeType", min_length=3, max_length=255)
    byte_size: int = Field(alias="byteSize", gt=0)
    job_id: str = Field(alias="jobId", min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_storage_identity(self) -> "VideoProxyRequest":
        if not re.fullmatch(BUCKET_PATTERN, self.bucket):
            raise ValueError("bucket is invalid")
        expected_path = re.escape(
            f"session-media/{self.owner_uid}/{self.session_id}/original/{self.sha256}"
        )
        if not re.fullmatch(rf"{expected_path}\.(?:mp4|mov|webm|m4v)", self.path):
            raise ValueError(
                "path must identify this owner's immutable original for this session and SHA-256"
            )
        return self


@dataclass(frozen=True)
class ProxyClaim:
    """What `claim()` hands back to the caller."""

    lease_id: str | None
    cached_manifest: dict[str, Any] | None
    cached_failure: dict[str, Any] | None
    original_ref: dict[str, Any] | None = None


def _iso(moment: datetime) -> str:
    """UTC, `Z`-suffixed — the shared Zod schemas' `z.string().datetime()`
    defaults to requiring the literal `Z`, not a `+00:00` offset."""
    return moment.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()[:48]
    return f"{prefix}-{digest}"


class VideoSessionProxyStore(Protocol):
    def claim(self, request: VideoProxyRequest) -> ProxyClaim: ...

    def complete(self, request: VideoProxyRequest, lease_id: str, manifest: dict[str, Any]) -> dict[str, Any]: ...

    def fail(self, request: VideoProxyRequest, lease_id: str, code: str, message: str) -> None: ...


class FirestoreVideoSessionProxyStore:
    """Owns `videoSessions/{sessionId}`'s proxy lifecycle.

    Field names match the TS side exactly (`proxyJob`, `originalGeneration`,
    `originalSha256`, `leaseId`, `leaseExpiresAt`, `proxyManifest`, `status`,
    `completedAt`, `failedAt`, `terminalReceiptId`, `failure`, `updatedAt`) —
    verified against `packages/shared/src/schemas/sessionMedia.ts`'s
    `VideoSessionSchema`/`ProxyJobClaimSchema`, which is `.strict()` and is
    parsed against this exact document client-side.
    """

    def __init__(self, client: firestore.Client):
        self._client = client

    def _reference(self, session_id: str):
        return self._client.collection("videoSessions").document(session_id)

    def claim(self, request: VideoProxyRequest) -> ProxyClaim:
        reference = self._reference(request.session_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)
        lease_id = uuid.uuid4().hex

        @firestore.transactional
        def claim_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            if not snapshot.exists:
                raise SessionNotFound(f"Video session {request.session_id} does not exist")
            session = snapshot.to_dict() or {}
            proxy_job = session.get("proxyJob") or {}
            original = session.get("original") or {}

            if proxy_job.get("jobId") != request.job_id:
                raise ProxyJobConflict(
                    "This request's jobId does not match the session's dispatched proxy job"
                )

            expected_session_identity = {
                "ownerUid": request.owner_uid,
                "organizationId": request.organization_id,
                "projectId": request.project_id,
            }
            for field, expected in expected_session_identity.items():
                if session.get(field) != expected:
                    raise ProxyJobConflict(
                        f"This request's {field} does not match the persisted video session"
                    )

            expected_original_identity = {
                "ownerUid": request.owner_uid,
                "organizationId": request.organization_id,
                "projectId": request.project_id,
                "bucket": request.bucket,
                "path": request.path,
                "generation": request.generation,
                "sha256": request.sha256,
                "mimeType": request.mime_type,
                "byteSize": request.byte_size,
            }
            for field, expected in expected_original_identity.items():
                if original.get(field) != expected:
                    raise ProxyJobConflict(
                        f"This request's original {field} does not match the immutable receipt"
                    )
            if (
                proxy_job.get("originalGeneration") != request.generation
                or proxy_job.get("originalSha256") != request.sha256
            ):
                raise ProxyJobConflict(
                    "This request does not match the original identity bound to the proxy job"
                )

            status = session.get("status")

            if status == "completed":
                manifest = session.get("proxyManifest")
                manifested_original = manifest.get("original") if manifest else None
                if (
                    manifest
                    and manifested_original
                    and manifested_original.get("generation") == request.generation
                    and manifested_original.get("sha256") == request.sha256
                ):
                    return ProxyClaim(
                        lease_id=None,
                        cached_manifest=manifest,
                        cached_failure=None,
                        original_ref=original,
                    )
                # Completed for a DIFFERENT original than this request claims —
                # a foreign/stale delivery slipping past the jobId check above
                # would be a real identity confusion; fail closed rather than
                # silently accept it as a replay.
                raise ProxyJobConflict(
                    "Session is already completed for a different original than this request"
                )

            if status == "failed":
                # Permanently done. Returning the cached failure (rather than
                # reprocessing) is what stops Cloud Tasks from retrying a job
                # that can never succeed.
                return ProxyClaim(
                    lease_id=None,
                    cached_manifest=None,
                    cached_failure=session.get("failure"),
                    original_ref=original,
                )

            if status == "cancelled":
                raise ProxyJobConflict("A cancelled video session cannot be claimed for processing")
            if status not in ("uploaded", "processing"):
                raise ProxyJobConflict(f"Video session status {status!r} cannot be claimed for processing")
            if proxy_job.get("status") not in ("dispatching", "queued"):
                raise ProxyJobConflict("The persisted proxy job is not dispatchable")

            lease_expires = _as_datetime(proxy_job.get("leaseExpiresAt"))
            lease_active = (
                status == "processing"
                and lease_expires is not None
                and lease_expires > now
            )
            if lease_active:
                raise ProxyJobInProgress("A proxy job attempt is already in progress for this session")

            active_transaction.update(reference, {
                "status": "processing",
                "proxyJob.leaseId": lease_id,
                "proxyJob.leaseExpiresAt": _iso(now + LEASE_DURATION),
                "updatedAt": _iso(now),
            })
            return ProxyClaim(
                lease_id=lease_id,
                cached_manifest=None,
                cached_failure=None,
                original_ref=original,
            )

        return claim_in_transaction(transaction)

    def complete(self, request: VideoProxyRequest, lease_id: str, manifest: dict[str, Any]) -> dict[str, Any]:
        reference = self._reference(request.session_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)
        terminal_receipt_id = _deterministic_id("proxy-complete", request.session_id, request.job_id)

        @firestore.transactional
        def complete_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            session = snapshot.to_dict() or {} if snapshot.exists else {}
            proxy_job = session.get("proxyJob") or {}
            if session.get("status") != "processing" or proxy_job.get("leaseId") != lease_id:
                # A newer attempt already took over (our lease expired and was
                # reclaimed) or the session moved on some other way. Writing
                # this manifest now would race a newer attempt's own write —
                # discard silently rather than clobber it.
                return {"discarded": True, "terminalStatus": session.get("status")}

            active_transaction.update(reference, {
                "status": "completed",
                "proxyManifest": manifest,
                "completedAt": _iso(now),
                "terminalReceiptId": terminal_receipt_id,
                "updatedAt": _iso(now),
                "proxyJob.leaseId": firestore.DELETE_FIELD,
                "proxyJob.leaseExpiresAt": firestore.DELETE_FIELD,
            })
            return {"discarded": False, "terminalReceiptId": terminal_receipt_id}

        return complete_in_transaction(transaction)

    def fail(self, request: VideoProxyRequest, lease_id: str, code: str, message: str) -> None:
        reference = self._reference(request.session_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)
        terminal_receipt_id = _deterministic_id("proxy-failed", request.session_id, request.job_id)

        @firestore.transactional
        def fail_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            session = snapshot.to_dict() or {} if snapshot.exists else {}
            proxy_job = session.get("proxyJob") or {}
            if session.get("status") != "processing" or proxy_job.get("leaseId") != lease_id:
                return

            active_transaction.update(reference, {
                "status": "failed",
                "failure": {"code": code, "message": message[:2000], "retryable": False},
                "failedAt": _iso(now),
                "terminalReceiptId": terminal_receipt_id,
                "updatedAt": _iso(now),
                "proxyJob.leaseId": firestore.DELETE_FIELD,
                "proxyJob.leaseExpiresAt": firestore.DELETE_FIELD,
            })

        fail_in_transaction(transaction)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class OriginalMediaStore:
    """Downloads and re-verifies the finalized original before touching it.

    The dispatch payload's generation/sha256 are what the finalizer observed at
    upload time — this re-checks them against the LIVE object, matching
    `CanonicalMasterStorage.stage`'s pattern in `pipeline.py`. An original that
    changed or vanished between dispatch and processing must fail closed, not
    silently transcode whatever happens to be at that path now.
    """

    def __init__(self, client: storage.Client):
        self._client = client

    def download_verified(self, request: VideoProxyRequest, directory: Path) -> Path:
        blob = self._client.bucket(request.bucket).blob(request.path)
        blob.reload(if_generation_match=int(request.generation))
        if str(blob.generation or "") != request.generation:
            raise OriginalVerificationFailed("Original generation changed since dispatch")
        if int(blob.size or 0) <= 0:
            raise OriginalVerificationFailed("Original object is empty")

        extension = Path(request.path).suffix or ".mp4"
        local_path = directory / f"original{extension}"
        blob.download_to_filename(str(local_path), if_generation_match=int(request.generation), checksum="auto")

        observed_hash = _sha256_file(local_path)
        if observed_hash != request.sha256:
            raise OriginalVerificationFailed("Downloaded original bytes do not match the verified SHA-256")
        return local_path


class DerivedMediaStore:
    """Uploads one worker-produced artifact as a private, generation-pinned,
    hash-verified object — mirrors `promoteImmutable` in
    `finalizeVideoSessionUpload.ts`: `if_generation_match=0` refuses to
    overwrite, and a 409/412 on retry is resolved by reading back the existing
    object and confirming it is the same bytes rather than treating the
    conflict as failure.
    """

    def __init__(self, client: storage.Client, bucket: str):
        self._client = client
        self._bucket = bucket

    def upload(
        self,
        *,
        owner_uid: str,
        session_id: str,
        job_id: str,
        role: str,
        local_path: Path,
        mime_type: str,
        worker_version: str | None = None,
        at_us: int | None = None,
    ) -> dict[str, Any]:
        sha256 = _sha256_file(local_path)
        destination_path = f"session-media/{owner_uid}/{session_id}/proxy/{job_id}/{local_path.name}"
        blob = self._client.bucket(self._bucket).blob(destination_path)
        creation_receipt_id = _deterministic_id("derived", session_id, job_id, role, sha256)

        try:
            blob.upload_from_filename(
                str(local_path),
                content_type=mime_type,
                if_generation_match=0,
                metadata={
                    "immutable": "true",
                    "role": role,
                    "sha256": sha256,
                    "creationReceiptId": creation_receipt_id,
                },
            )
            blob.reload()
        except (PreconditionFailed, Conflict) as error:
            # The `if_generation_match=0` precondition failed — an object
            # already exists at this path. Since the destination is
            # job-scoped, that can only mean a previous attempt for this exact
            # job already uploaded it; verify rather than assume.
            blob.reload()
            existing_metadata = blob.metadata or {}
            if existing_metadata.get("sha256") != sha256:
                raise OriginalVerificationFailed(
                    f"Existing derived object at {destination_path} does not match this job's bytes"
                ) from error

        ref = {
            "ownerUid": owner_uid,
            # organizationId/projectId are filled in by `_canonical_ref`/
            # `_derived_ref`, which have them; this store only knows the owner.
            "bucket": self._bucket,
            "path": destination_path,
            "generation": str(blob.generation),
            "sha256": sha256,
            "mimeType": mime_type,
            "byteSize": local_path.stat().st_size,
            "createdAt": _iso(datetime.now(UTC)),
            "creationReceiptId": creation_receipt_id,
        }
        if worker_version is not None:
            ref["workerVersion"] = worker_version
        if at_us is not None:
            ref["atUs"] = at_us
        return ref

    def delete(
        self,
        ref: dict[str, Any],
        *,
        owner_uid: str,
        session_id: str,
        job_id: str,
    ) -> None:
        expected_prefix = f"session-media/{owner_uid}/{session_id}/proxy/{job_id}/"
        if (
            ref.get("bucket") != self._bucket
            or not isinstance(ref.get("path"), str)
            or not ref["path"].startswith(expected_prefix)
            or not re.fullmatch(GENERATION_PATTERN, str(ref.get("generation", "")))
        ):
            raise OriginalVerificationFailed("Refusing to delete a malformed derived object identity")
        try:
            self._client.bucket(self._bucket).blob(ref["path"]).delete(
                if_generation_match=int(ref["generation"]),
            )
        except Exception as error:
            if int(getattr(error, "code", 0) or 0) != 404:
                raise


def _canonical_ref(base: dict[str, Any], role: str, organization_id: str, project_id: str) -> dict[str, Any]:
    return {
        **{key: value for key, value in base.items() if key not in ("workerVersion", "atUs")},
        "schemaVersion": "canonical-media-ref.v1",
        "role": role,
        "organizationId": organization_id,
        "projectId": project_id,
    }


def _derived_ref(base: dict[str, Any], role: str, organization_id: str, project_id: str) -> dict[str, Any]:
    return {
        **base,
        "schemaVersion": "derived-media-ref.v1",
        "role": role,
        "organizationId": organization_id,
        "projectId": project_id,
    }


class VideoSessionProxyPipeline:
    def __init__(
        self,
        sessions: VideoSessionProxyStore,
        originals: OriginalMediaStore,
        derived: DerivedMediaStore,
        ffmpeg: str,
        ffprobe: str,
    ):
        self._sessions = sessions
        self._originals = originals
        self._derived = derived
        self._ffmpeg = ffmpeg
        self._ffprobe = ffprobe

    def run(self, request: VideoProxyRequest, work_directory: Path) -> dict[str, Any]:
        claim = self._sessions.claim(request)
        if claim.cached_manifest is not None:
            return {"status": "completed", "reused": True, "manifest": claim.cached_manifest}
        if claim.cached_failure is not None:
            return {"status": "failed", "reused": True, "failure": claim.cached_failure}

        lease_id = claim.lease_id
        assert lease_id is not None  # claim() always returns exactly one of these three
        original_ref = claim.original_ref
        if original_ref is None:
            raise ProxyJobConflict("The proxy claim did not return the persisted original receipt")

        try:
            original_path = self._originals.download_verified(request, work_directory)
            output_directory = work_directory / "output"
            result = transcode_session_media(original_path, output_directory, self._ffmpeg, self._ffprobe)

            organization_id = request.organization_id
            project_id = request.project_id
            job_id = request.job_id

            proxy_ref = _canonical_ref(
                self._derived.upload(
                    owner_uid=request.owner_uid, session_id=request.session_id, job_id=job_id,
                    role="editing_proxy", local_path=Path(result["artifacts"]["proxy"]["path"]),
                    mime_type="video/mp4",
                ),
                "editing_proxy", organization_id, project_id,
            )
            guide_ref = _canonical_ref(
                self._derived.upload(
                    owner_uid=request.owner_uid, session_id=request.session_id, job_id=job_id,
                    role="guide_audio", local_path=Path(result["artifacts"]["guideAudio"]["path"]),
                    mime_type="audio/wav",
                ),
                "guide_audio", organization_id, project_id,
            )
            waveform_ref = _derived_ref(
                self._derived.upload(
                    owner_uid=request.owner_uid, session_id=request.session_id, job_id=job_id,
                    role="waveform", local_path=Path(result["artifacts"]["waveform"]["path"]),
                    mime_type="application/json", worker_version=WORKER_VERSION,
                ),
                "waveform", organization_id, project_id,
            )
            contact_sheet_ref = _derived_ref(
                self._derived.upload(
                    owner_uid=request.owner_uid, session_id=request.session_id, job_id=job_id,
                    role="contact_sheet", local_path=Path(result["artifacts"]["contactSheet"]["path"]),
                    mime_type="image/jpeg", worker_version=WORKER_VERSION,
                ),
                "contact_sheet", organization_id, project_id,
            )
            thumbnail_refs = [
                _derived_ref(
                    self._derived.upload(
                        owner_uid=request.owner_uid, session_id=request.session_id, job_id=job_id,
                        role="thumbnail", local_path=Path(thumbnail["path"]),
                        mime_type="image/jpeg", worker_version=WORKER_VERSION,
                    ),
                    "thumbnail", organization_id, project_id,
                )
                for thumbnail in result["thumbnails"]
            ]
            uploaded_refs = [
                proxy_ref,
                guide_ref,
                waveform_ref,
                contact_sheet_ref,
                *thumbnail_refs,
            ]

            manifest = {
                "schemaVersion": "proxy-manifest.v1",
                "manifestId": _deterministic_id("manifest", request.session_id, job_id),
                "sessionId": request.session_id,
                "ownerUid": request.owner_uid,
                "organizationId": organization_id,
                "projectId": project_id,
                "original": original_ref,
                "proxy": proxy_ref,
                "guideAudio": guide_ref,
                "inspection": result["inspection"],
                "timeMap": result["timeMap"],
                "waveform": waveform_ref,
                "thumbnails": thumbnail_refs,
                "contactSheet": contact_sheet_ref,
                "workerVersion": result["workerVersion"],
                "createdAt": _iso(datetime.now(UTC)),
                "processingReceiptId": _deterministic_id("processing", request.session_id, job_id),
            }
        except OriginalVerificationFailed as error:
            self._sessions.fail(request, lease_id, "original-verification-failed", str(error))
            raise
        except Exception as error:  # transcode/ffmpeg/upload failure
            # Unclassified: treat as transient. Do NOT call fail() — that would
            # permanently close the session over what might be a passing GCS
            # blip or an ffmpeg OOM on this instance. Let it propagate so the
            # HTTP layer returns 5xx and Cloud Tasks retries; the lease expiry
            # (LEASE_DURATION) is what makes that retry safe to actually
            # reprocess rather than being told "in progress" forever.
            raise ProxyPipelineConfigurationError(f"Proxy processing failed: {error}") from error

        outcome = self._sessions.complete(request, lease_id, manifest)
        if outcome.get("discarded"):
            if outcome.get("terminalStatus") == "cancelled":
                for ref in uploaded_refs:
                    self._derived.delete(
                        ref,
                        owner_uid=request.owner_uid,
                        session_id=request.session_id,
                        job_id=request.job_id,
                    )
            # Cancellation or a newer lease won while we were working. The
            # session document is authoritative; never report our uncommitted
            # manifest as completed.
            return {
                "status": "discarded",
                "reused": True,
                "terminalStatus": outcome.get("terminalStatus"),
            }
        return {"status": "completed", "reused": False, "manifest": manifest}


def build_pipeline_from_environment(
    env: dict[str, str],
    firestore_client: firestore.Client | None = None,
    storage_client: storage.Client | None = None,
) -> VideoSessionProxyPipeline:
    bucket = env.get("SESSION_MEDIA_BUCKET", "").strip()
    if not bucket:
        raise ProxyPipelineConfigurationError("SESSION_MEDIA_BUCKET is not configured")

    ffmpeg, ffprobe = require_ffmpeg()
    fs_client = firestore_client or firestore.Client()
    gcs_client = storage_client or storage.Client()

    return VideoSessionProxyPipeline(
        sessions=FirestoreVideoSessionProxyStore(fs_client),
        originals=OriginalMediaStore(gcs_client),
        derived=DerivedMediaStore(gcs_client, bucket),
        ffmpeg=ffmpeg,
        ffprobe=ffprobe,
    )
