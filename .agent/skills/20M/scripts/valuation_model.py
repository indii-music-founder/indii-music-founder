#!/usr/bin/env python3
"""Generate deterministic founder, subscriber, and acquisition-target tables."""

import argparse
import csv
import json
import math
from decimal import Decimal, InvalidOperation
from pathlib import Path


def number(value, field):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{field} must be numeric") from exc
    if result < 0:
        raise ValueError(f"{field} must be non-negative")
    return result


def positive_int(value, field):
    result = int(value)
    if result <= 0 or Decimal(result) != number(value, field):
        raise ValueError(f"{field} must be a positive integer")
    return result


def compact_amount(value):
    cleaned = value.strip().upper().replace("$", "").replace(",", "")
    factors = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000, "T": 1_000_000_000_000}
    suffix = cleaned[-1]
    factor = Decimal(factors.get(suffix, 1))
    base = cleaned[:-1] if suffix in factors else cleaned
    result = number(base, "target") * factor
    if result <= 0:
        raise ValueError("target must be greater than zero")
    return result


def money(value):
    return f"${Decimal(str(value)):,.0f}"


def calculate(config):
    milestones = [positive_int(v, "subscriber milestone") for v in config["subscriber_milestones"]]
    prices = [number(v, "monthly price") for v in config["monthly_prices"]]
    targets = [number(v, "target enterprise value") for v in config["target_enterprise_values"]]
    multiples = [number(v, "acquisition multiple") for v in config["acquisition_multiples"]]
    if any(v == 0 for v in prices + multiples):
        raise ValueError("prices and multiples must be greater than zero")

    founders = []
    for scenario in config["founder_scenarios"]:
        total_units = 0
        gross = Decimal(0)
        units = []
        for item in scenario["units"]:
            count = positive_int(item["count"], "founder count")
            price = number(item["price"], "founder price")
            total_units += count
            gross += count * price
            units.append({"count": count, "price": float(price)})
        founders.append({"label": scenario["label"], "total_units": total_units, "gross_one_time_cash": float(gross), "arr": 0, "units": units})

    subscribers = []
    for count in milestones:
        for price in prices:
            mrr = count * price
            subscribers.append({"subscribers": count, "monthly_price": float(price), "mrr": float(mrr), "arr": float(mrr * 12)})

    targets_out = []
    for target in targets:
        for multiple in multiples:
            required_arr = target / multiple
            for price in prices:
                targets_out.append({
                    "target_enterprise_value": float(target),
                    "arr_multiple": float(multiple),
                    "required_arr": float(required_arr),
                    "monthly_price": float(price),
                    "required_subscribers": math.ceil(required_arr / (price * 12)),
                })
    return {"company": config["company"], "as_of": config.get("as_of", "not supplied"), "currency": config.get("currency", "USD"), "founder_scenarios": founders, "subscriber_scenarios": subscribers, "acquisition_targets": targets_out}


def write_csv(path, rows):
    flat = [{k: v for k, v in row.items() if k != "units"} for row in rows]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(flat[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(flat)


def write_markdown(path, model):
    lines = [f"# {model['company']} deterministic scenarios", "", f"As of: {model['as_of']}", "", "## Founder scenarios", "", "| Scenario | Units | Gross one-time cash | ARR |", "|---|---:|---:|---:|"]
    for row in model["founder_scenarios"]:
        lines.append(f"| {row['label']} | {row['total_units']} | {money(row['gross_one_time_cash'])} | $0 |")
    lines += ["", "> Founder receipts are one-time cash, not ARR or MRR.", "", "## Subscriber scenarios", "", "| Subscribers | Monthly price | MRR | ARR |", "|---:|---:|---:|---:|"]
    for row in model["subscriber_scenarios"]:
        lines.append(f"| {row['subscribers']:,} | {money(row['monthly_price'])} | {money(row['mrr'])} | {money(row['arr'])} |")
    lines += ["", "## Acquisition target math", "", "| Target EV | Multiple | Required ARR | Price | Required subscribers |", "|---:|---:|---:|---:|---:|"]
    for row in model["acquisition_targets"]:
        lines.append(f"| {money(row['target_enterprise_value'])} | {row['arr_multiple']:g}× | {money(row['required_arr'])} | {money(row['monthly_price'])} | {row['required_subscribers']:,} |")
    lines += ["", "> Arithmetic only: customer counts do not establish valuation without verified revenue quality and current multiple support.", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--target", action="append")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    if args.target:
        config["target_enterprise_values"] = [str(compact_amount(value)) for value in args.target]
    model = calculate(config)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "model.json").write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    write_markdown(args.out_dir / "valuation_scenarios.md", model)
    write_csv(args.out_dir / "founder_scenarios.csv", model["founder_scenarios"])
    write_csv(args.out_dir / "subscriber_scenarios.csv", model["subscriber_scenarios"])
    write_csv(args.out_dir / "acquisition_targets.csv", model["acquisition_targets"])
    print(args.out_dir / "valuation_scenarios.md")


if __name__ == "__main__":
    main()
