
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TaxDeductionCategorizer(Tool):
    """
    Finance Manager Tool.
    Automatically parses CSV bank statement data (provided as a JSON array of transactions)
    and tags music-related write-offs (equipment, travel, meals).
    """

    async def execute(self, transactions_json_string: str) -> Response:
        self.set_progress("Categorizing transactions for tax write-offs")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Classification
            
            prompt = f"""
            You are the indiiOS Finance Manager & Tax Prep Assistant.
            Analyze the following list of transactions and identify which ones are likely deductible business expenses for an independent musician.
            
            Transactions Data:
            {transactions_json_string}
            
            Rules:
            1. Categorize standard music deductions: Gear/Software, Travel/Touring, Meals (50%), Marketing, Studio Time, Subscriptions (e.g., Spotify/Splice).
            2. Flag items that are definitely NOT deductible personal expenses.
            
            Return ONLY a JSON object with categorized transactions:
            {{
              "deductible_expenses": [
                {{
                  "date": "...",
                  "merchant": "Sweetwater Sound",
                  "amount": 149.99,
                  "category": "Gear/Software",
                  "confidence": "High"
                }}
              ],
              "non_deductible": ["...", "..."],
              "total_estimated_deductions_usd": 149.99
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
                    temperature=0.0 # Deterministic classification
                )
            )
            
            return Response(
                message=f"Tax deduction categorization complete.",
                additional={"tax_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tax Deduction Categorizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
