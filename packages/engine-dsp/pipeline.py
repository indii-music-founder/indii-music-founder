from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any, Protocol

import librosa
import numpy as np
import soundfile as sf
from google import genai
from google.cloud import firestore, storage
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
GENERATION_PATTERN = re.compile(r"^[1-9][0-9]{0,29}$")
BUCKET_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$")
ORIGINAL_AUDIO_PATTERN = re.compile(r"^original\.(wav|flac)$")
MAX_MASTER_BYTES = 500 * 1024 * 1024
LEASE_DURATION = timedelta(minutes=35)
ENGINE_VERSION = "2026-07-17.1"


class PipelineConfigurationError(RuntimeError):
    pass


class CanonicalMasterRejected(ValueError):
    pass


class AnalysisInProgress(RuntimeError):
    pass


class StaleAnalysisLease(RuntimeError):
    pass


class IngestionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    storage_bucket: str = Field(alias="storageBucket", min_length=3, max_length=222)
    storage_path: str = Field(alias="storagePath", min_length=1, max_length=1024)
    master_fingerprint: str = Field(alias="masterFingerprint", min_length=1, max_length=256)
    content_hash: str = Field(alias="contentHash", pattern=SHA256_PATTERN)
    generation: str = Field(pattern=GENERATION_PATTERN)
    owner_id: str = Field(alias="ownerId", min_length=1, max_length=128)

    @model_validator(mode="after")
    def validate_canonical_identity(self) -> "IngestionRequest":
        if not BUCKET_PATTERN.fullmatch(self.storage_bucket):
            raise ValueError("storageBucket is invalid")
        expected_path = f"masters/{self.owner_id}/{self.content_hash}/"
        path_parts = self.storage_path.split("/")
        if (
            not self.storage_path.startswith(expected_path)
            or len(path_parts) != 4
            or not ORIGINAL_AUDIO_PATTERN.fullmatch(path_parts[3])
        ):
            raise ValueError("storagePath does not match the owner and content hash")
        return self


class MarketingMoment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str = Field(max_length=16)
    end: str = Field(max_length=16)
    description: str = Field(max_length=280)


class GeminiMusicProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(max_length=1200)
    genres: list[Annotated[str, Field(max_length=80)]] = Field(max_length=8)
    moods: list[Annotated[str, Field(max_length=80)]] = Field(max_length=12)
    instrumentation: list[Annotated[str, Field(max_length=120)]] = Field(max_length=24)
    vocal_description: str = Field(max_length=800)
    language: str = Field(max_length=80)
    clean_or_explicit_signal: str = Field(max_length=240)
    marketing_moments: list[MarketingMoment] = Field(max_length=8)


@dataclass(frozen=True)
class StagedMaster:
    local_path: Path
    gs_uri: str
    mime_type: str
    size_bytes: int
    sample_rate: int
    bit_depth: int
    channels: int
    frames: int
    duration_seconds: float
    container: str
    codec: str


@dataclass(frozen=True)
class AnalysisClaim:
    lease_id: str | None
    cached_receipt: dict[str, Any] | None


class ReceiptStore(Protocol):
    def claim(self, request: IngestionRequest) -> AnalysisClaim: ...

    def complete(
        self,
        request: IngestionRequest,
        lease_id: str,
        staged: StagedMaster,
        dsp_profile: dict[str, Any],
        gemini_profile: dict[str, Any],
        gemini_model: str,
    ) -> dict[str, Any]: ...

    def fail(self, request: IngestionRequest, lease_id: str, error: Exception) -> None: ...


def _receipt_id(request: IngestionRequest) -> str:
    identity = f"{request.owner_id}\0{request.content_hash}\0{request.generation}"
    return f"audio_{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:48]}"


