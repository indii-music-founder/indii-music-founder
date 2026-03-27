
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class BrandAssetGenerator(Tool):
    """
    Brand Manager Tool.
    Evaluates uploaded logos/fonts against the Brand Kit,
    or generates color palettes based on textual descriptions using Gemini.
    Saves brand assets to Firestore profile.
    """

    async def execute(self, action: str, description: str = "", asset_path: str = "", **kwargs) -> Response:
        self.set_progress(f"Initiating Brand Asset check for action: {action}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Brand Manager.
            Action requested: {action}
            Description: {description}
            
            Based on the action:
            - "generate_palette": Create a cohesive color palette (primary, secondary, accent, background, text)
            - "evaluate_logo": Provide feedback on logo suitability for music branding
            - "font_recommendation": Suggest font pairings for the brand aesthetic
            
            Return ONLY a JSON object:
            {{
              "action": "{action}",
              "result": {{
                "color_palette": {{
                  "primary": "#hex",
                  "secondary": "#hex",
                  "accent": "#hex",
                  "background": "#hex",
                  "text": "#hex"
                }},
                "font_pairing": {{
                  "header": "Font Name",
                  "body": "Font Name",
                  "accent": "Font Name"
                }},
                "brand_assessment": "Overall assessment of brand direction",
                "recommendations": ["..."]
              }}
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.4)
            )
            brand_data = json.loads(response.text)
            
            # --- Firestore: Save brand assets to profile ---
            workflow_status = "Brand assets generated (local only)"
            if kwargs.get("save_to_profile") and kwargs.get("user_id"):
                try:
                    import firebase_admin
                    from firebase_admin import firestore as admin_firestore
                    if not firebase_admin._apps:
                        firebase_admin.initialize_app()
                    db = admin_firestore.client()
                    result = brand_data.get("result", {})
                    db.collection("users").document(kwargs["user_id"]).update({
                        "brandKit.colorPalette": result.get("color_palette", {}),
                        "brandKit.fontPairing": result.get("font_pairing", {}),
                        "brandKit.updatedAt": admin_firestore.SERVER_TIMESTAMP
                    })
                    workflow_status = "Brand assets saved to Firestore"
                except Exception as fs_e:
                    workflow_status = f"Firestore save failed: {fs_e}"
            
            return Response(
                message=f"Brand asset '{action}' completed. {workflow_status}",
                additional={"brand_data": brand_data, "workflow_status": workflow_status}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Brand Asset Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
