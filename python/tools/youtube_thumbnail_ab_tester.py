
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class YoutubeThumbnailAbTester(Tool):
    """
    Brand Manager / Social Tool.
    Generates A/B test concepts for YouTube thumbnails with scoring criteria.
    Exports comparison brief as markdown.
    """

    async def execute(self, video_title: str, target_audience: str, **kwargs) -> Response:
        self.set_progress(f"Generating thumbnail A/B test for '{video_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS YouTube Thumbnail Strategist.
            Generate 3 A/B test thumbnail concepts for maximum CTR.
            
            Video: {video_title}
            Target Audience: {target_audience}
            
            YouTube thumbnail best practices:
            - 1280x720 resolution (16:9)
            - Faces with emotion get 30% higher CTR
            - High contrast, bold text (3-4 words max)
            - Avoid clutter
            
            Return ONLY a JSON object:
            {{
              "variants": [
                {{
                  "variant_id": "A",
                  "concept": "Close-up face with surprised expression + bold title text",
                  "text_overlay": "3-4 word text",
                  "color_scheme": "Dark background, yellow text",
                  "emotion_trigger": "Curiosity",
                  "predicted_ctr_range": "4-7%"
                }}
              ],
              "test_duration_days": 7,
              "minimum_impressions": 1000,
              "winner_criteria": "Select variant with highest CTR after minimum impressions reached"
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
            ab_data = json.loads(response.text)
            
            # --- Markdown Brief ---
            import os
            md = [f"# YouTube Thumbnail A/B Test — {video_title}\n", f"**Duration:** {ab_data.get('test_duration_days',7)} days | **Min Impressions:** {ab_data.get('minimum_impressions',1000)}\n"]
            for v in ab_data.get("variants", []):
                md.append(f"## Variant {v.get('variant_id','')}")
                md.append(f"- **Concept:** {v.get('concept','')}")
                md.append(f"- **Text:** {v.get('text_overlay','')}")
                md.append(f"- **Colors:** {v.get('color_scheme','')}")
                md.append(f"- **Trigger:** {v.get('emotion_trigger','')}")
                md.append(f"- **Predicted CTR:** {v.get('predicted_ctr_range','')}\n")
            md.append(f"**Winner Criteria:** {ab_data.get('winner_criteria','')}")
            
            brief_md = "\n".join(md)
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(brief_md)
            
            return Response(
                message=f"Thumbnail A/B test: {len(ab_data.get('variants',[]))} variants generated.",
                additional={"ab_data": ab_data, "brief_md": brief_md, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"YouTube Thumbnail A/B Tester Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
