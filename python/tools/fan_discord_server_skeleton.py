
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class FanDiscordServerSkeleton(Tool):
    """
    Marketing Executive / Community Tool.
    Generates a complete Discord server structure blueprint with channels, roles, and bot configs.
    Exports as markdown spec for community managers.
    """

    async def execute(self, artist_name: str, community_size: str = "small", **kwargs) -> Response:
        self.set_progress(f"Generating Discord server skeleton for {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Community Architect.
            Design a complete Discord server structure for an indie music artist's fan community.
            
            Artist: {artist_name}
            Community Size: {community_size} (small: <1K, medium: 1-10K, large: 10K+)
            
            Return ONLY a JSON object:
            {{
              "server_name": "...",
              "categories": [
                {{
                  "name": "🎵 Music",
                  "channels": [
                    {{"name": "new-releases", "type": "text", "description": "Announcements for new drops"}},
                    {{"name": "listening-party", "type": "voice", "description": "Live listening sessions"}}
                  ]
                }}
              ],
              "roles": [
                {{"name": "OG Fan", "color": "#gold", "permissions": "Access to exclusive channels"}}
              ],
              "bot_recommendations": [
                {{"name": "MEE6", "purpose": "Auto-moderation and leveling"}}
              ],
              "onboarding_flow": "Describe the welcome experience"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.5)
            )
            server_data = json.loads(response.text)
            
            # --- Markdown Blueprint Export ---
            import os
            md = [f"# Discord Server Blueprint — {server_data.get('server_name', artist_name)}\n"]
            for cat in server_data.get("categories", []):
                md.append(f"## {cat.get('name', '')}\n")
                for ch in cat.get("channels", []):
                    icon = "💬" if ch.get("type") == "text" else "🔊"
                    md.append(f"- {icon} `#{ch.get('name','')}` — {ch.get('description','')}")
                md.append("")
            md.append("## Roles\n")
            for r in server_data.get("roles", []):
                md.append(f"- **{r.get('name','')}** ({r.get('color','')}) — {r.get('permissions','')}")
            md.append("\n## Recommended Bots\n")
            for b in server_data.get("bot_recommendations", []):
                md.append(f"- **{b.get('name','')}**: {b.get('purpose','')}")
            md.append(f"\n## Onboarding\n{server_data.get('onboarding_flow','')}")
            
            blueprint_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(blueprint_md)
            
            return Response(
                message=f"Discord server skeleton for {artist_name} generated.",
                additional={"server_data": server_data, "blueprint_md": blueprint_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Fan Discord Server Skeleton Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
