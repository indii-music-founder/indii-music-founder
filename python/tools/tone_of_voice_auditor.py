
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ToneOfVoiceAuditor(Tool):
    """
    Brand Manager Tool.
    Analyzes recent social posts to ensure they align with the artist's defined "brand archetype".
    """

    async def execute(self, recent_captions: list, target_archetype: str) -> Response:
        self.set_progress(f"Auditing Tone of Voice against the '{target_archetype}' archetype")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            captions_str = json.dumps(recent_captions)
            
            prompt = f"""
            You are the indiiOS Brand Manager.
            Audit the following recent social media captions to see if they align with the artist's target brand archetype.
            
            Target Archetype: {target_archetype}
            Recent Captions:
            {captions_str}
            
            Rules:
            1. Score the alignment (0-100).
            2. Identify any words or phrases that break character (e.g., using corporate speak when trying to be a "Rebel").
            3. Provide a rewritten version of the weakest caption.
            
            Return ONLY a JSON object:
            {{
              "alignment_score": 75,
              "analysis": "Too much sales-oriented language in post #2. Breaks the mysterious vibe.",
              "weakest_caption_original": "...",
              "weakest_caption_rewritten": "..."
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
                message=f"Tone of voice audit completed.",
                additional={"audit_report": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tone of Voice Auditor Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
