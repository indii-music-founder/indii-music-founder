import csv
import io
import json
import logging
import sys
from typing import Any, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("content_id_gen")


VALID_MATCH_POLICIES = {"monetize", "track", "block"}


class RightsVerificationError(ValueError):
    """Raised when rights attestation is missing or invalid — asset export
    must be blocked, never silently defaulted (ISSUE-786)."""


def generate_content_id_csv(asset_data: Dict[str, Any]) -> str:
    """Generates a YouTube Content ID Bulk Metadata CSV.

    Adheres to the YouTube Sound Recording asset specification.

    ISSUE-786: this NEVER defaults rights-determining fields (label, match
    policy, territories) — an invalid Content ID claim can suspend YouTube
    partner access. The caller must supply an explicit rights attestation
    and a real ISRC for every track; missing/invalid data blocks the export
    with a precise reason instead of emitting a false claim.

    Args:
        asset_data: Dictionary with:
            'tracks': list of {'isrc': str, 'title': str, 'id'?: str}
            'upc': str
            'artist': str
            'album_title'?: str
            'rights_attestation': {
                'exclusive_rights': bool — must be True,
                'label': str — real rights-holder label, non-empty,
                'match_policy': one of 'monetize' | 'track' | 'block',
                'territories': list[str] — explicit, non-empty,
            }

    Returns:
        A string containing the formatted CSV data.

    Raises:
        RightsVerificationError: attestation missing/invalid, or any track
            is missing a real ISRC/title.
    """
    logger.info("Generating Content ID CSV bulk metadata.")

    attestation = asset_data.get("rights_attestation")
    if not isinstance(attestation, dict):
        raise RightsVerificationError(
            "rights_attestation is required: exclusive_rights, label, match_policy, territories.")
    if attestation.get("exclusive_rights") is not True:
        raise RightsVerificationError(
            "Cannot export Content ID assets without confirmed exclusive_rights=true.")
    label = attestation.get("label", "").strip() if isinstance(attestation.get("label"), str) else ""
    if not label:
        raise RightsVerificationError("rights_attestation.label (real rights-holder label) is required.")
    match_policy = attestation.get("match_policy")
    if match_policy not in VALID_MATCH_POLICIES:
        raise RightsVerificationError(
            f"rights_attestation.match_policy must be one of {sorted(VALID_MATCH_POLICIES)}, got {match_policy!r}.")
    territories = attestation.get("territories")
    if not isinstance(territories, list) or not territories:
        raise RightsVerificationError(
            "rights_attestation.territories must be a non-empty explicit list (no default 'Worldwide').")
    territories_str = ", ".join(str(t) for t in territories)

    upc = asset_data.get("upc", "")
    if not upc:
        raise RightsVerificationError("upc is required for Content ID asset export.")

    tracks = asset_data.get("tracks", [])
    if not tracks:
        raise RightsVerificationError("At least one track is required for Content ID asset export.")

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # YouTube standard headers for sound_recording assets
    headers = [
        "Asset Type", "Custom ID", "ISRC", "UPC", "Title",
        "Artist", "Album", "Label", "Match Policy", "Territories"
    ]
    writer.writerow(headers)

    artist = asset_data.get("artist", "").strip() if isinstance(asset_data.get("artist"), str) else ""
    if not artist:
        raise RightsVerificationError("artist is required for Content ID asset export.")
    album = asset_data.get("album_title") or "Single"

    for idx, track in enumerate(tracks):
        track_id = track.get("id", f"TRACK-{idx + 1}")
        isrc = track.get("isrc", "").strip() if isinstance(track.get("isrc"), str) else ""
        title = track.get("title", "").strip() if isinstance(track.get("title"), str) else ""
        if not isrc:
            raise RightsVerificationError(f"Track {idx + 1} ({title or track_id}) is missing a real ISRC.")
        if not title:
            raise RightsVerificationError(f"Track {idx + 1} ({track_id}) is missing a title.")

        row = [
            "sound_recording",
            f"INDII-{track_id}",  # Unique Internal identifier
            isrc,
            upc,
            title,
            artist,
            album,
            label,
            match_policy,
            territories_str,
        ]
        writer.writerow(row)

    csv_content = output.getvalue()
    logger.info(f"CSV generation complete. Total records: {len(tracks)}")
    return csv_content



if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Content ID CSV Generator")
    parser.add_argument("json_data", help="JSON payload string")
    parser.add_argument("--storage-path", help="Optional path for file persistence")

    args = parser.parse_args()

    try:
        # Parse input JSON
        data = json.loads(args.json_data)
        csv_result = generate_content_id_csv(data)

        # ISSUE-789: emit structured JSON, not raw CSV text — the Electron
        # main handler requires structured JSON output from every distribution
        # Python script and unwraps a top-level 'csv' field.
        sys.stdout.write(json.dumps({
            "status": "SUCCESS",
            "csv": csv_result,
            "recordCount": len(data.get("tracks", [])),
        }))

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        print(json.dumps({"status": "FAILED", "error": f"JSON Decode Error: {e}"}))
        sys.exit(1)
    except RightsVerificationError as e:
        logger.warning(f"Rights verification blocked export: {e}")
        print(json.dumps({"status": "FAILED", "error": str(e)}))
        sys.exit(1)
    except Exception as e:
        logger.exception("Unexpected error in CSV generation")
        print(json.dumps({"status": "FAILED", "error": f"Internal Error: {e}"}))
        sys.exit(1)
