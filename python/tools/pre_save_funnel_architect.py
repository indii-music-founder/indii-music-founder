
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PreSaveFunnelArchitect(Tool):
    """
    Marketing Executive Tool.
    Generates HTML/CSS/JS for a tailored pre-save landing page.
    Exports as a deployable HTML file.
    """

    async def execute(self, artist_name: str, single_title: str, release_date: str, cover_art_url: str, **kwargs) -> Response:
        self.set_progress(f"Architecting Pre-Save Funnel for '{single_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive and Web Designer.
            Generate a complete, self-contained HTML pre-save landing page.
            
            Artist: {artist_name}
            Single Title: {single_title}
            Release Date: {release_date}
            Cover Art URL: {cover_art_url}
            
            Rules:
            1. Modern, mobile-first responsive design with dark theme.
            2. Include a countdown timer to the release date.
            3. Buttons for Spotify / Apple Music / YouTube Music pre-save (use placeholder hrefs).
            4. Email capture form for fan mailing list.
            5. Use inline CSS. No external dependencies except Google Fonts.
            
            Return ONLY a JSON object:
            {{
              "html": "Complete HTML document as a string",
              "meta_description": "SEO meta description for the page"
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
            funnel_data = json.loads(response.text)
            
            # --- HTML File Export ---
            import os
            export_path = kwargs.get("export_path")
            html_path = None
            workflow_status = "Landing page generated"
            
            if export_path:
                safe_title = single_title.replace(" ", "_").lower()
                html_path = os.path.join(export_path, f"{safe_title}_presave.html")
                with open(html_path, "w") as f:
                    f.write(funnel_data.get("html", ""))
                workflow_status = f"HTML exported to {html_path}"
            
            return Response(
                message=f"Pre-save funnel for '{single_title}'. {workflow_status}",
                additional={"funnel_data": funnel_data, "html_path": html_path, "workflow_status": workflow_status}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Pre-Save Funnel Architect Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
