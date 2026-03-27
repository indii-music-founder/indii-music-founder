
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PressReleaseGenerator(Tool):
    """
    Publicist Agent Tool.
    Formats a professional press release for blogs/curators based on track info and artist bio.
    Optionally sends the press release to media contacts via SendGrid.
    """

    async def execute(self, artist_name: str, track_title: str, release_date: str, key_story_points: list, contact_email: str, **kwargs) -> Response:
        self.set_progress(f"Drafting Press Release for {artist_name} - {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST

            story_points_str = "\n".join([f"- {point}" for point in key_story_points])
            
            prompt = f"""
            You are the indiiOS Publicist. 
            Draft a professional, ready-to-publish Press Release for a new music launch.
            
            Details:
            Artist: {artist_name}
            Track Title: {track_title}
            Release Date: {release_date}
            Contact Email: {contact_email}
            
            Key Narrative/Story Points to include:
            {story_points_str}
            
            Required Format:
            Must follow standard PR format (FOR IMMEDIATE RELEASE, Dateline, Headline, Dateline City, Intro, Body Paragraphs, About Artist, Media Contact).
            
            Output ONLY the Markdown document text of the press release.
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
                    temperature=0.3
                )
            )
            
            press_release = response.text
            
            # --- SendGrid Integration: Blast PR to media contacts ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "press@indiios.com")
            
            workflow_status = "PR drafted (not sent)"
            send_result = None
            
            auto_send = kwargs.get("auto_send", False)
            media_emails = kwargs.get("media_emails", [])
            
            if auto_send and sendgrid_key and media_emails:
                self.set_progress(f"Sending press release to {len(media_emails)} media contacts via SendGrid...")
                
                personalizations = [{
                    "to": [{"email": email} for email in media_emails],
                    "subject": f"FOR IMMEDIATE RELEASE: {artist_name} - \"{track_title}\" (Out {release_date})"
                }]
                
                sg_payload = {
                    "personalizations": personalizations,
                    "from": {"email": from_email, "name": f"{artist_name} Press"},
                    "content": [{
                        "type": "text/plain",
                        "value": press_release
                    }],
                    "tracking_settings": {
                        "open_tracking": {"enable": True},
                        "click_tracking": {"enable": True}
                    },
                    "categories": ["press-release", "media-blast", "auto-generated"]
                }
                
                headers = {
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json"
                }
                
                try:
                    sg_res = requests.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        json=sg_payload,
                        headers=headers,
                        timeout=10
                    )
                    if sg_res.status_code in (200, 202):
                        workflow_status = f"PR sent to {len(media_emails)} contacts"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {str(sg_e)}"
                    send_result = "error"
            elif auto_send and not media_emails:
                workflow_status = "Auto-send requested but media_emails list is empty"
            elif auto_send:
                workflow_status = "Auto-send requested but SENDGRID_API_KEY missing in .env"
            
            return Response(
                message=f"Press release for '{track_title}'. {workflow_status}",
                additional={
                    "markdown_document": press_release,
                    "workflow_status": workflow_status,
                    "send_result": send_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Press Release Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
