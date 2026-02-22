import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AudioReactiveVisualizerGen(Tool):
    """
    Director Agent Tool.
    Generates a 3D visualizer configuration (for Remotion/Three.js) reacting to specific frequencies.
    """

    async def execute(self, visual_theme: str, intensity_level: str = "High") -> Response:
        self.set_progress(f"Generating Audio-Reactive Visualizer config: Theme '{visual_theme}', Intensity '{intensity_level}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Director & Creative Technologist.
            Generate a configuration payload for a Three.js / WebGL audio-reactive visualizer.
            
            Visual Theme: {visual_theme}
            Intensity Level: {intensity_level}
            
            Rules:
            1. Map specific frequency bands (Low, Mid, High) to visual parameters (Scale, Color, Rotation).
            2. Provide hex colors matching the theme.
            
            Return ONLY a JSON object:
            {{
              "theme": "{visual_theme}",
              "camera": {{"fov": 75, "z_position": 5}},
              "colors": ["#FF0000", "#00FF00"],
              "reactivity_mapping": {{
                "kick_drum_lows": "Controls the core sphere scale (1.0 to 1.5 multiplier)",
                "synth_mids": "Controls the rotation speed of the outer rings",
                "hihat_highs": "Triggers particle emission bursts"
              }}
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4
                )
            )
            
            return Response(
                message=f"Audio-reactive 3D config generated.",
                additional={"visualizer_config": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Audio-Reactive Visualizer Gen Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