class FirestoreReceiptStore:
    """Server-owned idempotency and provenance receipts.

    Documents live at ``audio_analysis_receipts/{receiptId}``. Clients may only
    read receipts whose immutable ``userId`` matches their authenticated UID;
    Admin SDK workers own every write and lease transition.
    """

    def __init__(self, client: firestore.Client):
        self._client = client

    def _reference(self, request: IngestionRequest):
        return self._client.collection("audio_analysis_receipts").document(_receipt_id(request))

    def claim(self, request: IngestionRequest) -> AnalysisClaim:
        reference = self._reference(request)
        transaction = self._client.transaction()
        now = datetime.now(UTC)
        lease_id = uuid.uuid4().hex

        @firestore.transactional
        def claim_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            existing = snapshot.to_dict() if snapshot.exists else None
            if existing and existing.get("status") == "complete":
                if (
                    existing.get("userId") == request.owner_id
                    and existing.get("contentHash") == request.content_hash
                    and str(existing.get("generation")) == request.generation
                ):
                    return AnalysisClaim(lease_id=None, cached_receipt=existing)
                raise CanonicalMasterRejected("Analysis receipt identity collision")

            lease_expires_at = existing.get("leaseExpiresAt") if existing else None
            if (
                existing
                and existing.get("status") == "processing"
                and isinstance(lease_expires_at, datetime)
                and lease_expires_at > now
            ):
                raise AnalysisInProgress("Canonical master analysis is already in progress")

            active_transaction.set(
                reference,
                {
                    "receiptId": reference.id,
                    "userId": request.owner_id,
                    "storageBucket": request.storage_bucket,
                    "storagePath": request.storage_path,
                    "masterFingerprint": request.master_fingerprint,
                    "contentHash": request.content_hash,
                    "generation": request.generation,
                    "status": "processing",
                    "leaseId": lease_id,
                    "leaseExpiresAt": now + LEASE_DURATION,
                    "engineVersion": ENGINE_VERSION,
                    "createdAt": existing.get("createdAt", now) if existing else now,
                    "updatedAt": now,
                },
            )
            return AnalysisClaim(lease_id=lease_id, cached_receipt=None)

        return claim_in_transaction(transaction)

    def complete(
        self,
        request: IngestionRequest,
        lease_id: str,
        staged: StagedMaster,
        dsp_profile: dict[str, Any],
        gemini_profile: dict[str, Any],
        gemini_model: str,
    ) -> dict[str, Any]:
        reference = self._reference(request)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def complete_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            existing = snapshot.to_dict() if snapshot.exists else None
            if not existing or existing.get("leaseId") != lease_id:
                raise StaleAnalysisLease("Analysis lease no longer owns this receipt")
            receipt = {
                **existing,
                "status": "complete",
                "technical": {
                    "container": staged.container,
                    "codec": staged.codec,
                    "sampleRate": staged.sample_rate,
                    "bitDepth": staged.bit_depth,
                    "channels": staged.channels,
                    "frames": staged.frames,
                    "durationSeconds": staged.duration_seconds,
                    "sizeBytes": staged.size_bytes,
                },
                "openSourceProfile": dsp_profile,
                "geminiProfile": gemini_profile,
                "geminiModel": gemini_model,
                "completedAt": now,
                "updatedAt": now,
                "leaseId": None,
                "leaseExpiresAt": None,
            }
            active_transaction.set(reference, receipt)
            return receipt

        return complete_in_transaction(transaction)

    def fail(self, request: IngestionRequest, lease_id: str, error: Exception) -> None:
        reference = self._reference(request)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def fail_in_transaction(active_transaction):
            snapshot = reference.get(transaction=active_transaction)
            existing = snapshot.to_dict() if snapshot.exists else None
            if not existing or existing.get("leaseId") != lease_id:
                return
            active_transaction.update(
                reference,
                {
                    "status": "failed",
                    "failureType": type(error).__name__[:120],
                    "failureMessage": str(error)[:1000],
                    "failedAt": now,
                    "updatedAt": now,
                    "leaseId": None,
                    "leaseExpiresAt": None,
                },
            )

        fail_in_transaction(transaction)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as audio_file:
        for chunk in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _technical_properties(path: Path, mime_type: str, size_bytes: int) -> StagedMaster:
    try:
        info = sf.info(str(path))
    except (RuntimeError, TypeError) as error:
        raise CanonicalMasterRejected(f"Master audio cannot be decoded: {error}") from error

    expected_format = "WAV" if mime_type == "audio/wav" else "FLAC"
    if info.format != expected_format:
        raise CanonicalMasterRejected(
            f"Stored MIME type {mime_type} does not match decoded {info.format or 'unknown'} container"
        )
    subtype_depth = {"PCM_16": 16, "PCM_24": 24}
    bit_depth = subtype_depth.get(info.subtype)
    if bit_depth is None:
        raise CanonicalMasterRejected(f"Unsupported canonical master codec/subtype: {info.subtype}")
    if info.channels != 2:
        raise CanonicalMasterRejected("Canonical master must be stereo")
    if info.samplerate < 44_100:
        raise CanonicalMasterRejected("Canonical master sample rate must be at least 44.1 kHz")
    if info.frames <= 0 or not math.isfinite(info.duration) or info.duration <= 0:
        raise CanonicalMasterRejected("Canonical master duration is invalid")

    return StagedMaster(
        local_path=path,
        gs_uri="",
        mime_type=mime_type,
        size_bytes=size_bytes,
        sample_rate=int(info.samplerate),
        bit_depth=bit_depth,
        channels=int(info.channels),
        frames=int(info.frames),
        duration_seconds=float(info.duration),
        container=info.format.lower(),
        codec="flac" if info.format == "FLAC" else info.subtype.lower(),
    )


