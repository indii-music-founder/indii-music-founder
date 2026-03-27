
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RiderAndStagePlotBuilder(Tool):
    """
    Road Manager Tool.
    Generates a tech rider detailing microphone placements, DI box requirements, and hospitality requests.
    Exports as a markdown document for PDF conversion.
    """

    async def execute(self, band_members: int, has_synths: bool, has_live_drums: bool, **kwargs) -> Response:
        self.set_progress("Generating Tech Rider and Stage Plot requirements")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            artist_name = kwargs.get("artist_name", "Artist")
            
            prompt = f"""
            You are the indiiOS Road Manager.
            Generate a complete Tech Rider and Stage Plot for a live performance.
            
            Band Members: {band_members}
            Has Synths/Keys: {has_synths}
            Has Live Drums: {has_live_drums}
            Artist: {artist_name}
            
            Rules:
            1. List every input channel needed (vocals, guitars, bass, keys, drums breakdown).
            2. Specify microphone preferences (SM58, e604, etc.).
            3. Include monitoring requirements (in-ear or wedge).
            4. Include a basic hospitality rider section.
            5. Format as a clean JSON that can be rendered to PDF.
            
            Return ONLY a JSON object:
            {{
              "artist": "{artist_name}",
              "input_list": [
                {{"channel": 1, "instrument": "Lead Vocal", "mic": "SM58", "stand": "Boom", "notes": ""}}
              ],
              "monitoring": "In-Ear Monitors preferred, 4 stereo mixes minimum",
              "backline_needs": ["Guitar amp: Fender Twin or similar", "..."],
              "hospitality": ["12 bottles of water", "Hot meal for {band_members} people", "Private changing room"],
              "stage_dimensions_min": "20ft x 16ft",
              "load_in_time": "3 hours before doors"
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
            rider_data = json.loads(response.text)
            
            # --- Markdown Export for PDF conversion ---
            import os
            md_lines = [f"# Tech Rider — {artist_name}", ""]
            md_lines.append("## Input List\n")
            md_lines.append("| Ch | Instrument | Mic | Stand | Notes |")
            md_lines.append("|---|---|---|---|---|")
            for inp in rider_data.get("input_list", []):
                md_lines.append(f"| {inp.get('channel','')} | {inp.get('instrument','')} | {inp.get('mic','')} | {inp.get('stand','')} | {inp.get('notes','')} |")
            
            md_lines.append(f"\n## Monitoring\n{rider_data.get('monitoring', 'TBD')}")
            md_lines.append("\n## Backline Needs")
            for b in rider_data.get("backline_needs", []):
                md_lines.append(f"- {b}")
            md_lines.append("\n## Hospitality")
            for h in rider_data.get("hospitality", []):
                md_lines.append(f"- {h}")
            md_lines.append(f"\n**Min Stage:** {rider_data.get('stage_dimensions_min', 'TBD')}")
            md_lines.append(f"**Load-In:** {rider_data.get('load_in_time', 'TBD')}")
            
            rider_md = "\n".join(md_lines)
            export_path = kwargs.get("export_path")
            md_path = None
            if export_path:
                md_path = os.path.join(export_path, f"{artist_name.replace(' ', '_').lower()}_tech_rider.md")
                with open(md_path, "w") as f:
                    f.write(rider_md)
            
            return Response(
                message=f"Tech rider for {artist_name} generated ({len(rider_data.get('input_list', []))} channels).",
                additional={"rider_data": rider_data, "rider_md": rider_md, "export_path": md_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Rider & Stage Plot Builder Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
