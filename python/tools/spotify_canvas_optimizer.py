
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SpotifyCanvasOptimizer(Tool):
    """
    Director Agent Tool.
    Analyzes an input video prompt and generates ffmpeg/ImageMagick instructions 
    to create a perfectly looped 9:16 vertical video for Spotify Canvas.
    """

    async def execute(self, video_concept: str, source_asset_type: str = "16:9 4K Video") -> Response:
        self.set_progress(f"Optimizing '{video_concept}' for Spotify Canvas format")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Technical task
            
            prompt = f"""
            You are the indiiOS Director Agent.
            Generate a technical execution plan for creating a perfect Spotify Canvas loop.
            
            Video Concept: {video_concept}
            Source Asset Type: {source_asset_type}
            
            Rules for Spotify Canvas:
            - Aspect Ratio MUST be 9:16 (vertical).
            - Length MUST be between 3 and 8 seconds.
            - Format MUST be MP4.
            - It needs to loop seamlessly.
            - Important framing: Keep the bottom 25% clear (for song controls/UI) and the top 10% clear.
            
            Return ONLY a JSON object:
            {{
              "framing_instructions": "...",
              "looping_technique": "Crossfade / Ping-Pong / Hard Cut",
              "ffmpeg_command_template": "ffmpeg -i input.mp4 -vf 'crop=ih*(9/16):ih,scale=1080:1920...' output.mp4",
              "duration_target_seconds": 5
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
                    temperature=0.1 # Deterministic technical output
                )
            )
            
            return Response(
                message=f"Spotify Canvas technical execution plan created.",
                additional={"canvas_optimization": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Spotify Canvas Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
