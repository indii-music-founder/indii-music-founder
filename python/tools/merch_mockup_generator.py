
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MerchMockupGenerator(Tool):
    """
    Brand Manager Tool.
    Generates merch mockup specifications using Gemini image generation.
    Exports mockup spec as JSON for the POD provider API.
    """

    async def execute(self, product_type: str, design_description: str, color: str = "black", **kwargs) -> Response:
        self.set_progress(f"Generating merch mockup: {product_type} ({color})")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Merchandise Designer.
            Generate a detailed mockup specification for a merch item.
            
            Product: {product_type}
            Base Color: {color}
            Design: {design_description}
            
            Return ONLY a JSON object:
            {{
              "product_type": "{product_type}",
              "color": "{color}",
              "design_description": "{design_description}",
              "print_area": {{"width_inches": 12, "height_inches": 16, "position": "center-chest"}},
              "print_method": "DTG or Screen Print",
              "blank_garment": "Bella+Canvas 3001 or Gildan 64000",
              "estimated_cost_per_unit": 12.50,
              "suggested_retail_price": 30.00,
              "profit_margin_percentage": 58,
              "sizes_available": ["S", "M", "L", "XL", "2XL"],
              "mockup_prompt": "A photorealistic mockup prompt for image generation"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.3)
            )
            mockup_data = json.loads(response.text)
            
            # --- JSON Export for POD API ---
            import os
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    json.dump(mockup_data, f, indent=2)
            
            return Response(
                message=f"Mockup spec for {product_type} ({color}): ${mockup_data.get('suggested_retail_price', 0)} retail, ${mockup_data.get('estimated_cost_per_unit', 0)} cost.",
                additional={"mockup_data": mockup_data, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Merch Mockup Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
