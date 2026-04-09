import json
import logging
import sys
from typing import Any, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("waterfall_payout")


def calculate_waterfall(
    gross_amount: float,
    party_splits: Dict[str, float],
    recoupment_remaining: float = 0.0,
    platform_fee_percent: float = 0.15
) -> Dict[str, Any]:
    """Executes the industrial waterfall logic for revenue distribution.

    Waterfall order:
    1. Gross Revenue
    2. Subtract Platform Fee (e.g., Indii's 15%)
    3. Apply Recoupment (if any debt remains)
    4. Distribute Net Revenue according to party splits.

    Args:
        gross_amount: Total revenue before any deductions.
        party_splits: Dict mapping party names to their fractional share (e.g., {"artist": 0.5}).
        recoupment_remaining: Outstanding recoupable balance.
        platform_fee_percent: Percentage deducted by the platform (0.15 = 15%).

    Returns:
        A detailed report of the distribution.
    """
    logger.info(f"Calculating waterfall for gross: {gross_amount:.2f}")

    # Validate splits
    total_splits = sum(party_splits.values())
    if not (0.99 <= total_splits <=
            1.01):  # Allow for small floating point drift
        logger.warning(
            f"Warning: Party splits sum to {total_splits}, which is not exactly 1.0")

    fee_amount = gross_amount * platform_fee_percent
    revenue_after_fee = gross_amount - fee_amount

    recoupment_data: Dict[str, float] = {
        "starting_balance": float(recoupment_remaining),
        "applied": 0.0,
        "remaining_balance": float(recoupment_remaining)
    }

    balance = revenue_after_fee

    # 1. Apply Recoupment
    if recoupment_remaining > 0:
        applied = min(balance, recoupment_remaining)
        recoupment_data["applied"] = float(applied)
        recoupment_data["remaining_balance"] = float(
            recoupment_remaining - applied
        )
        balance -= applied
        logger.info(f"Applied {applied:.2f} towards recoupment.")

    distributions: Dict[str, Dict[str, Any]] = {}
    # 2. Execute Party Splits
    for party, split_percent in party_splits.items():
        payout = balance * split_percent
        distributions[party] = {
            "split": f"{split_percent * 100:.1f}%",
            "amount": float(payout)
        }

    total_distributed = sum(d["amount"] for d in distributions.values())
    unallocated_balance = max(0, balance - total_distributed)

    report = {
        "gross": float(gross_amount),
        "platform_fee": {
            "percent": f"{platform_fee_percent * 100:.1f}%",
            "amount": float(fee_amount)
        },
        "revenue_after_fee": float(revenue_after_fee),
        "recoupment": recoupment_data,
        "distributions": distributions,
        "summary_status": "PROCESSED",
        "total_distributed": float(total_distributed),
        "unallocated_balance": float(unallocated_balance)
    }

    return report



if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Waterfall Payout Calculator")
    parser.add_argument("payload", help="JSON payload for the calculation")

    args = parser.parse_args()

    try:
        input_data = json.loads(args.payload)

        # Mandatory field validation
        if "gross" not in input_data or "splits" not in input_data:
            raise ValueError("Missing 'gross' or 'splits' in input data.")

        payout_report = calculate_waterfall(
            gross_amount=float(input_data["gross"]),
            party_splits=input_data["splits"],
            recoupment_remaining=float(input_data.get("recoupment", 0)),
            platform_fee_percent=float(input_data.get("indii_fee_percent", 0.15))
        )
        print(json.dumps(payout_report, indent=2))

    except (json.JSONDecodeError, ValueError, TypeError, KeyError) as e:
        logger.error(f"Input Error: {e}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
    except Exception:
        logger.exception("Unexpected error in waterfall calculation")
        print(json.dumps({"error": "Internal Server Error"}))
        sys.exit(1)
