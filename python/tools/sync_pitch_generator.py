
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SyncPitchGenerator(Tool):
    """
    Licensing Executive Tool.
    Generates a targeted sync pitch email for a given track and target (brand, TV, film).
    Optionally sends the pitch directly via SendGrid.
    """

    async def execute(self, track_title: str, tempo: str, keywords: list, target_brand: str, placement_type: str, **kwargs) -> Response:
        self.set_progress(f"Crafting Sync Pitch for {track_title} to {target_brand}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Licensing Executive. 
            Draft a highly professional, concise email pitching a track to a Music Supervisor.
            
            Track Info:
            Title: {track_title}
            Tempo/Vibe: {tempo}
            Keywords: {', '.join(keywords)}
            
            Target:
            Company/Brand: {target_brand}
            Placement Type (e.g., Commercial, Film Trailer, Video Game): {placement_type}
            
            Format the response as JSON:
            {{
              "subject_line": "Catchy, professional email subject",
              "email_body": "The full email text, ready to send",
              "follow_up_strategy": "1 sentence on when/how to follow up"
            }}
            
            The email must be short, punchy, and highlight exactly why this track fits their brand profile.
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
            
            pitch = json.loads(response.text)
            
            # --- SendGrid Integration: Auto-send the sync pitch ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "licensing@indiios.com")
            
            workflow_status = "Pitch generated (not sent)"
            send_result = None
            
            auto_send = kwargs.get("auto_send", False)
            supervisor_email = kwargs.get("supervisor_email")
            
            if auto_send and sendgrid_key and supervisor_email:
                self.set_progress(f"Sending sync pitch to {supervisor_email} via SendGrid...")
                
                sg_payload = {
                    "personalizations": [{
                        "to": [{"email": supervisor_email}],
                        "subject": pitch.get("subject_line", f"Sync Opportunity: {track_title}")
                    }],
                    "from": {"email": from_email, "name": "indiiOS Licensing"},
                    "content": [{
                        "type": "text/plain",
                        "value": pitch.get("email_body", "")
                    }],
                    "tracking_settings": {
                        "open_tracking": {"enable": True},
                        "click_tracking": {"enable": True}
                    },
                    "categories": ["sync-pitch", "licensing", "auto-generated"]
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
                        workflow_status = f"Sync pitch sent to {supervisor_email}"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {str(sg_e)}"
                    send_result = "error"
            elif auto_send and not supervisor_email:
                workflow_status = "Auto-send requested but supervisor_email not provided"
            elif auto_send:
                workflow_status = "Auto-send requested but SENDGRID_API_KEY missing in .env"
            
            return Response(
                message=f"Sync pitch for '{track_title}' → {target_brand}. {workflow_status}",
                additional={
                    "pitch": pitch,
                    "workflow_status": workflow_status,
                    "send_result": send_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Sync Pitch Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
