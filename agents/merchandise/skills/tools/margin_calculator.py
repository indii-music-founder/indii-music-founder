import sys
import json

def calculate_margin(price, cost, shipping=0):
    total_cost = cost + shipping
    profit = price - total_cost
    margin_pct = (profit / price) * 100 if price > 0 else 0
    return {
        "price": price,
        "total_cost": total_cost,
        "profit": round(profit, 2),
        "margin_percentage": round(margin_pct, 2)
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: margin_calculator.py <price> <cost> [shipping]"}))
        sys.exit(1)
    
    try:
        price = float(sys.argv[1])
        cost = float(sys.argv[2])
        shipping = float(sys.argv[3]) if len(sys.argv) > 3 else 0
        print(json.dumps(calculate_margin(price, cost, shipping)))
    except ValueError:
        print(json.dumps({"error": "Price, cost and shipping must be numbers."}))
