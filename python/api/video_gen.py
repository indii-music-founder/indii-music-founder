from python.helpers.api import ApiHandler
import json
import sys
import os

class VideoGenRoute(ApiHandler):
    """
    API route for video generation via the indii_video_gen Python tool.
    
    Provides a REST API endpoint that the frontend can call directly
    instead of going through Cloud Functions + Inngest, useful for local
    development and Electron desktop mode.
    
    POST /video_gen
    Body: {
        "prompt": "...",
        "aspect_ratio": "16:9",
        "duration": 8,
        "start_image_url": null,
        "model": "veo-3.1-generate-preview"
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
        if not prompt:
            return {"error": "Prompt is required", "status": "error"}

        # Handle various field names (frontend uses aspectRatio, API uses aspect_ratio)
        aspect_ratio = input_data.get("aspect_ratio") or input_data.get("aspectRatio") or "16:9"
        
        # Handle duration (frontend might send duration or durationSeconds)
        duration = input_data.get("duration") or input_data.get("durationSeconds") or 4
        try:
            duration = min(int(duration), 30)
        except:
            duration = 4

        # Handle images (Frontend sends image object with imageBytes)
        image_bytes = None
        image_data_obj = input_data.get("image")
        if isinstance(image_data_obj, dict):
            image_bytes = image_data_obj.get("imageBytes")
        
        if not image_bytes:
            image_bytes = input_data.get("image_bytes") or input_data.get("imageBytes")

        model = input_data.get("model", "veo-3.1-generate-preview")

        try:
            # Dynamically import the video gen tool
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
            from tools.indii_video_gen import Tool as VideoGenTool

            tool = VideoGenTool()
            result = await tool.execute(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                duration=duration,
                image_bytes=image_bytes,
                model=model
            )

            if isinstance(result, dict) and result.get("status") == "error":
                 return result

            # Tool returns a Response object
            visual_path = result.additional.get("visual") if hasattr(result, "additional") else None

            return {
                "status": "ok",
                "success": True,
                "video_url": visual_path,
                "operation_name": result.additional.get("operation_name") if hasattr(result, "additional") else None,
                "metadata": {
                    "model": model,
                    "prompt_snippet": prompt[:100],
                    "aspect_ratio": aspect_ratio,
                    "duration": duration,
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
