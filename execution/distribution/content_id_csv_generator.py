import csv
import io
import json
import logging
import sys
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("content_id_gen")

def generate_content_id_csv(asset_data: Dict[str, Any]) -> str:
    """Generates a YouTube Content ID Bulk Metadata CSV.

    Adheres to the YouTube Sound Recording asset specification.

    Args:
        asset_data: Dictionary containing artist, album, and track information.
                    Expected keys: 'tracks', 'upc', 'artist', 'album_title'.

    Returns:
        A string containing the formatted CSV data.
    """
    logger.info("Generating Content ID CSV bulk metadata.")
    
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # YouTube standard headers for sound_recording assets
    headers = [
        "Asset Type", "Custom ID", "ISRC", "UPC", "Title", 
        "Artist", "Album", "Label", "Match Policy", "Territories"
    ]
    writer.writerow(headers)

    tracks = asset_data.get("tracks", [])
    if not tracks:
        logger.warning("No tracks found in asset data. Generating header-only CSV.")

    for track in tracks:
        # Extract metadata with defaults
        track_id = track.get("id", "UNKNOWN")
        isrc = track.get("isrc", "")
        upc = asset_data.get("upc", "")
        title = track.get("title", "Untitled Track")
        artist = asset_data.get("artist", "Various Artists")
        album = asset_data.get("album_title", "Single")
        
        row = [
            "sound_recording",
            f"INDII-{track_id}", # Unique Internal identifier
            isrc,
            upc,
            title,
            artist,
            album,
            "Indii OS Distribution", # Managed Label
            "Monetize",               # Default YouTube CID match policy
            "Worldwide"               # Standard territory availability
        ]
        writer.writerow(row)

    csv_content = output.getvalue()
    logger.info(f"CSV generation complete. Total records: {len(tracks)}")
    return csv_content

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Input JSON string required. Usage: python3 content_id_csv_generator.py '<json_data>'"
        }))
        sys.exit(1)

    try:
        # Attempt to parse input JSON
        raw_input = sys.argv[1]
        data = json.loads(raw_input)
        
        csv_result = generate_content_id_csv(data)
        
        # Output the raw CSV data to stdout
        sys.stdout.write(csv_result)
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        print(json.dumps({"error": f"JSON Decode Error: {e}"}))
        sys.exit(1)
    except Exception as e:
        logger.exception("Unexpected error in CSV generation")
        print(json.dumps({"error": f"Internal Error: {e}"}))
        sys.exit(1)
