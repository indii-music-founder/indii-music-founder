import datetime
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("isrc_manager")

class IdentityManager:
    """Manages unique identifiers for the music industry, including ISRCs and UPCs.

    Adheres to the standard ISRC format: CC-XXX-YY-NNNNN.
    - CC: Country Code (2 letters)
    - XXX: Registrant Code (3 alphanumeric)
    - YY: Year of Registration (2 digits)
    - NNNNN: Unique Designation Code (5 digits)
    """

    def __init__(self, store_path: str):
        """Initializes the IdentityManager.

        Args:
            store_path: Path to the JSON data store for persistence.
        """
        self.store_path = store_path
        self.data = self._load_data()

    def _load_data(self) -> Dict[str, Any]:
        """Loads data from the store or returns defaults."""
        defaults = {"isrc_count": 0, "upc_count": 0, "registry": {}}
        if os.path.exists(self.store_path):
            try:
                with open(self.store_path, 'r') as f:
                    stored_data = json.load(f)
                    # Merge with defaults to ensure all keys exist
                    return {**defaults, **stored_data}
            except (json.JSONDecodeError, ValueError, OSError) as e:
                logger.error(f"Failed to load identity store: {e}. Resetting to defaults.")
                return defaults
        return defaults

    def _save_data(self) -> None:
        """Persists identity data to the store."""
        try:
            with open(self.store_path, 'w') as f:
                json.dump(self.data, f, indent=2)
            logger.debug(f"Identity store saved to {self.store_path}")
        except OSError as e:
            logger.error(f"Failed to save identity store: {e}")

    def generate_isrc(self, country: str = "US", registrant: str = "XXX") -> str:
        """Generates a new valid ISRC.

        Args:
            country: 2-letter ISO country code.
            registrant: 3-character registrant code assigned to the label/artist.

        Returns:
            A formatted ISRC string.
        """
        year = datetime.datetime.now().strftime("%y")
        self.data["isrc_count"] += 1
        sequence = str(self.data["isrc_count"]).zfill(5)
        
        # Format: CC-XXX-YY-NNNNN
        isrc = f"{country.upper()}-{registrant.upper()}-{year}-{sequence}"
        logger.info(f"Generated ISRC: {isrc}")
        return isrc

    def _calculate_upc_check_digit(self, partial_upc: str) -> int:
        """Calculate GS1 check digit for an 11-digit partial UPC (Modulo 10)."""
        if len(partial_upc) != 11 or not partial_upc.isdigit():
            raise ValueError(f"Invalid partial UPC length: {len(partial_upc)}")
            
        odd_sum = sum(int(partial_upc[i]) for i in range(0, 11, 2))
        even_sum = sum(int(partial_upc[i]) for i in range(1, 11, 2))
        total = (odd_sum * 3) + even_sum
        check_digit = (10 - (total % 10)) % 10
        return check_digit

    def generate_upc(self, prefix: str = "060123456") -> str:
        """Generates a new valid 12-digit UPC with GS1 check digit.
        
        Args:
            prefix: 9-digit company prefix (defaults to mock prefix).
                    Note: A 9-digit prefix allows for 2 digits of item reference (100 items).
        
        Returns:
            A valid 12-digit UPC string.
        """
        self.data["upc_count"] += 1
        sequence = str(self.data["upc_count"]).zfill(2)  # 2 digits item ref for 9 digit prefix
        
        # Build 11-digit base
        partial_upc = f"{prefix}{sequence}"[-11:].zfill(11)
        
        check_digit = self._calculate_upc_check_digit(partial_upc)
        full_upc = f"{partial_upc}{check_digit}"
        
        logger.info(f"Generated UPC: {full_upc}")
        return full_upc

    def register_release(self, release_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Assigns ISRCs and a UPC to a release and its tracks.

        Args:
            release_id: Unique identifier for the release.
            metadata: Metadata dictionary containing 'tracks' list.

        Returns:
            The augmented metadata with assigned IDs.
        """
        logger.info(f"Registering identities for release: {release_id}")
        
        assigned_isrcs = []
        for track in metadata.get("tracks", []):
            isrc = self.generate_isrc()
            track["assigned_isrc"] = isrc
            assigned_isrcs.append(isrc)
        
        upc = self.generate_upc()
        metadata["assigned_upc"] = upc
        
        # Store in registry for historical lookup
        self.data["registry"][release_id] = {
            "upc": upc,
            "isrcs": assigned_isrcs,
            "metadata_snapshot": metadata,
            "registered_at": datetime.datetime.now().isoformat()
        }
        
        self._save_data()
        return metadata

if __name__ == "__main__":
    # Default to a generic store path if not provided by environment
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DEFAULT_STORE = os.path.join(BASE_DIR, "identity_store.json")
    
    manager = IdentityManager(DEFAULT_STORE)
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Command required: register, generate_isrc, or generate_upc."
        }))
        sys.exit(1)

    cmd = sys.argv[1].lower()
    
    try:
        if cmd == "register":
            # Usage: python3 isrc_manager.py register '{"tracks": [{"title": "Song 1"}]}' [rid]
            payload = json.loads(sys.argv[2])
            rid = sys.argv[3] if len(sys.argv) > 3 else f"REL-{datetime.datetime.now().strftime('%Y%m%d%f')}"
            print(json.dumps(manager.register_release(rid, payload), indent=2))
        elif cmd == "generate_isrc":
            kwargs = {}
            if len(sys.argv) > 2:
                try:
                    kwargs = json.loads(sys.argv[2])
                except Exception:
                    pass
            print(json.dumps({"isrc": manager.generate_isrc(**kwargs)}, indent=2))
            manager._save_data()
        elif cmd == "generate_upc":
            kwargs = {}
            if len(sys.argv) > 2:
                try:
                    kwargs = json.loads(sys.argv[2])
                except Exception:
                    pass
            print(json.dumps({"upc": manager.generate_upc(**kwargs)}, indent=2))
            manager._save_data()
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
            sys.exit(1)
            
    except Exception as e:
        logger.exception("Identity Manager Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
