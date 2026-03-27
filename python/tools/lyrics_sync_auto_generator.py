
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class LyricsSyncAutoGenerator(Tool):
    """
    Director / Video Tool.
    Generates a timed .lrc file from lyrics text and BPM data.
    Exports as an .lrc file for video editors and DSP lyric submission.
    """

    async def execute(self, track_title: str, lyrics_text: str, bpm: float, **kwargs) -> Response:
        self.set_progress(f"Generating timed .lrc sync for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Lyric Sync Specialist.
            Generate a timed LRC (synced lyrics) file from the lyrics and BPM.
            
            Track: {track_title}
            BPM: {bpm}
            Lyrics:
            {lyrics_text[:3000]}
            
            Rules:
            1. Estimate timestamps based on BPM and typical vocal pacing.
            2. Use standard LRC format: [mm:ss.xx] Lyric line
            3. Account for intro, verses, chorus, bridge sections.
            
            Return ONLY a JSON object:
            {{
              "lrc_content": "[00:00.00] ...\\n[00:15.50] ...",
              "total_duration_estimate": "3:30",
              "confidence_score": 75,
              "notes": "Timestamps are BPM-estimated. Fine-tune with waveform alignment."
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
            )
            lrc_data = json.loads(response.text)
            
            # --- LRC File Export ---
            import os
            lrc_path = None
            if kwargs.get("export_path"):
                safe_title = track_title.replace(" ", "_").lower()
                lrc_path = os.path.join(kwargs["export_path"], f"{safe_title}.lrc")
                with open(lrc_path, "w") as f:
                    f.write(lrc_data.get("lrc_content", ""))
            
            return Response(
                message=f"LRC sync generated for '{track_title}' (confidence: {lrc_data.get('confidence_score',0)}%).",
                additional={"lrc_data": lrc_data, "lrc_path": lrc_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Lyrics Sync Auto Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
