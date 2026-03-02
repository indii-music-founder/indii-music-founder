import datetime
import json
import logging
import os
import sys
from typing import Any, Dict, Optional

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
    - XXX: Registrant Code (3 alphanumeric) — set via ISRC_REGISTRANT_CODE env var
    - YY: Year of Registration (2 digits)
    - NNNNN: Unique Designation Code (5 digits)

    Required environment variables for production use:
    - ISRC_REGISTRANT_CODE: 3-character code assigned by the US ISRC Agency (RIAA)
    - ISRC_COUNTRY_CODE: 2-letter ISO country code (default: US)
    - GS1_COMPANY_PREFIX: 9-digit GS1 company prefix for UPC generation (~$250/yr at gs1us.org)
    """

    # Production defaults read from environment — never hardcode in source
    DEFAULT_ISRC_COUNTRY = os.environ.get("ISRC_COUNTRY_CODE", "US")
    DEFAULT_ISRC_REGISTRANT = os.environ.get("ISRC_REGISTRANT_CODE", "")
    DEFAULT_GS1_PREFIX = os.environ.get("GS1_COMPANY_PREFIX", "")

    def __init__(self, store_path: Optional[str] = None):
        """Initializes the IdentityManager.

        Args:
            store_path: Path to the JSON data store for persistence.
        """
        if store_path:
            self.store_path = store_path
        else:
            # Default to a protected user directory to avoid "BS" in project root
            data_dir = os.path.expanduser("~/.indiiOS/data")
            os.makedirs(data_dir, exist_ok=True)
            self.store_path = os.path.join(data_dir, "identity_store.json")

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
                logger.error(
                    f"Failed to load identity store: {e}. Resetting to defaults.")
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

    def generate_isrc(
            self,
            country: Optional[str] = None,
            registrant: Optional[str] = None) -> str:
        """Generates a new valid ISRC.

        Args:
            country: 2-letter ISO country code. Defaults to ISRC_COUNTRY_CODE env var or "US".
            registrant: 3-character registrant code assigned by the US ISRC Agency (RIAA).
                        Defaults to ISRC_REGISTRANT_CODE env var.

        Returns:
            A formatted ISRC string.

        Raises:
            ValueError: If no registrant code is configured (neither arg nor env var).
        """
        resolved_country = (country or self.DEFAULT_ISRC_COUNTRY or "US").upper()
        resolved_registrant = (registrant or self.DEFAULT_ISRC_REGISTRANT or "").upper()

        if not resolved_registrant:
            raise ValueError(
                "ISRC registrant code is required. Set the ISRC_REGISTRANT_CODE environment "
                "variable to your 3-character code assigned by the US ISRC Agency (RIAA). "
                "Apply at: https://www.usisrc.org/"
            )

        if len(resolved_registrant) != 3 or not resolved_registrant.isalnum():
            raise ValueError(
                f"Invalid ISRC registrant code '{resolved_registrant}'. "
                "Must be exactly 3 alphanumeric characters as assigned by the ISRC Agency."
            )

        year = datetime.datetime.now().strftime("%y")
        self.data["isrc_count"] += 1
        sequence = str(self.data["isrc_count"]).zfill(5)

        # Format: CC-XXX-YY-NNNNN
        isrc = f"{resolved_country}-{resolved_registrant}-{year}-{sequence}"

        # Uniqueness check — prevent reissuing same ISRC across releases
        all_issued = {
            isrc_val
            for entry in self.data.get("registry", {}).values()
            for isrc_val in entry.get("isrcs", [])
        }
        if isrc in all_issued:
            # Increment and retry once (counter drift recovery)
            self.data["isrc_count"] += 1
            sequence = str(self.data["isrc_count"]).zfill(5)
            isrc = f"{resolved_country}-{resolved_registrant}-{year}-{sequence}"

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

    def generate_upc(self, prefix: Optional[str] = None) -> str:
        """Generates a new valid 12-digit UPC with GS1 check digit.

        Args:
            prefix: 9-digit GS1 company prefix. Defaults to GS1_COMPANY_PREFIX env var.
                    Register at https://www.gs1us.org/ (~$250/yr for 9-digit prefix).
                    Note: A 9-digit prefix allows for 2 digits of item reference (100 items).

        Returns:
            A valid 12-digit UPC string.

        Raises:
            ValueError: If no GS1 company prefix is configured.
        """
        resolved_prefix = prefix or self.DEFAULT_GS1_PREFIX or ""

        if not resolved_prefix:
            raise ValueError(
                "GS1 company prefix is required for UPC generation. Set the GS1_COMPANY_PREFIX "
                "environment variable to your 9-digit prefix. "
                "Register at: https://www.gs1us.org/"
            )

        if len(resolved_prefix) != 9 or not resolved_prefix.isdigit():
            raise ValueError(
                f"Invalid GS1 company prefix '{resolved_prefix}'. "
                "Must be exactly 9 digits as assigned by GS1."
            )

        self.data["upc_count"] += 1
        sequence = str(self.data["upc_count"]).zfill(2)  # 2 digits item ref for 9-digit prefix

        # Build 11-digit base
        partial_upc = f"{resolved_prefix}{sequence}"[-11:].zfill(11)

        check_digit = self._calculate_upc_check_digit(partial_upc)
        full_upc = f"{partial_upc}{check_digit}"

        logger.info(f"Generated UPC: {full_upc}")
        return full_upc

    def register_release(self, release_id: str,
                         metadata: Dict[str, Any]) -> Dict[str, Any]:
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
    import argparse

    parser = argparse.ArgumentParser(description="ISRC & UPC Manager")
    parser.add_argument("command", choices=["register", "generate_isrc", "generate_upc"], help="Command to execute")
    parser.add_argument("payload", nargs="?", help="JSON payload for the command")
    parser.add_argument("extra_arg", nargs="?", help="Optional extra argument (e.g. release ID)")
    parser.add_argument("--storage-path", help="Path to the data store directory")

    args = parser.parse_args()

    # Determine store path and fix potential argparse greedy consumption
    storage_path = args.storage_path
    
    # If storage_path is None but payload or extra_arg looks like a flag
    # this is a heuristic to fix Electron bridge's positional argument gaps
    if storage_path is None:
        if args.payload == "--storage-path" and args.extra_arg:
            storage_path = args.extra_arg
            args.payload = None
            args.extra_arg = None
        elif args.extra_arg == "--storage-path":
            # This case shouldn't happen with the current bridge but for safety
            # we'd need to look at sys.argv for the value after --storage-path
            pass

    store_file = None
    if storage_path:
        os.makedirs(storage_path, exist_ok=True)
        store_file = os.path.join(storage_path, "identity_store.json")

    manager = IdentityManager(store_path=store_file)

    try:
        if args.command == "register":
            if not args.payload:
                print(json.dumps({"error": "Payload required for register command."}))
                sys.exit(1)
            
            payload = json.loads(args.payload)
            rid = args.extra_arg if args.extra_arg else f"REL-{datetime.datetime.now().strftime('%Y%m%d%f')}"
            print(json.dumps(manager.register_release(rid, payload), indent=2))

        elif args.command == "generate_isrc":
            kwargs = {}
            if args.payload:
                try:
                    kwargs = json.loads(args.payload)
                except Exception:
                    pass
            print(json.dumps({"isrc": manager.generate_isrc(**kwargs)}, indent=2))
            manager._save_data()

        elif args.command == "generate_upc":
            kwargs = {}
            if args.payload:
                try:
                    kwargs = json.loads(args.payload)
                except Exception:
                    pass
            print(json.dumps({"upc": manager.generate_upc(**kwargs)}, indent=2))
            manager._save_data()

    except Exception as e:
        logger.exception("Identity Manager Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
