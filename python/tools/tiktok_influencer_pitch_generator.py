import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TiktokInfluencerPitchGenerator(Tool):
    """
    Marketing Executive Tool.
    Creates personalized outreach DMs for micro-influencers matching the artist's vibe.
    """

    async def execute(self, track_title: str, influencer_name: str, influencer_niche: str, artist_vibe: str) -> Response:
        self.set_progress(f"Generating TikTok outreach DM for: {influencer_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST # Text generation
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Write a casual, non-cringe, highly personalized TikTok/Instagram DM pitching a new track to a micro-influencer.
            
            Artist Vibe: {artist_vibe}
            Track Title: {track_title}
            Influencer Name: {influencer_name}
            Influencer Niche (e.g. grwm, skate edits, transitions): {influencer_niche}
            
            RULES for the DM:
            1. Keep it short (max 4 sentences).
            2. Sound like a real person, not an ad agency. No corporate speak.
            3. Compliment their content specifically related to their niche.
            4. Make it easy for them to say yes (e.g., offering to send the unreleased sound).
            
            Return ONLY a JSON object:
            {{
              "dm_text": "...",
              "influencer_name": "{influencer_name}",
              "suggested_video_concept": "A 1-sentence idea for how they could use the sound in their specific niche."
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.8 # Creative, empathetic tone
                )
            )
            
            return Response(
                message=f"TikTok Influencer Pitch drafted for '{influencer_name}'",
                additional={"pitch_data": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Influencer Pitch Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
