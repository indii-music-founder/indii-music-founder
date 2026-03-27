
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

    async def execute(self, artist_name: str, release_title: str, core_message: str, **kwargs) -> Response:
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

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4
                )
            )
            
            payload = json.loads(response.text)
            
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            mailchimp_key = os.getenv("MAILCHIMP_API_KEY")
            mailchimp_dc = os.getenv("MAILCHIMP_DC", "us1")
            
            workflow_status = "Generated only"
            campaign_id = None
            
            locals_kwargs = locals().get("kwargs", {})
            auto_create_campaign = locals_kwargs.get("auto_create_campaign", False) if locals_kwargs else False
            
            if auto_create_campaign and mailchimp_key:
                self.set_progress("Creating Mailchimp Campaign...")
                endpoint = f"https://{mailchimp_dc}.api.mailchimp.com/3.0/campaigns"
                headers = {"Authorization": f"Bearer {mailchimp_key}"}
                list_id = os.getenv("MAILCHIMP_LIST_ID", "mock_list_id")
                
                data = {
                    "type": "regular",
                    "recipients": {"list_id": list_id},
                    "settings": {
                        "subject_line": payload.get("subject_line_options", ["Re: New Release"])[0],
                        "title": f"indiiOS Campaign - {release_title}",
                        "reply_to": "info@indiios.com",
                        "from_name": artist_name
                    }
                }
                
                try:
                    mc_res = requests.post(endpoint, json=data, headers=headers, timeout=10)
                    if mc_res.ok:
                        campaign_id = mc_res.json().get("id")
                        workflow_status = f"Mailchimp Campaign {campaign_id} created"
                    else:
                        workflow_status = f"Mailchimp API Error: {mc_res.status_code}"
                except Exception as mc_e:
                    workflow_status = f"Mailchimp unreachable: {str(mc_e)}"
            elif auto_create_campaign:
                workflow_status = "Auto-create requested but MAILCHIMP_API_KEY missing in .env"
                
            return Response(
                message=f"Email newsletter generated. Status: {workflow_status}",
                additional={
                    "newsletter_copy": payload,
                    "workflow_status": workflow_status,
                    "mailchimp_campaign_id": campaign_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Email Newsletter Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
