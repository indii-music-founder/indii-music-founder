
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ViralTrendingSoundMatcher(Tool):
    """
    Social Media Manager Tool.
    Analyzes top TikTok sounds to find tempos that match a segment of the artist's unreleased song.
    """

    async def execute(self, track_bpm: int, track_key: str) -> Response:
        self.set_progress(f"Matching trending TikTok sounds to {track_bpm} BPM / {track_key}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Social Media Manager.
            Simulate an analysis of the top 50 viral TikTok sounds today and find 3 that tempo-match 
            or key-match an upcoming release operating at {track_bpm} BPM in {track_key}.
            
            Rules:
            1. Suggest 3 trending sounds.
            2. Explain the mashup concept (e.g. "Transition your acapella into this trending beat drop").
            
            Return ONLY a JSON object:
            {{
              "matches": [
                {{"sound_name": "Trending Sound 1", "match_type": "Tempo Match", "concept": "..."}}
              ],
              "strategy_note": "..."
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
                    temperature=0.4
                )
            )
            
            return Response(
                message=f"Trending sounds matched.",
                additional={"tiktok_strategy": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Viral Trending Sound Matcher Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
