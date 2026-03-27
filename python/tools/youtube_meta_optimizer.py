
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class YoutubeMetaOptimizer(Tool):
    """
    Social Media Manager Tool.
    Generates high-SEO descriptions and tags for a music video.
    Optionally pushes the optimized metadata to a live YouTube video via the Data API.
    """

    async def execute(self, video_title: str, artist_name: str, video_description_context: str, key_themes: list, **kwargs) -> Response:
        self.set_progress(f"Optimizing YouTube Meta for: {video_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
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
                    temperature=0.4
                )
            )
            
            youtube_meta = json.loads(response.text)
            
            # --- YouTube Data API v3: Push metadata to a live video ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            youtube_api_key = os.getenv("YOUTUBE_API_KEY")
            youtube_oauth_token = os.getenv("YOUTUBE_OAUTH_TOKEN")
            
            workflow_status = "Metadata generated (not pushed)"
            push_result = None
            
            auto_push = kwargs.get("auto_push", False)
            video_id = kwargs.get("youtube_video_id")
            category_id = kwargs.get("category_id", "10")  # 10 = Music
            
            if auto_push and youtube_oauth_token and video_id:
                self.set_progress(f"Pushing optimized metadata to YouTube video {video_id}...")
                
                update_payload = {
                    "id": video_id,
                    "snippet": {
                        "title": youtube_meta.get("optimized_title_suggestion", video_title),
                        "description": youtube_meta.get("youtube_description", ""),
                        "tags": youtube_meta.get("tags", []),
                        "categoryId": category_id
                    }
                }
                
                headers = {
                    "Authorization": f"Bearer {youtube_oauth_token}",
                    "Content-Type": "application/json"
                }
                
                try:
                    yt_res = requests.put(
                        "https://www.googleapis.com/youtube/v3/videos",
                        params={"part": "snippet"},
                        json=update_payload,
                        headers=headers,
                        timeout=15
                    )
                    if yt_res.ok:
                        workflow_status = f"Metadata pushed to YouTube video {video_id}"
                        push_result = "success"
                    else:
                        error_detail = yt_res.json().get("error", {}).get("message", yt_res.status_code)
                        workflow_status = f"YouTube API Error: {error_detail}"
                        push_result = "failed"
                except Exception as yt_e:
                    workflow_status = f"YouTube API unreachable: {str(yt_e)}"
                    push_result = "error"
            elif auto_push and not video_id:
                workflow_status = "Auto-push requested but youtube_video_id not provided"
            elif auto_push:
                workflow_status = "Auto-push requested but YOUTUBE_OAUTH_TOKEN missing in .env"
            
            return Response(
                message=f"YouTube metadata optimized for '{video_title}'. {workflow_status}",
                additional={
                    "youtube_meta": youtube_meta,
                    "workflow_status": workflow_status,
                    "push_result": push_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"YouTube Meta Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
