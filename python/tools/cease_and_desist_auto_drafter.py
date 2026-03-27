
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CeaseAndDesistAutoDrafter(Tool):
    """
    Legal Counsel Tool.
    Generates a formatted C&D letter for unauthorized use of a master recording.
    Optionally creates a PandaDoc document for digital delivery/signing.
    """

    async def execute(self, infringing_url: str, artist_name: str, copyright_owner: str, **kwargs) -> Response:
        self.set_progress(f"Drafting Cease and Desist for {infringing_url}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a formal Cease and Desist letter demanding the takedown of an unauthorized upload.
            
            Infringing URL: {infringing_url}
            Artist: {artist_name}
            Copyright Owner: {copyright_owner}
            
            Rules:
            1. Use formal legal language citing the DMCA (if applicable) or general copyright infringement.
            2. Demand removal within 48 hours.
            3. Do not invent a real law firm name, sign it "indiiOS Legal Division".
            
            Return ONLY a JSON object:
            {{
              "subject_line": "...",
              "letter_body": "...",
              "recommended_action": "Email to platform abuse contact."
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
            
            legal_doc = json.loads(response.text)
            
            # --- PandaDoc Integration: Create a C&D PDF ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "C&D drafted (local only)"
            pandadoc_doc_id = None
            
            create_pdf = kwargs.get("create_pandadoc", False)
            
            if create_pdf and pandadoc_key:
                self.set_progress("Creating PandaDoc C&D document for delivery...")
                
                doc_payload = {
                    "name": f"Cease & Desist - {artist_name} v. {infringing_url[:40]}",
                    "recipients": [
                        {"email": kwargs.get("recipient_email", "legal@indiios.com"), "role": "Recipient"}
                    ],
                    "content_placeholders": [
                        {"block_id": "subject_line", "value": legal_doc.get("subject_line", "")},
                        {"block_id": "letter_body", "value": legal_doc.get("letter_body", "")},
                        {"block_id": "infringing_url", "value": infringing_url},
                        {"block_id": "copyright_owner", "value": copyright_owner},
                    ],
                    "tags": ["cease-and-desist", "auto-generated", "dmca"]
                }
                
                template_id = os.getenv("PANDADOC_CD_TEMPLATE_ID")
                if template_id:
                    doc_payload["template_uuid"] = template_id
                
                headers = {
                    "Authorization": f"API-Key {pandadoc_key}",
                    "Content-Type": "application/json"
                }
                
                try:
                    pd_res = requests.post(
                        "https://api.pandadoc.com/public/v1/documents",
                        json=doc_payload,
                        headers=headers,
                        timeout=15
                    )
                    if pd_res.ok:
                        pandadoc_doc_id = pd_res.json().get("id")
                        workflow_status = f"PandaDoc C&D document {pandadoc_doc_id} created"
                    else:
                        workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                except Exception as pd_e:
                    workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
            elif create_pdf:
                workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
            
            return Response(
                message=f"Cease & Desist drafted. {workflow_status}",
                additional={
                    "legal_doc": legal_doc,
                    "workflow_status": workflow_status,
                    "pandadoc_doc_id": pandadoc_doc_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Cease & Desist Auto-Drafter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
