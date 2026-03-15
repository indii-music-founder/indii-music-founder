"""
Metadata QC Auditor — deterministic, rule-based, stdlib-only implementation.

Validates track metadata against DSP-acceptance rules without any AI/LLM calls.

Validation rules
----------------
- title        : required, non-empty, max 255 chars
- artist_name  : required, non-empty, max 255 chars
- isrc         : required, regex ^[A-Z]{2}-[A-Z0-9]{3}-\\d{2}-\\d{5}$
- upc          : required, 12 or 13 numeric digits only
- genre        : required, must be in DSP_GENRES whitelist
- release_date : required, ISO 8601 YYYY-MM-DD, must be a real calendar date
- territory    : required, non-empty string

Scoring
-------
Each of the 7 fields contributes equally (100 / 7 ≈ 14.28 points).
A "warn" field deducts half a field's share; a "fail" deducts the full share.
Final score is rounded to the nearest integer, clamped to [0, 100].

Output JSON
-----------
{
  "status": "pass|fail|warn",
  "score": 0-100,
  "fields": {
    "title":        {"status": "pass|fail|warn", "message": "..."},
    "artist_name":  {"status": "pass|fail|warn", "message": "..."},
    "isrc":         {"status": "pass|fail|warn", "message": "..."},
    "upc":          {"status": "pass|fail|warn", "message": "..."},
    "genre":        {"status": "pass|fail|warn", "message": "..."},
    "release_date": {"status": "pass|fail|warn", "message": "..."},
    "territory":    {"status": "pass|fail|warn", "message": "..."}
  },
  "summary": "3 errors, 1 warning"
}

CLI usage
---------
  # From a JSON file:
  python metadata_qc_auditor.py --metadata-json /path/to/metadata.json

  # From individual flags:
  python metadata_qc_auditor.py \\
      --title "My Track" \\
      --artist "Jane Doe" \\
      --isrc "US-IND-26-00001" \\
      --upc "884123456789" \\
      --genre "Hip-Hop/Rap" \\
      --release-date "2026-06-01" \\
      --territory "Worldwide"

Zero AI/LLM calls — pure stdlib: re, json, argparse, datetime.
"""

import argparse
import datetime
import json
import re
import sys

# ---------------------------------------------------------------------------
# DSP-accepted genre whitelist
# Comprehensive list sourced from Apple Music, Spotify, DistroKid, TuneCore,
# and CD Baby genre taxonomies (148 genres).
# ---------------------------------------------------------------------------

DSP_GENRES = {
    # --- Core Genres ---
    "Alternative",
    "Blues",
    "Children's Music",
    "Classical",
    "Comedy",
    "Country",
    "Dance",
    "Electronic",
    "Folk",
    "Gospel",
    "Hip-Hop/Rap",
    "Holiday",
    "Instrumental",
    "Jazz",
    "Latin",
    "Metal",
    "New Age",
    "Opera",
    "Pop",
    "Punk",
    "R&B/Soul",
    "Reggae",
    "Rock",
    "Singer/Songwriter",
    "Soundtrack",
    "Spoken Word",
    "World",
    # --- Electronic / Dance Sub-Genres ---
    "Ambient",
    "Bass Music",
    "Breakbeat",
    "Chillout",
    "Chillwave",
    "Deep House",
    "Disco",
    "Downtempo",
    "Drum & Bass",
    "Dub",
    "Dubstep",
    "EDM",
    "Electro",
    "Electronica",
    "Future Bass",
    "Garage",
    "Glitch",
    "Grime",
    "Hardstyle",
    "House",
    "IDM",
    "Jungle",
    "Lo-fi",
    "Minimal",
    "Progressive House",
    "Synthwave",
    "Tech House",
    "Techno",
    "Trance",
    "Trip-Hop",
    "UK Garage",
    "Vaporwave",
    # --- Hip-Hop / Rap Sub-Genres ---
    "Boom Bap",
    "Cloud Rap",
    "Conscious Hip-Hop",
    "Drill",
    "Emo Rap",
    "Gangsta Rap",
    "Hyphy",
    "Mumble Rap",
    "Phonk",
    "Trap",
    "Underground Hip-Hop",
    # --- Rock / Alt Sub-Genres ---
    "Alt-Country",
    "Art Rock",
    "Britpop",
    "Classic Rock",
    "Dream Pop",
    "Emo",
    "Experimental",
    "Garage Rock",
    "Gothic",
    "Grunge",
    "Hardcore",
    "Hard Rock",
    "Indie",
    "Indie Pop",
    "Indie Rock",
    "Math Rock",
    "New Wave",
    "Noise",
    "Post-Hardcore",
    "Post-Punk",
    "Post-Rock",
    "Progressive Rock",
    "Psychedelic",
    "Shoegaze",
    "Ska",
    "Soft Rock",
    "Stoner Rock",
    "Surf Rock",
    # --- Metal Sub-Genres ---
    "Black Metal",
    "Death Metal",
    "Deathcore",
    "Doom Metal",
    "Metalcore",
    "Nu Metal",
    "Power Metal",
    "Progressive Metal",
    "Thrash Metal",
    # --- R&B / Soul Sub-Genres ---
    "Contemporary R&B",
    "Funk",
    "Motown",
    "Neo-Soul",
    "Quiet Storm",
    # --- Global / Regional ---
    "Afrobeats",
    "Afropop",
    "Baile Funk",
    "Bolero",
    "Bossa Nova",
    "Cumbia",
    "Dancehall",
    "Flamenco",
    "J-Pop",
    "K-Pop",
    "Mariachi",
    "Merengue",
    "MPB",
    "Reggaeton",
    "Salsa",
    "Samba",
    "Soca",
    "Zouk",
    # --- Other / Specialty ---
    "Acoustic",
    "Cinematic",
    "Easy Listening",
    "Fitness & Workout",
    "Healing & Meditation",
    "Karaoke",
    "Lullaby",
    "Nature Sounds",
    "Podcast",
    "Relaxation",
    "Sleep",
    "Study Music",
    "ASMR",
    "Christian & Gospel",
    "Worship",
}

