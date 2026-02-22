import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SyncBriefMatcher(Tool):
    """
    Licensing Executive Tool.
    Ingest a movie supervisor's brief and score the artist's catalog for the best match.
    """

    async def execute(self, supervisor_brief: str, catalog_json_str: str) -> Response:
        self.set_progress("Scoring catalog tracks against Music Supervisor Sync Brief")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Licensing Executive (Sync).
            A music supervisor just requested a track. Score the provided catalog to find the top 2 best matches.
            
            Supervisor Brief: "{supervisor_brief}"
            Catalog Data: {catalog_json_str}
            
            Rules:
            1. Provide a match score (0-100) for the top 2 tracks.
            2. Generate a 2-sentence pitch for the #1 track explaining WHY it perfectly fits the brief.
            
            Return ONLY a JSON object:
            {{
              "top_matches": [
                {{"track_id": "...", "score": 95, "reasoning": "..."}}
              ],
              "email_pitch_body": "..."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )
            
            return Response(
                message=f"Sync brief matched against catalog.",
                additional={"sync_pitch": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Sync Brief Matcher Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
