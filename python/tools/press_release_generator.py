
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class PressReleaseGenerator(Tool):
    """
    Publicist Agent Tool.
    Formats a professional press release for blogs/curators based on track info and artist bio.
    """

    async def execute(self, artist_name: str, track_title: str, release_date: str, key_story_points: list, contact_email: str) -> Response:
        self.set_progress(f"Drafting Press Release for {artist_name} - {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text rewriting/formatting

            story_points_str = "\n".join([f"- {point}" for point in key_story_points])
            
            prompt = f"""
            You are the indiiOS Publicist. 
            Draft a professional, ready-to-publish Press Release for a new music launch.
            
            Details:
            Artist: {artist_name}
            Track Title: {track_title}
            Release Date: {release_date}
            Contact Email: {contact_email}
            
            Key Narrative/Story Points to include:
            {story_points_str}
            
            Required Format:
            Must follow standard PR format (FOR IMMEDIATE RELEASE, Dateline, Headline, Dateline City, Intro, Body Paragraphs, About Artist, Media Contact).
            
            Output ONLY the Markdown document text of the press release.
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
                    temperature=0.3 # Informative and professional tone
                )
            )
            
            return Response(
                message=f"Press Release drafted for {track_title}.",
                additional={"markdown_document": response.text}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Press Release Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)

