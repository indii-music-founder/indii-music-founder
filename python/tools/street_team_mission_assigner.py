
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class StreetTeamMissionAssigner(Tool):
    """
    Marketing Executive Tool.
    Creates localized guerrilla marketing tasks with clear directives.
    Exports missions as a printable markdown checklist.
    """

    async def execute(self, city: str, budget: float, campaign_goal: str, **kwargs) -> Response:
        self.set_progress(f"Generating Street Team missions for {city} (Budget: ${budget})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive and Guerrilla Marketing Strategist.
            Create 5-8 hyper-local street team missions for an indie music campaign.
            
            City: {city}
            Budget: ${budget}
            Campaign Goal: {campaign_goal}
            
            Rules:
            1. Each mission must be specific, actionable, and measurable.
            2. Include cost estimates per mission.
            3. Include specific locations or venue types.
            
            Return ONLY a JSON object:
            {{
              "city": "{city}",
              "total_budget": {budget},
              "missions": [
                {{
                  "id": 1,
                  "title": "...",
                  "location_type": "Coffee shops near campus",
                  "action": "Distribute QR code stickers linking to pre-save",
                  "cost_estimate": 25,
                  "kpi": "500 stickers placed"
                }}
              ]
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.6)
            )
            missions_data = json.loads(response.text)
            
            # --- Markdown Checklist Export ---
            import os
            checklist_lines = [f"# Street Team Missions — {city}", f"**Budget:** ${budget} | **Goal:** {campaign_goal}\n"]
            for m in missions_data.get("missions", []):
                checklist_lines.append(f"- [ ] **Mission {m.get('id', '?')}: {m.get('title', '')}**")
                checklist_lines.append(f"  - Location: {m.get('location_type', '')}")
                checklist_lines.append(f"  - Action: {m.get('action', '')}")
                checklist_lines.append(f"  - Cost: ${m.get('cost_estimate', 0)} | KPI: {m.get('kpi', '')}\n")
            
            checklist_md = "\n".join(checklist_lines)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(checklist_md)
            
            return Response(
                message=f"Street team missions for {city} generated ({len(missions_data.get('missions', []))} missions).",
                additional={"missions_data": missions_data, "checklist_md": checklist_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Street Team Mission Assigner Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
