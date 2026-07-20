#!/usr/bin/env python3
"""Validate core 20M report disclosures, IP boundaries, and founder totals."""

import argparse
import json
import re
from decimal import Decimal
from pathlib import Path


BASE_PATTERNS = [
    r"current.{0,40}valuation",
    r"remediat",
    r"founder.{0,100}not.{0,30}ARR",
    r"acquisition",
    r"planning valuation.{0,100}not an appraisal",
    r"intellectual property|IP asset",
    r"IP answer matrix",
    r"customer.{0,200}(customer-controlled|not.{0,40}(owned|platform.{0,20}IP)|receive.{0,60}no.{0,20}platform.{0,20}IP)",
    r"licensed|vendor-dependent",
    r"chain.{0,20}title|assignment",
]

ROOM_PATTERNS = [
    r"what.{0,40}(intellectual property|IP).{0,40}own",
    r"what.{0,80}(artist|customer).{0,80}(control|belong)",
    r"licensed.{0,60}(vendor|depend)|vendor-dependent",
    r"evidence.{0,80}(review|available)",
    r"prevent.{0,80}transfer|transfer.{0,80}diligence",
]


def missing_concepts(report: str, room: bool = False) -> list[str]:
    patterns = BASE_PATTERNS + (ROOM_PATTERNS if room else [])
    return [pattern for pattern in patterns if not re.search(pattern, report, re.I | re.S)]


def validate(report: str, model: dict, room: bool = False) -> None:
    missing = missing_concepts(report, room)
    for row in model["founder_scenarios"]:
        expected = sum(Decimal(str(x["count"])) * Decimal(str(x["price"])) for x in row["units"])
        if expected != Decimal(str(row["gross_one_time_cash"])) or row["arr"] != 0:
            raise ValueError(f"Founder scenario failed: {row['label']}")
    if missing:
        raise ValueError("Missing report concepts: " + ", ".join(missing))
    if not re.search(r"https?://", report):
        raise ValueError("No source URL detected")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--room", action="store_true", help="Require the complete live investor-room IP question set.")
    args = parser.parse_args()
    report = args.report.read_text(encoding="utf-8")
    model = json.loads(args.model.read_text(encoding="utf-8"))
    try:
        validate(report, model, room=args.room)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("Report validation passed")


if __name__ == "__main__":
    main()
