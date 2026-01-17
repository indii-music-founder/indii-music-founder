import json
import sys
import re

class QCValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_metadata(self, data):
        """
        Validates metadata against industrial style guides (Apple Music / Spotify).
        """
        # 1. Title Hygiene
        title = data.get("title", "")
        if not title:
            self.errors.append("Title is required.")
        
        if re.search(r'\b(feat|ft|Prod by|Produced by)\b', title, re.IGNORECASE):
            self.errors.append(f"Title '{title}' contains contributor info (feat/ft/prod). These MUST be moved to the contributor fields.")

        if title.isupper():
            self.errors.append(f"Title '{title}' is in ALL CAPS. Use standard sentence casing.")

        # 2. Artist Integrity
        artist = data.get("artist", "")
        generic_names = ["Chill Beats", "Sleep Sound", "Lofi Rain", "Meditation Music", "Background Music"]
        if artist in generic_names:
            self.errors.append(f"Artist name '{artist}' is identified as generic/SEO-spam. Rejecting for DSP compliance.")

        # 3. Artwork Simulation (Metadata check for now)
        artwork_url = data.get("artwork_url", "")
        if not artwork_url:
            self.errors.append("Artwork URL is required.")

        return {
            "valid": len(self.errors) == 0,
            "errors": self.errors,
            "warnings": self.warnings
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        validator = QCValidator()
        result = validator.validate_metadata(input_data)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
