
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CampaignGenerator(Tool):
    """
    Marketing Executive Tool.
    Generates a 4-week rollout schedule with specific content buckets for a release.
    """

    async def execute(self, artist_name: str, release_title: str, release_date: str, mood_genre: str = "") -> Response:
        self.set_progress(f"Generating Marketing Campaign for: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Routing/Text generation
            
            prompt = f"""
            You are the indiiOS Marketing Executive. 
            Create a 4-week pre-save and rollout marketing campaign for the upcoming release.
            
            Details:
            Artist: {artist_name}
            Title: {release_title}
            Drop Date: {release_date}
            Vibe/Genre: {mood_genre}
            
            Required JSON structure:
            {{
              "campaign_name": "String",
              "target_audience": ["Demo 1", "Demo 2"],
              "timeline": [
                {{
                   "week": "-4",
                   "focus": "Tease the audio",
                   "action_items": ["Post cryptic IG Story", "Setup Pre-save link"]
                }},
                {{ "week": "-3"... }},
                {{ "week": "-2"... }},
                {{ "week": "-1"... }},
                {{ "week": "0 (Release Week)"... }}
              ]
            }}
            """
            
            

            
                        _rl = RateLimiter()

            
                        wait_time = _rl.wait_time("gemini")

            
                        if wait_time > 0:

            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

            
                            await asyncio.sleep(wait_time)

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.7 # Need creative marketing ideas
                )
            )
            return Response(
                message=f"Marketing Rollout Generated for {release_title}",
                additional={"campaign": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Campaign Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
