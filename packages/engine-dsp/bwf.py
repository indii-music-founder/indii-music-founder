"""Broadcast Wave (BWF) metadata extraction — deterministic RIFF chunk parsing.

Reads the fixed-layout `bext` chunk (ITU-R BS.646 / EBU Tech 3285) and the
`iXML` chunk from a WAV file without loading audio samples into memory:
chunk bodies other than `bext`/`iXML` are skipped by seek.

Pure stdlib (`struct`, `re`) so it never affects DSP numerics.
"""

from __future__ import annotations

import re
import struct
from pathlib import Path
from typing import Any

# bext fixed head, per EBU Tech 3285 v2 (through maxShortTermLoudness):
#   description 256, originator 32, originatorReference 32,
#   originationDate 10, originationTime 8, timeReference 8, version 2,
#   UMID 64, loudnessValue 2, loudnessRange 2, maxTruePeakLevel 2,
#   maxMomentaryLoudness 2, maxShortTermLoudness 2
# The five loudness levels are SIGNED 16-bit fixed-point x0.01 (dBTP/LU go
# negative in practice).
_BEXT_HEAD = "<256s32s32s10s8sQH64shhhhh"
_BEXT_HEAD_SIZE = struct.calcsize(_BEXT_HEAD)

_RIFF_HEADER = 12
_CHUNK_HEADER = 8


def _clean_text(raw: bytes) -> str:
    """Decode a fixed-width NUL-padded ASCII field, trimming padding."""
    return raw.split(b"\x00", 1)[0].decode("ascii", errors="replace").strip()


def _decode_fixed_text(raw: bytes) -> str:
    return raw.decode("utf-8", errors="replace").strip()


def _iter_chunks(path: Path):
    """Yield (chunk_id, body_reader) for a RIFF/WAVE file, seeking past bodies."""
    with path.open("rb") as handle:
        header = handle.read(_RIFF_HEADER)
        if len(header) < _RIFF_HEADER or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
            return
        while True:
            chunk_header = handle.read(_CHUNK_HEADER)
            if len(chunk_header) < _CHUNK_HEADER:
                return
            chunk_id = chunk_header[:4]
            (chunk_size,) = struct.unpack("<I", chunk_header[4:8])
            if chunk_id in (b"bext", b"iXML"):
                body = handle.read(chunk_size)
                yield chunk_id, body
                # iXML bodies are unpadded in the wild; realign to even offset.
                if chunk_size % 2 == 1:
                    handle.seek(1, 1)
            else:
                handle.seek(chunk_size + (chunk_size % 2), 1)


def parse_bext(body: bytes) -> dict[str, Any]:
    """Parse the bext fixed head into human fields. Loudness values are
    fixed-point x0.01 per spec (e.g. 1800 => 18.0 LUFS)."""
    if len(body) < _BEXT_HEAD_SIZE:
        return {"parseError": "bext chunk shorter than the fixed head"}
    fields = struct.unpack_from(_BEXT_HEAD, body, 0)
    (
        description,
        originator,
        originator_reference,
        origination_date,
        origination_time,
        time_reference,
        version,
        umid,
        loudness_value,
        loudness_range,
        max_true_peak,
        max_momentary,
        max_short_term,
    ) = fields

    def level(raw: int) -> float | None:
        # 32767 is the spec's "not signalled" sentinel (signed 16-bit).
        return None if raw == 32_767 else round(raw / 100.0, 2)

    parsed: dict[str, Any] = {
        "description": _clean_text(description),
        "originator": _clean_text(originator),
        "originatorReference": _clean_text(originator_reference),
        "originationDate": _clean_text(origination_date),
        "originationTime": _clean_text(origination_time),
        "timeReferenceSamples": time_reference,
        "version": version,
    }
    umid_text = _clean_text(umid)
    if umid_text:
        parsed["umid"] = umid_text
    loudness = {
        "integratedLufs": level(loudness_value),
        "loudnessRangeLu": level(loudness_range),
        "maxTruePeakDbTp": level(max_true_peak),
        "maxMomentaryLufs": level(max_momentary),
        "maxShortTermLufs": level(max_short_term),
    }
    parsed["loudness"] = {key: value for key, value in loudness.items() if value is not None}
    return parsed


def parse_ixml(body: bytes) -> dict[str, Any]:
    """Extract the small set of iXML fields that matter for provenance."""
    text = _decode_fixed_text(body)
    parsed: dict[str, Any] = {}

    def first_tag(tag: str) -> str | None:
        match = re.search(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
        return match.group(1).strip() if match else None

    for tag in ("PROJECT", "SPEED_MASTER", "TIMECODE_RATE", "DATE", "TAPE"):
        value = first_tag(tag)
        if value:
            parsed[tag] = value[:120]
    track_count = first_tag("TRACK_COUNT") or first_tag("NUM_TRACKS")
    if track_count:
        parsed["TRACK_COUNT"] = track_count
    return parsed


def parse_bwf_metadata(path: str | Path) -> dict[str, Any]:
    """Parse BWF metadata from a WAV file. Returns {} for non-WAV input or
    when no BWF chunks exist (the result is additive receipt data only)."""
    result: dict[str, Any] = {}
    for chunk_id, body in _iter_chunks(Path(path)):
        if chunk_id == b"bext":
            result["bext"] = parse_bext(body)
        elif chunk_id == b"iXML":
            result["iXML"] = parse_ixml(body)
    return result
