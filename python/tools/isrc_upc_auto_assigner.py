"""
ISRC / UPC Auto-Assigner — deterministic, stdlib-only implementation.

Generates ISRCs using the format CC-XXX-YY-NNNNN where:
  CC    = ISO 3166-1 alpha-2 country code (default "US")
  XXX   = registrant code (default "IND" for indiiOS)
  YY    = last two digits of the current year
  NNNNN = 5-digit sequential counter persisted in /tmp/isrc_counter.json

Generates UPCs using the EAN-13 check-digit algorithm:
  - 12-digit base: prefix "884" + 9 random digits
  - Check digit: alternate ×1 / ×3 weights, check = (10 − (sum % 10)) % 10

CLI usage:
  python isrc_upc_auto_assigner.py \
      --country-code US \
      --registrant IND \
      --artist-name "Jane Doe" \
      --track-title "My Track" \
      --count 3

Output: one JSON object per line, e.g.
  {"isrc": "US-IND-26-00001", "upc": "884123456789X", "generated_at": "..."}

Zero AI/LLM calls — pure stdlib.
"""

import argparse
import datetime
import json
import os
import random
import sys

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

COUNTER_FILE = "/tmp/isrc_counter.json"


def _load_counter() -> int:
    """Return the current sequential counter from disk, defaulting to 0."""
    if os.path.exists(COUNTER_FILE):
        try:
            with open(COUNTER_FILE, "r") as fh:
                data = json.load(fh)
            return int(data.get("counter", 0))
        except (json.JSONDecodeError, ValueError, OSError):
            pass
    return 0


def _save_counter(value: int) -> None:
    """Persist *value* as the next available counter to disk."""
    with open(COUNTER_FILE, "w") as fh:
        json.dump({"counter": value}, fh)


# ---------------------------------------------------------------------------
# ISRC generation
# ---------------------------------------------------------------------------

def generate_isrc(country_code: str = "US", registrant: str = "IND") -> str:
    """
    Generate one ISRC and advance the persisted counter.

    Format: CC-XXX-YY-NNNNN
    """
    country_code = country_code.upper().strip()
    registrant = registrant.upper().strip()

    year_suffix = datetime.datetime.now().strftime("%y")  # e.g. "26"

    counter = _load_counter() + 1
    _save_counter(counter)

    designation = f"{counter:05d}"
    return f"{country_code}-{registrant}-{year_suffix}-{designation}"


# ---------------------------------------------------------------------------
# UPC generation  (EAN-13 check digit)
# ---------------------------------------------------------------------------

def _ean13_check_digit(twelve_digits: str) -> int:
    """
    Compute the EAN-13 check digit for a 12-digit string.

    Algorithm:
      Alternate weights of 1 and 3 (position 1 → weight 1, position 2 → weight 3, …)
      Sum all weighted digits.
      Check digit = (10 − (total % 10)) % 10
    """
    total = 0
    for i, ch in enumerate(twelve_digits):
        weight = 1 if i % 2 == 0 else 3
        total += int(ch) * weight
    return (10 - (total % 10)) % 10


def generate_upc() -> str:
    """
    Generate a valid 13-digit EAN-13 / UPC-A barcode string.

    Structure:  884  (GS1 prefix)  +  9 random digits  +  1 check digit
    """
    prefix = "884"
    random_part = "".join(str(random.randint(0, 9)) for _ in range(9))
    twelve = prefix + random_part
    check = _ean13_check_digit(twelve)
    return twelve + str(check)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assign_identifiers(
    country_code: str = "US",
    registrant: str = "IND",
    artist_name: str = "",
    track_title: str = "",
) -> dict:
    """
    Generate one ISRC + UPC pair and return a structured dict.

    Returns:
        {
            "isrc": "US-IND-26-00001",
            "upc": "8841234567895",
            "artist_name": "...",
            "track_title": "...",
            "generated_at": "2026-03-08T12:00:00"
        }
    """
    return {
        "isrc": generate_isrc(country_code=country_code, registrant=registrant),
        "upc": generate_upc(),
        "artist_name": artist_name,
        "track_title": track_title,
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Deterministic ISRC / UPC auto-assigner for indiiOS.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--country-code",
        default="US",
        help="ISO 3166-1 alpha-2 country code (default: US)",
    )
    parser.add_argument(
        "--registrant",
        default="IND",
        help="ISRC registrant code, up to 3 alphanumeric chars (default: IND)",
    )
    parser.add_argument(
        "--artist-name",
        default="",
        help="Artist name to embed in output metadata",
    )
    parser.add_argument(
        "--track-title",
        default="",
        help="Track title to embed in output metadata",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=1,
        help="Number of ISRC/UPC pairs to generate (default: 1)",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.count < 1:
        print(
            json.dumps({"status": "error", "message": "--count must be >= 1"}),
            file=sys.stderr,
        )
        sys.exit(1)

    results = []
    for _ in range(args.count):
        result = assign_identifiers(
            country_code=args.country_code,
            registrant=args.registrant,
            artist_name=args.artist_name,
            track_title=args.track_title,
        )
        results.append(result)

    # Emit one JSON object per line (NDJSON) for easy pipeline consumption.
    for record in results:
        print(json.dumps(record))


if __name__ == "__main__":
    main()
