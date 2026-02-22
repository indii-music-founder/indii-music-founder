import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SpotifyMarqueeRoasEstimator(Tool):
    """
    Marketing Executive Tool.
    Estimates Return on Ad Spend for Spotify Marquee / Showcase campaigns based on budget.
    """

    async def execute(self, budget_usd: float, genre: str, target_market: str = "US") -> Response:
        self.set_progress(f"Estimating Spotify Marquee ROAS for ${budget_usd} budget in {genre}")
        
        try:
            # Deterministic estimation logic based on average Marquee costs (~$0.55 per click)
            cpc_estimate = 0.55 
            if genre.lower() in ["pop", "hip hop", "rap"]:
                cpc_estimate = 0.65 # More competitive
            elif genre.lower() in ["jazz", "classical"]:
                cpc_estimate = 0.45 # Less competitive
                
            expected_clicks = int(budget_usd / cpc_estimate)
            
            # Intent rate (people who save/playlist after clicking) averages around 15-20%
            expected_intent_rate = 0.18
            expected_saves = int(expected_clicks * expected_intent_rate)
            
            # Value of a save in streams over 1 year is approx 12 streams
            expected_streams = expected_saves * 12
            # Spotify payout per stream approx $0.0035
            payout_per_stream = 0.0035
            
            expected_revenue = expected_streams * payout_per_stream
            roas_percentage = (expected_revenue / budget_usd) * 100
            
            report = {
                "budget": budget_usd,
                "estimated_clicks": expected_clicks,
                "cost_per_click": cpc_estimate,
                "estimated_saves": expected_saves,
                "estimated_streams_1yr": expected_streams,
                "estimated_revenue": round(expected_revenue, 2),
                "roas_percentage": round(roas_percentage, 2),
                "viability": "GOOD" if roas_percentage > 50 else "LOSS LEADER / AWARENESS ONLY"
            }
            
            return Response(
                message=f"Spotify Marquee ROAS Estimated. Viability: {report['viability']}",
                additional={"marquee_projection": report}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Spotify Marquee ROAS Estimator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
