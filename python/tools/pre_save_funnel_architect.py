import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PreSaveFunnelArchitect(Tool):
    """
    Marketing Executive Tool.
    Generates the structural JSON definition for a high-converting pre-save landing page.
    """

    async def execute(self, artist_name: str, release_title: str, incentive: str = "Exclusive behind-the-scenes video") -> Response:
        self.set_progress(f"Architecting Pre-Save Funnel for: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text/JSON generation
            
            prompt = f"""
            You are the indiiOS Web Funnel Architect.
            Generate the structural configuration for a high-converting Pre-Save landing page.
            
            Artist Name: {artist_name}
            Release Title: {release_title}
            Fan Incentive (Bribe to pre-save): {incentive}
            
            Rules:
            1. Create punchy, urgent headline and subheadline copy.
            2. Define the call-to-action (CTA) button text.
            3. Ensure the incentive is front and center to maximize conversion rate.
            
            Return ONLY a JSON object representing the page structure:
            {{
              "page_title": "...",
              "seo_description": "...",
              "hero_section": {{
                "headline": "...",
                "subheadline": "...",
                "cta_button_primary": "Pre-Save on Spotify",
                "cta_button_secondary": "Pre-Add on Apple Music"
              }},
              "incentive_banner": "...",
              "bg_color_hex_suggestion": "#000000"
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.6 # Marketing copy
                )
            )
            
            return Response(
                message=f"Pre-Save funnel architected for '{release_title}'",
                additional={"funnel_config": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Pre-Save Funnel Architect Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
