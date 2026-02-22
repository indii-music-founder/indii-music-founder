
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataTaggingForSync(Tool):
    """
    Licensing Executive Tool.
    Auto-generate granular mood, instrumentation, and lyric theme tags for a catalog database.
    """

    async def execute(self, track_lyrics: str, track_sonic_profile: str) -> Response:
        self.set_progress("Generating granular Sync metadata tags for DISCO/Disco.ac upload")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Licensing Executive handling metatagging.
            Analyze the following lyrics and sonic profile to generate granular tags for a sync catalog.
            
            Sonic Profile: {track_sonic_profile}
            Lyrics: {track_lyrics}
            
            Rules:
            1. Generate exactly 5 'Mood' tags (e.g. Uplifting, Cinematic, Dark).
            2. Generate exactly 5 'Instrumentation' tags (e.g. Distorted Bass, Arp Synth).
            3. Generate 3 'Lyrical Themes' (e.g. Overcoming Adversity, Summer Love).
            4. Provide a 'Similar Artists' array (up to 3).
            
            Return ONLY a JSON object:
            {{
              "moods": [],
              "instrumentation": [],
              "lyrical_themes": [],
              "similar_artists": []
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
                    temperature=0.2
                )
            )
            
            return Response(
                message=f"Granular sync metadata generated.",
                additional={"sync_metadata": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Metadata Tagging For Sync Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
