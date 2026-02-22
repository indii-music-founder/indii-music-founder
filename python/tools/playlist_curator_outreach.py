
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PlaylistCuratorOutreach(Tool):
    """
    Marketing Executive Tool.
    Generates personalized cold emails to independent Spotify playlist curators.
    """

    async def execute(self, curator_name: str, playlist_name: str, artist_track: str, sonic_vibe: str) -> Response:
        self.set_progress(f"Drafting curator outreach for playlist: '{playlist_name}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Draft a short, highly personalized cold email pitching an independent playlist curator.
            
            Curator: {curator_name}
            Target Playlist: {playlist_name}
            Artist's Track: {artist_track}
            Sonic Vibe: {sonic_vibe}
            
            Rules:
            1. Keep it under 100 words. Curators hate long emails.
            2. Mention specifically why {artist_track} fits the vibe of {playlist_name}.
            3. Do not be overly formal or pushy.
            
            Return ONLY a JSON object:
            {{
              "subject_line": "...",
              "email_body": "..."
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
                    temperature=0.3
                )
            )
            
            return Response(
                message=f"Playlist curator pitch generated.",
                additional={"curator_pitch": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Playlist Curator Outreach Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