# Pre-compiled regex for ISRC validation
_ISRC_RE = re.compile(r"^[A-Z]{2}-[A-Z0-9]{3}-\d{2}-\d{5}$")

# Pre-compiled regex for UPC: 12 or 13 digits only
_UPC_RE = re.compile(r"^\d{12,13}$")

# ---------------------------------------------------------------------------
# Individual field validators
# ---------------------------------------------------------------------------


def _check_title(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "title is required and cannot be empty."}
    text = str(value).strip()
    if len(text) > 255:
        return {"status": "fail", "message": f"title exceeds 255 characters (got {len(text)})."}
    return {"status": "pass", "message": "OK"}


def _check_artist_name(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "artist_name is required and cannot be empty."}
    text = str(value).strip()
    if len(text) > 255:
        return {"status": "fail", "message": f"artist_name exceeds 255 characters (got {len(text)})."}
    return {"status": "pass", "message": "OK"}


def _check_isrc(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "isrc is required and cannot be empty."}
    text = str(value).strip().upper()
    if not _ISRC_RE.match(text):
        return {
            "status": "fail",
            "message": (
                f"isrc '{text}' does not match required format CC-XXX-YY-NNNNN "
                "(e.g. US-IND-26-00001)."
            ),
        }
    return {"status": "pass", "message": "OK"}


def _check_upc(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "upc is required and cannot be empty."}
    text = str(value).strip()
    if not _UPC_RE.match(text):
        return {
            "status": "fail",
            "message": (
                f"upc '{text}' must be 12 or 13 numeric digits only "
                f"(got {len(text)} chars)."
            ),
        }
    return {"status": "pass", "message": "OK"}


def _check_genre(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "genre is required and cannot be empty."}
    text = str(value).strip()
    if text not in DSP_GENRES:
        # Attempt case-insensitive match and warn instead of fail
        lower_map = {g.lower(): g for g in DSP_GENRES}
        canonical = lower_map.get(text.lower())
        if canonical:
            return {
                "status": "warn",
                "message": (
                    f"genre '{text}' is not the canonical capitalisation. "
                    f"Use '{canonical}'."
                ),
            }
        return {
            "status": "fail",
            "message": (
                f"genre '{text}' is not in the DSP-accepted genre list. "
                f"Accepted values: {', '.join(sorted(DSP_GENRES))}."
            ),
        }
    return {"status": "pass", "message": "OK"}


def _check_release_date(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "release_date is required and cannot be empty."}
    text = str(value).strip()
    # Must match YYYY-MM-DD strictly
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return {
            "status": "fail",
            "message": (
                f"release_date '{text}' is not in ISO 8601 YYYY-MM-DD format."
            ),
        }
    try:
        datetime.date.fromisoformat(text)
    except ValueError:
        return {
            "status": "fail",
            "message": f"release_date '{text}' is not a valid calendar date.",
        }
    return {"status": "pass", "message": "OK"}


