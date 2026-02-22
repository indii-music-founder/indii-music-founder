
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ThirtyDayContentCalendar(Tool):
    """
    Social Media Manager Tool.
    Generates a daily posting schedule mixing behind-the-scenes, performance clips, and direct fan engagement.
    """

    async def execute(self, artist_name: str, core_content_pillars: list, upcoming_release_date: str) -> Response:
        self.set_progress(f"Generating 30-Day Content Calendar for: {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Complex structural generation
            
            pillars_str = ", ".join(core_content_pillars)
            
            prompt = f"""
            You are the indiiOS Social Media Manager.
            Generate a 30-day content calendar leading up to a specific release date.
            
            Artist Name: {artist_name}
            Core Content Pillars (e.g. fashion, guitar solos, humor): {pillars_str}
            Release Date: {upcoming_release_date}
            
            Rules:
            1. Create 30 days of posts (Day 1 to Day 30).
            2. Vary the platforms (TikTok, IG Reel, IG Story, YouTube Short).
            3. Follow a marketing funnel: Awareness -> Engagement -> Teasing -> Release -> Post-Release.
            4. Keep descriptions actionable and short.
            
            Return ONLY a JSON object:
            {{
              "campaign_name": "...",
              "calendar": [
                {{
                  "day": 1,
                  "platform": "TikTok",
                  "content_type": "Behind The Scenes",
                  "description": "...",
                  "audio_to_use": "Original/Trending",
                  "call_to_action": "..."
                }},
                // ... all 30 days
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
                    temperature=0.6 # Marketing creativity needed
                )
            )
            
            return Response(
                message=f"30-Day content calendar generated for '{artist_name}'",
                additional={"calendar_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"30-Day Content Calendar Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
