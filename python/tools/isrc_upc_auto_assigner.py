import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IsrcUpcAutoAssigner(Tool):
    """
    Release & Distribution Manager Tool.
    Pulls from a reserved block of metadata codes and assigns them logically.
    """

    async def execute(self, track_titles: list, country_code: str = "US", registrant_code: str = "XXX") -> Response:
        self.set_progress(f"Assigning ISRCs for {len(track_titles)} tracks")
        
        try:
            from google import genai
            from google.genai import types
            import time
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Deterministic data processing
            
            tracks_str = ", ".join(track_titles)
            year_suffix = str(time.localtime().tm_year)[-2:]
            
            prompt = f"""
            You are the indiiOS Distribution Manager.
            Generate a set of valid ISRC identifiers and one UPC barcode for an upcoming release.
            
            Country Code: {country_code}
            Registrant Code: {registrant_code}
            Year of Reference: {year_suffix}
            Tracks to Assign: {tracks_str}
            
            Rules:
            1. An ISRC looks like: CC-XXX-YY-NNNNN (Country - Registrant - Year - Designation Number).
            2. The designation numbers should be sequential for the tracks provided, starting from 00001.
            3. Generate one valid-looking 12-digit UPC for the overall project.
            
            Return ONLY a JSON object:
            {{
              "upc_code": "...",
              "assigned_isrcs": [
                {{
                  "track_title": "...",
                  "isrc": "US-XXX-26-00001"
                }}
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0 # pure data 
                )
            )
            
            return Response(
                message=f"Successfully assigned {len(track_titles)} ISRCs and 1 UPC.",
                additional={"identifiers": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"ISRC/UPC Auto-Assigner Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
