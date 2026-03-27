
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class EpkBuilder(Tool):
    """
    Brand Manager Tool.
    Compiles artist bio, press photos, and links into a sleek hosted EPK structure.
    Optionally exports to PandaDoc as a shareable PDF.
    """

    async def execute(self, artist_name: str, genre: str, bio_summary: str, key_achievements: list, contact_email: str, **kwargs) -> Response:
        self.set_progress(f"Building Electronic Press Kit (EPK) for: {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            achievements_str = ", ".join(key_achievements)
            
            prompt = f"""
            You are the indiiOS Brand Manager.
            Generate the structural JSON data for an Electronic Press Kit (EPK) that can be instantly rendered to a webpage.
            
            Artist Name: {artist_name}
            Genre: {genre}
            Raw Bio summary: {bio_summary}
            Key Achievements: {achievements_str}
            Contact: {contact_email}
            
            Rules:
            1. Rewrite the raw bio into a professional, compelling 2-paragraph press bio ("Short Bio") and a 1-sentence "Elevator Pitch".
            2. Format the achievements into bullet points.
            3. Provide placeholder layout components for the frontend to render.
            
            Return ONLY a JSON object:
            {{
              "epk_title": "...",
              "elevator_pitch": "...",
              "short_bio": "...",
              "highlighted_quotes": ["...", "..."],
              "achievements": ["...", "..."],
              "contact_info": "{contact_email}",
              "suggested_color_palette": ["#...", "#..."],
              "font_pairing": {{"header": "...", "body": "..."}}
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
                    temperature=0.4
                )
            )
            
            epk_data = json.loads(response.text)
            
            # --- PandaDoc Integration: Create a shareable EPK PDF ---
            import requests
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            pandadoc_key = os.getenv("PANDADOC_API_KEY")
            workflow_status = "EPK generated (local only)"
            pandadoc_doc_id = None
            
            create_pdf = kwargs.get("create_pandadoc", False)
            
            if create_pdf and pandadoc_key:
                self.set_progress("Creating PandaDoc EPK document...")
                
                achievements_text = "\n".join([f"• {a}" for a in epk_data.get("achievements", [])])
                
                doc_payload = {
                    "name": f"EPK - {artist_name} ({genre})",
                    "recipients": [
                        {"email": kwargs.get("recipient_email", contact_email), "role": "Recipient"}
                    ],
                    "content_placeholders": [
                        {"block_id": "artist_name", "value": artist_name},
                        {"block_id": "elevator_pitch", "value": epk_data.get("elevator_pitch", "")},
                        {"block_id": "bio", "value": epk_data.get("short_bio", "")},
                        {"block_id": "achievements", "value": achievements_text},
                        {"block_id": "contact", "value": contact_email},
                    ],
                    "tags": ["epk", "press-kit", "auto-generated"]
                }
                
                template_id = os.getenv("PANDADOC_EPK_TEMPLATE_ID")
                if template_id:
                    doc_payload["template_uuid"] = template_id
                
                headers = {
                    "Authorization": f"API-Key {pandadoc_key}",
                    "Content-Type": "application/json"
                }
                
                try:
                    pd_res = requests.post(
                        "https://api.pandadoc.com/public/v1/documents",
                        json=doc_payload,
                        headers=headers,
                        timeout=15
                    )
                    if pd_res.ok:
                        pandadoc_doc_id = pd_res.json().get("id")
                        workflow_status = f"PandaDoc EPK {pandadoc_doc_id} created"
                    else:
                        workflow_status = f"PandaDoc API Error: {pd_res.status_code}"
                except Exception as pd_e:
                    workflow_status = f"PandaDoc unreachable: {str(pd_e)}"
            elif create_pdf:
                workflow_status = "PandaDoc requested but PANDADOC_API_KEY missing in .env"
            
            return Response(
                message=f"EPK generated for '{artist_name}'. {workflow_status}",
                additional={
                    "epk_data": epk_data,
                    "workflow_status": workflow_status,
                    "pandadoc_doc_id": pandadoc_doc_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"EPK Builder Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
