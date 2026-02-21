import json
import argparse
from typing import Dict, Any, List

def analyze_ticketing(event_id: str, current_sales: int, venue_capacity: int, days_to_show: int) -> Dict[str, Any]:
    """
    Mock implementation of a ticketing analyzer for the Road Agent.
    In reality, this would connect to Eventbrite, Ticketmaster, or Dice APIs 
    to analyze scan rates, drop counts, and sales velocity over time.
    """
    try:
        sell_out_percentage = (current_sales / venue_capacity) * 100
        
        # Calculate velocity
        sales_velocity = "Slow"
        projected_final_sales = current_sales
        
        if days_to_show > 0:
            avg_daily_sales = current_sales / max(1, (30 - days_to_show)) # Assuming 30 day sale window
            if sell_out_percentage > 80:
                sales_velocity = "High (Sell Out Expected)"
                projected_final_sales = venue_capacity
            elif sell_out_percentage > 50 and days_to_show < 7:
                sales_velocity = "Medium (Walk-up Dependant)"
                projected_final_sales = min(venue_capacity, int(current_sales + (avg_daily_sales * days_to_show * 1.5)))
            else:
                sales_velocity = "Low (Marketing Push Needed)"
                projected_final_sales = int(current_sales + (avg_daily_sales * days_to_show))
                
        result = {
            "status": "success",
            "event_id": event_id,
            "current_sales": current_sales,
            "sell_out_percentage": round(sell_out_percentage, 1),
            "sales_velocity": sales_velocity,
            "projected_final_sales": min(venue_capacity, projected_final_sales),
            "actionable_insight": "Increase ad spend in local market" if "Low" in sales_velocity else "Maintain course"
        }
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ticketing Analyzer Tool")
    parser.add_argument("--event", type=str, required=True, help="Event ID")
    parser.add_argument("--sales", type=int, required=True, help="Current ticket sales")
    parser.add_argument("--capacity", type=int, required=True, help="Total venue capacity")
    parser.add_argument("--days", type=int, required=True, help="Days until the show")
    
    args = parser.parse_args()
    
    result = analyze_ticketing(args.event, args.sales, args.capacity, args.days)
    print(json.dumps(result, indent=2))
