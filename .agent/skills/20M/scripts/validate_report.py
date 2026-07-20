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
    r"prevent.{0,80}transfer|transfer.{0,80}diligence|hard.{0,80}transfer",
    r"IP.{0,40}asset.{0,40}register|asset.{0,40}register",
    r"(why|how).{0,80}(intellectual property|IP).{0,80}(matter|support).{0,80}value|value.{0,80}(intellectual property|IP)",
]

IP_REGISTER_PATTERNS = [
    r"intellectual property.{0,100}(asset )?register",
    r"rights posture",
    r"review state",
    r"IP-(PLATFORM|BRAND|MODEL|DATA|MUSIC)-",
    r"founder actions",
]

LIVE_ANSWER_CARD_PATTERNS = [
    r"what.{0,40}(intellectual property|IP).{0,40}own",
    r"what.{0,80}(review|evidence).{0,80}(transfer|block)",
    r"how.{0,40}(IP|intellectual property).{0,40}support.{0,40}value",
    r"short answer",
    r"deep answer",
]

INVESTOR_QA_PATTERNS = [
    r"what.{0,40}(own|owned)",
    r"(artist|customer).{0,80}(control|belong)",
    r"licensed.{0,60}(vendor|depend)|vendor-dependent",
    r"evidence.{0,80}(review|available)",
    r"prevent.{0,80}transfer|transfer.{0,80}diligence|hard.{0,80}transfer",
    r"(why|how).{0,80}(value|replacement|transferability)",
]


def missing_concepts(report: str, room: bool = False) -> list[str]:
    patterns = BASE_PATTERNS + (ROOM_PATTERNS if room else [])
    return [pattern for pattern in patterns if not re.search(pattern, report, re.I | re.S)]


def missing_structure(document: str, patterns: list[str]) -> list[str]:
    return [pattern for pattern in patterns if not re.search(pattern, document, re.I | re.S)]


def validate(
    report: str,
    model: dict,
    room: bool = False,
    ip_register: str | None = None,
    live_answer_card: str | None = None,
    investor_qa: str | None = None,
) -> None:
    missing = missing_concepts(report, room)
    for row in model["founder_scenarios"]:
        expected = sum(Decimal(str(x["count"])) * Decimal(str(x["price"])) for x in row["units"])
        if expected != Decimal(str(row["gross_one_time_cash"])) or row["arr"] != 0:
            raise ValueError(f"Founder scenario failed: {row['label']}")
    if missing:
        raise ValueError("Missing report concepts: " + ", ".join(missing))
    if room and ip_register is None:
        raise ValueError("Investor-room validation requires an IP register path.")
    if room and live_answer_card is None:
        raise ValueError("Investor-room validation requires the live-answer card path.")
    if room and investor_qa is None:
        raise ValueError("Investor-room validation requires the investor Q&A index path.")
    if room and ip_register is not None:
        missing_register = missing_structure(ip_register, IP_REGISTER_PATTERNS)
        if missing_register:
            raise ValueError("IP register is missing required diligence structure: " + ", ".join(missing_register))
    if room and live_answer_card is not None:
        missing_card = missing_structure(live_answer_card, LIVE_ANSWER_CARD_PATTERNS)
        if missing_card:
            raise ValueError("Investor-room live-answer card is missing required IP coverage: " + ", ".join(missing_card))
    if room and investor_qa is not None:
        missing_qa = missing_structure(investor_qa, INVESTOR_QA_PATTERNS)
        if missing_qa:
            raise ValueError("Investor-room Q&A index is missing required IP coverage: " + ", ".join(missing_qa))
    if not re.search(r"https?://", report):
        raise ValueError("No source URL detected")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--room", action="store_true", help="Require the complete live investor-room IP question set.")
    parser.add_argument("--ip-register", type=Path, help="Validate the authoritative IP asset register used by an investor-room report.")
    parser.add_argument("--live-answer-card", type=Path, help="Validate the IP answer card used in the investor room.")
    parser.add_argument("--investor-qa", type=Path, help="Validate the investor Q&A index used in the investor room.")
    args = parser.parse_args()
    if args.room and (args.ip_register is None or args.live_answer_card is None or args.investor_qa is None):
        parser.error("--room requires --ip-register, --live-answer-card, and --investor-qa to validate the complete investor IP pack.")
    report = args.report.read_text(encoding="utf-8")
    model = json.loads(args.model.read_text(encoding="utf-8"))
    try:
        ip_register = args.ip_register.read_text(encoding="utf-8") if args.ip_register else None
        live_answer_card = args.live_answer_card.read_text(encoding="utf-8") if args.live_answer_card else None
        investor_qa = args.investor_qa.read_text(encoding="utf-8") if args.investor_qa else None
        validate(report, model, room=args.room, ip_register=ip_register, live_answer_card=live_answer_card, investor_qa=investor_qa)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("Report validation passed")


if __name__ == "__main__":
    main()
