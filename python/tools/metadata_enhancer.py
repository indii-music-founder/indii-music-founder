
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataEnhancer(Tool):
    """
    Database/Metadata Manager Tool.
    Takes basic track info and generates rich, SEO-optimized metadata including 
    keywords, moods, similar artists, and a short descriptive blurb.
    """

    async def execute(self, track_title: str, artist_name: str, genre: str, basic_description: str) -> Response:
        self.set_progress(f"Enhancing Metadata for {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text processing
            
            prompt = f"""
            You are the indiiOS Database and Metadata Manager.
            Your job is to enrich basic track information into comprehensive metadata 
            suitable for DSPs (Spotify/Apple), Sync Libraries, and SEO.
            
            Basic Info:
            Artist: {artist_name}
            Track: {track_title}
            Genre: {genre}
            Provided Description: {basic_description}
            
            Required JSON Output:
            {{
              "primary_moods": ["Mood 1", "Mood 2", "Mood 3"],
              "secondary_genres": ["Subgenre 1", "Subgenre 2"],
              "search_keywords": ["keyword1", "keyword2", "keyword3", "... up to 15"],
              "similar_artists_for_algorithm": ["Artist 1", "Artist 2", "Artist 3"],
              "short_blurb_dsp": "A 1-2 sentence compelling description for Spotify/Apple Music pitch.",
              "sync_themes": ["Theme 1", "Theme 2"]
            }}
            """
            
            

            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3 # Focused and relevant keywords
                )
            )
            
            return Response(
                message=f"Metadata enriched for {track_title}.",
                additional={"enriched_metadata": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Metadata Enhancer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
