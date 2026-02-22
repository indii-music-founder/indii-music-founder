
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CoWriterNdaGenerator(Tool):
    """
    Legal Counsel Tool.
    Drafts an NDA tailored for in-studio writing camps.
    """

    async def execute(self, artist_name: str, guest_writer_names: list, studio_location: str, date: str) -> Response:
        self.set_progress(f"Drafting Studio NDA for {len(guest_writer_names)} writers at {studio_location}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Legal Form Generation
            
            writers_str = ", ".join(guest_writer_names)
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a Non-Disclosure Agreement (NDA) specifically tailored for a music industry writing camp / studio session.
            
            Disclosing Party (Artist/Label): {artist_name}
            Receiving Parties (Guest Writers): {writers_str}
            Studio Location: {studio_location}
            Date of Session: {date}
            
            Rules:
            1. The NDA must restrict the leaking or sharing of unreleased audio files, stems, session files, and lyrics.
            2. The NDA must restrict photography or social media posting of the session without explicit consent.
            3. The tone must be formal and legally binding under US state law (assume California jurisdiction).
            
            Return ONLY a JSON object:
            {{
              "contract_title": "NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT",
              "markdown_contract": "...",
              "parties_to_sign": ["..."],
              "key_clauses_summary": "Short 3-bullet summary of what the NDA prohibits."
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
                message=f"Studio NDA drafted for session at {studio_location}.",
                additional={"nda_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Co-Writer NDA Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
