import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class InstrumentalAcapellaBouncer(Tool):
    """
    Licensing Executive Tool.
    Verify that a delivery folder contains full mix, instrumental, acapella, TV track, and clean versions.
    """

    async def execute(self, delivered_files: list) -> Response:
        self.set_progress("Bouncing delivery folder to ensure all required Master deliverables exist")
        
        try:
            required_stems = ["Main Mix", "Instrumental", "Acapella", "TV Track", "Clean Version"]
            found = []
            missing = []
            
            # Simple keyword matching simulation against the delivered filenames
            for req in required_stems:
                keyword = req.lower().replace(" ", "")
                # Clean version might just be 'clean', instrumentals might be 'inst'
                
                match = False
                for f in delivered_files:
                    f_clean = f.lower()
                    if req.lower() in f_clean or (req == "Instrumental" and "inst" in f_clean) or (req == "Acapella" and "vox" in f_clean or "acap" in f_clean):
                        match = True
                        break
                        
                if match:
                    found.append(req)
                else:
                    missing.append(req)
            
            status = "APPROVED_FOR_DELIVERY" if not missing else "DELIVERY_REJECTED_MISSING_STEMS"
            
            report = {
                "status": status,
                "found_deliverables": found,
                "missing_deliverables": missing,
                "note": "A supervisor pitch requires the whole stem package. Cannot submit." if missing else "Ready for pitch."
            }
            
            return Response(
                message=f"Deliverable Verification Complete. Status: {status}",
                additional={"delivery_report": report}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Instrumental/Acapella Bouncer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
