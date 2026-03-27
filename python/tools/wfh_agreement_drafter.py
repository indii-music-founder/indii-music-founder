
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class WfhAgreementDrafter(Tool):
    """
    Legal Counsel Tool.
    Generates a customized Work-For-Hire agreement for collaborators.
    """

    async def execute(self, artist_name: str, collaborator_name: str, collaborator_role: str, flat_fee_usd: float) -> Response:
        self.set_progress(f"Drafting WFH Agreement for: {collaborator_name} ({collaborator_role})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Document Generation
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a standard Work-For-Hire (WFH) agreement for a music production scenario.
            
            Hiring Party (Artist): {artist_name}
            Collaborator (Independent Contractor): {collaborator_name}
            Collaborator Role (e.g., Session Guitarist, Mixing Engineer, Graphic Designer): {collaborator_role}
            Flat Fee Compensation: ${flat_fee_usd}
            
            Rules:
            1. The agreement MUST explicitly state that the work is a "work made for hire" under US Copyright Law.
            2. The agreement MUST state that all rights, title, and interest (including copyright) belong entirely to the Hiring Party.
            3. The agreement MUST state the flat fee compensation is full and final payment, with no backend royalties owed (unless explicitly negotiated otherwise outside this document).
            4. Format as a clean, markdown-based legal document with placeholder dates and signature lines.
            
            Return ONLY a JSON object:
            {{
              "agreement_type": "Work-For-Hire",
              "parties": [\"{artist_name}\", \"{collaborator_name}\"],
              "markdown_contract": "...",
              "risk_flags": "List any potential legal risks based on the role provided (e.g. vocalists sometimes contest WFH)."
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
                    temperature=0.0 # Deterministic legal form
                )
            )
            
            return Response(
                message=f"WFH Agreement drafted for {collaborator_name}",
                additional={"wfh_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"WFH Agreement Drafter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
