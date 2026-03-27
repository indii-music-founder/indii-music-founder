
from python.helpers.rate_limiter import RateLimiter
import asyncio
import os
import time
import base64
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IndiiImageGen(Tool):
    """
    Executes image generation via Nano Banana Pro (Gemini 3 Pro Image).
    Uses the generateContent API — NOT the deprecated generateImages endpoint.
    Strictly follows the OS-as-Tool Persistence Rule and img:// Protocol Bridge.
    """
    async def execute(self, prompt, style="", aspect_ratio="1:1", **kwargs):
        self.set_progress("Initializing Nano Banana Pro synthesis...")

        try:
            # 1. API Call Setup
            from google import genai
            from google.genai import types

            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.IMAGE_GEN  # gemini-3-pro-image-preview (Nano Banana Pro)

            # 2. Tag Extraction & Enrichment
            enriched_prompt = f"{prompt}"
            if style:
                enriched_prompt += f", style: {style}"
            self.set_progress(f"Generating image with {model_id} (Nano Banana Pro)...")

            # 3. Rate Limiting
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

# 4. Call Nano Banana via generateContent API
            response = client.models.generate_content(
                model=model_id,
                contents=[enriched_prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )

            # 5. Extract image from response parts
            image_data = None
            text_response = ""
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    text_response = part.text
                elif hasattr(part, 'inline_data') and part.inline_data:
                    image_data = base64.b64decode(part.inline_data.data) if isinstance(part.inline_data.data, str) else part.inline_data.data

            if not image_data:
                return Response(message=f"Error: Image API returned no image data. Text: {text_response}", break_loop=False)

            # 6. Persistence Rule (Physicality First)
            assets_dir = os.path.join(os.getcwd(), "assets", "image")
            if not os.path.exists(assets_dir):
                os.makedirs(assets_dir, exist_ok=True)

            filename = f"gen_{int(time.time())}.png"
            abs_path = os.path.join(assets_dir, filename)

            with open(abs_path, "wb") as f:
                f.write(image_data)

            # 7. Protocol Bridge (The Magic String)
            protocol_path = f"img://{abs_path}&t={time.time()}"

            # 8. Response Payload (The Handoff)
            return Response(
                message=f"""**Nano Banana Pro Image Generation Complete.**

![Generated Image]({protocol_path})""",
                break_loop=False,
                additional={"visual": protocol_path}
            )

        except Exception as e:
            import traceback
            error_msg = f"""Image Generation Failed: {str(e)}
{traceback.format_exc()}"""
            return Response(message=error_msg, break_loop=False)
