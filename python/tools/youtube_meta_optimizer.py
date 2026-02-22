import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class YoutubeMetaOptimizer(Tool):
    """
    Social Media Manager Tool.
    Generates high-SEO descriptions and tags for an upcoming music video.
    """

    async def execute(self, video_title: str, artist_name: str, video_description_context: str, key_themes: list) -> Response:
        self.set_progress(f"Optimizing YouTube Meta for: {video_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text Generation / SEO
            
            themes_str = ", ".join(key_themes)
            
            prompt = f"""
            You are the indiiOS YouTube Channel Growth Strategist.
            Write a highly optimized YouTube description and a list of EXACTLY 20 high-value tags for a new music video.
            
            Video Title: {video_title}
            Artist Name: {artist_name}
            Context/Story: {video_description_context}
            Key Themes/Genres: {themes_str}
            
            Rules:
            1. The description must have an engaging hook in the first 2 lines (before the "Show More" fold).
            2. Include placeholder sections for "Listen on Spotify/Apple Music", "Follow on Socials", and "Credits".
            3. Tags must be comma-separated, max 500 characters total. Include variations of the artist name, song title, and broad genre keywords.
            4. Keep the tone enthusiastic but professional.
            
            Return ONLY a JSON object:
            {{
              "optimized_title_suggestion": "Optional suggestion to improve the title for CTR",
              "youtube_description": "... [Formatted with line breaks]",
              "tags": ["tag1", "tag2", "..."],
              "total_tag_character_count": 0
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4 # Need SEO optimized, structured text
                )
            )
            
            return Response(
                message=f"YouTube metadata optimized for '{video_title}'",
                additional={"youtube_meta": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"YouTube Meta Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
