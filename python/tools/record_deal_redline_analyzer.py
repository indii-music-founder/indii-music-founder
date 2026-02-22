
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RecordDealRedlineAnalyzer(Tool):
    """
    Legal Counsel Tool.
    Simulates scanning a PDF recording agreement and flagging predatory sub-publishing clauses.
    """

    async def execute(self, contract_summary_text: str) -> Response:
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

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            return Response(
                message=f"Contract analyzed for predatory clauses.",
                additional={"redline_report": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Record Deal Redline Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
