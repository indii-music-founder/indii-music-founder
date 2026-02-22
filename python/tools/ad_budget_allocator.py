import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AdBudgetAllocator(Tool):
    """
    Marketing Executive Tool.
    Distributes an ad budget optimally across Meta and TikTok based on goals.
    """

    async def execute(self, total_budget_usd: float, primary_goal: str = "Spotify Conversions") -> Response:
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
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            return Response(
                message=f"Ad budget of ${total_budget_usd} allocated effectively.",
                additional={"allocation": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Ad Budget Allocator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
