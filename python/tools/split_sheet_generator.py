
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class SplitSheetGenerator(Tool):
    """
    Publishing Administrator Tool.
    Takes an array of collaborators and percentages, and generates a formatted split sheet agreement.
    """

    async def execute(self, track_title: str, collaborators: list, isrc: str = "TBD", iswc: str = "TBD") -> Response:
        self.set_progress(f"Generating Split Sheet for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text/Document Generation
            
            # Input validation
            total_split = sum([comp.get('split_percentage', 0) for comp in collaborators])
            if abs(total_split - 100.0) > 0.01:
                return Response(message=f"Error: Split percentages must equal 100. Current total: {total_split}%", break_loop=False)

            collaborator_text = "\n".join([
                f"- Name: {c.get('name')}, Role: {c.get('role', 'Writer/Producer')}, PRO: {c.get('pro', 'ASCAP/BMI')}, IPI: {c.get('ipi', 'TBD')}, Split: {c.get('split_percentage')}%"
                for c in collaborators
            ])
            
            prompt = f"""
            You are the indiiOS Publishing Administrator. 
            Generate a formal, legally binding "Songwriter Split Sheet" document in Markdown format.
            
            Song Title: {track_title}
            ISRC: {isrc}
            ISWC: {iswc}
            Date of Agreement: [Current Date]
            
            Collaborators:
            {collaborator_text}
            
            The document must include:
            1. An introductory declaration of agreement.
            2. The clean list of collaborators with their exact percentages, roles, and PRO/IPI information.
            3. Standard legalese stating this document supersedes prior verbal agreements regarding the composition copyright.
            4. Signature lines for all parties.
            
            Output ONLY the Markdown document text.
            """
            
            

            
                        _rl = RateLimiter()

            
                        wait_time = _rl.wait_time("gemini")

            
                        if wait_time > 0:

            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")

            
                            await asyncio.sleep(wait_time)

            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0 # Legal documents must be deterministic and factual
                )
            )
            
            return Response(
                message=f"Split Sheet Generated for '{track_title}'. ready for signatures.",
                additional={"markdown_document": response.text}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Split Sheet Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
