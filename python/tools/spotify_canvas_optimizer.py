
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SpotifyCanvasOptimizer(Tool):
    """
    Brand Manager Tool.
    Generates creative direction briefs for Spotify Canvas (8s looping vertical video).
    Exports as a structured spec for the video production team.
    """

    async def execute(self, track_title: str, mood: str, genre: str, **kwargs) -> Response:
        self.set_progress(f"Optimizing Spotify Canvas concept for '{track_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Brand Manager specializing in Spotify Canvas optimization.
            Create 3 creative direction options for an 8-second looping vertical video.
            
            Track: {track_title}
            Mood: {mood}
            Genre: {genre}
            
            Spotify Canvas Specs:
            - 9:16 vertical aspect ratio (1080x1920)
            - 3-8 seconds, seamless loop
            - MP4 or WebM, max 16MB
            
            Return ONLY a JSON object:
            {{
              "track": "{track_title}",
              "canvas_options": [
                {{
                  "concept_name": "...",
                  "visual_description": "Detailed shot-by-shot description",
                  "color_palette": ["#hex1", "#hex2"],
                  "loop_technique": "Smooth zoom / Cinemagraph / Particle",
                  "estimated_production_cost": "$50-200"
                }}
              ],
              "specs": {{
                "resolution": "1080x1920",
                "duration_seconds": 8,
                "format": "MP4",
                "max_size_mb": 16
              }}
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
            canvas_data = json.loads(response.text)
            
            # --- Markdown Brief Export ---
            import os
            md_lines = [f"# Spotify Canvas Brief — {track_title}\n"]
            for i, opt in enumerate(canvas_data.get("canvas_options", []), 1):
                md_lines.append(f"## Option {i}: {opt.get('concept_name', '')}")
                md_lines.append(f"**Visual:** {opt.get('visual_description', '')}")
                md_lines.append(f"**Colors:** {', '.join(opt.get('color_palette', []))}")
                md_lines.append(f"**Loop:** {opt.get('loop_technique', '')}")
                md_lines.append(f"**Est. Cost:** {opt.get('estimated_production_cost', '')}\n")
            
            specs = canvas_data.get("specs", {})
            md_lines.append(f"---\n**Specs:** {specs.get('resolution','')} | {specs.get('duration_seconds',8)}s | {specs.get('format','MP4')} | Max {specs.get('max_size_mb',16)}MB")
            
            brief_md = "\n".join(md_lines)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(brief_md)
            
            return Response(
                message=f"Canvas concepts for '{track_title}': {len(canvas_data.get('canvas_options',[]))} options.",
                additional={"canvas_data": canvas_data, "brief_md": brief_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Spotify Canvas Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
