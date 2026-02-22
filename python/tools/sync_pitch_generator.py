
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SyncPitchGenerator(Tool):
    """
    Licensing Executive Tool.
    Generates a targeted sync pitch email for a given track and target (brand, TV, film).
    """

    async def execute(self, track_title: str, tempo: str, keywords: list, target_brand: str, placement_type: str) -> Response:
        self.set_progress(f"Crafting Sync Pitch for {track_title} to {target_brand}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text writing
            
            prompt = f"""
            You are the indiiOS Licensing Executive. 
            Draft a highly professional, concise email pitching a track to a Music Supervisor.
            
            Track Info:
            Title: {track_title}
            Tempo/Vibe: {tempo}
            Keywords: {', '.join(keywords)}
            
            Target:
            Company/Brand: {target_brand}
            Placement Type (e.g., Commercial, Film Trailer, Video Game): {placement_type}
            
            Format the response as JSON:
            {{
              "subject_line": "Catchy, professional email subject",
              "email_body": "The full email text, ready to send",
              "follow_up_strategy": "1 sentence on when/how to follow up"
            }}
            
            The email must be short, punchy, and highlight exactly why this track fits their brand profile.
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
                    temperature=0.4 # Need professional, consistent tone
                )
            )
            return Response(
                message=f"Sync Pitch generated for {target_brand}",
                additional={"pitch": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Sync Pitch Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
