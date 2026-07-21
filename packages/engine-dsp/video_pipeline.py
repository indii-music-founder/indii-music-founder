from __future__ import annotations

import hashlib
import json
import math
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


class VideoProcessingError(RuntimeError):
    pass


@dataclass(frozen=True)
class VideoInspection:
    duration_us: int
    source_video_codec: str
    source_audio_codec: str | None
    source_width: int
    source_height: int
    source_rotation_degrees: int
    source_frame_rate_mode: str
    source_hdr: bool


Runner = Callable[..., subprocess.CompletedProcess[str]]


def _run(command: list[str], runner: Runner = subprocess.run) -> subprocess.CompletedProcess[str]:
    result = runner(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise VideoProcessingError(result.stderr.strip() or f"Command failed: {command[0]}")
    return result


def _fraction(value: str | None) -> float:
    if not value or value == "0/0":
        return 0.0
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator)


def parse_ffprobe(payload: dict[str, Any]) -> VideoInspection:
    streams = payload.get("streams")
    if not isinstance(streams, list):
        raise VideoProcessingError("FFprobe returned no streams")
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
    audio = next((stream for stream in streams if stream.get("codec_type") == "audio"), None)
    if not video:
        raise VideoProcessingError("The source has no video stream")
    duration = float(video.get("duration") or payload.get("format", {}).get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise VideoProcessingError("The source duration is invalid")
    rotation = int(float(video.get("tags", {}).get("rotate", 0)))
    for side_data in video.get("side_data_list", []):
        if "rotation" in side_data:
            rotation = int(round(float(side_data["rotation"])))
    rotation = rotation % 360
    if rotation not in {0, 90, 180, 270}:
        raise VideoProcessingError("The source rotation is unsupported")
    average_rate = _fraction(video.get("avg_frame_rate"))
    real_rate = _fraction(video.get("r_frame_rate"))
    frame_rate_mode = "variable" if average_rate and real_rate and abs(average_rate - real_rate) > 0.01 else "constant"
    transfer = str(video.get("color_transfer", "")).lower()
    primaries = str(video.get("color_primaries", "")).lower()
    source_hdr = transfer in {"smpte2084", "arib-std-b67"} or primaries == "bt2020"
    return VideoInspection(
        duration_us=round(duration * 1_000_000),
        source_video_codec=str(video.get("codec_name") or "unknown"),
        source_audio_codec=str(audio.get("codec_name")) if audio else None,
        source_width=int(video.get("width") or 0),
        source_height=int(video.get("height") or 0),
        source_rotation_degrees=rotation,
        source_frame_rate_mode=frame_rate_mode,
        source_hdr=source_hdr,
    )


def inspect_video(path: Path, ffprobe: str = "ffprobe", runner: Runner = subprocess.run) -> VideoInspection:
    result = _run([
        ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], runner)
    try:
        return parse_ffprobe(json.loads(result.stdout))
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        raise VideoProcessingError("FFprobe output is malformed") from error


def _rotation_filter(rotation: int) -> list[str]:
    return {
        0: [],
        90: ["transpose=clock"],
        180: ["hflip", "vflip"],
        270: ["transpose=cclock"],
    }[rotation]


def proxy_filter(inspection: VideoInspection) -> str:
    filters: list[str] = []
    if inspection.source_hdr:
        filters.extend([
            "zscale=t=linear:npl=100",
            "format=gbrpf32le",
            "tonemap=hable:desat=0",
            "zscale=p=bt709:t=bt709:m=bt709:r=tv",
        ])
    filters.extend(_rotation_filter(inspection.source_rotation_degrees))
    filters.extend([
        "scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2",
        "fps=30",
        "format=yuv420p",
        "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
        "setsar=1",
    ])
    return ",".join(filters)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _waveform(path: Path, bins: int = 1000) -> list[float]:
    with wave.open(str(path), "rb") as source:
        if source.getsampwidth() != 2:
            raise VideoProcessingError("Guide audio must be signed 16-bit PCM")
        frames = source.getnframes()
        samples_per_bin = max(1, math.ceil(frames / bins))
        peaks: list[float] = []
        while True:
            block = source.readframes(samples_per_bin)
            if not block:
                break
            samples = [int.from_bytes(block[index:index + 2], "little", signed=True) for index in range(0, len(block), 2)]
            peaks.append(round(max(abs(sample) for sample in samples) / 32768, 6))
        return peaks


def transcode_session_media(
    source: Path,
    output_directory: Path,
    ffmpeg: str = "ffmpeg",
    ffprobe: str = "ffprobe",
    runner: Runner = subprocess.run,
) -> dict[str, Any]:
    output_directory.mkdir(parents=True, exist_ok=True)
    inspection = inspect_video(source, ffprobe, runner)
    if not inspection.source_audio_codec:
        raise VideoProcessingError("A session recording requires an audio stream for guide extraction")
    proxy = output_directory / "editing-proxy.mp4"
    guide = output_directory / "guide-audio.wav"
    contact_sheet = output_directory / "contact-sheet.jpg"
    waveform = output_directory / "waveform.json"
    _run([
        ffmpeg, "-y", "-v", "error", "-noautorotate", "-i", str(source),
        "-map", "0:v:0", "-map", "0:a:0?", "-vf", proxy_filter(inspection),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-fps_mode", "cfr",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart",
        "-metadata:s:v:0", "rotate=0", str(proxy),
    ], runner)
    _run([
        ffmpeg, "-y", "-v", "error", "-i", str(source), "-map", "0:a:0?",
        "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(guide),
    ], runner)
    interval = max(0.1, inspection.duration_us / 1_000_000 / 12)
    _run([
        ffmpeg, "-y", "-v", "error", "-i", str(proxy),
        "-vf", f"fps=1/{interval},scale=320:-2,tile=4x3", "-frames:v", "1", str(contact_sheet),
    ], runner)
    thumbnails: list[Path] = []
    for index, fraction in enumerate((0.1, 0.5, 0.9), start=1):
        thumbnail = output_directory / f"thumbnail-{index:02d}.jpg"
        thumbnails.append(thumbnail)
        _run([
            ffmpeg, "-y", "-v", "error", "-ss", f"{inspection.duration_us / 1_000_000 * fraction:.6f}",
            "-i", str(proxy), "-frames:v", "1", "-vf", "scale=480:-2", str(thumbnail),
        ], runner)
    waveform.write_text(json.dumps({
        "schemaVersion": "session-waveform.v1",
        "sampleRate": 48000,
        "durationUs": inspection.duration_us,
        "peaks": _waveform(guide),
    }, separators=(",", ":")), encoding="utf-8")
    proxy_inspection = inspect_video(proxy, ffprobe, runner)
    return {
        "inspection": {
            "originalDurationUs": inspection.duration_us,
            "proxyDurationUs": proxy_inspection.duration_us,
            "sourceVideoCodec": inspection.source_video_codec,
            "sourceAudioCodec": inspection.source_audio_codec,
            "sourceWidth": inspection.source_width,
            "sourceHeight": inspection.source_height,
            "sourceRotationDegrees": inspection.source_rotation_degrees,
            "sourceFrameRateMode": inspection.source_frame_rate_mode,
            "sourceHdr": inspection.source_hdr,
            "proxyVideoCodec": proxy_inspection.source_video_codec,
            "proxyAudioCodec": proxy_inspection.source_audio_codec,
            "proxyWidth": proxy_inspection.source_width,
            "proxyHeight": proxy_inspection.source_height,
            "proxyFrameRateNumerator": 30,
            "proxyFrameRateDenominator": 1,
            "proxyColorSpace": "rec709",
            "orientationBakedIn": True,
        },
        "timeMap": {
            "version": "presentation-time-map.v1",
            "segments": [{
                "proxyStartUs": 0,
                "proxyEndUs": proxy_inspection.duration_us,
                "originalStartUs": 0,
                "originalEndUs": inspection.duration_us,
            }],
        },
        "artifacts": {
            name: {"path": str(path), "sha256": _sha256(path), "byteSize": path.stat().st_size}
            for name, path in {
                "proxy": proxy, "guideAudio": guide, "waveform": waveform, "contactSheet": contact_sheet
            }.items()
        },
        "thumbnails": [
            {"path": str(path), "sha256": _sha256(path), "byteSize": path.stat().st_size}
            for path in thumbnails
        ],
        "workerVersion": "session-media-ffmpeg.v1",
    }


def require_ffmpeg() -> tuple[str, str]:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise VideoProcessingError("FFmpeg and FFprobe are required")
    return ffmpeg, ffprobe
