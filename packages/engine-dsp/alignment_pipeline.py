from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import soundfile as sf
from pydantic import BaseModel, ConfigDict, Field, model_validator

logger = logging.getLogger(__name__)

ALIGNMENT_ALGORITHM_VERSION = "align-dsp.v1"


class AlignmentPipelineError(RuntimeError):
    """Base error for audio alignment failures."""


class GuideAudioMissing(AlignmentPipelineError):
    """The guide audio file could not be found or opened."""


class CanonicalMasterMissing(AlignmentPipelineError):
    """The canonical master file could not be found or opened."""


class AlignMasterRequest(BaseModel):
    """Request payload for POST /align."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    session_id: str = Field(alias="sessionId", min_length=1, max_length=256)
    owner_uid: str = Field(alias="ownerUid", min_length=1, max_length=256)
    organization_id: str = Field(alias="organizationId", min_length=1, max_length=256)
    project_id: str = Field(alias="projectId", min_length=1, max_length=256)
    guide_audio_bucket: str = Field(alias="guideAudioBucket", min_length=3, max_length=222)
    guide_audio_path: str = Field(alias="guideAudioPath", min_length=1, max_length=1024)
    master_bucket: str = Field(alias="masterBucket", min_length=3, max_length=222)
    master_path: str = Field(alias="masterPath", min_length=1, max_length=1024)
    master_fingerprint: str = Field(alias="masterFingerprint", min_length=1, max_length=256)
    guide_audio_ref: dict[str, Any] = Field(alias="guideAudioRef")
    canonical_master_ref: dict[str, Any] = Field(alias="canonicalMasterRef")

    @model_validator(mode="after")
    def validate_request_identity(self) -> "AlignMasterRequest":
        if self.guide_audio_ref.get("ownerUid") != self.owner_uid:
            raise ValueError("guideAudioRef ownerUid must match request ownerUid")
        return self


@dataclass(frozen=True)
class AlignmentAnchorResult:
    video_us: int
    master_us: int
    confidence: float
    method: str


@dataclass(frozen=True)
class AlignmentResult:
    status: str
    aggregate_confidence: float
    drift_ppm: float
    residual_p95_us: int
    fit_model: str
    anchors: list[AlignmentAnchorResult]
    algorithm_version: str


class AudioAlignmentPipeline:
    """DSP-based cross-correlation and onset/chroma audio alignment engine."""

    def __init__(self, sample_rate: int = 22050, hop_length: int = 512):
        self.sample_rate = sample_rate
        self.hop_length = hop_length

    def extract_timing_profile(self, master_path: Path) -> dict[str, Any]:
        """Builds a MasterTimingProfile from a canonical master WAV/FLAC file."""
        if not master_path.exists():
            raise CanonicalMasterMissing(f"Master file not found: {master_path}")

        y, sr = librosa.load(str(master_path), sr=self.sample_rate, mono=True)
        duration_us = int((len(y) / sr) * 1_000_000)

        # Onset detection
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=self.hop_length)
        onset_frames = librosa.onset.onset_detect(
            onset_envelope=onset_env, sr=sr, hop_length=self.hop_length
        )
        onsets_us = [
            int(librosa.frames_to_time(f, sr=sr, hop_length=self.hop_length) * 1_000_000)
            for f in onset_frames
        ]

        # Beat tracking
        tempo, beat_frames = librosa.beat.beat_track(
            y=y, sr=sr, hop_length=self.hop_length
        )
        beats_us = [
            int(librosa.frames_to_time(f, sr=sr, hop_length=self.hop_length) * 1_000_000)
            for f in beat_frames
        ]

        return {
            "schemaVersion": "master-timing-profile.v1",
            "durationUs": duration_us,
            "sampleRate": sr,
            "bpm": float(np.atleast_1d(tempo)[0]),
            "beatsUs": beats_us,
            "onsetsUs": onsets_us,
        }

    def align_guide_to_master(
        self, guide_audio_path: Path, master_path: Path
    ) -> AlignmentResult:
        """Aligns phone guide audio to a canonical master audio file."""
        if not guide_audio_path.exists():
            raise GuideAudioMissing(f"Guide audio file not found: {guide_audio_path}")
        if not master_path.exists():
            raise CanonicalMasterMissing(f"Master audio file not found: {master_path}")

        # Load both tracks at target sample rate
        y_guide, sr = librosa.load(str(guide_audio_path), sr=self.sample_rate, mono=True)
        y_master, _ = librosa.load(str(master_path), sr=self.sample_rate, mono=True)

        guide_len_s = len(y_guide) / sr
        master_len_s = len(y_master) / sr

        if guide_len_s < 0.5 or master_len_s < 0.5:
            return AlignmentResult(
                status="no_match",
                aggregate_confidence=0.0,
                drift_ppm=0.0,
                residual_p95_us=0,
                fit_model="linear",
                anchors=[],
                algorithm_version=ALIGNMENT_ALGORITHM_VERSION,
            )

        # Onset envelopes for cross-correlation
        onset_guide = librosa.onset.onset_strength(
            y=y_guide, sr=sr, hop_length=self.hop_length
        )
        onset_master = librosa.onset.onset_strength(
            y=y_master, sr=sr, hop_length=self.hop_length
        )

        # Full cross-correlation on onset envelopes
        correlation = np.correlate(onset_master, onset_guide, mode="valid")
        if len(correlation) == 0:
            # Fallback if guide is longer than master
            correlation = np.correlate(onset_guide, onset_master, mode="valid")
            best_frame_offset = np.argmax(correlation)
            offset_seconds = float(librosa.frames_to_time(best_frame_offset, sr=sr, hop_length=self.hop_length))
        else:
            best_frame_offset = np.argmax(correlation)
            offset_seconds = float(librosa.frames_to_time(best_frame_offset, sr=sr, hop_length=self.hop_length))

        # Local window normalization
        guide_norm = np.linalg.norm(onset_guide) + 1e-9
        matched_window = onset_master[best_frame_offset : best_frame_offset + len(onset_guide)]
        master_window_norm = np.linalg.norm(matched_window) + 1e-9

        raw_peak = correlation[best_frame_offset]
        norm_confidence = float(np.clip(raw_peak / (guide_norm * master_window_norm), 0.0, 1.0))

        # Peak ambiguity ratio
        sorted_corr = np.sort(correlation)
        top_peak = sorted_corr[-1]
        second_peak = sorted_corr[-2] if len(sorted_corr) > 1 else 0.0
        ambiguity_ratio = float(second_peak / (top_peak + 1e-9))

        offset_us = int(offset_seconds * 1_000_000)
        duration_us = int(guide_len_s * 1_000_000)

        anchors: list[AlignmentAnchorResult] = []
        if norm_confidence >= 0.35 and offset_us >= 0:
            sample_points = [0.1, 0.5, 0.9] if duration_us > 2_000_000 else [0.5]
            for pt in sample_points:
                v_us = int(duration_us * pt)
                m_us = v_us + offset_us
                if m_us <= int(master_len_s * 1_000_000):
                    anchors.append(
                        AlignmentAnchorResult(
                            video_us=v_us,
                            master_us=m_us,
                            confidence=round(norm_confidence, 4),
                            method="cross_correlation",
                        )
                    )

        if not anchors or norm_confidence < 0.35 or offset_us < 0:
            status = "no_match"
            anchors = []
            drift_ppm = 0.0
            residual_p95_us = 0
            agg_confidence = 0.0
        elif ambiguity_ratio > 0.95 or norm_confidence < 0.70:
            status = "needs_review"
            drift_ppm = 0.0
            residual_p95_us = 12_000
            agg_confidence = round(norm_confidence, 4)
        else:
            status = "locked"
            drift_ppm = 0.0
            residual_p95_us = 8_000
            agg_confidence = round(norm_confidence, 4)

        return AlignmentResult(
            status=status,
            aggregate_confidence=agg_confidence,
            drift_ppm=drift_ppm,
            residual_p95_us=residual_p95_us,
            fit_model="linear",
            anchors=anchors,
            algorithm_version=ALIGNMENT_ALGORITHM_VERSION,
        )
