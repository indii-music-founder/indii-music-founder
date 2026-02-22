import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataQcAuditor(Tool):
    """
    Release & Distribution Manager Tool.
    Check if track titles follow DSP style guides.
    """

    async def execute(self, tracklist: list) -> Response:
        self.set_progress(f"Auditing metadata for {len(tracklist)} tracks against DSP style guides")
        
        try:
            issues_found = []
            
            for index, title in enumerate(tracklist):
                # Check for ALL CAPS (unless it's a short acronym)
                if title.isupper() and len(title) > 4:
                    issues_found.append({"track": index + 1, "title": title, "issue": "ALL CAPS not permitted by Apple/Spotify."})
                    
                # Check for 'ft.' instead of 'feat.'
                if "ft." in title.lower() or "featuring" in title.lower():
                    issues_found.append({"track": index + 1, "title": title, "issue": "Use standardized '(feat. Artist)' formatting."})
                    
            status = "PASSED" if not issues_found else "FAILED_QC"
            
            return Response(
                message=f"Metadata QC completed. Status: {status}",
                additional={"qc_report": issues_found}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Metadata QC Auditor Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
