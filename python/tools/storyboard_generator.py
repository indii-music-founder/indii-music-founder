import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class StoryboardGenerator(Tool):
    """
    Director Agent Tool.
    Translates a song concept into a cohesive 5-shot visual sequence with technical Veo 3.1 prompts.
    """

    async def execute(self, song_title: str, visual_concept: str, aspect_ratio: str = "16:9") -> Response:
        self.set_progress(f"Generating Storyboard for: {song_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Routing/Text Generation
            
            prompt = f"""
            You are the indiiOS Video Producer / Director Agent.
            Convert a vague concept into a tight 5-shot storyboard for a music video.
            For each shot, provide a highly technical prompt optimized for Google Veo 3.1 video generation model.
            
            Song Title: {song_title}
            Visual Concept: {visual_concept}
            Target Aspect Ratio: {aspect_ratio}
            
            Veo Prompting Rules:
            - Focus on [Subject] + [Action/Environment] + [Camera Direction] + [Lighting/Style] + [Technical Specs]
            - Use explicit camera terms: "slow pan left", "drone shot", "static tripod"
            - Use cinematic lighting terms: "rembrandt lighting", "volumetric fog"
            
            Return ONLY a JSON object:
            {{
              "project": "...",
              "concept_summary": "...",
              "shots": [
                {{
                  "shot_number": 1,
                  "section": "Intro",
                  "description": "...",
                  "veo_prompt": "... --ar {aspect_ratio}",
                  "duration_seconds": 5
                }}
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.8 # Creative task
                )
            )
            
            return Response(
                message=f"Storyboard with Veo prompts generated for '{song_title}'",
                additional={"storyboard": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Storyboard Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
