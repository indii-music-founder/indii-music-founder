
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CopyrightRegistrationPrep(Tool):
    """
    Publishing Administrator Tool.
    Prepares a structured payload for US Copyright Office PA/SR applications.
    """

    async def execute(self, track_title: str, writers: list, year_created: str, year_published: str = None) -> Response:
        self.set_progress(f"Preparing Copyright Registration (PA/SR) for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text/Document Generation
            
            writers_str = "\\n".join([f"- {w.get('name')}: {w.get('contribution', 'Music & Lyrics')}" for w in writers])
            
            prompt = f"""
            You are the indiiOS Publishing Administrator. 
            Prepare a JSON payload for US Copyright Office PA (Performing Arts) and SR (Sound Recording) registration.
            
            Song Title: {track_title}
            Year Created: {year_created}
            Year Published: {year_published if year_published else "Unpublished"}
            Writers/Claimants:
            {writers_str}
            
            Determine the required forms, application type, and create an exact data mapping for the eCO (Electronic Copyright Office) system.
            
            Return ONLY a JSON object:
            {{
              "title_of_work": "{track_title}",
              "type_of_work": "Sound Recording with underlying Performing Arts",
              "year_of_completion": "{year_created}",
              "publication_status": "Published" or "Unpublished",
              "authors": [
                {{
                  "name": "...",
                  "nature_of_authorship": ["Music", "Lyrics", "Sound Recording"]
                }}
              ],
              "copyright_claimants": [],
              "fees_estimated_usd": 65,
              "next_steps": ["1. Export PDF checklist", "2. Upload audio file to eCO portal"]
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
                    temperature=0.0 # Legal tasks must be deterministic
                )
            )
            
            return Response(
                message=f"Copyright Registration Prepped for '{track_title}'. ready for submission.",
                additional={"registration_payload": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Copyright Prep Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
