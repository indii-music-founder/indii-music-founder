import os
import time
import asyncio
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IndiiVideoGen(Tool):
    """
    Executes high-fidelity video generation via Gemini (Veo 3.1).
    Strictly follows the OS-as-Tool Persistence Rule and img:// Protocol Bridge.
    """

    async def execute(self, **kwargs) -> Response:
        self.set_progress("Initializing Veo 3.1 synthesis...")
        
        try:
            prompt = kwargs.get("prompt", "")
            image_path = kwargs.get("image_path", "")
            duration = kwargs.get("duration", 4) 
            
            # 1. API Call Setup
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.VIDEO_GEN 

            if not prompt and not image_path:
                return Response(message="Error: Prompt or Source Image required for video synthesis.", break_loop=False)

            self.set_progress(f"Submitting video request to {model_id}...")
            
            # 2. Call Veo API
            self.set_progress(f"Submitting video request to {model_id}...")
            
            # Use source object for prompt/image
            source = types.GenerateVideosSource(prompt=prompt) if prompt else None
            
            if image_path:
                with open(image_path, "rb") as f:
                    image_data = f.read()
                image = types.Image(image_bytes=image_data, mime_type="image/png")
                
                # If we have both, image-to-video takes the image in 'image' kwarg and prompt in 'prompt' kwarg.
                # However the latest SDK recommends using source=GenerateVideosSource(image=..., prompt=...)
                source = types.GenerateVideosSource(prompt=prompt, image=image)

            operation = client.models.generate_videos(
                model=model_id,
                source=source,
                config=types.GenerateVideosConfig(
                    duration_seconds=duration,
                )
            )

            self.set_progress("Veo 3.1 synthesizing video frames (this may take 1-2 minutes)...")
            
            while not getattr(operation, 'done', False):
                await asyncio.sleep(5)
                operation = client.operations.get(operation=operation)
                
            if getattr(operation, 'error', None):
                return Response(message=f"Error: Veo API generation failed: {operation.error}", break_loop=False)

            # Check both response and result attributes based on SDK version
            result = getattr(operation, 'response', None) or getattr(operation, 'result', None)
            
            if not result or not getattr(result, 'generated_videos', None):
                return Response(message="Error: Veo API returned no video data.", break_loop=False)

            # 4. Persistence Rule (Physicality First)
            try:
                project_id = getattr(self.agent.context, 'id', 'default_project')
            except:
                project_id = "default_project"

            # Blueprint Path: /a0/usr/projects/{project_id}/assets/video/
            assets_dir = f"/a0/usr/projects/{project_id}/assets/video"
            if not os.path.exists("/a0"):
                assets_dir = f"/tmp/indiiOS/projects/{project_id}/assets/video"
            os.makedirs(assets_dir, exist_ok=True)

            filename = f"gen_{int(time.time())}.mp4"
            abs_path = os.path.join(assets_dir, filename)

            video_obj = result.generated_videos[0].video
            video_data = getattr(video_obj, 'video_bytes', None)
            video_uri = getattr(video_obj, 'uri', None)

            if video_data:
                with open(abs_path, "wb") as f:
                    f.write(video_data)
            elif video_uri:
                import urllib.request
                self.set_progress(f"Downloading high-fidelity video asset from Veo...")
                req = urllib.request.Request(video_uri, headers={'x-goog-api-key': api_key})
                with urllib.request.urlopen(req) as response_stream, open(abs_path, 'wb') as out_file:
                    out_file.write(response_stream.read())
            else:
                return Response(message="Error: Veo API returned no video bytes and no URI.", break_loop=False)

            # 5. Protocol Bridge (The Magic String)
            # UI handles video files via the img:// protocol as well for unified rendering
            protocol_path = f"img://{abs_path}&t={time.time()}"

            return Response(
                message=f"**Gemini Video Generation Complete.**\n\nVideo asset ready at: {protocol_path}",
                additional={"visual": protocol_path}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Video Generation Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)