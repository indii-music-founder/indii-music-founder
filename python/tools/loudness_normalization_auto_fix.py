import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class LoudnessNormalizationAutoFix(Tool):
    """
    Producer Agent Tool.
    Generates limiting and EQ curves to hit -14 LUFS without clipping.
    """

    async def execute(self, track_path: str, current_lufs: float, current_true_peak: float) -> Response:
        self.set_progress(f"Generating loudness normalization fix for track: {track_path}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Mastering Engineer.
            Analyze the current loudness stats and generate a strategy to cleanly hit -14 LUFS and -1.0dB True Peak for Spotify submission.
            
            Current LUFS: {current_lufs}
            Current True Peak: {current_true_peak}
            
            Rules:
            1. Suggest specific limiter threshold and ceiling adjustments.
            2. Suggest any dynamic EQ moves needed to prevent the low-end from triggering the limiter too hard.
            
            Return ONLY a JSON object:
            {{
              "target_lufs": -14.0,
              "target_true_peak": -1.0,
              "limiter_recommendation": {{
                "threshold_db": -2.5,
                "ceiling_db": -1.0,
                "release_time_ms": 150
              }},
              "eq_advice": "..."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1 # Technical precision
                )
            )
            
            return Response(
                message=f"Loudness normalization strategy generated.",
                additional={"mastering_plan": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Loudness Normalization Auto-Fix Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
