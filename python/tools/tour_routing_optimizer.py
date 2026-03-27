
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TourRoutingOptimizer(Tool):
    """
    Road / Tour Manager Tool.
    Calculates the most gas-efficient route for a list of target cities.
    Uses Google Directions API for real drive time/distance data when available.
    Falls back to LLM spatial reasoning when API is not configured.
    """

    async def execute(self, target_cities: list, start_city: str, **kwargs) -> Response:
        self.set_progress(f"Optimizing tour route starting from {start_city}")
        
        try:
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            google_maps_key = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
            
            # --- Strategy 1: Google Directions API for real distances ---
            if google_maps_key and len(target_cities) <= 23:
                self.set_progress("Calculating real drive times via Google Directions API...")
                import requests
                
                # Build waypoints for the Directions API
                all_cities = [start_city] + list(target_cities)
                waypoints = "|".join(target_cities[:-1]) if len(target_cities) > 1 else ""
                
                url = "https://maps.googleapis.com/maps/api/directions/json"
                params = {
                    "origin": start_city,
                    "destination": target_cities[-1] if target_cities else start_city,
                    "waypoints": f"optimize:true|{waypoints}" if waypoints else "",
                    "key": google_maps_key,
                    "units": "imperial"
                }
                
                try:
                    res = requests.get(url, params=params, timeout=15)
                    if res.ok:
                        data = res.json()
                        if data.get("status") == "OK":
                            route = data["routes"][0]
                            optimized_order = route.get("waypoint_order", [])
                            legs = route.get("legs", [])
                            
                            route_legs = []
                            total_hours = 0
                            total_miles = 0
                            
                            for leg in legs:
                                duration_hours = round(leg["duration"]["value"] / 3600, 1)
                                distance_miles = round(leg["distance"]["value"] / 1609.34, 0)
                                total_hours += duration_hours
                                total_miles += distance_miles
                                
                                route_legs.append({
                                    "from": leg["start_address"],
                                    "to": leg["end_address"],
                                    "estimated_drive_hours": duration_hours,
                                    "distance_miles": int(distance_miles)
                                })
                            
                            # Build optimized order from waypoint_order
                            optimized_cities = [start_city]
                            for idx in optimized_order:
                                optimized_cities.append(target_cities[idx])
                            if target_cities:
                                optimized_cities.append(target_cities[-1])
                            
                            # Fuel cost estimate ($3.50/gal, ~25 mpg for a van)
                            fuel_cost = round((total_miles / 25) * 3.50, 2)
                            
                            return Response(
                                message=f"Tour route optimized across {len(target_cities)} cities. {total_hours:.1f}h total drive time.",
                                additional={
                                    "route_plan": {
                                        "source": "google_directions_api",
                                        "starting_point": start_city,
                                        "optimized_route_order": optimized_cities,
                                        "legs": route_legs,
                                        "total_estimated_drive_hours": round(total_hours, 1),
                                        "total_miles": int(total_miles),
                                        "estimated_fuel_cost_usd": fuel_cost
                                    }
                                }
                            )
                except Exception:
                    pass  # Fall through to LLM fallback
            
            # --- Strategy 2: LLM Spatial Reasoning Fallback ---
            self.set_progress("Using AI spatial reasoning for route optimization...")
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
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
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            
            route_plan = json.loads(response.text)
            route_plan["source"] = "llm_spatial_reasoning"
            
            return Response(
                message=f"Tour route optimized across {len(target_cities)} cities.",
                additional={"route_plan": route_plan}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tour Routing Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
