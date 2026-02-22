
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SocialCaptionGenerator(Tool):
    """
    Social Media Manager Tool.
    Generates optimized caption options and hashtags based on an image/video asset
    and target platform (e.g. TikTok, Instagram).
    """

    async def execute(self, platform: str, target_audience: str, key_message: str, asset_path: str = None) -> Response:
        self.set_progress(f"Generating Social Captions for {platform}")
        
        try:
            from google import genai
            from google.genai import types
            import os
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            
            contents = []
            
            # If an asset is provided, use Pro vision for context. Otherwise, use Fast text.
            if asset_path and os.path.exists(asset_path):
                model_id = AIConfig.TEXT_AGENT
                with open(asset_path, "rb") as f:
                    asset_data = f.read()
                    
                mime_type = "image/jpeg"
                if asset_path.lower().endswith((".png")): mime_type = "image/png"
                elif asset_path.lower().endswith((".mp4", ".mov")): mime_type = "video/mp4"
                
                contents.append(types.Part.from_bytes(data=asset_data, mime_type=mime_type))
            else:
                model_id = AIConfig.TEXT_FAST

            prompt = f"""
            You are the indiiOS Social Media Manager. 
            Write 3 engaging, distinct caption options for a {platform} post.
            
            Context:
            Target Audience: {target_audience}
            Key Message: {key_message}
            Asset Provided: {"Yes, see attached media." if asset_path else "No media provided, base it purely on the message."}
            
            Required JSON Format:
            {{
               "options": [
                 {{
                    "tone": "Humorous/Edgy/Professional etc",
                    "caption": "The actual text with emojis 🚀",
                    "hashtags": ["#music", "#indii"]
                 }},
                 {{ "tone": "...", "caption": "...", "hashtags": [] }},
                 {{ "tone": "...", "caption": "...", "hashtags": [] }}
               ],
               "best_posting_time": "Suggested time/day for this platform based on audience"
            }}
            """
            
            contents.append(prompt)
            
            

            
                        _rl = RateLimiter()

            
                        wait_time = _rl.wait_time("gemini")

            
                        if wait_time > 0:

            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

            
                            await asyncio.sleep(wait_time)

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.8 # Creative captions
                )
            )
            
            return Response(
                message=f"Social Captions Generated for {platform}.",
                additional={"captions": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Social Caption Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
