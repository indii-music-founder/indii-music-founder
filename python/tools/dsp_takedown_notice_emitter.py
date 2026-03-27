
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class DspTakedownNoticeEmitter(Tool):
    """
    Release & Distribution Manager Tool.
    Generates the formal request required to pull a release from all global stores.
    Optionally sends the takedown notice email via SendGrid.
    """

    async def execute(self, release_title: str, upc: str, reason_for_takedown: str, **kwargs) -> Response:
        self.set_progress(f"Initiating Global DSP Takedown for: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
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

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            takedown = json.loads(response.text)
            
            # --- SendGrid Integration: Auto-send the takedown notice ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "distribution@indiios.com")
            
            workflow_status = "Takedown prepared (not sent)"
            send_result = None
            
            auto_send = kwargs.get("auto_send", False)
            distributor_email = kwargs.get("distributor_email")
            
            if auto_send and sendgrid_key and distributor_email:
                self.set_progress(f"Sending urgent takedown to {distributor_email} via SendGrid...")
                
                sg_payload = {
                    "personalizations": [{
                        "to": [{"email": distributor_email}],
                        "subject": takedown.get("urgent_email_subject", f"URGENT TAKEDOWN: {release_title} ({upc})")
                    }],
                    "from": {"email": from_email, "name": "indiiOS Distribution"},
                    "content": [{
                        "type": "text/plain",
                        "value": takedown.get("email_body", "")
                    }],
                    "mail_settings": {
                        "bypass_list_management": {"enable": True}
                    },
                    "categories": ["takedown-notice", "urgent", "auto-generated"]
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
                        workflow_status = f"Takedown notice sent to {distributor_email}"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {str(sg_e)}"
                    send_result = "error"
            elif auto_send and not distributor_email:
                workflow_status = "Auto-send requested but distributor_email not provided"
            elif auto_send:
                workflow_status = "Auto-send requested but SENDGRID_API_KEY missing in .env"
            
            return Response(
                message=f"Takedown for '{release_title}' ({upc}). {workflow_status}",
                additional={
                    "takedown_protocol": takedown,
                    "workflow_status": workflow_status,
                    "send_result": send_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"DSP Takedown Notice Emitter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
