import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PreSaveFunnelArchitect(Tool):
    """
    Marketing Executive Tool.
    Generates HTML/CSS/JS for a tailored pre-save landing page.
    """

    async def execute(self, artist_name: str, single_title: str, release_date: str, cover_art_url: str) -> Response:
        self.set_progress(f"Architecting Pre-Save Funnel for '{single_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Generate the HTML and inline CSS for a modern, conversion-optimized pre-save landing page.
            
            Artist: {artist_name}
            Single: {single_title}
            Release Date: {release_date}
            Cover Art URL: {cover_art_url}
            
            Rules:
            1. Create a sleek dark-mode design with modern typography.
            2. Include buttons for "Pre-Save on Spotify" and "Pre-Add on Apple Music".
            3. Include an email capture form for "Join the VIP Newsletter".
            
            Return ONLY a JSON object:
            {{
              "funnel_id": "presave_campaign_123",
              "html_content": "<!DOCTYPE html><html>...",
              "recommendations": "Advice on driving traffic to this funnel via TikTok"
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            return Response(
                message=f"Pre-save funnel HTML generated for '{single_title}'.",
                additional={"funnel_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Pre-Save Funnel Architect Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
