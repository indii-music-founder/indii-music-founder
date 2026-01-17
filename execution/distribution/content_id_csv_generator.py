import csv
import json
import sys
import io

def generate_content_id_csv(artist_data):
    """
    Generates a mock YouTube Content ID Bulk Metadata CSV.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # YouTube standard headers for sound_recording assets
    headers = [
        "Asset Type", "Custom ID", "ISRC", "UPC", "Title", 
        "Artist", "Album", "Label", "Match Policy", "Territories"
    ]
    writer.writerow(headers)

    for track in artist_data.get("tracks", []):
        row = [
            "sound_recording",
            f"UID-{track['id']}",
            track.get("isrc", ""),
            artist_data.get("upc", ""),
            track.get("title", ""),
            artist_data.get("artist", ""),
            artist_data.get("album_title", ""),
            "Indii OS Distribution",
            "Monetize",
            "Worldwide"
        ]
        writer.writerow(row)

    return output.getvalue()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
        csv_output = generate_content_id_csv(data)
        print(csv_output)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
