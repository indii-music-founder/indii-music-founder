import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class StreetTeamMissionAssigner(Tool):
    """
    Marketing Executive Tool.
    Creates localized guerrilla marketing tasks with clear directives.
    """

    async def execute(self, city: str, budget: float, campaign_goal: str) -> Response:
        self.set_progress(f"Generating Street Team missions for {city} (Budget: ${budget})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Design 3 specific guerrilla marketing "Missions" for a street team of fans in {city}.
            
            Campaign Goal: {campaign_goal}
            Budget for Materials/Rewards: ${budget}
            
            Rules:
            1. Missions must be legal but edgy/attention-grabbing.
            2. Suggest specific neighborhoods or types of locations in {city} if known, or general archetypes (e.g., college campuses, record stores).
            3. Allocate the ${budget} across the 3 missions.
            
            Return ONLY a JSON object:
            {{
              "city": "{city}",
              "missions": [
                {{
                  "title": "...",
                  "action_plan": "...",
                  "target_locations": "...",
                  "budget_allocated": 50,
                  "fan_reward": "..."
                }}
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.5
                )
            )
            
            return Response(
                message=f"Street Team missions generated for {city}.",
                additional={"street_team_plan": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Street Team Mission Assigner Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
