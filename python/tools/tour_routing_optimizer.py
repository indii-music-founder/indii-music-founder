import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TourRoutingOptimizer(Tool):
    """
    Road / Tour Manager Tool.
    Simulates calculating the most gas-efficient route for a list of target cities.
    """

    async def execute(self, target_cities: list, start_city: str) -> Response:
        self.set_progress(f"Optimizing tour route starting from {start_city}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Spatial reasoning simulation
            
            cities_str = ", ".join(target_cities)
            
            prompt = f"""
            You are the indiiOS Tour & Road Manager.
            Calculate the most geographically logical, gas-efficient tour route given a starting point and a list of target cities.
            
            Start City: {start_city}
            Target Cities: {cities_str}
            
            Rules:
            1. You MUST visit EVERY city in the Target Cities list exactly once.
            2. Organize the stops in an order that avoids backtracking across the country (solve the traveling salesman problem logically).
            3. Estimate the typical drive time in hours between each consecutive stop based on standard US geography.
            
            Return ONLY a JSON object:
            {{
              "starting_point": "{start_city}",
              "optimized_route_order": ["{start_city}", "City 1", "City 2", "..."],
              "legs": [
                {{
                  "from": "{start_city}",
                  "to": "City 1",
                  "estimated_drive_hours": 4
                }}
              ],
              "total_estimated_drive_hours": 0
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0 # Deterministic logic problem
                )
            )
            
            return Response(
                message=f"Tour route optimized across {len(target_cities)} cities.",
                additional={"route_plan": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tour Routing Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
