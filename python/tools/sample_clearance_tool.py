
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SampleClearanceTool(Tool):
    """
    Legal Counsel Tool.
    Evaluates risk on sample usage and generates a draft clearance request letter.
    Optionally sends the clearance request via SendGrid.
    """

    async def execute(self, sample_description: str, intended_usage: str, original_artist: str = "Unknown", **kwargs) -> Response:
        self.set_progress(f"Evaluating sample clearance for: {sample_description}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Legal Counsel specializing in music copyright.
            Evaluate the sample clearance risk and draft a clearance request letter.
            
            Sample Description: {sample_description}
            Original Artist/Source: {original_artist}
            Intended Usage: {intended_usage}
            
            Rules:
            1. Assess risk level (Low/Medium/High/Critical).
            2. Identify whether this requires Master + Publishing clearance or just one.
            3. Draft a formal clearance request letter.
            
            Return ONLY a JSON object:
            {{
              "risk_level": "Medium",
              "risk_factors": ["..."],
              "clearance_types_needed": ["Master Recording", "Publishing/Composition"],
              "estimated_cost_range": "$500 - $5,000",
              "clearance_letter": "Formal letter text requesting sample clearance",
              "alternatives_if_denied": ["Re-record a sound-alike", "Use royalty-free alternative"]
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0)
            )
            clearance = json.loads(response.text)
            
            # --- SendGrid: Send clearance request letter ---
            import requests, os
            from dotenv import load_dotenv
            load_dotenv()
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "legal@indiios.com")
            workflow_status = "Clearance assessment complete (letter not sent)"
            
            if kwargs.get("auto_send") and sendgrid_key and kwargs.get("rights_holder_email"):
                target = kwargs["rights_holder_email"]
                self.set_progress(f"Sending clearance request to {target}...")
                sg_payload = {
                    "personalizations": [{"to": [{"email": target}], "subject": f"Sample Clearance Request — {sample_description[:50]}"}],
                    "from": {"email": from_email, "name": "indiiOS Legal"},
                    "content": [{"type": "text/plain", "value": clearance.get("clearance_letter", "")}],
                    "categories": ["sample-clearance", "legal", "auto-generated"]
                }
                headers = {"Authorization": f"Bearer {sendgrid_key}", "Content-Type": "application/json"}
                try:
                    sg_res = requests.post("https://api.sendgrid.com/v3/mail/send", json=sg_payload, headers=headers, timeout=10)
                    if sg_res.status_code in (200, 202):
                        workflow_status = f"Clearance request sent to {target}"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {sg_e}"
            
            return Response(
                message=f"Sample clearance: {clearance.get('risk_level', 'Unknown')} risk. {workflow_status}",
                additional={"clearance": clearance, "workflow_status": workflow_status}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Sample Clearance Tool Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
