import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class WaterfallCalculator(Tool):
    """
    Finance Manager Tool.
    Takes total revenue, recoupable expenses, and a splits array to calculate exact payout amounts.
    """

    async def execute(self, total_revenue: float, recoupable_expenses: float, royalty_rate: float, splits: list) -> Response:
        self.set_progress(f"Calculating Waterfall Payouts for Gross Revenue: ${total_revenue}")
        
        try:
            # Deterministic calculation (No AI needed for exact math)
            if total_revenue < 0 or recoupable_expenses < 0 or royalty_rate < 0:
                return Response(message="Error: Financial inputs must be positive numbers.", break_loop=False)
                
            total_split = sum([comp.get('split_percentage', 0) for comp in splits])
            if abs(total_split - 100.0) > 0.01:
                return Response(message=f"Error: Split percentages must equal 100. Current total: {total_split}%", break_loop=False)

            # 1. Recoupment Phase
            net_profit_after_recoupment = total_revenue - recoupable_expenses
            
            payout_report = {
                "gross_revenue": float(total_revenue),
                "recoupable_expenses": float(recoupable_expenses),
                "recoupment_status": "Recouped" if net_profit_after_recoupment > 0 else "Unrecouped",
                "net_profit_allocatable": 0.0,
                "label_share": 0.0,
                "artist_pool": 0.0,
                "individual_payouts": []
            }

            if net_profit_after_recoupment > 0:
                payout_report["net_profit_allocatable"] = float(net_profit_after_recoupment)
                
                # 2. Royalty Allocation
                artist_pool = net_profit_after_recoupment * (royalty_rate / 100.0)
                label_share = net_profit_after_recoupment - artist_pool
                
                payout_report["artist_pool"] = float(artist_pool)
                payout_report["label_share"] = float(label_share)
                
                # 3. Splits Distribution
                for person in splits:
                    name = person.get("name")
                    percentage = person.get("split_percentage", 0)
                    payout_amount = artist_pool * (percentage / 100.0)
                    
                    payout_report["individual_payouts"].append({
                        "name": name,
                        "percentage": percentage,
                        "payout_amount": float(payout_amount)
                    })
            else:
                payout_report["remaining_recoupment_balance"] = abs(float(net_profit_after_recoupment))
                for person in splits:
                     payout_report["individual_payouts"].append({
                        "name": person.get("name"),
                        "percentage": person.get("split_percentage", 0),
                        "payout_amount": 0.0
                    })

            return Response(
                message=f"Waterfall Payout Calculated ({payout_report['recoupment_status']}).",
                additional={"payout_report": payout_report}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Waterfall Calculator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
