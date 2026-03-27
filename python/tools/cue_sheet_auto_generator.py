
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CueSheetAutoGenerator(Tool):
    """
    Licensing Executive Tool.
    Draft ASCAP/BMI cue sheets based on an exported video timeline.
    Exports as CSV for PRO submission.
    """

    async def execute(self, video_title: str, editor_timeline_json: str, **kwargs) -> Response:
        self.set_progress(f"Generating ASCAP/BMI Cue Sheet for {video_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Licensing Executive.
            Generate a professional ASCAP/BMI cue sheet from the video timeline data.
            
            Video Title: {video_title}
            Timeline Data: {editor_timeline_json}
            
            Rules:
            1. Each cue must include: Cue Number, Title, Composer(s), Publisher(s), PRO, Usage (Background/Featured/Theme), Timing (In/Out), Duration.
            2. Format must match standard PRO submission requirements.
            
            Return ONLY a JSON object:
            {{
              "video_title": "{video_title}",
              "total_music_duration_seconds": 0,
              "cues": [
                {{
                  "cue_number": 1,
                  "title": "...",
                  "composers": ["..."],
                  "publishers": ["..."],
                  "pro": "ASCAP",
                  "usage": "Background Vocal",
                  "time_in": "00:00:15",
                  "time_out": "00:01:30",
                  "duration_seconds": 75
                }}
              ]
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0)
            )
            
            cue_data = json.loads(response.text)
            
            # --- CSV Export for PRO submission ---
            import os
            csv_rows = ["Cue #,Title,Composer(s),Publisher(s),PRO,Usage,Time In,Time Out,Duration (s)"]
            for cue in cue_data.get("cues", []):
                composers = "; ".join(cue.get("composers", []))
                publishers = "; ".join(cue.get("publishers", []))
                csv_rows.append(f"{cue.get('cue_number','')},{cue.get('title','')},{composers},{publishers},{cue.get('pro','')},{cue.get('usage','')},{cue.get('time_in','')},{cue.get('time_out','')},{cue.get('duration_seconds','')}")
            
            csv_payload = "\n".join(csv_rows)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Cue sheet for '{video_title}' generated with {len(cue_data.get('cues', []))} cues.",
                additional={"cue_data": cue_data, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Cue Sheet Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