def _check_territory(value) -> dict:
    if not value or not str(value).strip():
        return {"status": "fail", "message": "territory is required and cannot be empty."}
    return {"status": "pass", "message": "OK"}


# ---------------------------------------------------------------------------
# Aggregator
# ---------------------------------------------------------------------------

_FIELD_CHECKS = [
    ("title", _check_title),
    ("artist_name", _check_artist_name),
    ("isrc", _check_isrc),
    ("upc", _check_upc),
    ("genre", _check_genre),
    ("release_date", _check_release_date),
    ("territory", _check_territory),
]

_FIELD_COUNT = len(_FIELD_CHECKS)
_POINTS_PER_FIELD = 100.0 / _FIELD_COUNT


def audit_metadata(metadata: dict) -> dict:
    """
    Run all deterministic QC rules against *metadata* and return a structured report.

    Parameters
    ----------
    metadata : dict
        Keys: title, artist_name, isrc, upc, genre, release_date, territory

    Returns
    -------
    dict
        {
          "status": "pass|fail|warn",
          "score": int,           # 0-100
          "fields": { ... },
          "summary": "X errors, Y warnings"
        }
    """
    field_results: dict = {}
    error_count = 0
    warn_count = 0
    deducted_points = 0.0

    for field_name, check_fn in _FIELD_CHECKS:
        raw_value = metadata.get(field_name)
        result = check_fn(raw_value)
        field_results[field_name] = result

        if result["status"] == "fail":
            error_count += 1
            deducted_points += _POINTS_PER_FIELD
        elif result["status"] == "warn":
            warn_count += 1
            deducted_points += _POINTS_PER_FIELD / 2.0

    score = max(0, min(100, round(100.0 - deducted_points)))

    if error_count > 0:
        overall_status = "fail"
    elif warn_count > 0:
        overall_status = "warn"
    else:
        overall_status = "pass"

    # Build human-readable summary
    parts = []
    if error_count:
        parts.append(f"{error_count} error{'s' if error_count != 1 else ''}")
    if warn_count:
        parts.append(f"{warn_count} warning{'s' if warn_count != 1 else ''}")
    if not parts:
        parts.append("no issues")
    summary = ", ".join(parts)

    return {
        "status": overall_status,
        "score": score,
        "fields": field_results,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Deterministic metadata QC auditor for DSP submission.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--metadata-json",
        metavar="PATH",
        help="Path to a JSON file containing the metadata object.",
    )
    group.add_argument(
        "--title",
        metavar="TITLE",
        help="Track title (use with individual field flags).",
    )

    # Individual field flags (only meaningful when --title is used, not --metadata-json)
    parser.add_argument("--artist", metavar="ARTIST", help="Artist name.")
    parser.add_argument("--isrc", metavar="ISRC", help="ISRC code (CC-XXX-YY-NNNNN).")
    parser.add_argument("--upc", metavar="UPC", help="UPC / EAN barcode (12 or 13 digits).")
    parser.add_argument("--genre", metavar="GENRE", help="DSP genre.")
    parser.add_argument("--release-date", metavar="DATE", help="Release date (YYYY-MM-DD).")
    parser.add_argument("--territory", metavar="TERRITORY", help="Release territory.")

    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.metadata_json:
        try:
            with open(args.metadata_json, "r", encoding="utf-8") as fh:
                metadata = json.load(fh)
        except FileNotFoundError:
            print(
                json.dumps({"status": "error", "message": f"File not found: {args.metadata_json}"}),
                file=sys.stderr,
            )
            sys.exit(1)
        except json.JSONDecodeError as exc:
            print(
                json.dumps({"status": "error", "message": f"Invalid JSON: {exc}"}),
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # Build metadata dict from individual CLI flags
        metadata = {
            "title": args.title,
            "artist_name": args.artist,
            "isrc": args.isrc,
            "upc": args.upc,
            "genre": args.genre,
            "release_date": args.release_date,
            "territory": args.territory,
        }

    report = audit_metadata(metadata)
    print(json.dumps(report, indent=2))

    # Exit non-zero if QC failed so this tool can be used in CI pipelines.
    if report["status"] == "fail":
        sys.exit(1)


if __name__ == "__main__":
    main()
