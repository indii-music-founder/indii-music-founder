
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SpotifyMarqueeRoasEstimator(Tool):
    """
    Marketing Executive Tool.
    Estimates ROAS for a Spotify Marquee campaign based on artist analytics.
    Exports projection as CSV for the marketing budget spreadsheet.
    """

    async def execute(self, monthly_listeners: int, campaign_budget_usd: float, target_track: str, **kwargs) -> Response:
        self.set_progress(f"Estimating Marquee ROAS for '{target_track}' (${campaign_budget_usd})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive and Spotify Ads Specialist.
            Estimate the return on ad spend (ROAS) for a Spotify Marquee campaign.
            
            Track: {target_track}
            Monthly Listeners: {monthly_listeners}
            Campaign Budget: ${campaign_budget_usd}
            
            Spotify Marquee Benchmarks:
            - Avg intent rate: 35-65%
            - Avg cost-per-reach: $0.25-$0.75
            - Avg save rate: 8-15%
            - Avg stream-per-listener: 3.5 in first 14 days
            
            Return ONLY a JSON object:
            {{
              "estimated_reach": 0,
              "estimated_intent_rate": "45%",
              "estimated_saves": 0,
              "estimated_streams_14d": 0,
              "estimated_revenue_streams": 0.0,
              "cost_per_stream": 0.0,
              "roas_ratio": 0.0,
              "recommendation": "Run / Hold / Skip",
              "optimization_tips": ["..."]
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
            )
            roas_data = json.loads(response.text)
            
            # --- CSV Export ---
            import os
            csv_rows = [
                "Metric,Value",
                f"Budget,${campaign_budget_usd}",
                f"Est. Reach,{roas_data.get('estimated_reach', 'N/A')}",
                f"Intent Rate,{roas_data.get('estimated_intent_rate', 'N/A')}",
                f"Est. Saves,{roas_data.get('estimated_saves', 'N/A')}",
                f"Est. Streams (14d),{roas_data.get('estimated_streams_14d', 'N/A')}",
                f"Est. Revenue,${roas_data.get('estimated_revenue_streams', 0)}",
                f"Cost Per Stream,${roas_data.get('cost_per_stream', 0)}",
                f"ROAS Ratio,{roas_data.get('roas_ratio', 0)}",
                f"Recommendation,{roas_data.get('recommendation', 'N/A')}"
            ]
            csv_payload = "\n".join(csv_rows)
            
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Marquee ROAS: {roas_data.get('roas_ratio','N/A')}x — {roas_data.get('recommendation','N/A')}",
                additional={"roas_data": roas_data, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Spotify Marquee ROAS Estimator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
