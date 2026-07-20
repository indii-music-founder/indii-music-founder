#!/usr/bin/env python3
"""Validate core 20M report disclosures and founder totals."""

import argparse
import json
import re
from decimal import Decimal
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    args = parser.parse_args()
    report = args.report.read_text(encoding="utf-8")
    model = json.loads(args.model.read_text(encoding="utf-8"))
    patterns = [r"current.{0,40}valuation", r"remediat", r"founder.{0,100}not.{0,30}ARR", r"acquisition", r"planning valuation.{0,100}not an appraisal"]
    missing = [pattern for pattern in patterns if not re.search(pattern, report, re.I | re.S)]
    for row in model["founder_scenarios"]:
        expected = sum(Decimal(str(x["count"])) * Decimal(str(x["price"])) for x in row["units"])
        if expected != Decimal(str(row["gross_one_time_cash"])) or row["arr"] != 0:
            raise SystemExit(f"Founder scenario failed: {row['label']}")
    if missing:
        raise SystemExit("Missing report concepts: " + ", ".join(missing))
    if not re.search(r"https?://", report):
        raise SystemExit("No source URL detected")
    print("Report validation passed")


if __name__ == "__main__":
    main()
