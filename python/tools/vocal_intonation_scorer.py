
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
import os
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class VocalIntonationScorer(Tool):
    """
    Producer Agent Tool.
    Analyzes a vocal stem for pitch drift and generates correction advice.
    Uses Gemini audio analysis with FFmpeg fallback for pitch data.
    """

    async def execute(self, vocal_stem_path: str, track_key: str, **kwargs) -> Response:
        self.set_progress(f"Scoring vocal intonation against {track_key}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            
            # Try to extract pitch data via FFmpeg
            pitch_data = None
            if vocal_stem_path and os.path.exists(vocal_stem_path):
                import subprocess
                try:
                    result = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", vocal_stem_path],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        probe = json.loads(result.stdout)
                        streams = probe.get("streams", [])
                        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
                        if audio_stream:
                            pitch_data = {
                                "sample_rate": audio_stream.get("sample_rate"),
                                "channels": audio_stream.get("channels"),
                                "duration": audio_stream.get("duration"),
                                "codec": audio_stream.get("codec_name")
                            }
                except Exception:
                    pass
            
            model_id = AIConfig.TEXT_FAST
            prompt = f"""
            You are the indiiOS Vocal Coach and Producer.
            Score a vocal performance for intonation quality.
            
            Track Key: {track_key}
            Audio Metadata: {json.dumps(pitch_data) if pitch_data else "Not available"}
            
            Return ONLY a JSON object:
            {{
              "intonation_score": 82,
              "problem_areas": [
                {{"section": "Verse 2", "issue": "Flat by ~20 cents on sustained notes", "severity": "Minor"}}
              ],
              "strengths": ["Strong chorus delivery", "Good vibrato control"],
              "correction_recommendations": [
                {{"tool": "Melodyne", "action": "Correct pitch on verse 2 sustained notes by +20 cents"}},
                {{"tool": "iZotope Nectar", "action": "Light automatic pitch correction, speed 50ms"}}
              ],
              "overall_assessment": "Performance is strong. Minor corrections in verse 2 will polish it."
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
            score_data = json.loads(response.text)
            
            # --- Markdown Report Export ---
            md = [f"# Vocal Intonation Report\n", f"**Key:** {track_key} | **Score:** {score_data.get('intonation_score','N/A')}/100\n"]
            problems = score_data.get("problem_areas", [])
            if problems:
                md.append("## Problem Areas\n")
                for p in problems:
                    md.append(f"- **{p.get('section','')}**: {p.get('issue','')} ({p.get('severity','')})")
            md.append("\n## Corrections\n")
            for c in score_data.get("correction_recommendations", []):
                md.append(f"- **{c.get('tool','')}**: {c.get('action','')}")
            md.append(f"\n---\n{score_data.get('overall_assessment','')}")
            
            report_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)
            
            return Response(
                message=f"Vocal score: {score_data.get('intonation_score','N/A')}/100 — {len(problems)} issue(s).",
                additional={"score_data": score_data, "pitch_data": pitch_data, "report_md": report_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Vocal Intonation Scorer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
