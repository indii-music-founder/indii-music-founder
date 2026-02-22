
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class EpkBuilder(Tool):
    """
    Brand Manager Tool.
    Compiles artist bio, press photos, and links into a sleek hosted EPK structure.
    """

    async def execute(self, artist_name: str, genre: str, bio_summary: str, key_achievements: list, contact_email: str) -> Response:
        self.set_progress(f"Building Electronic Press Kit (EPK) for: {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text/JSON generation
            
            achievements_str = ", ".join(key_achievements)
            
            prompt = f"""
            You are the indiiOS Brand Manager.
            Generate the structural JSON data for an Electronic Press Kit (EPK) that can be instantly rendered to a webpage.
            
            Artist Name: {artist_name}
            Genre: {genre}
            Raw Bio summary: {bio_summary}
            Key Achievements: {achievements_str}
            Contact: {contact_email}
            
            Rules:
            1. Rewrite the raw bio into a professional, compelling 2-paragraph press bio ("Short Bio") and a 1-sentence "Elevator Pitch".
            2. Format the achievements into bullet points.
            3. Provide placeholder layout components for the frontend to render.
            
            Return ONLY a JSON object:
            {{
              "epk_title": "...",
              "elevator_pitch": "...",
              "short_bio": "...",
              "highlighted_quotes": ["...", "..."],
              "achievements": ["...", "..."],
              "contact_info": "{contact_email}",
              "suggested_color_palette": ["#...", "#..."],
              "font_pairing": {{"header": "...", "body": "..."}}
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
                    temperature=0.4 # Need professional branding tone
                )
            )
            
            return Response(
                message=f"EPK generated for '{artist_name}'",
                additional={"epk_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"EPK Builder Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
