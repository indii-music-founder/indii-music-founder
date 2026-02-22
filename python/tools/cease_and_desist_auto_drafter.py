import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CeaseAndDesistAutoDrafter(Tool):
    """
    Legal Counsel Tool.
    Generates a formatted C&D letter for unauthorized use of a master recording.
    """

    async def execute(self, infringing_url: str, artist_name: str, copyright_owner: str) -> Response:
        self.set_progress(f"Drafting Cease and Desist for {infringing_url}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Legal Counsel.
            Draft a formal Cease and Desist letter demanding the takedown of an unauthorized upload.
            
            Infringing URL: {infringing_url}
            Artist: {artist_name}
            Copyright Owner: {copyright_owner}
            
            Rules:
            1. Use formal legal language citing the DMCA (if applicable) or general copyright infringement.
            2. Demand removal within 48 hours.
            3. Do not invent a real law firm name, sign it "indiiOS Legal Division".
            
            Return ONLY a JSON object:
            {{
              "subject_line": "...",
              "letter_body": "...",
              "recommended_action": "Email to platform abuse contact."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            return Response(
                message=f"Cease & Desist drafted.",
                additional={"legal_doc": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Cease & Desist Auto-Drafter Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
