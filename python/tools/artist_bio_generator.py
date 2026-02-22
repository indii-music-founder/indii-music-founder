
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ArtistBioGenerator(Tool):
    """
    Brand Manager Tool.
    Generates short, medium, and long artist bios for DSPs and press.
    """

    async def execute(self, artist_name: str, genre: str, key_achievements: list, core_vibe: str) -> Response:
        self.set_progress(f"Generating EPK bios for {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            achievements_str = ", ".join(key_achievements)
            
            prompt = f"""
            You are the indiiOS Brand Manager & Publicist.
            Write three variations of a professional artist bio for the indie {genre} artist '{artist_name}'.
            
            Key Achievements: {achievements_str}
            Core Vibe/Aesthetic: {core_vibe}
            
            Rules:
            1. Short Bio: ~2-3 sentences. Perfect for Spotify/Apple Music quick reading.
            2. Medium Bio: ~1 paragraph. Good for booking agents or a tight EPK.
            3. Long Bio: ~2-3 paragraphs. Deep dive into background, achievements, and aesthetic direction.
            
            Return ONLY a JSON object:
            {{
              "short_bio": "...",
              "medium_bio": "...",
              "long_bio": "..."
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
                    temperature=0.7 # Allow for creative writing
                )
            )
            
            return Response(
                message=f"3 bio variations generated for {artist_name}.",
                additional={"bios": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Artist Bio Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
