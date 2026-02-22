import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CueSheetAutoGenerator(Tool):
    """
    Licensing Executive Tool.
    Draft ASCAP/BMI cue sheets based on an exported video timeline.
    """

    async def execute(self, video_title: str, editor_timeline_json: str) -> Response:
        self.set_progress(f"Generating ASCAP/BMI Cue Sheet for {video_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Licensing Executive.
            Generate a formatted PRO (ASCAP/BMI) Cue Sheet for the following video based on timeline data.
            
            Video Title: {video_title}
            Timeline Audio Exports: {editor_timeline_json}
            
            Rules:
            1. For every track in the timeline, determine the Time In and Time Out.
            2. Calculate total Duration (e.g., 00:01:45).
            3. Assume "Background Vocal" usage if not specified.
            
            Return ONLY a JSON object:
            {{
              "production_title": "{video_title}",
              "cues": [
                {{"cue_number": 1, "track_title": "...", "usage_type": "BI", "time_in": "00:00:10", "duration": "00:00:30"}}
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            return Response(
                message=f"Cue Sheet generated successfully.",
                additional={"cue_sheet": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Cue Sheet Auto-Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
