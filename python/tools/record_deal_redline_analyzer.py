
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RecordDealRedlineAnalyzer(Tool):
    """
    Legal Counsel Tool.
    Scans a recording agreement summary and flags predatory sub-publishing clauses.
    Optionally creates a PandaDoc redline report for the artist's review.
    """

    async def execute(self, contract_summary_text: str, **kwargs) -> Response:
        self.set_progress("Analyzing recording contract for predatory clauses")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Review the following summaries of clauses extracted from a recording contract:
            {contract_summary_text}
            
            Rules:
            1. Flag any predatory sub-publishing clauses, 360 rights grabs, or perpetual term lengths.
            2. Suggest specific redlines (e.g. "Change Net Receipts to at-source").
            
            Return ONLY a JSON object:
            {{
              "red_flags": [
                {{"clause": "...", "issue": "...", "suggested_redline": "..."}}
              ],
              "overall_risk_score": "High/Medium/Low"
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
            
            redline_report = json.loads(response.text)
            
            # --- PandaDoc Integration: Create a Redline Report PDF ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "Analysis complete (local only)"
            pandadoc_doc_id = None
            
            create_report = kwargs.get("create_pandadoc", False)
            
            if create_report and pandadoc_key:
                self.set_progress("Creating PandaDoc redline report...")
                
                flags = redline_report.get("red_flags", [])
                flags_text = "\n\n".join([
                    f"🔴 Clause: {f.get('clause', 'N/A')}\n   Issue: {f.get('issue', 'N/A')}\n   Suggested Change: {f.get('suggested_redline', 'N/A')}"
                    for f in flags
                ])
                
                doc_payload = {
                    "name": f"Redline Report - Risk: {redline_report.get('overall_risk_score', 'Unknown')}",
                    "recipients": [
                        {"email": kwargs.get("recipient_email", "legal@indiios.com"), "role": "Artist"}
                    ],
                    "content_placeholders": [
                        {"block_id": "risk_score", "value": redline_report.get("overall_risk_score", "N/A")},
                        {"block_id": "red_flags", "value": flags_text or "No red flags identified."},
                        {"block_id": "flag_count", "value": str(len(flags))},
                    ],
                    "tags": ["redline-report", "contract-review", "auto-generated"]
                }
                
                template_id = os.getenv("PANDADOC_REDLINE_TEMPLATE_ID")
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
                        workflow_status = f"PandaDoc redline report {pandadoc_doc_id} created"
                    else:
                        workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                except Exception as pd_e:
                    workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
            elif create_report:
                workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
            
            return Response(
                message=f"Contract analyzed. Risk: {redline_report.get('overall_risk_score', 'Unknown')}. {workflow_status}",
                additional={
                    "redline_report": redline_report,
                    "workflow_status": workflow_status,
                    "pandadoc_doc_id": pandadoc_doc_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Record Deal Redline Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
