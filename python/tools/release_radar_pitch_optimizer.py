
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ReleaseRadarPitchOptimizer(Tool):
    """
    Distribution Agent Tool.
    Optimizes metadata and pitch text to maximize algorithmic playlist placement.
    Exports a Spotify for Artists pitch form pre-fill.
    """

    async def execute(self, track_title: str, artist_name: str, genre: str, mood: str, **kwargs) -> Response:
        self.set_progress(f"Optimizing Release Radar pitch for '{track_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Distribution Agent and Spotify Playlist Strategist.
            Optimize the editorial pitch for Spotify's algorithm and editorial team.
            
            Track: {track_title}
            Artist: {artist_name}
            Genre: {genre}
            Mood: {mood}
            
            Rules:
            1. Pitch must be under 500 characters (Spotify limit).
            2. Include specific genre tags, mood descriptors, and similar artists.
            3. Highlight any notable features (collaborations, story, viral moment).
            
            Return ONLY a JSON object:
            {{
              "optimized_pitch": "Under 500 chars...",
              "genre_tags": ["..."],
              "mood_tags": ["..."],
              "similar_artists": ["..."],
              "recommended_playlists": ["Release Radar", "Discover Weekly"],
              "submission_timing": "Submit 7+ days before release",
              "pitch_score": 85
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.3)
            )
            pitch_data = json.loads(response.text)
            
            # --- Markdown Export: Spotify for Artists pitch form ---
            import os
            md_lines = [
                f"# Spotify Pitch — {track_title}\n",
                f"**Artist:** {artist_name}",
                f"**Pitch Score:** {pitch_data.get('pitch_score', 'N/A')}/100\n",
                "## Optimized Pitch Text\n",
                f"> {pitch_data.get('optimized_pitch', '')}\n",
                f"**Genres:** {', '.join(pitch_data.get('genre_tags', []))}",
                f"**Moods:** {', '.join(pitch_data.get('mood_tags', []))}",
                f"**Similar Artists:** {', '.join(pitch_data.get('similar_artists', []))}",
                f"**Target Playlists:** {', '.join(pitch_data.get('recommended_playlists', []))}",
                f"**Timing:** {pitch_data.get('submission_timing', '')}"
            ]
            pitch_md = "\n".join(md_lines)
            
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(pitch_md)
            
            return Response(
                message=f"Pitch optimized for '{track_title}' — Score: {pitch_data.get('pitch_score','N/A')}/100.",
                additional={"pitch_data": pitch_data, "pitch_md": pitch_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Release Radar Pitch Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
