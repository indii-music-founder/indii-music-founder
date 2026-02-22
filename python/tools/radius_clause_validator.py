
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RadiusClauseValidator(Tool):
    """
    Road & Tour Manager Tool.
    Analyzes a proposed tour route to ensure no gigs fall within a radius clause of an anchor festival.
    """

    async def execute(self, festival_city: str, festival_date: str, radius_miles: int, blackout_days: int, proposed_tour_dates: list) -> Response:
        self.set_progress(f"Validating Radius Clause for Anchor Festival in {festival_city}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Spatial and temporal reasoning
            
            tour_dates_str = json.dumps(proposed_tour_dates)
            
            prompt = f"""
            You are the indiiOS Road Manager.
            Check a proposed list of tour dates against an anchor festival's strict radius clause.
            
            Anchor Festival City: {festival_city}
            Anchor Festival Date: {festival_date}
            Restricted Radius: {radius_miles} miles
            Blackout Period: {blackout_days} days before and after
            
            Proposed Tour Routing:
            {tour_dates_str}
            
            Rules:
            1. Flag any proposed dates that violate the radius clause geographically (e.g., playing a small club 50 miles away).
            2. Flag any proposed dates that violate the radius clause temporally.
            3. Return a clean approval status.
            
            Return ONLY a JSON object:
            {{
              "is_compliant": false,
              "violations_found": [
                {{"city": "...", "date": "...", "reason": "Violates 100 mile radius limit (is 40 miles away)"}}
              ],
              "recommendation": "Drop the club date or negotiate an exemption with the festival buyer."
            }}
            """
            
            

            
                        _rl = RateLimiter()

            
                        wait_time = _rl.wait_time("gemini")

            
                        if wait_time > 0:

            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

            
                            await asyncio.sleep(wait_time)

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0 # Deterministic checking
                )
            )
            
            return Response(
                message=f"Radius clause validation completed.",
                additional={"validation_report": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Radius Clause Validator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
