import sys
import json

def generate_splits(track_name, artist_splits):
    # artist_splits: list of (name, share_pct)
    total_share = sum(share for name, share in artist_splits)
    if total_share != 100:
        return {"error": f"Total share must be 100%, but got {total_share}%"}
    
    return {
        "track": track_name,
        "splits": [{"artist": name, "share": f"{share}%"} for name, share in artist_splits],
        "status": "VALIDATED"
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: calculate_splits.py <track_name> '{\"Artist\": 50, \"Producer\": 50}'"}))
        sys.exit(1)
    
    try:
        track = sys.argv[1]
        splits_raw = json.loads(sys.argv[2])
        splits = [(name, float(share)) for name, share in splits_raw.items()]
        print(json.dumps(generate_splits(track, splits)))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
