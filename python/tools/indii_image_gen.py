
from python.helpers.rate_limiter import RateLimiter
import asyncio
import os
import time
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IndiiImageGen(Tool):
    """
    Executes actual image generation via Gemini (Imagen 3).
    Strictly follows the OS-as-Tool Persistence Rule and img:// Protocol Bridge.
    """
    async def execute(self, prompt, style="", aspect_ratio="1:1", **kwargs):
        self.set_progress("Initializing Imagen 3 synthesis...")

        try:
            # 1. API Call Setup
            from google import genai
            from google.genai import types

            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.IMAGE_GEN

            # 2. Tag Extraction & Enrichment
            enriched_prompt = f"{prompt}, style: {style}, aspect_ratio: {aspect_ratio}"
            self.set_progress(f"Generating image with {model_id}...")

            # 3. Call Imagen API
            

                        _rl = RateLimiter()

                        wait_time = _rl.wait_time("gemini")

                        if wait_time > 0:

                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

                            await asyncio.sleep(wait_time)

            esponse = client.models.generate_images(
                model=model_id,
                prompt=enriched_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                )
            )

            if not response.generated_images:
                return Response(message="Error: Image API returned no data.", break_loop=False)

            # 4. Persistence Rule (Physicality First)
            # Standardizing to relative assets path for portability
            assets_dir = os.path.join(os.getcwd(), "assets", "image")
            if not os.path.exists(assets_dir):
                os.makedirs(assets_dir, exist_ok=True)

            image_data = response.generated_images[0].image.image_bytes
            filename = f"gen_{int(time.time())}.png"
            abs_path = os.path.join(assets_dir, filename)

            with open(abs_path, "wb") as f:
                f.write(image_data)

            # 5. Protocol Bridge (The Magic String)
            # Logic: img://{abs_path}&t={timestamp}
            protocol_path = f"img://{abs_path}&t={time.time()}"

            # 3. Response Payload (The Handoff)
            # Vector A: Inline Chat (Markdown)
            # Vector B: Tool Result (Metadata for UI thumbnails)
            return Response(
                message=f"""**Gemini Image Generation Complete.**

![Generated Image]({protocol_path})""",
                break_loop=False,
                additional={"visual": protocol_path}
            )

        except Exception as e:
            import traceback
            error_msg = f"""Image Generation Failed: {str(e)}
{traceback.format_exc()}"""
            return Response(message=error_msg, break_loop=False)
