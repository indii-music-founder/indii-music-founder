
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MetadataTaggingForSync(Tool):
    """
    Licensing Executive Tool.
    Tags tracks with sync-specific metadata for music library submission.
    Exports tagged data as CSV for library ingestion.
    """

    async def execute(self, track_title: str, audio_characteristics: str = "", **kwargs) -> Response:
        self.set_progress(f"Tagging '{track_title}' for sync library submission")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Sync Tagging Specialist.
            Generate comprehensive sync-friendly metadata tags for a track.
            
            Track: {track_title}
            Audio Characteristics: {audio_characteristics}
            
            Sync libraries require extensive tagging. Return ONLY a JSON object:
            {{
              "track_title": "{track_title}",
              "primary_mood": "...",
              "secondary_moods": ["..."],
              "genres": ["..."],
              "sub_genres": ["..."],
              "tempo_descriptor": "Slow/Medium/Upbeat/Driving",
              "energy": "Low/Medium/High",
              "instrumentation": ["..."],
              "vocal_type": "Male/Female/Instrumental/Choir",
              "use_cases": ["Commercial", "Film Trailer", "TV Drama"],
              "similar_tracks": ["..."],
              "keywords": ["..."]
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
            tags = json.loads(response.text)
            
            # --- CSV Export for library ingestion ---
            import os
            csv_rows = ["Field,Value"]
            csv_rows.append(f"Track,{tags.get('track_title','')}")
            csv_rows.append(f"Primary Mood,{tags.get('primary_mood','')}")
            csv_rows.append(f"Secondary Moods,{'; '.join(tags.get('secondary_moods',[]))}")
            csv_rows.append(f"Genres,{'; '.join(tags.get('genres',[]))}")
            csv_rows.append(f"Tempo,{tags.get('tempo_descriptor','')}")
            csv_rows.append(f"Energy,{tags.get('energy','')}")
            csv_rows.append(f"Instrumentation,{'; '.join(tags.get('instrumentation',[]))}")
            csv_rows.append(f"Vocal Type,{tags.get('vocal_type','')}")
            csv_rows.append(f"Use Cases,{'; '.join(tags.get('use_cases',[]))}")
            csv_rows.append(f"Keywords,{'; '.join(tags.get('keywords',[]))}")
            csv_payload = "\n".join(csv_rows)
            
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Sync tags generated for '{track_title}'.",
                additional={"tags": tags, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Metadata Tagging for Sync Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
