import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ReleaseRadarPitchOptimizer(Tool):
    """
    Marketing Executive Tool.
    Drafts the perfect 500-character pitch for Spotify for Artists editorial submission.
    """

    async def execute(self, track_title: str, genre: str, mood: str, instruments: list, storyline: str) -> Response:
        self.set_progress(f"Drafting Spotify Editorial Pitch for: {track_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text Generation
            
            instruments_str = ", ".join(instruments)
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Your job is to write a highly optimized pitch for the Spotify for Artists editorial submission tool for a new track.
            
            Track Title: {track_title}
            Genre: {genre}
            Mood: {mood}
            Main Instruments: {instruments_str}
            The Story Behind the Song: {storyline}
            
            CRITICAL RULES FOR SPOTIFY PITCHING:
            1. STRICTLY MAXIMUM 500 CHARACTERS (including spaces). Do not exceed this limit under any circumstances.
            2. Focus on the origin story, marketing drivers, and the specific vibe.
            3. Do not waste characters on filler words like "This song is about..." Just get straight to the facts.
            4. Highlight the target audience or sub-genre it fits best.
            
            Return ONLY a JSON object:
            {{
              "pitch_text": "... [The exact text, under 500 chars]",
              "character_count": 485,
              "target_playlists": ["Fresh Finds", "Lorem", "New Music Friday"],
              "marketing_angle": "Focus on the vulnerability and acoustic instrumentation for late-night listening."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.7 # Need creative but concise marketing copy
                )
            )
            
            return Response(
                message=f"Spotify Editorial Pitch Drafted for '{track_title}'",
                additional={"pitch_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Pitch Optimizer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
