
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SampleClearanceTool(Tool):
    """
    Legal Counsel Tool.
    Evaluates risk on sample usage and generates a draft clearance request.
    """

    async def execute(self, sample_description: str, intended_usage: str, original_artist: str = "Unknown") -> Response:
        self.set_progress(f"Evaluating sample clearance for: {sample_description}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Document Generation
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Evaluate the risks of a specified music sample and generate a formal Sample Clearance Request Letter.
            
            Original Sample: {sample_description} (Original Artist: {original_artist})
            Intended Usage (How it's used in the new track): {intended_usage}
            
            Return ONLY a JSON object:
            {{
              "risk_assessment": "High/Medium/Low",
              "rights_required": ["Master", "Publishing/Composition"],
              "strategy_notes": "...",
              "clearance_letter_draft": "[Markdown formatted formal letter requesting clearance, detailing the intended use, offering terms (e.g. buyout or royalty split), and requesting signature or negotiation]"
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
                    temperature=0.0 # Deterministic legal form
                )
            )
            
            return Response(
                message=f"Sample clearance strategy developed for '{sample_description}'",
                additional={"clearance_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Sample Clearance Tool Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
