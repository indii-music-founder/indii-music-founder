import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RiderAndStagePlotBuilder(Tool):
    """
    Road Manager Tool.
    Generates a PDF tech rider detailing microphone placements, DI box requirements, and hospitality requests.
    """

    async def execute(self, band_members: int, has_synths: bool, has_live_drums: bool) -> Response:
        self.set_progress("Generating Tech Rider and Stage Plot requirements")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Road Manager.
            Generate a combined Tech Runner and Hospitality Rider configuration.
            
            Band Members: {band_members}
            Synths: {has_synths}
            Live Drums: {has_live_drums}
            
            Rules:
            1. Detail the exact I/O channel list (e.g., Ch 1: Kick In, Ch 2: Kick Out, etc.).
            2. Specify DI box counts and power drop locations.
            3. Provide a standard reasonable green room hospitality request.
            
            Return ONLY a JSON object:
            {{
              "stage_plot_layout": "...",
              "input_list": [
                {{"channel": 1, "source": "...", "mic_type": "...", "stand": "..."}}
              ],
              "hospitality": ["...", "..."]
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
                message=f"Tech and Hospitality Rider generated.",
                additional={"rider": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Rider & Stage Plot Builder Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
