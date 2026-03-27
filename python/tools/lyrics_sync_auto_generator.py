
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class LyricsSyncAutoGenerator(Tool):
    """
    Director / Video Tools.
    Simulates the alignment of a provided lyric text file with a rhythm map to generate a timed .lrc file.
    """

    async def execute(self, track_title: str, lyrics_text: str, bpm: float) -> Response:
        self.set_progress(f"Generating timed .lrc sync for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Technical layout
            
            prompt = f"""
            You are the indiiOS Music Synchronization Engine.
            Convert a raw text string of lyrics into a standard .lrc format, simulating the timing based on the BPM.
            
            Track Title: {track_title}
            BPM: {bpm}
            Raw Lyrics:\n{lyrics_text}
            
            Rules:
            1. Output MUST be valid .lrc format.
            2. Format: [mm:ss.xx] Lyric string here
            3. Make logical guesses for spacing assuming a standard 4/4 pop/rap delivery at {bpm} BPM.
            
            Return ONLY a JSON object:
            {{
              "track_title": "{track_title}",
              "lrc_content": "[00:00.00] ...\\n[00:04.20] ..."
            }}
            """
            
            

            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1 # Needs strict layout
                )
            )
            
            return Response(
                message=f".lrc file generated for '{track_title}'",
                additional={"sync_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Lyrics Sync Auto Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
