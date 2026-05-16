import sys
import json

def generate_nda(party_a, party_b):
    template = f"NON-DISCLOSURE AGREEMENT\nBetween {party_a} and {party_b}\n\n1. Purpose: Discussion of music business opportunities.\n2. Duration: 2 years.\n..."
    return {
        "title": "Standard NDA",
        "parties": [party_a, party_b],
        "content_preview": template[:100] + "...",
        "status": "DRAFT_GENERATED"
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: nda_generator.py <party_a> <party_b>"}))
        sys.exit(1)
    
    a = sys.argv[1]
    b = sys.argv[2]
    print(json.dumps(generate_nda(a, b)))
