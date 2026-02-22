from python.helpers.api import ApiHandler
import json
import sys
import os

class ImageGenRoute(ApiHandler):
    """
    API route for image generation via the indii_image_gen Python tool.
    
    Provides a REST API endpoint that the frontend can call directly
    instead of going through Cloud Functions, useful for local development
    and Electron desktop mode.
    
    POST /image_gen
    Body: { "prompt": "...", "aspect_ratio": "1:1", "count": 1 }
    """
    methods = ["POST"]

    @staticmethod
    def get_methods():
        return ["POST"]

    @staticmethod
    def requires_csrf():
        return True

    @staticmethod
    def requires_api_key():
        return True

    async def process(self, input_data, request):
        prompt = input_data.get("prompt", "")
        if not prompt:
            return {"error": "Prompt is required", "status": "error"}

        aspect_ratio = input_data.get("aspect_ratio", "1:1")
        count = min(int(input_data.get("count", 1)), 4)
        model = input_data.get("model", "imagen-3.0-generate-001")

        try:
            # Dynamically import the image gen tool
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
            from tools.indii_image_gen import Tool as ImageGenTool

            tool = ImageGenTool()
            result = await tool.execute(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                count=count,
                model=model
            )

            return {
                "status": "ok",
                "images": result.get("images", []),
                "metadata": {
                    "model": model,
                    "prompt_snippet": prompt[:100],
                    "aspect_ratio": aspect_ratio,
                    "is_ai_generated": True
                }
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__
            }
