
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class EmailNewsletterGenerator(Tool):
    """
    Marketing Executive Tool.
    Drafts a highly converting HTML/Text email blast for the artist's mailing list.
    """

    async def execute(self, artist_name: str, release_title: str, core_message: str) -> Response:
        self.set_progress(f"Generating email newsletter for {artist_name}'s release: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Write an email newsletter blast to the fan mailing list announcing a new release.
            
            Artist: {artist_name}
            Release Title: {release_title}
            Core Message/Vibe: {core_message}
            
            Rules:
            1. Provide 3 punchy Subject Line options.
            2. Write the Plain Text body of the email. Keep it authentic and intimate, not overly corporate.
            3. Include a clear Call To Action (CTA) link placeholder.
            
            Return ONLY a JSON object:
            {{
              "subject_line_options": ["...", "...", "..."],
              "email_body_text": "...",
              "primary_cta": "Listen to {release_title} now"
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
                message=f"Email newsletter generated.",
                additional={"newsletter_copy": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Email Newsletter Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
