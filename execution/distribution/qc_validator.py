import json
import logging
import re
import sys
from typing import Any, Dict, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("qc_validator")


class QCValidator:
    """Validates release metadata against industrial style guides (Apple Music, Spotify, Amazon).

    Ensures metadata hygiene, artist integrity, and platform compliance.
    """

    GENERIC_ARTIST_NAMES = {
        "Chill Beats", "Sleep Sound", "Lofi Rain", "Meditation Music",
        "Background Music", "Nature Sounds", "White Noise", "Calm",
        "Spa", "Yoga Music", "Study Music"
    }

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def validate_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validates a release metadata object.

        Args:
            data: Dictionary containing fields like 'title', 'artist', 'artwork_url'.

        Returns:
            A report dictionary with 'valid', 'errors', and 'warnings'.
        """
        logger.info("Starting metadata QC validation.")
        self.errors = []
        self.warnings = []

        # 1. Title Hygiene
        title = data.get("title", "").strip()
        if not title:
            self.errors.append("Title is required.")
        else:
            # Check for forbidden contributor info in title
            contributor_regex = (
                r'\b(feat|ft|Prod by|Produced by|presenting|pres|with)\b'
            )
            if re.search(contributor_regex, title, re.IGNORECASE):
                self.errors.append(
                    f"Title '{title}' contains contributor information. "
                    "Per DSP Style Guides, features and producers MUST be "
                    "listed in contributor fields, not titles."
                )

            # Check for casing issues
            if title.isupper() and len(title) > 4:
                self.errors.append(
                    f"Title '{title}' is in ALL CAPS. Use standard Title Case."
                )
            elif title.islower() and len(title) > 4:
                self.warnings.append(
                    f"Title '{title}' is in all lowercase. "
                    "Standard Title Case is preferred."
                )

        # 2. Artist Integrity
        artist = data.get("artist", "").strip()
        if not artist:
            self.errors.append("Primary artist name is required.")
        elif artist in self.GENERIC_ARTIST_NAMES:
            self.errors.append(
                f"Artist name '{artist}' is identified as generic or SEO-spam. "
                "DSPs (like Apple Music) reject generic artist names to "
                "prevent search manipulation."
            )

        # 3. Artwork Presence
        artwork_url = data.get("artwork_url", "")
        if not artwork_url:
            self.errors.append(
                "Artwork URL is missing. Releases cannot be "
                "distributed without cover art."
            )

        # 4. Versioning Check (Warnings)
        version = data.get("version", "").lower()
        if "original" in version:
            self.warnings.append(
                "'Original' version description is redundant and "
                "may be removed by DSP editors."
            )

        is_valid = len(self.errors) == 0
        logger.info(
            f"QC Validation finished. Valid: {is_valid}. "
            f"Errors: {len(self.errors)}"
        )

        return {
            "valid": is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": (
                "Release is compliant." if is_valid
                else f"QC Failed with {len(self.errors)} errors."
            )
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": (
                "No metadata JSON provided. "
                "Usage: python3 qc_validator.py '<metadata_json>'"
            )
        }))
        sys.exit(1)

    try:
        input_payload = sys.argv[1]
        metadata = json.loads(input_payload)

        validator = QCValidator()
        result = validator.validate_metadata(metadata)
        print(json.dumps(result, indent=2))

    except json.JSONDecodeError as e:
        logger.error(f"JSON Parsing Error: {e}")
        print(json.dumps({"error": f"Invalid JSON provided: {e}"}))
        sys.exit(1)
    except Exception as e:
        logger.exception("Unexpected error in QC Validator execution")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
