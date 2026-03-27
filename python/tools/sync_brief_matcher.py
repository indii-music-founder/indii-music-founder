
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SyncBriefMatcher(Tool):
    """
    Licensing Executive Tool.
    Matches tracks from the artist's catalog against incoming sync briefs.
    Exports match report as CSV for the licensing team.
    """

    async def execute(self, brief_description: str, catalog_tracks: list, **kwargs) -> Response:
        self.set_progress(f"Matching catalog against sync brief")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            catalog_str = json.dumps(catalog_tracks[:20])
            
            prompt = f"""
            You are the indiiOS Licensing Executive.
            Match tracks from the catalog against a sync placement brief.
            
            Brief: {brief_description}
            Catalog: {catalog_str}
            
            Score each track 0-100 for brief fit. Return ONLY a JSON object:
            {{
              "brief_summary": "...",
              "matches": [
                {{"track_title": "...", "score": 85, "rationale": "Why it fits the brief"}}
              ],
              "no_match_suggestion": "If nothing fits, suggest the type of track to create"
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
            match_data = json.loads(response.text)
            
            # --- CSV Export ---
            import os
            csv_rows = ["Track,Score,Rationale"]
            for m in match_data.get("matches", []):
                rationale = m.get("rationale", "").replace(",", ";")
                csv_rows.append(f"{m.get('track_title','')},{m.get('score',0)},{rationale}")
            csv_payload = "\n".join(csv_rows)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Sync brief matched: {len(match_data.get('matches',[]))} tracks scored.",
                additional={"match_data": match_data, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Sync Brief Matcher Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
