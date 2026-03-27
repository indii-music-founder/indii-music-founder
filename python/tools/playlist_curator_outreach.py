
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PlaylistCuratorOutreach(Tool):
    """
    Marketing Executive Tool.
    Generates personalized cold emails to independent Spotify playlist curators.
    Optionally sends the email directly via SendGrid API.
    """

    async def execute(self, curator_name: str, playlist_name: str, artist_track: str, sonic_vibe: str, **kwargs) -> Response:
        self.set_progress(f"Drafting curator outreach for playlist: '{playlist_name}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Draft a short, highly personalized cold email pitching an independent playlist curator.
            
            Curator: {curator_name}
            Target Playlist: {playlist_name}
            Artist's Track: {artist_track}
            Sonic Vibe: {sonic_vibe}
            
            Rules:
            1. Keep it under 100 words. Curators hate long emails.
            2. Mention specifically why {artist_track} fits the vibe of {playlist_name}.
            3. Do not be overly formal or pushy.
            
            Return ONLY a JSON object:
            {{
              "subject_line": "...",
              "email_body": "..."
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
                    temperature=0.3
                )
            )
            
            curator_pitch = json.loads(response.text)
            
            # --- SendGrid Integration: Send the email directly ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "outreach@indiios.com")
            
            workflow_status = "Pitch generated (not sent)"
            send_result = None
            
            auto_send = kwargs.get("auto_send", False)
            curator_email = kwargs.get("curator_email")
            
            if auto_send and sendgrid_key and curator_email:
                self.set_progress(f"Sending pitch email to {curator_email} via SendGrid...")
                
                sg_payload = {
                    "personalizations": [{
                        "to": [{"email": curator_email, "name": curator_name}],
                        "subject": curator_pitch.get("subject_line", f"New track for {playlist_name}")
                    }],
                    "from": {"email": from_email, "name": "indiiOS Outreach"},
                    "content": [{
                        "type": "text/plain",
                        "value": curator_pitch.get("email_body", "")
                    }],
                    "tracking_settings": {
                        "open_tracking": {"enable": True},
                        "click_tracking": {"enable": True}
                    },
                    "categories": ["curator-outreach", "auto-generated"]
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
                        workflow_status = f"Email sent to {curator_email}"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {str(sg_e)}"
                    send_result = "error"
            elif auto_send and not curator_email:
                workflow_status = "Auto-send requested but curator_email not provided"
            elif auto_send:
                workflow_status = "Auto-send requested but SENDGRID_API_KEY missing in .env"
            
            return Response(
                message=f"Playlist curator pitch ready. {workflow_status}",
                additional={
                    "curator_pitch": curator_pitch,
                    "workflow_status": workflow_status,
                    "send_result": send_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Playlist Curator Outreach Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
