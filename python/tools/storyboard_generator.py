
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class StoryboardGenerator(Tool):
    """
    Creative Director Tool.
    Generates shot-by-shot storyboard data for music videos.
    Exports as markdown production document.
    """

    async def execute(self, track_title: str, concept: str, duration_seconds: int = 210, **kwargs) -> Response:
        self.set_progress(f"Generating storyboard for '{track_title}' music video")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Creative Director.
            Generate a shot-by-shot storyboard for a music video.
            
            Track: {track_title}
            Concept: {concept}
            Duration: {duration_seconds} seconds
            
            Return ONLY a JSON object:
            {{
              "title": "{track_title}",
              "concept_summary": "...",
              "shots": [
                {{
                  "shot_number": 1,
                  "timecode": "0:00 - 0:15",
                  "shot_type": "Wide establishing",
                  "action": "Artist walks through empty street at dawn",
                  "camera_movement": "Slow dolly forward",
                  "lighting": "Natural golden hour",
                  "notes": "Use anamorphic lens for cinematic feel"
                }}
              ],
              "color_grade": "Desaturated with warm highlights",
              "estimated_budget_range": "$2,000 - $5,000"
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
            storyboard = json.loads(response.text)
            
            # --- Markdown Production Document ---
            import os
            md = [f"# Storyboard — {track_title}\n", f"**Concept:** {storyboard.get('concept_summary','')}", f"**Color Grade:** {storyboard.get('color_grade','')}", f"**Budget:** {storyboard.get('estimated_budget_range','')}\n"]
            md.append("## Shots\n")
            md.append("| # | Timecode | Shot | Action | Camera | Lighting | Notes |")
            md.append("|---|---|---|---|---|---|---|")
            for s in storyboard.get("shots", []):
                md.append(f"| {s.get('shot_number','')} | {s.get('timecode','')} | {s.get('shot_type','')} | {s.get('action','')} | {s.get('camera_movement','')} | {s.get('lighting','')} | {s.get('notes','')} |")
            
            production_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(production_md)
            
            return Response(
                message=f"Storyboard for '{track_title}': {len(storyboard.get('shots',[]))} shots.",
                additional={"storyboard": storyboard, "production_md": production_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Storyboard Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
