
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class BrandAssetGenerator(Tool):
    """
    Evaluates uploaded logos/fonts against the Brand Kit, 
    or generates color palettes based on textual descriptions using Gemini.
    """

    async def execute(self, action: str, description: str = "", asset_path: str = "") -> Response:
        self.set_progress(f"Initiating Brand Asset check for action: {action}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Brand/Routing logic
            
            if action == "generate_palette":
                prompt = f"""
                You are the indiiOS Brand Manager. Generate a JSON color palette based on this description: "{description}".
                Include primary, secondary, accent, background, and text colors in hex format.
                
                Expected JSON format:
                {{
                  "primary": "#HEX",
                  "secondary": "#HEX",
                  "accent": "#HEX",
                  "background": "#HEX",
                  "text": "#HEX"
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
                        temperature=0.7 # Slight variation for creative colors
                    )
                )
                return Response(
                    message="Generated Color Palette",
                    additional={"palette": json.loads(response.text)}
                )

            elif action == "evaluate_asset":
                if not asset_path:
                    return Response(message="Asset path required for evaluation.", break_loop=False)
                
                # Requires Pro for multi-modal visual analysis
                model_id = AIConfig.TEXT_AGENT 
                
                with open(asset_path, "rb") as f:
                    asset_data = f.read()
                    
                mime_type = "image/png" if asset_path.endswith(".png") else "image/jpeg"
                
                prompt = f"""
                You are the indiiOS Brand Manager. Evaluate this visual asset.
                Does it look professional? What are the dominant colors? 
                Provide a JSON assessment:
                
                {{
                    "professional": true/false,
                    "dominant_colors": ["#HEX1", "#HEX2"],
                    "feedback": "string feedback"
                }}
                """
                
                

                
                            _rl = RateLimiter()

                
                            wait_time = _rl.wait_time("gemini")

                
                            if wait_time > 0:

                
                                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

                
                                await asyncio.sleep(wait_time)

                
                esponse = client.models.generate_content(
                    model=model_id,
                    contents=[
                        types.Part.from_bytes(data=asset_data, mime_type=mime_type),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
                return Response(
                    message="Evaluated Brand Asset",
                    additional={"evaluation": json.loads(response.text)}
                )
                
            else:
                return Response(message=f"Unknown action: {action}", break_loop=False)

        except Exception as e:
            import traceback
            return Response(message=f"Brand Asset Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)

