import os
import time
import asyncio
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

# Note: google-genai SDK for Veo might be under specific modules or experimental.
# We will assume a standard generation interface or use the REST API via the SDK if needed.
# For this implementation, we simulate the structure based on standard GenAI usage.

class IndiiVideoGen(Tool):
    # Constants for paths and behaviors
    PROJECT_ROOT = "/a0/usr/projects"
    MOCK_VIDEO_CONTENT = b"MOCK_VIDEO_DATA"
    DEFAULT_DURATION = 8

    async def execute(self, **kwargs) -> Response:
        try:
            prompt = kwargs.get("prompt", "")
            image_path = kwargs.get("image_path", "")
            
            self.set_progress("Initializing Veo video generation...")

            # 1. API Call Setup (Zero Hardcoding)
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.VIDEO_GEN 

            # Validating input
            if not prompt and not image_path:
                 return Response(message="Error: Prompt or Image Path required.", break_loop=False)

            self.set_progress(f"Submitting video request to {model_id}...")
            
            # 2. Call Veo API
            # Note: For Image-to-Video, we would pass the image as a part.
            contents = [prompt] if prompt else []
            if image_path:
                # We need to handle local path to binary or URI
                with open(image_path, "rb") as f:
                    image_data = f.read()
                contents.append(types.Part.from_bytes(data=image_data, mime_type="image/png"))

            response = client.models.generate_videos(
                model=model_id,
                prompt=prompt,
                # config=types.GenerateVideosConfig( ... ) # Optional params
            )

            if not response.generated_videos:
                return Response(message="Error: Veo API returned no video data.", break_loop=False)

            # 3. Path Resolution
            try:
                project_id = getattr(self.agent.context, 'id', 'default_project')
            except Exception:
                project_id = "default_project"
            
            assets_dir = os.path.join(self.PROJECT_ROOT, project_id, "assets", "video")
            os.makedirs(assets_dir, exist_ok=True)
            
            timestamp = int(time.time())
            video_filename = f"vid_{timestamp}.mp4"
            video_path = os.path.join(assets_dir, video_filename)
            
            # Save actual video
            video_bytes = response.generated_videos[0].video.video_bytes
            with open(video_path, "wb") as f:
                f.write(video_bytes) 

            # 4. Handle Thumbnail (Veo might not return one directly yet, so we use the input or a placeholder)
            thumb_path = image_path if image_path else ""
            
            return Response(
                message=f"Video generated successfully! \n\n[Download Video]({video_path})",
                break_loop=False,
                additional={
                    "video_path": video_path,
                    "model": model_id
                }
            )

        except Exception as e:
            return Response(message=f"Video generation failed: {str(e)}", break_loop=False)