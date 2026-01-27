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
            
            # 2. Build Multi-Modal Payload
            contents = []
            if image_path:
                with open(image_path, "rb") as f:
                    image_data = f.read()
                contents.append(types.Part.from_bytes(data=image_data, mime_type="image/png"))
            
            if prompt:
                contents.append(prompt)

            # 3. Call Veo API
            response = client.models.generate_videos(
                model=model_id,
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    duration_seconds=duration,
                )
            )

            if not response.generated_videos:
                return Response(message="Error: Veo API returned no video data.", break_loop=False)

            # 4. Persistence Rule (Physicality First)
            try:
                project_id = getattr(self.agent.context, 'id', 'default_project')
            except:
                project_id = "default_project"

            # Blueprint Path: /a0/usr/projects/{project_id}/assets/video/
            assets_dir = f"/a0/usr/projects/{project_id}/assets/video"
            os.makedirs(assets_dir, exist_ok=True)

            video_data = response.generated_videos[0].video.video_bytes
            filename = f"gen_{int(time.time())}.mp4"
            abs_path = os.path.join(assets_dir, filename)

            with open(abs_path, "wb") as f:
                f.write(video_data)

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