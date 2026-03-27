
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class BpmKeyDetector(Tool):
    """
    Producer Agent Tool.
    Simulates parsing raw audio to detect tempo (BPM) and root key.
    """

    async def execute(self, track_path: str) -> Response:
        self.set_progress(f"Detecting BPM and Key for: {track_path}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Producer Agent.
            Simulate detecting the BPM and musical Key for an indie pop/electronic track located at '{track_path}'.
            
            Return ONLY a JSON object:
            {{
              "estimated_bpm": 120,
              "estimated_key": "C Minor",
              "camelot_wheel": "5A",
              "confidence_score": 95,
              "genre_vibe": "Upbeat synth-pop"
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
                    temperature=0.7 # Add a little variance to the mock response
                )
            )
            
            return Response(
                message=f"BPM and Key detection completed.",
                additional={"audio_meta": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"BPM & Key Detector Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
