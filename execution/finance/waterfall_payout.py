import json
import sys

def calculate_waterfall(gross, splits, recoupment=0, indii_fee_percent=0.15):
    """
    Executes the industrial waterfall:
    Gross -> Indii Fee -> Recoupment -> Partner Splits -> Net Payout
    """
    report = {
        "gross": gross,
        "fee_deducted": gross * indii_fee_percent,
        "remaining_after_fee": gross * (1 - indii_fee_percent),
        "recoupment_applied": 0,
        "payouts": {}
    }

    balance = report["remaining_after_fee"]
    
    # 1. Apply Recoupment
    if recoupment > 0:
        applied = min(balance, recoupment)
        report["recoupment_applied"] = applied
        balance -= applied
    
    # 2. Execute Splits
    for party, percent in splits.items():
        report["payouts"][party] = balance * percent

    report["total_distributed"] = sum(report["payouts"].values())
    report["final_balance"] = balance - report["total_distributed"]

    return report

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Input JSON required"}))
        sys.exit(1)

    data = json.loads(sys.argv[1])
    try:
        report = calculate_waterfall(
            data["gross"], 
            data["splits"], 
            data.get("recoupment", 0),
            data.get("indii_fee_percent", 0.15)
        )
        print(json.dumps(report, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
