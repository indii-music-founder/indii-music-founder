
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CrossCollaborationProposal(Tool):
    """
    Marketing Executive Tool.
    Drafts a DM/email proposing a cross-promotional collaboration with another artist.
    Optionally sends the proposal via SendGrid.
    """

    async def execute(self, target_artist: str, shared_demographic: str, collaboration_idea: str, **kwargs) -> Response:
        self.set_progress(f"Drafting collaboration proposal to {target_artist}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Draft a professional yet personable collaboration proposal to another artist.
            
            Target Artist: {target_artist}
            Shared Fan Demographic: {shared_demographic}
            Collaboration Idea: {collaboration_idea}
            
            Rules:
            1. Be genuine and reference their work specifically.
            2. Clearly state the mutual benefit.
            3. Keep it under 150 words.
            
            Return ONLY a JSON object:
            {{
              "dm_version": "Short DM for Instagram/Twitter",
              "email_version": "Slightly longer email version",
              "subject_line": "Email subject line",
              "follow_up_template": "1-sentence follow-up if no response in 5 days"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.5)
            )
            proposal = json.loads(response.text)
            
            # --- SendGrid Integration ---
            import requests, os
            from dotenv import load_dotenv
            load_dotenv()
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "collab@indiios.com")
            workflow_status = "Proposal generated (not sent)"
            send_result = None
            
            if kwargs.get("auto_send") and sendgrid_key and kwargs.get("target_email"):
                target_email = kwargs["target_email"]
                self.set_progress(f"Sending proposal to {target_email}...")
                sg_payload = {
                    "personalizations": [{"to": [{"email": target_email, "name": target_artist}], "subject": proposal.get("subject_line", f"Collab idea — {target_artist}")}],
                    "from": {"email": from_email, "name": "indiiOS Collaborations"},
                    "content": [{"type": "text/plain", "value": proposal.get("email_version", "")}],
                    "categories": ["artist-collab", "auto-generated"]
                }
                headers = {"Authorization": f"Bearer {sendgrid_key}", "Content-Type": "application/json"}
                try:
                    sg_res = requests.post("https://api.sendgrid.com/v3/mail/send", json=sg_payload, headers=headers, timeout=10)
                    if sg_res.status_code in (200, 202):
                        workflow_status = f"Proposal sent to {target_email}"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {sg_e}"
                    send_result = "error"
            
            return Response(
                message=f"Collaboration proposal for {target_artist}. {workflow_status}",
                additional={"proposal": proposal, "workflow_status": workflow_status, "send_result": send_result}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Cross Collaboration Proposal Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
