from python.helpers.api import ApiHandler
import json
import sys
import os

class ImageEditRoute(ApiHandler):
    """
    API route for image editing via the indii_image_edit Python tool.
    
    POST /image_edit
    Body: {
        "prompt": "...",
        "image": "base64...",
        "mask": "base64...",
        "model": "imagen-3.0-capability-001"
    }
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
        image_bytes = input_data.get("image") or input_data.get("image_bytes")
        
        if not prompt:
            return {"error": "Prompt is required", "status": "error", "success": False}
        if not image_bytes:
            return {"error": "Base image is required", "status": "error", "success": False}

        mask_bytes = input_data.get("mask") or input_data.get("mask_bytes")
        model = input_data.get("model")

        try:
            # Dynamically import the image edit tool
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
            from tools.indii_image_edit import Tool as ImageEditTool

            tool = ImageEditTool()
            result = await tool.execute(
                prompt=prompt,
                image_bytes=image_bytes,
                mask_bytes=mask_bytes,
                model=model
            )

            if isinstance(result, dict) and result.get("status") == "error":
                 return result

            # Tool returns a Response object
            visual_path = result.additional.get("visual") if hasattr(result, "additional") else None

            return {
                "status": "ok",
                "success": True,
                "url": visual_path,
                "data": {
                    "base64": None, # Local path is used in visual_path
                    "url": visual_path
                },
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "image/png",
                                        "data": None,
                                        "uri": visual_path
                                    }
                                }
                            ]
                        }
                    }
                ],
                "metadata": {
                    "model": model or "imagen-3.0-capability-001",
                    "prompt_snippet": prompt[:100],
                    "is_ai_generated": True,
                    "local": True
                }
            }

        except Exception as e:
            return {
                "status": "error",
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }
