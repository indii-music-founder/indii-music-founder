
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class FanDiscordServerSkeleton(Tool):
    """
    Social Media Manager Tool.
    Outputs a structural design to construct a well-moderated fan Discord server.
    """

    async def execute(self, artist_name: str, fanbase_name: str, is_gaming_focused: bool = False) -> Response:
        self.set_progress(f"Designing Discord server skeleton for the {fanbase_name} community")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            gaming_context = "Include dedicated channels for gaming & streaming." if is_gaming_focused else "Focus heavily on music production and general chat."
            
            prompt = f"""
            You are the indiiOS Community & Social Media Manager.
            Design the category and channel structure for a new official artist Discord server.
            
            Artist: {artist_name}
            Fanbase Name: {fanbase_name}
            Context: {gaming_context}
            
            Rules:
            1. Create a logical hierarchy: Information, Community, Media, Voice, etc.
            2. Define 3-5 custom Roles (e.g., Admins, VIPs, standard fans).
            3. Provide a short description of what each channel is for.
            
            Return ONLY a JSON object matching this structure:
            {{
              "server_name": "...",
              "roles": ["...", "..."],
              "categories": [
                {{
                  "name": "Information",
                  "channels": [
                    {{"name": "announcements", "purpose": "..."}}
                  ]
                }}
              ]
            }}
            """
            
            

            
                        _rl = RateLimiter()

            
                        wait_time = _rl.wait_time("gemini")

            
                        if wait_time > 0:

            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

            
                            await asyncio.sleep(wait_time)

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3 # Structured architecture
                )
            )
            
            return Response(
                message=f"Discord server skeleton designed for {artist_name}.",
                additional={"discord_config": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Fan Discord Server Skeleton Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
