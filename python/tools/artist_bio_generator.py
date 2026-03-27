
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ArtistBioGenerator(Tool):
    """
    Brand Manager Tool.
    Generates short, medium, and long artist bios for DSPs and press.
    Optionally saves the bios to Firestore under the user's profile.
    """

    async def execute(self, artist_name: str, genre: str, key_achievements: list, core_vibe: str, **kwargs) -> Response:
        self.set_progress(f"Generating EPK bios for {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            achievements_str = ", ".join(key_achievements)
            
            prompt = f"""
            You are the indiiOS Brand Manager & Publicist.
            Write three variations of a professional artist bio for the indie {genre} artist '{artist_name}'.
            
            Key Achievements: {achievements_str}
            Core Vibe/Aesthetic: {core_vibe}
            
            Rules:
            1. Short Bio: ~2-3 sentences. Perfect for Spotify/Apple Music quick reading.
            2. Medium Bio: ~1 paragraph. Good for booking agents or a tight EPK.
            3. Long Bio: ~2-3 paragraphs. Deep dive into background, achievements, and aesthetic direction.
            
            Return ONLY a JSON object:
            {{
              "short_bio": "...",
              "medium_bio": "...",
              "long_bio": "..."
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
                    temperature=0.7
                )
            )
            
            bios = json.loads(response.text)
            
            # --- Firestore Integration: Save bios to user profile ---
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            workflow_status = "Bios generated (local only)"
            
            save_to_profile = kwargs.get("save_to_profile", False)
            user_id = kwargs.get("user_id")
            
            if save_to_profile and user_id:
                self.set_progress("Saving bios to user profile in Firestore...")
                
                try:
                    import firebase_admin
                    from firebase_admin import firestore as admin_firestore
                    
                    # Initialize Firebase Admin if not already done
                    if not firebase_admin._apps:
                        firebase_admin.initialize_app()
                    
                    db = admin_firestore.client()
                    user_ref = db.collection("users").document(user_id)
                    
                    user_ref.update({
                        "brandKit.generatedBios": bios,
                        "brandKit.bioLastGenerated": admin_firestore.SERVER_TIMESTAMP
                    })
                    
                    workflow_status = "Bios saved to Firestore profile"
                except Exception as fs_e:
                    workflow_status = f"Firestore save failed: {str(fs_e)}"
            elif save_to_profile:
                workflow_status = "Save requested but user_id not provided"
            
            return Response(
                message=f"3 bio variations generated for {artist_name}. {workflow_status}",
                additional={
                    "bios": bios,
                    "workflow_status": workflow_status
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Artist Bio Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
