import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CrossCollaborationProposal(Tool):
    """
    Marketing Executive Tool.
    Drafts a DM/email proposing a cross-promotional collaboration with another artist.
    """

    async def execute(self, target_artist: str, shared_demographic: str, collaboration_idea: str) -> Response:
        self.set_progress(f"Drafting collaboration proposal to {target_artist}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Draft a polite, mutually-beneficial pitch message to {target_artist} proposing a cross-collaboration.
            
            Shared Demographic: {shared_demographic}
            Collaboration Idea: {collaboration_idea}
            
            Rules:
            1. Emphasize the mutual benefit of algorithmic cross-pollination.
            2. Keep it casual but professional (suitable for Instagram DM or a manager-to-manager email).
            3. Do not ask for money or complex commitments, keep it low-friction.
            
            Return ONLY a JSON object:
            {{
              "dm_version": "...",
              "email_version": "..."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4
                )
            )
            
            return Response(
                message=f"Collaboration proposal drafted.",
                additional={"collab_pitch": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Cross Collaboration Proposal Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
