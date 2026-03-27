
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ToneOfVoiceAuditor(Tool):
    """
    Brand Manager Tool.
    Audits marketing copy against the artist's established brand voice guidelines.
    Exports audit report as markdown.
    """

    async def execute(self, copy_text: str, brand_voice_description: str, **kwargs) -> Response:
        self.set_progress("Auditing copy against brand voice guidelines")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Brand Voice Auditor.
            Analyze the following copy against the established brand voice guidelines.
            
            Copy to Audit:
            ---
            {copy_text}
            ---
            
            Brand Voice Guidelines:
            {brand_voice_description}
            
            Return ONLY a JSON object:
            {{
              "overall_score": 85,
              "voice_alignment": "Strong/Moderate/Weak",
              "issues": [
                {{"line": "...", "issue": "Too formal for this brand", "suggestion": "Rewrite to..."}}
              ],
              "strengths": ["..."],
              "rewritten_version": "Full rewritten version aligned to brand voice"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.3)
            )
            audit = json.loads(response.text)
            
            # --- Markdown Export ---
            import os
            md = [f"# Brand Voice Audit\n", f"**Score:** {audit.get('overall_score','N/A')}/100 | **Alignment:** {audit.get('voice_alignment','N/A')}\n"]
            issues = audit.get("issues", [])
            if issues:
                md.append("## Issues\n")
                for i in issues:
                    md.append(f"- 🟡 *\"{i.get('line','')}\"* → {i.get('issue','')} → {i.get('suggestion','')}")
            md.append("\n## Strengths")
            for s in audit.get("strengths", []):
                md.append(f"- ✅ {s}")
            
            report_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)
            
            return Response(
                message=f"Voice audit: {audit.get('overall_score','N/A')}/100 — {audit.get('voice_alignment','N/A')}.",
                additional={"audit": audit, "report_md": report_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Tone of Voice Auditor Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
