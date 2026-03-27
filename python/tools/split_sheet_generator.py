
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SplitSheetGenerator(Tool):
    """
    Publishing Administrator Tool.
    Takes an array of collaborators and percentages, and generates a formatted split sheet agreement.
    Optionally creates a PandaDoc document for digital signing by all parties.
    """

    async def execute(self, track_title: str, collaborators: list, isrc: str = "TBD", iswc: str = "TBD", **kwargs) -> Response:
        self.set_progress(f"Generating Split Sheet for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            # Input validation
            total_split = sum([comp.get('split_percentage', 0) for comp in collaborators])
            if abs(total_split - 100.0) > 0.01:
                return Response(message=f"Error: Split percentages must equal 100. Current total: {total_split}%", break_loop=False)

            collaborator_text = "\n".join([
                f"- Name: {c.get('name')}, Role: {c.get('role', 'Writer/Producer')}, PRO: {c.get('pro', 'ASCAP/BMI')}, IPI: {c.get('ipi', 'TBD')}, Split: {c.get('split_percentage')}%"
                for c in collaborators
            ])
            
            prompt = f"""
            You are the indiiOS Publishing Administrator. 
            Generate a formal, legally binding "Songwriter Split Sheet" document in Markdown format.
            
            Song Title: {track_title}
            ISRC: {isrc}
            ISWC: {iswc}
            Date of Agreement: [Current Date]
            
            Collaborators:
            {collaborator_text}
            
            The document must include:
            1. An introductory declaration of agreement.
            2. The clean list of collaborators with their exact percentages, roles, and PRO/IPI information.
            3. Standard legalese stating this document supersedes prior verbal agreements regarding the composition copyright.
            4. Signature lines for all parties.
            
            Output ONLY the Markdown document text.
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
                    temperature=0.0
                )
            )
            
            markdown_doc = response.text
            
            # --- PandaDoc Integration: Create a signable split sheet ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "Split sheet generated (local only)"
            pandadoc_doc_id = None
            
            create_signable = kwargs.get("create_pandadoc", False)
            
            if create_signable and pandadoc_key:
                self.set_progress("Creating PandaDoc split sheet for signing...")
                
                recipients = []
                for c in collaborators:
                    email = c.get("email", f"{c.get('name', 'unknown').replace(' ', '.').lower()}@placeholder.com")
                    recipients.append({
                        "email": email,
                        "first_name": c.get("name", "Collaborator"),
                        "role": "Signer"
                    })
                
                doc_payload = {
                    "name": f"Split Sheet - {track_title} ({isrc})",
                    "recipients": recipients,
                    "content_placeholders": [
                        {"block_id": "track_title", "value": track_title},
                        {"block_id": "isrc", "value": isrc},
                        {"block_id": "iswc", "value": iswc},
                        {"block_id": "split_sheet_body", "value": markdown_doc[:5000]},
                    ],
                    "tags": ["split-sheet", "publishing", "auto-generated"]
                }
                
                template_id = os.getenv("PANDADOC_SPLIT_SHEET_TEMPLATE_ID")
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
                        workflow_status = f"PandaDoc split sheet {pandadoc_doc_id} created — ready for signing"
                    else:
                        workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                except Exception as pd_e:
                    workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
            elif create_signable:
                workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
            
            return Response(
                message=f"Split Sheet for '{track_title}'. {workflow_status}",
                additional={
                    "markdown_document": markdown_doc,
                    "workflow_status": workflow_status,
                    "pandadoc_doc_id": pandadoc_doc_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Split Sheet Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
