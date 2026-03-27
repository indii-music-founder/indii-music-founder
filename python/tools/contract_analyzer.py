
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ContractAnalyzer(Tool):
    """
    Analyzes legal contracts (PDFs) to extract key terms and flag unfavorable clauses.
    Optionally creates a PandaDoc document from the analysis for client review.
    """

    async def execute(self, action: str, file_path: str = "", **kwargs) -> Response:
        self.set_progress(f"Initiating Contract Analysis: {action}")
        
        try:
            from google import genai
            from google.genai import types
            import os
            
            if not file_path or not os.path.exists(file_path):
                 return Response(message=f"Error: Contract file not found at {file_path}", break_loop=False)
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_AGENT # Pro required for complex legal reasoning
            
            with open(file_path, "rb") as f:
                asset_data = f.read()
            mime_type = "application/pdf"
            
            if action == "extract_terms":
                prompt = """
                You are indiiOS Legal Counsel. Analyze this contract and extract the key terms into JSON.
                
                Required JSON format:
                {
                  "type": "Record Deal, Publishing, Split Sheet, etc.",
                  "parties": ["Name 1", "Name 2"],
                  "term": "Length of agreement (e.g. 5 years, in perpetuity)",
                  "territory": "Worldwide, US only, etc.",
                  "royalties_or_splits": "Extracted numerical splits or royalty rates",
                  "flags": ["Clause 4a is unfavorable because it limits audit rights", "Term length is unusually long"]
                }
                
                Extract these fields accurately based ONLY on the provided PDF text. If a field is not present, mark it "Not specified".
                """

                _rl = RateLimiter()
                wait_time = _rl.wait_time("gemini")
                if wait_time > 0:
                    self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                    await asyncio.sleep(wait_time)

                response = client.models.generate_content(
                    model=model_id,
                    contents=[
                        types.Part.from_bytes(data=asset_data, mime_type=mime_type),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0 # High factuality
                    )
                )
                
                analysis = json.loads(response.text)
                
                # --- PandaDoc Integration: Create a summary document ---
                import requests
                from dotenv import load_dotenv
                load_dotenv()
                
                pandadoc_key = os.getenv("PANDADOC_API_KEY")
                workflow_status = "Analysis complete"
                pandadoc_doc_id = None
                
                create_doc = kwargs.get("create_pandadoc", False)
                
                if create_doc and pandadoc_key:
                    self.set_progress("Creating PandaDoc summary document...")
                    
                    flags_text = "\n".join([f"⚠️ {f}" for f in analysis.get("flags", [])])
                    
                    doc_payload = {
                        "name": f"Contract Analysis - {analysis.get('type', 'Unknown')}",
                        "recipients": [
                            {"email": kwargs.get("recipient_email", "legal@indiios.com"), "role": "Client"}
                        ],
                        "content_placeholders": [
                            {"block_id": "contract_type", "value": analysis.get("type", "N/A")},
                            {"block_id": "parties", "value": ", ".join(analysis.get("parties", []))},
                            {"block_id": "term", "value": analysis.get("term", "N/A")},
                            {"block_id": "territory", "value": analysis.get("territory", "N/A")},
                            {"block_id": "royalties", "value": analysis.get("royalties_or_splits", "N/A")},
                            {"block_id": "red_flags", "value": flags_text or "None identified"},
                        ],
                        "tags": ["contract-analysis", "auto-generated"]
                    }
                    
                    template_id = os.getenv("PANDADOC_CONTRACT_TEMPLATE_ID")
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
                            workflow_status = f"PandaDoc document {pandadoc_doc_id} created"
                        else:
                            workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                    except Exception as pd_e:
                        workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
                elif create_doc:
                    workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
                
                return Response(
                    message=f"Contract Terms Extracted. {workflow_status}",
                    additional={
                        "analysis": analysis,
                        "workflow_status": workflow_status,
                        "pandadoc_doc_id": pandadoc_doc_id
                    }
                )

            else:
                return Response(message=f"Unknown action: {action}", break_loop=False)

        except Exception as e:
            import traceback
            return Response(message=f"Contract Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
