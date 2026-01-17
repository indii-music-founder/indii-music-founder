import json
import logging
import sys
from typing import Any, Dict, Optional

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
    if not (0.99 <= total_splits <= 1.01): # Allow for small floating point drift
        logger.warning(f"Warning: Party splits sum to {total_splits}, which is not exactly 1.0")

    fee_amount = gross_amount * platform_fee_percent
    revenue_after_fee = gross_amount - fee_amount
    
    report = {
        "gross": float(gross_amount),
        "platform_fee": {
            "percent": f"{platform_fee_percent * 100:.1f}%",
            "amount": float(fee_amount)
        },
        "revenue_after_fee": float(revenue_after_fee),
        "recoupment": {
            "starting_balance": float(recoupment_remaining),
            "applied": 0.0,
            "remaining_balance": float(recoupment_remaining)
        },
        "distributions": {},
        "summary_status": "PROCESSED"
    }

    balance = revenue_after_fee
    
    # 1. Apply Recoupment
    if recoupment_remaining > 0:
        applied = min(balance, recoupment_remaining)
        report["recoupment"]["applied"] = float(applied)
        report["recoupment"]["remaining_balance"] = float(recoupment_remaining - applied)
        balance -= applied
        logger.info(f"Applied {applied:.2f} towards recoupment.")
    
    # 2. Execute Party Splits
    for party, split_percent in party_splits.items():
        payout = balance * split_percent
        report["distributions"][party] = {
            "split": f"{split_percent * 100:.1f}%",
            "amount": float(payout)
        }

    report["total_distributed"] = float(sum(d["amount"] for d in report["distributions"].values()))
    report["unallocated_balance"] = float(max(0, balance - report["total_distributed"]))

    return report

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Input JSON required. Example: '{\"gross\": 1000, \"splits\": {\"artist\": 0.5, \"label\": 0.5}, \"recoupment\": 100}'"
        }))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        
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
    except Exception as e:
        logger.exception("Unexpected error in waterfall calculation")
        print(json.dumps({"error": "Internal Server Error"}))
        sys.exit(1)
