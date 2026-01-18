#!/usr/bin/env python3
"""
keys_manager.py - Rights Management & BWARM Generator

Handles "Keys Layer" operations:
1. BWARM (Bulk Works Registration) CSV generation for The MLC.
2. Merlin delivery compliance checks.
"""

import csv
import json
import io
import sys
import logging
import datetime
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("keys_manager")


class KeysManager:
    """Manages publishing rights and external reporting keys."""

    def generate_bwarm_csv(self, works: List[Dict[str, Any]]) -> str:
        """Generates a CSV formatted for The MLC (Mechanical Licensing Collective).

        Using a simplified BWARM-compatible schema:
        - Work Title
        - ISWC (if available)
        - HFA Code (if available)
        - Writer 1 Last Name
        - Writer 1 First Name
        - Writer 1 IPI
        - Publisher Name
        - Publisher IPI
        - Collection Share
        """
        output = io.StringIO()
        fieldnames = [
            'Work Title',
            'ISWC',
            'Internal Work ID',
            'Writer 1 Last Name',
            'Writer 1 First Name',
            'Writer 1 Role (C/A)',
            'Writer 1 IPI',
            'Publisher Name',
            'Publisher IPI',
            'Collection Share (%)',
            'Original Release Date'
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for work in works:
            writer.writerow({
                'Work Title': work.get('title', 'Untitled Work'),
                'ISWC': work.get('iswc', ''),
                'Internal Work ID': work.get('id', ''),
                'Writer 1 Last Name': work.get('writer_last', 'Doe'),
                'Writer 1 First Name': work.get('writer_first', 'John'),
                'Writer 1 Role (C/A)': 'C',  # Composer/Author
                'Writer 1 IPI': work.get('writer_ipi', ''),
                'Publisher Name': work.get('publisher', 'Self-Published'),
                'Publisher IPI': work.get('publisher_ipi', ''),
                'Collection Share (%)': '100',
                'Original Release Date': work.get(
                    'release_date',
                    datetime.datetime.now().strftime('%Y-%m-%d')
                )
            })

        return output.getvalue()

    def check_merlin_compliance(
            self, catalog_data: Dict[str, Any]) -> Dict[str, Any]:
        """Checks if a catalog meets Merlin application standards."""
        # Simple heuristic check

        track_count = catalog_data.get('total_tracks', 0)
        has_isrcs = catalog_data.get('has_isrcs', False)
        has_upcs = catalog_data.get('has_upcs', False)
        exclusive_rights = catalog_data.get('exclusive_rights', True)

        score = 0
        checks = []

        # Merlin typically requires a catalog size of ~50+ tracks or
        # significant revenue
        if track_count >= 50:
            score += 40
            checks.append("Catalog size sufficient (>50 tracks)")
        else:
            checks.append(f"Catalog size low ({track_count}/50)")

        if has_isrcs:
            score += 20
            checks.append("ISRCs assigned")

        if has_upcs:
            score += 20
            checks.append("UPCs assigned")

        if exclusive_rights:
            score += 20
            checks.append("Exclusive rights confirmed")

        status = "READY" if score >= 80 else "NOT_READY"

        return {
            "status": status,
            "score": score,
            "checks": checks,
            "timestamp": datetime.datetime.now().isoformat()
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": (
                "Usage: keys_manager.py [bwarm|merlin_check] <json_payload>"
            )
        }))
        sys.exit(1)

    manager = KeysManager()
    cmd = sys.argv[1].lower()

    try:
        input_data = json.loads(sys.argv[2])

        if cmd == "bwarm":
            # Input expected: {"works": [...]}
            works = input_data.get("works", [])
            csv_out = manager.generate_bwarm_csv(works)
            print(json.dumps({
                "status": "SUCCESS",
                "format": "BWARM_CSV",
                "csv": csv_out
            }))

        elif cmd == "merlin_check":
            report = manager.check_merlin_compliance(input_data)
            print(json.dumps(report, indent=2))

        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
            sys.exit(1)

    except Exception as e:
        logger.exception("Keys Manager Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
