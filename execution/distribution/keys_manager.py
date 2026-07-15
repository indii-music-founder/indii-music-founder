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

        ISSUE-792 FIX: Requires real writer/publisher data. Never fabricates legal names or shares.

        Schema (MLC Bulk Work Registration template):
        - Work Title (required)
        - ISWC (optional)
        - Writer Last Name (required - no defaults)
        - Writer First Name (required - no defaults)
        - Writer IPI (optional but recommended)
        - Publisher Name (required - no "Self-Published" default)
        - Publisher IPI (optional but recommended)
        - Collection Share % (from actual metadata, summed across splits)
        - Original Release Date (from metadata, not defaulted to today)
        """
        output = io.StringIO()
        fieldnames = [
            'Work Title',
            'ISWC',
            'Internal Work ID',
            'Writer Last Name',
            'Writer First Name',
            'Writer Role (C/A)',
            'Writer IPI',
            'Publisher Name',
            'Publisher IPI',
            'Collection Share (%)',
            'Original Release Date'
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for work in works:
            # ISSUE-792: Validate required fields before writing
            title = work.get('title', '').strip()
            if not title:
                logger.warning("Skipping work with missing or empty title")
                continue

            writer_last = work.get('writer_last', '').strip()
            writer_first = work.get('writer_first', '').strip()
            if not writer_last or not writer_first:
                logger.warning(f"Skipping work '{title}': requires real writer legal names (first and last)")
                continue

            publisher = work.get('publisher', '').strip()
            if not publisher:
                logger.warning(f"Skipping work '{title}': requires real publisher name (no 'Self-Published' default)")
                continue

            # Collection share should come from actual royalty split data, not hardcoded to 100%
            collection_share = work.get('collection_share')
            if collection_share is None:
                logger.warning(f"Skipping work '{title}': requires actual collection share from royalty splits")
                continue

            # Release date must be from metadata, never defaulted to today
            release_date = work.get('release_date', '').strip()
            if not release_date:
                logger.warning(f"Skipping work '{title}': requires actual release date from metadata")
                continue

            writer.writerow({
                'Work Title': title,
                'ISWC': work.get('iswc', '').strip(),
                'Internal Work ID': work.get('id', '').strip(),
                'Writer Last Name': writer_last,
                'Writer First Name': writer_first,
                'Writer Role (C/A)': work.get('writer_role', 'C'),  # Composer/Author/Both
                'Writer IPI': work.get('writer_ipi', '').strip(),
                'Publisher Name': publisher,
                'Publisher IPI': work.get('publisher_ipi', '').strip(),
                'Collection Share (%)': str(collection_share),
                'Original Release Date': release_date
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
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Keys Manager & BWARM Generator")
    parser.add_argument("command", choices=["bwarm", "merlin_check"], help="Command to execute")
    parser.add_argument("json_data", help="JSON payload string")
    parser.add_argument("--storage-path", help="Optional path for file persistence")

    args = parser.parse_args()
    manager = KeysManager()

    try:
        input_data = json.loads(args.json_data)

        if args.command == "bwarm":
            # Input expected: {"works": [...]}
            works = input_data.get("works", [])
            csv_out = manager.generate_bwarm_csv(works)
            print(json.dumps({
                "status": "SUCCESS",
                "format": "BWARM_CSV",
                "csv": csv_out
            }))

        elif args.command == "merlin_check":
            report = manager.check_merlin_compliance(input_data)
            print(json.dumps(report, indent=2))

    except Exception as e:
        logger.exception("Keys Manager Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
