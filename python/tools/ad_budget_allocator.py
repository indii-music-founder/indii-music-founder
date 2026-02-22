import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AdBudgetAllocator(Tool):
    """
    Marketing Executive Tool.
    Takes a specified budget and allocates it optimally across ad platforms (Meta, TikTok).
    """

    async def execute(self, total_budget_usd: float, campaign_goal: str, target_audience: str) -> Response:
        self.set_progress(f"Allocating ${total_budget_usd} ad budget for: {campaign_goal}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text Generation / Routing
            
            prompt = f"""
            You are the indiiOS Digital Advertising Strategist.
            Allocate an ad budget across Meta (IG/FB) and TikTok for an upcoming music release campaign.
            
            Total Budget: ${total_budget_usd}
            Campaign Goal (e.g., Pre-saves, Spotify conversions, Video Views): {campaign_goal}
            Target Audience: {target_audience}
            
            Rules:
            1. Output a sensible split based on current industry best practices for the specified goal. (e.g., TikTok is better for raw views/awareness, Meta is better for hard conversions like pre-saves).
            2. Provide a 1-sentence rationale for the split.
            3. Suggest exactly 3 distinct ad creatives or "hooks" to test.
            
            Return ONLY a JSON object:
            {{
              "allocation": {{
                "meta_usd": 0,
                "tiktok_usd": 0,
                "youtube_shorts_usd": 0
              }},
              "rationale": "...",
              "suggested_hooks": ["Hook 1...", "Hook 2...", "Hook 3..."]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2 # Needs to be logical and grounded
                )
            )
            
            return Response(
                message=f"Ad budget of ${total_budget_usd} allocated successfully.",
                additional={"ad_strategy": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Ad Budget Allocator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