class CanonicalMasterStorage:
    def __init__(self, client: storage.Client, allowed_bucket: str):
        if not allowed_bucket or not BUCKET_PATTERN.fullmatch(allowed_bucket):
            raise PipelineConfigurationError("MASTER_AUDIO_BUCKET is missing or invalid")
        self._client = client
        self._allowed_bucket = allowed_bucket

    def _blob(self, request: IngestionRequest):
        if request.storage_bucket != self._allowed_bucket:
            raise CanonicalMasterRejected("Storage bucket is not the configured canonical-master bucket")
        bucket = self._client.bucket(request.storage_bucket)
        return bucket.blob(request.storage_path)

    def stage(self, request: IngestionRequest, directory: Path) -> StagedMaster:
        blob = self._blob(request)
        expected_generation = int(request.generation)
        blob.reload(if_generation_match=expected_generation)
        metadata = blob.metadata or {}
        content_type = blob.content_type or ""
        size_bytes = int(blob.size or 0)
        issues = [
            "owner metadata does not match" if metadata.get("ownerId") != request.owner_id else "",
            "content-hash metadata does not match"
            if metadata.get("contentHash") != request.content_hash
            else "",
            "master fingerprint metadata does not match"
            if metadata.get("masterFingerprint") != request.master_fingerprint
            else "",
            "immutable metadata is missing" if metadata.get("immutable") != "true" else "",
            "stored generation does not match"
            if str(blob.generation or "") != request.generation
            else "",
            "unsupported stored audio MIME type"
            if content_type not in {"audio/wav", "audio/flac"}
            else "",
            "stored master size is invalid"
            if size_bytes <= 0 or size_bytes > MAX_MASTER_BYTES
            else "",
        ]
        rejected = [issue for issue in issues if issue]
        if rejected:
            raise CanonicalMasterRejected("; ".join(rejected))

        extension = ".wav" if content_type == "audio/wav" else ".flac"
        local_path = directory / f"canonical-master{extension}"
        blob.download_to_filename(
            str(local_path),
            if_generation_match=expected_generation,
            checksum="auto",
        )
        observed_hash = _sha256_file(local_path)
        if observed_hash != request.content_hash:
            raise CanonicalMasterRejected("Downloaded master bytes do not match the verified SHA-256")

        technical = _technical_properties(local_path, content_type, size_bytes)
        return replace(
            technical,
            gs_uri=f"gs://{request.storage_bucket}/{request.storage_path}",
        )

    def assert_generation(self, request: IngestionRequest) -> None:
        blob = self._blob(request)
        blob.reload(if_generation_match=int(request.generation))
        if str(blob.generation or "") != request.generation:
            raise CanonicalMasterRejected("Canonical master generation changed during analysis")


def build_open_source_profile(staged: StagedMaster) -> dict[str, Any]:
    sample_count = 0
    square_sum = 0.0
    peak = 0.0
    clipping_samples = 0
    zero_crossings = 0
    previous_mono: float | None = None
    previous_block_rms: float | None = None
    transient_energy = 0.0

    for block in sf.blocks(
        str(staged.local_path),
        blocksize=65_536,
        dtype="float32",
        always_2d=True,
    ):
        if block.size == 0:
            continue
        absolute = np.abs(block)
        peak = max(peak, float(np.max(absolute)))
        clipping_samples += int(np.count_nonzero(absolute >= 0.999))
        square_sum += float(np.sum(np.square(block, dtype=np.float64)))
        sample_count += int(block.size)

        mono = np.mean(block, axis=1, dtype=np.float64)
        if previous_mono is not None and mono.size and ((previous_mono >= 0) != (mono[0] >= 0)):
            zero_crossings += 1
        if mono.size > 1:
            zero_crossings += int(np.count_nonzero(np.signbit(mono[1:]) != np.signbit(mono[:-1])))
            previous_mono = float(mono[-1])
        block_rms = float(np.sqrt(np.mean(np.square(mono)))) if mono.size else 0.0
        if previous_block_rms is not None:
            transient_energy += abs(block_rms - previous_block_rms)
        previous_block_rms = block_rms

    if sample_count <= 0:
        raise CanonicalMasterRejected("Canonical master contains no decodable samples")
    rms = math.sqrt(square_sum / sample_count)
    rms_dbfs = 20.0 * math.log10(max(rms, 1e-12))
    clipping_ratio = clipping_samples / sample_count

    analysis_audio, analysis_rate = librosa.load(
        str(staged.local_path),
        sr=22_050,
        mono=True,
        duration=600.0,
    )
    if analysis_audio.size:
        tempo, beat_frames = librosa.beat.beat_track(y=analysis_audio, sr=analysis_rate)
        tempo_bpm = float(np.asarray(tempo).reshape(-1)[0])
        beat_count = int(np.asarray(beat_frames).size)
    else:
        tempo_bpm = 0.0
        beat_count = 0

    return {
        "analyzer": "librosa+soundfile",
        "analyzerVersion": ENGINE_VERSION,
        "tempoBpm": round(tempo_bpm, 4),
        "beatCountFirstTenMinutes": beat_count,
        "peakLinear": round(peak, 8),
        "rmsDbfs": round(rms_dbfs, 4),
        "clippingSampleRatio": round(clipping_ratio, 10),
        "zeroCrossingRate": round(zero_crossings / max(staged.frames, 1), 10),
        "blockTransientEnergy": round(transient_energy, 8),
        "tempoAnalysisSeconds": min(staged.duration_seconds, 600.0),
    }


