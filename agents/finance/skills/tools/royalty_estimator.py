import sys
import json

def estimate_royalties(streams, rate=0.004):
    gross = streams * rate
    return {
        "estimated_streams": streams,
        "rate_per_stream": rate,
        "estimated_gross": round(gross, 2),
        "currency": "USD"
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: royalty_estimator.py <streams> [rate]"}))
        sys.exit(1)
    
    try:
        streams = int(sys.argv[1])
        rate = float(sys.argv[2]) if len(sys.argv) > 2 else 0.004
        print(json.dumps(estimate_royalties(streams, rate)))
    except ValueError:
        print(json.dumps({"error": "Streams must be an integer, rate must be a number."}))
