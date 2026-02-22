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

        aspect_ratio = input_data.get("aspect_ratio", "16:9")
        duration = min(int(input_data.get("duration", 8)), 30)
        start_image_url = input_data.get("start_image_url")
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
                start_image_url=start_image_url,
                model=model
            )

            return {
                "status": "ok",
                "video_url": result.get("video_url"),
                "operation_name": result.get("operation_name"),
                "metadata": {
                    "model": model,
                    "prompt_snippet": prompt[:100],
                    "aspect_ratio": aspect_ratio,
                    "duration": duration,
                    "is_ai_generated": True
                }
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__
            }
