import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class YoutubeThumbnailAbTester(Tool):
    """
    Director Agent Tool.
    Generates 5 distinct high-contrast YouTube thumbnail concepts based on a music video theme.
    """

    async def execute(self, track_title: str, video_theme: str, target_vibe: str = "Cinematic") -> Response:
        self.set_progress(f"Generating A/B Thumbnail Concepts for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text/Concept generation
            
            prompt = f"""
            You are the indiiOS Visual Director.
            Generate 5 highly distinct YouTube thumbnail concepts for a music video to use in A/B testing.
            
            Track Title: {track_title}
            Video Theme: {video_theme}
            Target Vibe: {target_vibe}
            
            Rules for YT Thumbnails:
            1. High contrast, highly clickable.
            2. The 5 concepts must test different marketing angles (e.g., Concept 1: Emotional Close-up, Concept 2: Wide Action Shot, Concept 3: Typography heavy).
            3. Provide specific layout instructions (foreground, background, text overlay).
            4. Keep text overlay under 4 words.
            
            Return ONLY a JSON object:
            {{
              "track": "{track_title}",
              "thumbnail_concepts": [
                {{
                  "variant": "A",
                  "angle": "Emotional Face",
                  "visual_description": "...",
                  "text_overlay": "...",
                  "imagen_prompt": "..."
                }},
                // ... 5 distinct concepts total
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.8 # High creativity needed for distinct visual concepts
                )
            )
            
            return Response(
                message=f"5 A/B test thumbnail concepts generated.",
                additional={"thumbnail_strategy": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"YouTube Thumbnail AB Tester Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
