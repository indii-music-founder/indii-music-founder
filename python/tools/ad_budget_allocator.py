
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AdBudgetAllocator(Tool):
    """
    Marketing Executive Tool.
    Distributes an ad budget optimally across Meta and TikTok based on goals.
    Exports allocation as a CSV spreadsheet for the marketing team.
    """

    async def execute(self, total_budget_usd: float, primary_goal: str = "Spotify Conversions", **kwargs) -> Response:
        self.set_progress(f"Allocating ${total_budget_usd} ad budget for {primary_goal}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Allocate a digital ad budget optimally across Meta (IG/FB) and TikTok.
            
            Total Budget: ${total_budget_usd}
            Primary Goal: {primary_goal}
            
            Rules:
            1. Base your distribution on current music marketing trends.
            2. Meta is usually better for direct Spotify conversions, TikTok is better for sheer awareness/virality.
            3. Break the budget into specific ad-sets (e.g., Lookalike Audiences, Retargeting).
            
            Return ONLY a JSON object:
            {{
              "meta_allocation_usd": 600,
              "tiktok_allocation_usd": 400,
              "strategy_breakdown": [
                {{"platform": "Meta", "campaign_type": "Retargeting", "amount": 200, "rationale": "Hit warm leads who engaged with recent posts"}}
              ],
              "expected_return_cpa": "$0.50 per click"
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
                    temperature=0.2
                )
            )
            
            allocation = json.loads(response.text)
            
            # --- CSV Export: Generate a budget breakdown spreadsheet ---
            csv_rows = [
                "Platform,Campaign Type,Amount (USD),Rationale"
            ]
            
            for item in allocation.get("strategy_breakdown", []):
                platform = item.get("platform", "")
                campaign_type = item.get("campaign_type", "")
                amount = item.get("amount", 0)
                rationale = item.get("rationale", "").replace(",", ";")
                csv_rows.append(f"{platform},{campaign_type},{amount},{rationale}")
            
            csv_rows.append("")
            csv_rows.append(f"Meta Total,,{allocation.get('meta_allocation_usd', 0)},")
            csv_rows.append(f"TikTok Total,,{allocation.get('tiktok_allocation_usd', 0)},")
            csv_rows.append(f"Grand Total,,{total_budget_usd},")
            csv_rows.append(f"Expected CPA,,,{allocation.get('expected_return_cpa', 'N/A')}")
            
            csv_payload = "\n".join(csv_rows)
            
            # Optional: Save to disk
            import os
            export_path = kwargs.get("export_path")
            if export_path:
                self.set_progress(f"Exporting budget allocation to {export_path}")
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Ad budget of ${total_budget_usd} allocated. Meta: ${allocation.get('meta_allocation_usd', 0)}, TikTok: ${allocation.get('tiktok_allocation_usd', 0)}.",
                additional={
                    "allocation": allocation,
                    "csv_payload": csv_payload,
                    "export_path": export_path
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Ad Budget Allocator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