class GeminiAudioAnalyzer:
    def __init__(self, client: genai.Client, model: str):
        if not model.strip():
            raise PipelineConfigurationError("GEMINI_AUDIO_MODEL is missing")
        self._client = client
        self.model = model.strip()

    def analyze(self, staged: StagedMaster) -> dict[str, Any]:
        prompt = (
            "Analyze this canonical music master for reusable artist intelligence. "
            "Describe only what is audible. Identify likely genres, moods, instrumentation, "
            "vocal characteristics/language, and up to eight timestamped moments useful for "
            "short-form marketing or video editing. For clean_or_explicit_signal, report only "
            "audible evidence and say uncertain when uncertain. Do not infer copyright ownership, "
            "registrations, royalty splits, identities, or legal rights."
        )
        response = self._client.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_uri(file_uri=staged.gs_uri, mime_type=staged.mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiMusicProfile.model_json_schema(),
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned no audio analysis")
        try:
            return GeminiMusicProfile.model_validate_json(response.text).model_dump(
                mode="json", by_alias=True
            )
        except (ValidationError, json.JSONDecodeError) as error:
            raise RuntimeError("Gemini returned an invalid audio-analysis schema") from error


class AudioAnalysisPipeline:
    def __init__(
        self,
        receipt_store: ReceiptStore,
        master_storage: CanonicalMasterStorage,
        gemini_analyzer: GeminiAudioAnalyzer,
    ):
        self._receipt_store = receipt_store
        self._master_storage = master_storage
        self._gemini_analyzer = gemini_analyzer

    def run(self, request: IngestionRequest) -> dict[str, Any]:
        claim = self._receipt_store.claim(request)
        if claim.cached_receipt is not None:
            return claim.cached_receipt
        if not claim.lease_id:
            raise StaleAnalysisLease("Analysis claim did not return an active lease")

        try:
            with tempfile.TemporaryDirectory(prefix="indii-master-analysis-") as directory:
                staged = self._master_storage.stage(request, Path(directory))
                dsp_profile = build_open_source_profile(staged)
                gemini_profile = self._gemini_analyzer.analyze(staged)
                self._master_storage.assert_generation(request)
                return self._receipt_store.complete(
                    request,
                    claim.lease_id,
                    staged,
                    dsp_profile,
                    gemini_profile,
                    self._gemini_analyzer.model,
                )
        except Exception as error:
            self._receipt_store.fail(request, claim.lease_id, error)
            raise


def build_pipeline_from_environment() -> AudioAnalysisPipeline:
    project = (os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT") or "").strip()
    if not project:
        raise PipelineConfigurationError("GOOGLE_CLOUD_PROJECT is missing")
    allowed_bucket = os.environ.get("MASTER_AUDIO_BUCKET", "").strip()
    model = os.environ.get("GEMINI_AUDIO_MODEL", "gemini-3-flash-preview").strip()
    location = os.environ.get("VERTEX_LOCATION", "global").strip()
    if not location:
        raise PipelineConfigurationError("VERTEX_LOCATION is missing")

    storage_client = storage.Client(project=project)
    firestore_client = firestore.Client(project=project)
    gemini_client = genai.Client(vertexai=True, project=project, location=location)
    return AudioAnalysisPipeline(
        FirestoreReceiptStore(firestore_client),
        CanonicalMasterStorage(storage_client, allowed_bucket),
        GeminiAudioAnalyzer(gemini_client, model),
    )
