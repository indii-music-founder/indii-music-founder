
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AudioReactiveVisualizerGen(Tool):
    """
    Director Agent Tool.
    Generates a 3D visualizer configuration (for Remotion/Three.js) reacting to specific frequencies.
    Exports config as JSON for the Remotion pipeline.
    """

    async def execute(self, visual_theme: str, intensity_level: str = "High", **kwargs) -> Response:
        self.set_progress(f"Generating Audio-Reactive Visualizer config: Theme '{visual_theme}', Intensity '{intensity_level}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Visual Effects Director.
            Generate a complete Three.js / Remotion visualizer configuration.
            
            Visual Theme: {visual_theme}
            Intensity Level: {intensity_level}
            
            Return ONLY a JSON object:
            {{
              "visualizer_type": "Particle Field / Waveform / Spectrum / 3D Mesh",
              "theme": "{visual_theme}",
              "frequency_bands": {{
                "bass": {{"range_hz": [20, 250], "visual_target": "Particle size scaling"}},
                "mid": {{"range_hz": [250, 4000], "visual_target": "Color shift"}},
                "high": {{"range_hz": [4000, 20000], "visual_target": "Sparkle density"}}
              }},
              "color_palette": ["#hex1", "#hex2", "#hex3"],
              "background": "Gradient / Solid / Transparent",
              "particle_count": 2000,
              "camera_motion": "Slow orbit / Static / POV drift",
              "resolution": "1920x1080",
              "fps": 30,
              "remotion_config": {{
                "compositionId": "audio-visualizer",
                "durationInFrames": 900,
                "codec": "h264"
              }}
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
            viz_config = json.loads(response.text)
            
            # --- JSON Config Export for Remotion ---
            import os
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    json.dump(viz_config, f, indent=2)
            
            return Response(
                message=f"Visualizer config generated: {viz_config.get('visualizer_type', 'Unknown')} ({visual_theme}).",
                additional={"viz_config": viz_config, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Audio Reactive Visualizer Gen Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
