
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataEnhancer(Tool):
    """
    Distribution Agent Tool.
    AI-enriches track metadata with genre tags, mood descriptors, and DSP-optimized descriptions.
    Saves enhanced metadata to Firestore for distribution pipeline consumption.
    """

    async def execute(self, track_title: str, artist_name: str, raw_genre: str = "", **kwargs) -> Response:
        self.set_progress(f"Enhancing metadata for '{track_title}'")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Metadata Specialist.
            Enhance the metadata for optimal DSP discoverability and algorithmic placement.
            
            Track: {track_title}
            Artist: {artist_name}
            Raw Genre: {raw_genre}
            
            Return ONLY a JSON object:
            {{
              "primary_genre": "...",
              "secondary_genre": "...",
              "mood_tags": ["..."],
              "energy_level": "Low/Medium/High",
              "bpm_estimate": 0,
              "dsp_description": "2-sentence description optimized for search",
              "similar_artists": ["..."],
              "recommended_playlists": ["..."],
              "isrc_validation": "Valid/Missing/Invalid"
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2)
            )
            enhanced = json.loads(response.text)
            
            # --- Firestore persistence ---
            workflow_status = "Metadata enhanced (local only)"
            if kwargs.get("save_to_release") and kwargs.get("release_id") and kwargs.get("user_id"):
                try:
                    import firebase_admin
                    from firebase_admin import firestore as admin_firestore
                    if not firebase_admin._apps:
                        firebase_admin.initialize_app()
                    db = admin_firestore.client()
                    db.collection("users").document(kwargs["user_id"]).collection("releases").document(kwargs["release_id"]).update({
                        "enhancedMetadata": enhanced,
                        "metadataEnhancedAt": admin_firestore.SERVER_TIMESTAMP
                    })
                    workflow_status = "Metadata saved to release record"
                except Exception as fs_e:
                    workflow_status = f"Firestore save failed: {fs_e}"
            
            return Response(
                message=f"Metadata enhanced for '{track_title}'. {workflow_status}",
                additional={"enhanced_metadata": enhanced, "workflow_status": workflow_status}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Metadata Enhancer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
