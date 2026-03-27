
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class WfhAgreementDrafter(Tool):
    """
    Legal Counsel Tool.
    Generates a customized Work-For-Hire agreement for collaborators.
    Optionally creates a PandaDoc document for digital signing.
    """

    async def execute(self, artist_name: str, collaborator_name: str, collaborator_role: str, flat_fee_usd: float, **kwargs) -> Response:
        self.set_progress(f"Drafting WFH Agreement for: {collaborator_name} ({collaborator_role})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a Work-For-Hire (WFH) agreement for a music industry freelancer.
            
            Hiring Party: {artist_name}
            Contractor: {collaborator_name}
            Role: {collaborator_role}
            Flat Fee: ${flat_fee_usd}
            
            Rules:
            1. All IP created during the engagement is owned by the Hiring Party.
            2. Contractor waives moral rights where applicable.
            3. Payment terms: 50% upfront, 50% on delivery.
            4. California jurisdiction.
            
            Return ONLY a JSON object:
            {{
              "contract_title": "WORK-FOR-HIRE AGREEMENT",
              "markdown_contract": "...",
              "key_terms_summary": "3-bullet summary of core terms"
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
                    temperature=0.0
                )
            )
            
            wfh_data = json.loads(response.text)
            
            # --- PandaDoc Integration ---
            import requests, os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "WFH agreement drafted (local only)"
            pandadoc_doc_id = None
            
            if kwargs.get("create_pandadoc") and pandadoc_key:
                self.set_progress("Creating PandaDoc WFH agreement...")
                doc_payload = {
                    "name": f"WFH Agreement - {collaborator_name} ({collaborator_role})",
                    "recipients": [
                        {"email": kwargs.get("collaborator_email", "contractor@placeholder.com"), "first_name": collaborator_name, "role": "Contractor"},
                        {"email": kwargs.get("artist_email", "artist@indiios.com"), "first_name": artist_name, "role": "Hiring Party"}
                    ],
                    "content_placeholders": [
                        {"block_id": "hiring_party", "value": artist_name},
                        {"block_id": "contractor", "value": collaborator_name},
                        {"block_id": "role", "value": collaborator_role},
                        {"block_id": "fee", "value": f"${flat_fee_usd}"},
                        {"block_id": "contract_body", "value": wfh_data.get("markdown_contract", "")[:5000]},
                    ],
                    "tags": ["wfh", "work-for-hire", "auto-generated"]
                }
                template_id = os.getenv("PANDADOC_WFH_TEMPLATE_ID")
                if template_id:
                    doc_payload["template_uuid"] = template_id
                headers = {"Authorization": f"API-Key {pandadoc_key}", "Content-Type": "application/json"}
                try:
                    pd_res = requests.post("https://api.pandadoc.com/public/v1/documents", json=doc_payload, headers=headers, timeout=15)
                    if pd_res.ok:
                        pandadoc_doc_id = pd_res.json().get("id")
                        workflow_status = f"PandaDoc WFH {pandadoc_doc_id} created"
                    else:
                        workflow_status = f"PandaDoc Error: {pd_res.status_code}"
                except Exception as e:
                    workflow_status = f"PandaDoc unreachable: {e}"
            
            return Response(
                message=f"WFH Agreement for {collaborator_name}. {workflow_status}",
                additional={"wfh_data": wfh_data, "workflow_status": workflow_status, "pandadoc_doc_id": pandadoc_doc_id}
            )
        except Exception as e:
            import traceback
            return Response(message=f"WFH Agreement Drafter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
