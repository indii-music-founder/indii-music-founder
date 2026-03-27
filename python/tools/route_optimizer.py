
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RouteOptimizer(Tool):
    """
    Road / Tour Manager Tool.
    Takes a list of target cities, uses Google Maps API (via Gemini Tools)
    to calculate the most efficient driving route and estimated travel times.
    """

    async def execute(self, cities: list, starting_city: str) -> Response:
        self.set_progress(f"Optimizing Tour Route starting from {starting_city}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_AGENT # Pro required for spatial reasoning/tool use
            
            city_list_str = "\n".join([f"- {city}" for city in cities])
            
            # Use Google Search grounding to find real distances/times
            google_search_tool = types.Tool(
                google_search=types.GoogleSearch()
            )
            
            prompt = f"""
            You are the indiiOS Road Manager. 
            I need you to calculate the most efficient driving route for an upcoming tour.
            
            Starting City: {starting_city}
            Target Cities to Visit:
            {city_list_str}
            
            Tasks:
            1. Use your knowledge (and search if necessary) to order these cities into the most logical, shortest driving route starting from {starting_city}.
            2. Estimate the driving time between each jump.
            3. Output the final route as a JSON array.
            
            Required JSON Format:
            {{
               "optimized_route": [
                 {{
                   "day": 1,
                   "origin": "Starting City",
                   "destination": "Next City",
                   "estimated_drive_time_hours": 4.5,
                   "distance_miles": 280
                 }},
                 ...
               ],
               "total_estimated_miles": 1500,
               "logistical_warnings": ["Warning: Drive from X to Y crosses a mountain pass."]
            }}
            """
            
            

            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                tools=[google_search_tool],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0 # Must be deterministic routing
                )
            )
            
            return Response(
                message=f"Tour route optimized for {len(cities)} cities.",
                additional={"route_plan": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Route Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)

