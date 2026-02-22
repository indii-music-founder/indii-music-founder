import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MerchSettlementCalculator(Tool):
    """
    Road Manager Tool.
    Calculate nightly venue cuts, sales tax, and profit margins to determine correct payouts at load-out.
    """

    async def execute(self, gross_sales: float, venue_cut_percentage: float, sales_tax_percentage: float) -> Response:
        self.set_progress(f"Calculating merch settlement for gross sales of ${gross_sales}")
        
        try:
            # Deterministic math block for settlement at the end of the night
            
            # The sales figure includes sales tax, so we back it out first
            net_sales = gross_sales / (1 + (sales_tax_percentage / 100))
            tax_owed = gross_sales - net_sales
            
            # Venue cut is usually taken on the net sales
            venue_cut = net_sales * (venue_cut_percentage / 100)
            
            artist_takehome = net_sales - venue_cut
            
            report = {
                "gross_collected": gross_sales,
                "sales_tax_withheld": tax_owed,
                "net_sales": net_sales,
                "venue_cut": venue_cut,
                "venue_percentage": venue_cut_percentage,
                "artist_net_takehome": artist_takehome
            }
            
            return Response(
                message=f"Merch settlement calculated. Artist Net: ${artist_takehome:.2f}",
                additional={"settlement_report": report}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Merch Settlement Calculator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
