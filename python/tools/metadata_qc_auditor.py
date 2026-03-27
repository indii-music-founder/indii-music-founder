
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataQcAuditor(Tool):
    """
    Distribution Agent Tool.
    QC-audits metadata fields against DSP requirements before submission.
    Exports audit report as markdown.
    """

    async def execute(self, metadata_json: str, target_dsp: str = "All", **kwargs) -> Response:
        self.set_progress(f"Auditing metadata for {target_dsp} compliance")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Metadata QC Auditor.
            Audit the following release metadata against DSP submission requirements.
            
            Target DSP(s): {target_dsp}
            Metadata: {metadata_json}
            
            Check for:
            1. Missing required fields (title, artist, genre, ISRC, UPC, copyright)
            2. Character limit violations (Spotify: 200 chars for title)
            3. Invalid characters or formatting issues
            4. Explicit content flag consistency
            5. Artwork spec compliance (3000x3000 min, no text overlays for some DSPs)
            
            Return ONLY a JSON object:
            {{
              "overall_status": "Pass/Fail/Warning",
              "issues": [
                {{"field": "...", "severity": "Error/Warning", "message": "...", "fix": "..."}}
              ],
              "passed_checks": ["..."],
              "dsp_specific_notes": {{"Spotify": "...", "Apple Music": "..."}}
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
            audit = json.loads(response.text)
            
            # --- Markdown Report Export ---
            import os
            issues = audit.get("issues", [])
            md = [f"# Metadata QC Audit — {target_dsp}\n", f"**Status:** {audit.get('overall_status','Unknown')}\n"]
            if issues:
                md.append("## Issues\n")
                for i in issues:
                    icon = "🔴" if i.get("severity") == "Error" else "🟡"
                    md.append(f"- {icon} **{i.get('field','')}**: {i.get('message','')} → *{i.get('fix','')}*")
            md.append(f"\n## Passed ({len(audit.get('passed_checks',[]))})")
            for p in audit.get("passed_checks", []):
                md.append(f"- ✅ {p}")
            
            report_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)
            
            return Response(
                message=f"QC Audit: {audit.get('overall_status','Unknown')} — {len(issues)} issues found.",
                additional={"audit": audit, "report_md": report_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Metadata QC Auditor Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
