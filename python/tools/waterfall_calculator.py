import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig


def _normalize_currency(value) -> float:
    """
    Accept a float/int or a string like "$1,234.56" and return a float.

    Raises ValueError if the value cannot be converted.
    """
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("$", "").replace(",", "").strip()
        return float(cleaned)
    raise ValueError(f"Cannot convert {type(value).__name__!r} to a currency amount")


class WaterfallCalculator(Tool):
    """
    Finance Manager Tool.
    Takes total revenue, recoupable expenses, and a splits array to calculate exact payout amounts.
    """

    async def execute(self, total_revenue, recoupable_expenses, royalty_rate, splits: list) -> Response:
        self.set_progress(f"Calculating Waterfall Payouts for Gross Revenue: ${total_revenue}")

        try:
            # ------------------------------------------------------------------
            # Input validation — currency normalisation and range checks
            # ------------------------------------------------------------------
            try:
                total_revenue = _normalize_currency(total_revenue)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid total_revenue: {exc}"}),
                    break_loop=False,
                )

            try:
                recoupable_expenses = _normalize_currency(recoupable_expenses)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid recoupable_expenses: {exc}"}),
                    break_loop=False,
                )

            try:
                royalty_rate = _normalize_currency(royalty_rate)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid royalty_rate: {exc}"}),
                    break_loop=False,
                )

            if total_revenue < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "total_revenue cannot be negative."}),
                    break_loop=False,
                )
            if recoupable_expenses < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "recoupable_expenses cannot be negative."}),
                    break_loop=False,
                )
            if royalty_rate < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "royalty_rate cannot be negative."}),
                    break_loop=False,
                )
            if royalty_rate > 100:
                return Response(
                    message=json.dumps({"status": "error", "message": f"royalty_rate ({royalty_rate}%) cannot exceed 100%."}),
                    break_loop=False,
                )

            if not isinstance(splits, list):
                return Response(
                    message=json.dumps({"status": "error", "message": "splits must be a list of objects."}),
                    break_loop=False,
                )

            for i, comp in enumerate(splits):
                pct = comp.get("split_percentage", 0)
                try:
                    pct = _normalize_currency(pct)
                except (ValueError, TypeError) as exc:
                    return Response(
                        message=json.dumps({"status": "error", "message": f"Invalid split_percentage at index {i}: {exc}"}),
                        break_loop=False,
                    )
                if pct < 0:
                    return Response(
                        message=json.dumps({"status": "error", "message": f"split_percentage at index {i} cannot be negative."}),
                        break_loop=False,
                    )
                if pct > 100:
                    return Response(
                        message=json.dumps({"status": "error", "message": f"split_percentage at index {i} ({pct}%) cannot exceed 100%."}),
                        break_loop=False,
                    )
                comp["split_percentage"] = pct  # store normalised value back

            # ------------------------------------------------------------------
            # Deterministic calculation (No AI needed for exact math)
            # ------------------------------------------------------------------
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
