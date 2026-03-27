
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
import os
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class LoudnessNormalizationAutoFix(Tool):
    """
    Producer Agent Tool.
    Generates FFmpeg commands to normalize audio to target LUFS.
    Exports the FFmpeg command chain for execution.
    """

    async def execute(self, track_path: str, current_lufs: float, current_true_peak: float, **kwargs) -> Response:
        self.set_progress(f"Generating loudness normalization fix for: {os.path.basename(track_path)}")
        
        try:
            target_lufs = kwargs.get("target_lufs", -14.0)
            target_true_peak = kwargs.get("target_true_peak", -1.0)
            
            # Deterministic calculation
            lufs_delta = target_lufs - current_lufs
            needs_limiting = current_true_peak > target_true_peak
            
            # Generate FFmpeg normalization command
            output_path = track_path.replace(".wav", "_normalized.wav").replace(".flac", "_normalized.flac")
            
            ffmpeg_filter = f"loudnorm=I={target_lufs}:TP={target_true_peak}:LRA=11:measured_I={current_lufs}:measured_TP={current_true_peak}:measured_LRA=7:measured_thresh=-24:offset=0:linear=true:print_format=json"
            
            ffmpeg_cmd = f'ffmpeg -i "{track_path}" -af "{ffmpeg_filter}" -ar 48000 -sample_fmt s24 "{output_path}"'
            
            # If also needs limiting
            limiter_cmd = None
            if needs_limiting:
                limiter_cmd = f'ffmpeg -i "{output_path}" -af "alimiter=limit={target_true_peak}:attack=5:release=100" -ar 48000 -sample_fmt s24 "{output_path.replace("_normalized", "_limited")}"'
            
            # Use Gemini for detailed analysis and recommendations
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Mastering Engineer.
            The track has current LUFS: {current_lufs} and true peak: {current_true_peak} dB.
            Target: {target_lufs} LUFS, {target_true_peak} dBTP.
            Delta needed: {lufs_delta:.1f} dB.
            
            Return ONLY a JSON object:
            {{
              "diagnosis": "Brief diagnosis of the current levels",
              "recommendation": "Specific mastering recommendation",
              "risk_assessment": "Low/Medium/High — risk of quality degradation",
              "dsp_compliance": {{
                "spotify": {{"compliant": true, "notes": ""}},
                "apple_music": {{"compliant": true, "notes": ""}},
                "youtube_music": {{"compliant": true, "notes": ""}}
              }}
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0)
            )
            analysis = json.loads(response.text)
            
            # --- Shell Script Export ---
            script_lines = [
                "#!/bin/bash",
                f"# Loudness Normalization Script for {os.path.basename(track_path)}",
                f"# Current: {current_lufs} LUFS, {current_true_peak} dBTP",
                f"# Target: {target_lufs} LUFS, {target_true_peak} dBTP",
                "",
                f"{ffmpeg_cmd}",
            ]
            if limiter_cmd:
                script_lines.append(f"{limiter_cmd}")
            script_lines.append('echo "Normalization complete."')
            
            script_content = "\n".join(script_lines)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(script_content)
                os.chmod(export_path, 0o755)
            
            return Response(
                message=f"Normalization plan: {lufs_delta:+.1f} dB adjustment. Risk: {analysis.get('risk_assessment','Unknown')}.",
                additional={
                    "analysis": analysis,
                    "ffmpeg_cmd": ffmpeg_cmd,
                    "limiter_cmd": limiter_cmd,
                    "script_content": script_content,
                    "export_path": export_path
                }
            )
        except Exception as e:
            import traceback
            return Response(message=f"Loudness Normalization Auto Fix Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
