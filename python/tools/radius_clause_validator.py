
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class RadiusClauseValidator(Tool):
    """
    Legal Counsel / Road Manager Tool.
    Validates radius clauses in performance contracts against planned tour dates.
    Exports conflict report as markdown.
    """

    async def execute(self, proposed_venues: list, existing_contracts_json: str, **kwargs) -> Response:
        self.set_progress(f"Validating radius clauses for {len(proposed_venues)} venues")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            venues_str = json.dumps(proposed_venues)
            
            prompt = f"""
            You are the indiiOS Legal Counsel and Tour Logistics Expert.
            Analyze whether proposed tour venues conflict with existing radius clauses.
            
            Proposed Venues: {venues_str}
            Existing Contracts with Radius Clauses: {existing_contracts_json}
            
            Rules:
            1. A typical radius clause restricts performing within 60-100 miles for 30-90 days.
            2. Flag any conflicts with severity (Warning vs Block).
            3. Suggest alternate dates or venues for conflicts.
            
            Return ONLY a JSON object:
            {{
              "total_venues_checked": 0,
              "conflicts": [
                {{
                  "proposed_venue": "...",
                  "conflicting_contract": "...",
                  "radius_miles": 75,
                  "restriction_days": 60,
                  "severity": "Block",
                  "suggestion": "Move date to after restriction period"
                }}
              ],
              "clear_venues": ["..."]
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
            validation = json.loads(response.text)
            
            # --- Markdown Conflict Report ---
            import os
            conflicts = validation.get("conflicts", [])
            md_lines = ["# Radius Clause Validation Report\n"]
            md_lines.append(f"**Venues Checked:** {validation.get('total_venues_checked', len(proposed_venues))}")
            md_lines.append(f"**Conflicts Found:** {len(conflicts)}\n")
            
            if conflicts:
                md_lines.append("## ⚠️ Conflicts\n")
                for c in conflicts:
                    severity = "🔴" if c.get("severity") == "Block" else "🟡"
                    md_lines.append(f"### {severity} {c.get('proposed_venue', '')}")
                    md_lines.append(f"- **Contract:** {c.get('conflicting_contract', '')}")
                    md_lines.append(f"- **Radius:** {c.get('radius_miles', '')} mi / {c.get('restriction_days', '')} days")
                    md_lines.append(f"- **Suggestion:** {c.get('suggestion', '')}\n")
            
            clear = validation.get("clear_venues", [])
            if clear:
                md_lines.append("## ✅ Clear Venues\n")
                for v in clear:
                    md_lines.append(f"- {v}")
            
            report_md = "\n".join(md_lines)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)
            
            return Response(
                message=f"Radius check: {len(conflicts)} conflicts, {len(clear)} clear.",
                additional={"validation": validation, "report_md": report_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Radius Clause Validator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
