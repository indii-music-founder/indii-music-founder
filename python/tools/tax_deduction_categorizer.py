
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TaxDeductionCategorizer(Tool):
    """
    Finance Manager Tool.
    Parses CSV bank statement data (as JSON array of transactions) and tags
    music-related write-offs (equipment, travel, meals).
    Optionally exports to a Google Sheet or returns a CSV-ready payload.
    """

    async def execute(self, transactions_json_string: str, **kwargs) -> Response:
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

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0 # Deterministic classification
                )
            )
            
            tax_data = json.loads(response.text)
            
            # --- CSV Export: Generate a downloadable CSV payload ---
            csv_rows = []
            csv_rows.append("Date,Merchant,Amount,Category,Confidence,Deductible")
            
            for exp in tax_data.get("deductible_expenses", []):
                csv_rows.append(
                    f"{exp.get('date', '')},{exp.get('merchant', '')},{exp.get('amount', 0)},{exp.get('category', '')},{exp.get('confidence', '')},Yes"
                )
            
            for nd in tax_data.get("non_deductible", []):
                csv_rows.append(f",,,,{nd},No")
            
            csv_rows.append(f"\nTotal Estimated Deductions,,,${tax_data.get('total_estimated_deductions_usd', 0)}")
            
            csv_payload = "\n".join(csv_rows)
            
            # --- Optional: Save CSV to disk ---
            import os
            export_path = kwargs.get("export_path")
            if export_path:
                self.set_progress(f"Exporting tax report to {export_path}")
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Tax deduction categorization complete. Found ${tax_data.get('total_estimated_deductions_usd', 0)} in potential deductions.",
                additional={
                    "tax_data": tax_data,
                    "csv_payload": csv_payload,
                    "export_path": export_path
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Tax Deduction Categorizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
