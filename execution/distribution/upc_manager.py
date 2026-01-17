#!/usr/bin/env python3
"""
upc_manager.py - Universal Product Code Generator

Industrial UPC/EAN management for album and single releases.
Implements GS1 check digit algorithm for valid barcodes.
"""

import datetime
import json
import logging
import os
import sys
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("upc_manager")


class UPCManager:
    """Manages Universal Product Code generation and validation.
    
    Implements the GS1 specification for UPC-A (12-digit) codes.
    Uses a local persistence store to track assigned codes.
    """

    def __init__(self, store_path: str):
        """Initialize the UPC Manager.
        
        Args:
            store_path: Path to the JSON file for persistence.
        """
        self.store_path = store_path
        self.data = self._load_store()
        
        # Default GS1 Company Prefix (would be replaced with real prefix in production)
        self.company_prefix = self.data.get("company_prefix", "060123456")  # 9-digit prefix
        
    def _load_store(self) -> Dict[str, Any]:
        """Load persistence store from disk."""
        try:
            if os.path.exists(self.store_path):
                with open(self.store_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load UPC store: {e}")
        return {"upcs": {}, "sequence": 0, "company_prefix": "060123456"}
    
    def _save_store(self) -> None:
        """Persist store to disk."""
        try:
            os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
            with open(self.store_path, 'w') as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save UPC store: {e}")

    def _calculate_check_digit(self, partial_upc: str) -> int:
        """Calculate GS1 check digit for an 11-digit partial UPC.
        
        Uses the standard modulo-10 algorithm:
        1. Sum odd-position digits, multiply by 3
        2. Sum even-position digits
        3. Add both sums
        4. Check digit = (10 - (sum mod 10)) mod 10
        
        Args:
            partial_upc: 11-digit string without check digit.
            
        Returns:
            Single check digit (0-9).
        """
        if len(partial_upc) != 11 or not partial_upc.isdigit():
            raise ValueError(f"Invalid partial UPC length: {len(partial_upc)}")
            
        odd_sum = sum(int(partial_upc[i]) for i in range(0, 11, 2))
        even_sum = sum(int(partial_upc[i]) for i in range(1, 11, 2))
        total = (odd_sum * 3) + even_sum
        check_digit = (10 - (total % 10)) % 10
        return check_digit

    def generate_upc(self, release_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate a new UPC-A code.
        
        Args:
            release_id: Optional release ID to associate with this UPC.
            
        Returns:
            Dictionary containing the generated UPC and metadata.
        """
        # Increment sequence
        self.data["sequence"] = self.data.get("sequence", 0) + 1
        seq = self.data["sequence"]
        
        # Build 11-digit base (prefix + item reference)
        # Company prefix is 9 digits, item reference is 2 digits
        item_ref = str(seq).zfill(2)[-2:]  # Last 2 digits of sequence
        partial_upc = f"{self.company_prefix}{item_ref}"
        
        if len(partial_upc) != 11:
            logger.error(f"Partial UPC has wrong length: {partial_upc}")
            partial_upc = partial_upc[:11].ljust(11, '0')
        
        check_digit = self._calculate_check_digit(partial_upc)
        full_upc = f"{partial_upc}{check_digit}"
        
        # Store the assignment
        timestamp = datetime.datetime.now().isoformat()
        record = {
            "upc": full_upc,
            "release_id": release_id,
            "created_at": timestamp,
            "sequence": seq
        }
        self.data["upcs"][full_upc] = record
        self._save_store()
        
        logger.info(f"Generated UPC: {full_upc} for release: {release_id}")
        
        return {
            "upc": full_upc,
            "formatted": f"{full_upc[0]} {full_upc[1:6]} {full_upc[6:11]} {full_upc[11]}",
            "release_id": release_id,
            "created_at": timestamp,
            "status": "SUCCESS"
        }

    def validate_upc(self, upc: str) -> Dict[str, Any]:
        """Validate a UPC-A code.
        
        Args:
            upc: 12-digit UPC string.
            
        Returns:
            Validation result with details.
        """
        upc = upc.replace(" ", "").replace("-", "")
        
        if len(upc) != 12:
            return {"valid": False, "error": f"Invalid length: {len(upc)} (expected 12)"}
            
        if not upc.isdigit():
            return {"valid": False, "error": "UPC must contain only digits"}
            
        expected_check = self._calculate_check_digit(upc[:11])
        actual_check = int(upc[11])
        
        if expected_check != actual_check:
            return {
                "valid": False,
                "error": f"Check digit mismatch: expected {expected_check}, got {actual_check}"
            }
            
        return {
            "valid": True,
            "upc": upc,
            "formatted": f"{upc[0]} {upc[1:6]} {upc[6:11]} {upc[11]}"
        }

    def lookup_upc(self, upc: str) -> Optional[Dict[str, Any]]:
        """Look up a UPC in the registry.
        
        Args:
            upc: UPC to look up.
            
        Returns:
            Record if found, None otherwise.
        """
        return self.data.get("upcs", {}).get(upc)


if __name__ == "__main__":
    # Resolve paths relative to project root
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STORE_FILE = os.path.join(BASE_DIR, "upc_store.json")
    
    manager = UPCManager(STORE_FILE)
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: upc_manager.py [generate|validate] ..."}))
        sys.exit(1)
        
    command = sys.argv[1].lower()
    
    try:
        if command == "generate":
            release_id = sys.argv[2] if len(sys.argv) > 2 else None
            result = manager.generate_upc(release_id)
            print(json.dumps(result, indent=2))
            
        elif command == "validate":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Usage: upc_manager.py validate <upc>"}))
                sys.exit(1)
            upc = sys.argv[2]
            result = manager.validate_upc(upc)
            print(json.dumps(result, indent=2))
            
        elif command == "lookup":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Usage: upc_manager.py lookup <upc>"}))
                sys.exit(1)
            upc = sys.argv[2]
            result = manager.lookup_upc(upc)
            print(json.dumps(result or {"error": "UPC not found"}, indent=2))
            
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)
            
    except Exception as e:
        logger.exception("UPC Manager Execution Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
