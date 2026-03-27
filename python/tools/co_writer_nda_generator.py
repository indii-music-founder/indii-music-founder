
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CoWriterNdaGenerator(Tool):
    """
    Legal Counsel Tool.
    Drafts an NDA tailored for in-studio writing camps.
    Optionally creates a PandaDoc document for digital signing.
    """

    async def execute(self, artist_name: str, guest_writer_names: list, studio_location: str, date: str, **kwargs) -> Response:
        self.set_progress(f"Drafting Studio NDA for {len(guest_writer_names)} writers at {studio_location}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            writers_str = ", ".join(guest_writer_names)
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a Non-Disclosure Agreement (NDA) specifically tailored for a music industry writing camp / studio session.
            
            Disclosing Party (Artist/Label): {artist_name}
            Receiving Parties (Guest Writers): {writers_str}
            Studio Location: {studio_location}
            Date of Session: {date}
            
            Rules:
            1. The NDA must restrict the leaking or sharing of unreleased audio files, stems, session files, and lyrics.
            2. The NDA must restrict photography or social media posting of the session without explicit consent.
            3. The tone must be formal and legally binding under US state law (assume California jurisdiction).
            
            Return ONLY a JSON object:
            {{
              "contract_title": "NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT",
              "markdown_contract": "...",
              "parties_to_sign": ["..."],
              "key_clauses_summary": "Short 3-bullet summary of what the NDA prohibits."
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
            
            nda_data = json.loads(response.text)
            
            # --- PandaDoc Integration: Create a signable NDA document ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "NDA drafted (local only)"
            pandadoc_doc_id = None
            
            create_signable = kwargs.get("create_pandadoc", False)
            
            if create_signable and pandadoc_key:
                self.set_progress("Creating PandaDoc NDA for digital signing...")
                
                # Build recipient list from guest writers
                recipients = []
                writer_emails = kwargs.get("writer_emails", [])
                for i, name in enumerate(guest_writer_names):
                    email = writer_emails[i] if i < len(writer_emails) else f"writer{i+1}@placeholder.com"
                    recipients.append({"email": email, "first_name": name, "role": "Signer"})
                
                doc_payload = {
                    "name": f"Studio NDA - {studio_location} ({date})",
                    "recipients": recipients,
                    "content_placeholders": [
                        {"block_id": "disclosing_party", "value": artist_name},
                        {"block_id": "receiving_parties", "value": writers_str},
                        {"block_id": "studio_location", "value": studio_location},
                        {"block_id": "session_date", "value": date},
                        {"block_id": "contract_body", "value": nda_data.get("markdown_contract", "")},
                        {"block_id": "clauses_summary", "value": nda_data.get("key_clauses_summary", "")},
                    ],
                    "tags": ["nda", "studio-session", "auto-generated"]
                }
                
                template_id = os.getenv("PANDADOC_NDA_TEMPLATE_ID")
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
                        workflow_status = f"PandaDoc NDA {pandadoc_doc_id} created — ready for signing"
                    else:
                        workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                except Exception as pd_e:
                    workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
            elif create_signable:
                workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
            
            return Response(
                message=f"Studio NDA drafted for session at {studio_location}. {workflow_status}",
                additional={
                    "nda_data": nda_data,
                    "workflow_status": workflow_status,
                    "pandadoc_doc_id": pandadoc_doc_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Co-Writer NDA Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
