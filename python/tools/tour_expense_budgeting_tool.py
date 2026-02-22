import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TourExpenseBudgetingTool(Tool):
    """
    Finance Manager Tool.
    Ingests expected route lengths, van rental costs, and per diems to flag cash flow gaps.
    """

    async def execute(self, days_on_road: int, daily_guarantee: float, traveling_party_size: int) -> Response:
        self.set_progress(f"Budgeting {days_on_road} day tour for {traveling_party_size} people")
        
        try:
            # Deterministic math block
            van_rental_daily = 150.0
            gas_daily_estimate = 75.0
            hotel_room_rate = 120.0  # Assuming 2 people per room
            rooms_needed = max(1, traveling_party_size // 2 + (traveling_party_size % 2))
            per_diem = 30.0
            
            daily_overhead = van_rental_daily + gas_daily_estimate + (hotel_room_rate * rooms_needed) + (per_diem * traveling_party_size)
            total_overhead = daily_overhead * days_on_road
            
            expected_gross = daily_guarantee * days_on_road
            net_profit_loss = expected_gross - total_overhead
            
            report = {
                "days_on_road": days_on_road,
                "gross_revenue": expected_gross,
                "total_expenses": total_overhead,
                "net_profit": net_profit_loss,
                "burn_rate_per_day": daily_overhead,
                "status": "PROFITABLE" if net_profit_loss > 0 else "CASH FLOW WARNING"
            }
            
            return Response(
                message=f"Tour budget calculated. Status: {report['status']}",
                additional={"budget_report": report}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tour Expense Budgeting Tool Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
