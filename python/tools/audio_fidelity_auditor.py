
from python.helpers.files import safe_path

from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
import os
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class AudioFidelityAuditor(Tool):
    """
    Producer Agent Tool.
    Analyzes an audio file for mastering quality, LUFS targets, and mixing imbalances.
    """

    async def execute(self, file_path: str, target_platform: str = "Spotify", genre: str = "Pop", **kwargs) -> Response:
        self.set_progress(f"Auditing audio fidelity for {os.path.basename(file_path) if file_path else 'Unknown'}")
        
        try:
            from google import genai
            from google.genai import types
            
            if not file_path or not os.path.exists(file_path):
                return Response(message="Error: Audio file not found for fidelity audit.", break_loop=False)

            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            
            self.set_progress("Uploading audio to Gemini for spectrum analysis...")
            uploaded_file = client.files.upload(file=safe_path(file_path))
            
            # Note: We use Gemini 3 Pro for complex reasoning over audio
            model_id = "gemini-3-pro-preview" # Using specific multimodal model
            
            prompt = f"""
            You are the indiiOS Mastering Engineer / Technical A&R.
            Listen to the provided audio file. Perform a "Car Test" mixing analysis and mastering audit.
            
            Target Platform: {target_platform}
            Genre: {genre}
            
            Evaluate the following:
            1. Loudness & Headroom (Estimate LUFS and True Peak suitability)
            2. Low-Mid frequencies (200Hz - 500Hz) for boxiness or mud
            3. High frequencies (2kHz - 5kHz) for harshness/sibilance
            4. Sub-bass phase issues or crowding
            
            Return the analysis strictly as a JSON object:
            {{
              "estimated_lufs": "-14 LUFS",
              "true_peak_db": "-1.0",
              "mix_balance_score": 8,
              "low_mids_analysis": "Clear, no mud detected.",
              "highs_analysis": "Slight harshness on hi-hats around 4kHz.",
              "recommendations": ["Use dynamic EQ on highs", "Boost sub-bass by 1dB"]
            }}
            """
            
            self.set_progress("Running deep audio fidelity analysis...")
            

            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[uploaded_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            
            try:
            
                result = json.loads(response.text)
            
            except json.JSONDecodeError:
            
                result = {"raw_text": response.text, "error": "Failed to parse JSON"}
            
            # --- Markdown Report Export ---
            md_lines = [f"# Audio Fidelity Audit — {os.path.basename(file_path)}\n"]
            md_lines.append(f"**Platform:** {target_platform} | **Genre:** {genre}\n")
            md_lines.append(f"| Metric | Value |")
            md_lines.append(f"|---|---|")
            md_lines.append(f"| Est. LUFS | {result.get('estimated_lufs','N/A')} |")
            md_lines.append(f"| True Peak | {result.get('true_peak_db','N/A')} dBTP |")
            md_lines.append(f"| Mix Balance | {result.get('mix_balance_score','N/A')}/10 |")
            md_lines.append(f"\n**Low-Mids:** {result.get('low_mids_analysis','')}")
            md_lines.append(f"**Highs:** {result.get('highs_analysis','')}\n")
            recs = result.get('recommendations', [])
            if recs:
                md_lines.append("## Recommendations\n")
                for r in recs:
                    md_lines.append(f"- {r}")
            report_md = "\n".join(md_lines)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)

            return Response(
                message=f"Audio Fidelity Audit Complete for {os.path.basename(file_path)}",
                additional={"audit_report": result, "report_md": report_md, "export_path": export_path}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Audio Fidelity Auditor Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
