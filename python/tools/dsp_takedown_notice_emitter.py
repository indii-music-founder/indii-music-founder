
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class DspTakedownNoticeEmitter(Tool):
    """
    Release & Distribution Manager Tool.
    Generates the formal request required to pull a release from all global stores.
    """

    async def execute(self, release_title: str, upc: str, reason_for_takedown: str) -> Response:
        self.set_progress(f"Initiating Global DSP Takedown for: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Generating legalistic email format
            
            prompt = f"""
            You are the indiiOS Distribution Manager.
            Draft a formal, urgent "Takedown Notice" instructing a distribution partner (like tunedistribution, the orchard, or stem) to pull a release from all DSPs immediately.
            
            Release Title: {release_title}
            UPC: {upc}
            Reason for Takedown: {reason_for_takedown}
            
            Rules:
            1. The tone must be professional, urgent, and legally tight.
            2. Request explicit confirmation once the action has been submitted to Spotify/Apple/etc.
            3. Note that this is a takedown of all variations and territories.
            
            Return ONLY a JSON object:
            {{
              "takedown_status": "Prepared",
              "urgent_email_subject": "URGENT TAKEDOWN REQUEST: [Release Title] [UPC]",
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
                    temperature=0.1 # Formal structure
                )
            )
            
            return Response(
                message=f"Takedown notice for '{release_title}' prepared.",
                additional={"takedown_protocol": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"DSP Takedown Notice Emitter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
