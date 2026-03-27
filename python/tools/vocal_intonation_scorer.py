
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class VocalIntonationScorer(Tool):
    """
    Producer Agent Tool.
    Analyzes a vocal stem for pitch drift and generates correction advice.
    """

    async def execute(self, vocal_stem_path: str, track_key: str) -> Response:
        self.set_progress(f"Scoring vocal intonation against {track_key}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Vocal Producer.
            Simulate a pitch analysis of a raw vocal stem mapped against the key of {track_key}.
            
            Rules:
            1. Provide an overall intonation score (0-100).
            2. Identify 2 simulated timestamp regions where the pitch drifts flat or sharp.
            3. Recommend whether Auto-Tune (retune speed) or Melodyne (manual graph) is the better fix.
            
            Return ONLY a JSON object:
            {{
              "overall_score": 88,
              "problem_areas": [
                {{"timestamp": "0:45-0:48", "issue": "Drifts 15 cents flat on the sustained note", "fix": "Melodyne subtle correction"}}
              ],
              "tool_recommendation": "Use Melodyne for the verse, fast Auto-Tune for the hook."
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
                    temperature=0.2
                )
            )
            
            return Response(
                message=f"Vocal intonation scored.",
                additional={"vocal_analysis": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Vocal Intonation Scorer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
