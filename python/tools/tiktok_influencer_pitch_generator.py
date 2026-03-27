
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class TiktokInfluencerPitchGenerator(Tool):
    """
    Marketing Executive Tool.
    Creates personalized outreach DMs for micro-influencers.
    Optionally sends the pitch via SendGrid if the influencer's email is available.
    """

    async def execute(self, artist_name: str, track_title: str, campaign_vibe: str, target_influencer_niche: str, **kwargs) -> Response:
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
              "email_version": "A slightly more formal email version of the DM pitch",
              "suggested_hashtags": ["#tag1", "#tag2"]
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
                    temperature=0.6
                )
            )
            
            pitch_data = json.loads(response.text)
            
            # --- SendGrid Integration: Send email version to influencer ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            sendgrid_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("SENDGRID_FROM_EMAIL", "collab@indiios.com")
            
            workflow_status = "Pitch templates generated (not sent)"
            send_result = None
            
            auto_send = kwargs.get("auto_send", False)
            influencer_email = kwargs.get("influencer_email")
            influencer_name = kwargs.get("influencer_name", "Creator")
            
            if auto_send and sendgrid_key and influencer_email:
                self.set_progress(f"Sending pitch email to {influencer_email} via SendGrid...")
                
                email_body = pitch_data.get("email_version", pitch_data.get("dm_template", ""))
                
                sg_payload = {
                    "personalizations": [{
                        "to": [{"email": influencer_email, "name": influencer_name}],
                        "subject": f"Collab? 🎵 {artist_name} x {influencer_name}"
                    }],
                    "from": {"email": from_email, "name": f"{artist_name} Team"},
                    "content": [{
                        "type": "text/plain",
                        "value": email_body
                    }],
                    "tracking_settings": {
                        "open_tracking": {"enable": True},
                        "click_tracking": {"enable": True}
                    },
                    "categories": ["influencer-outreach", "tiktok", "auto-generated"]
                }
                
                headers = {
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json"
                }
                
                try:
                    sg_res = requests.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        json=sg_payload,
                        headers=headers,
                        timeout=10
                    )
                    if sg_res.status_code in (200, 202):
                        workflow_status = f"Pitch email sent to {influencer_email}"
                        send_result = "delivered"
                    else:
                        workflow_status = f"SendGrid Error: {sg_res.status_code}"
                        send_result = "failed"
                except Exception as sg_e:
                    workflow_status = f"SendGrid unreachable: {str(sg_e)}"
                    send_result = "error"
            elif auto_send and not influencer_email:
                workflow_status = "Auto-send requested but influencer_email not provided"
            elif auto_send:
                workflow_status = "Auto-send requested but SENDGRID_API_KEY missing in .env"
            
            return Response(
                message=f"Influencer pitch templates generated. {workflow_status}",
                additional={
                    "influencer_campaign": pitch_data,
                    "workflow_status": workflow_status,
                    "send_result": send_result
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"TikTok Influencer Pitch Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
