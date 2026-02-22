
from python.helpers.rate_limiter import RateLimiter
import asyncio
import os
import time
import base64
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IndiiImageEdit(Tool):
    """
    Executes image editing (inpainting, remix, outpainting) via Gemini (Imagen 3).
    Strictly follows the OS-as-Tool Persistence Rule and img:// Protocol Bridge.
    """
    async def execute(self, prompt, image_bytes, mask_bytes=None, model=None, **kwargs):
        self.set_progress("Initializing Imagen 3 editing pipeline...")

        try:
            # 1. API Call Setup
            from google import genai
            from google.genai import types

            api_key = AIConfig.get_api_key()
            # Note: Vertex AI is required for editing in the GenAI SDK
            client = genai.Client(
                api_key=api_key, 
                vertexai=True, 
                project=os.getenv("VITE_FIREBASE_PROJECT_ID"),
                location="us-central1",
                http_options={'api_version': 'v1beta'}
            )
            
            # Model for editing is specialized
            model_id = "imagen-3.0-capability-001"
            
            # 2. Reference Images Setup
            if "," in image_bytes:
                image_bytes = image_bytes.split(",")[1]
            raw_data = base64.b64decode(image_bytes)
            
            raw_ref = types.RawReferenceImage(
                reference_id=1,
                reference_image=types.Image(image_bytes=raw_data),
            )
            
            reference_images = [raw_ref]
            
            # Mode detection
            edit_mode = "EDIT_MODE_CONTROLLED_EDITING" # Default for remix
            
            if mask_bytes:
                if "," in mask_bytes:
                    mask_bytes = mask_bytes.split(",")[1]
                mask_data = base64.b64decode(mask_bytes)
                
                mask_ref = types.MaskReferenceImage(
                    reference_id=2,
                    reference_image=types.Image(image_bytes=mask_data),
                    config=types.MaskReferenceConfig(
                        mask_mode="MASK_MODE_USER_PROVIDED",
                    ),
                )
                reference_images.append(mask_ref)
                edit_mode = "EDIT_MODE_INPAINT_INSERTION"

            self.set_progress(f"Submitting edit request to {model_id}...")

            # 3. Call Imagen API
            # Rate limiting check
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.edit_image(
                model=model_id,
                prompt=prompt,
                reference_images=reference_images,
                config=types.EditImageConfig(
                    edit_mode=edit_mode,
                    number_of_images=1,
                    aspect_ratio="1:1" if not mask_bytes else None # Ratio usually comes from source for inpaint
                )
            )

            if not response.generated_images:
                return Response(message="Error: Image API returned no data.", break_loop=False)

            # 4. Persistence Rule (Physicality First)
            assets_dir = os.path.join(os.getcwd(), "assets", "image")
            if not os.path.exists(assets_dir):
                os.makedirs(assets_dir, exist_ok=True)

            out_image_data = response.generated_images[0].image.image_bytes
            filename = f"edit_{int(time.time())}.png"
            abs_path = os.path.join(assets_dir, filename)

            with open(abs_path, "wb") as f:
                f.write(out_image_data)

            # 5. Protocol Bridge
            protocol_path = f"img://{abs_path}&t={time.time()}"

            return Response(
                message=f"**Gemini Image Edit Complete.**\n\n![Edited Image]({protocol_path})",
                break_loop=False,
                additional={"visual": protocol_path, "status": "ok", "success": True}
            )

        except Exception as e:
            import traceback
            error_msg = f"Image Editing Failed: {str(e)}\n{traceback.format_exc()}"
            return Response(message=error_msg, break_loop=False, additional={"status": "error", "error": str(e)})

class Tool(IndiiImageEdit):
    pass
