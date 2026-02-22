import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TiktokInfluencerPitchGenerator(Tool):
    """
    Marketing Executive Tool.
    Creates personalized outreach DMs for micro-influencers.
    """

    async def execute(self, artist_name: str, track_title: str, campaign_vibe: str, target_influencer_niche: str) -> Response:
        self.set_progress(f"Drafting TikTok influencer pitches for '{track_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive.
            Draft a personalized cold-outreach DM to a TikTok micro-influencer in the '{target_influencer_niche}' niche.
            
            Artist: {artist_name}
            Track to Promote: {track_title}
            Campaign Vibe/Trend Idea: {campaign_vibe}
            
            Rules:
            1. Keep it brief, authentic, and not overly corporate.
            2. Propose a casual collaboration or a paid micro-campaign depending on their rate.
            3. Make it easy for them to just say "send the sound".
            
            Return ONLY a JSON object:
            {{
              "dm_template": "...",
              "follow_up_template": "...",
              "suggested_hashtags": ["#tag1", "#tag2"]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.6
                )
            )
            
            return Response(
                message=f"Influencer pitch DM templates generated.",
                additional={"influencer_campaign": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"TikTok Influencer Pitch Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
