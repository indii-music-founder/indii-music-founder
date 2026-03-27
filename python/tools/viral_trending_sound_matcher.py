
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ViralTrendingSoundMatcher(Tool):
    """
    Marketing Executive Tool.
    Matches artist tracks to currently trending sounds/formats on TikTok and Reels.
    Exports trend-match report as markdown.
    """

    async def execute(self, artist_tracks: list, platform: str = "TikTok", **kwargs) -> Response:
        self.set_progress(f"Matching tracks to trending sounds on {platform}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            tracks_str = json.dumps(artist_tracks[:15])
            
            prompt = f"""
            You are the indiiOS Viral Marketing Strategist.
            Analyze how the artist's catalog can be positioned against current {platform} trends.
            
            Artist Tracks: {tracks_str}
            Platform: {platform}
            
            Return ONLY a JSON object:
            {{
              "trending_formats": [
                {{"trend_name": "...", "description": "...", "estimated_lifespan_days": 14}}
              ],
              "track_matches": [
                {{
                  "track_title": "...",
                  "matching_trend": "...",
                  "match_score": 85,
                  "content_idea": "Specific video concept using this sound",
                  "optimal_clip_seconds": "15-30s starting at chorus"
                }}
              ],
              "timing_advice": "Post between 6-9 PM EST for maximum reach"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.5)
            )
            trend_data = json.loads(response.text)
            
            # --- Markdown Report ---
            import os
            md = [f"# Viral Sound Matching — {platform}\n"]
            md.append("## Trending Formats\n")
            for t in trend_data.get("trending_formats", []):
                md.append(f"- **{t.get('trend_name','')}**: {t.get('description','')} (~{t.get('estimated_lifespan_days','')} days)")
            md.append("\n## Track Matches\n")
            for m in trend_data.get("track_matches", []):
                md.append(f"### 🎵 {m.get('track_title','')} → {m.get('matching_trend','')}")
                md.append(f"- Score: {m.get('match_score','')}/100")
                md.append(f"- Concept: {m.get('content_idea','')}")
                md.append(f"- Clip: {m.get('optimal_clip_seconds','')}\n")
            md.append(f"**Timing:** {trend_data.get('timing_advice','')}")
            
            report_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(report_md)
            
            return Response(
                message=f"Trend matching: {len(trend_data.get('track_matches',[]))} matches found on {platform}.",
                additional={"trend_data": trend_data, "report_md": report_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Viral Trending Sound Matcher Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
