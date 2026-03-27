
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MusicLibraryTagger(Tool):
    """
    Publishing Administrator Tool.
    Bulk-tags tracks for sync library submission with standardized descriptor sets.
    Exports complete tag set as CSV.
    """

    async def execute(self, tracks: list, library_format: str = "standard", **kwargs) -> Response:
        self.set_progress(f"Bulk-tagging {len(tracks)} tracks for {library_format} library")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            tracks_str = json.dumps(tracks[:20])
            
            prompt = f"""
            You are the indiiOS Music Library Tagger.
            Bulk-tag tracks for a {library_format} music library using standardized descriptors.
            
            Tracks: {tracks_str}
            
            For each track, provide:
            1. Primary/Secondary genre
            2. Mood (1-3 tags from standardized set)
            3. Tempo (BPM range + descriptor)
            4. Instrumentation highlights
            5. Vocal type
            6. Best-fit placements
            
            Return ONLY a JSON object:
            {{
              "tagged_tracks": [
                {{
                  "title": "...",
                  "genres": ["..."],
                  "moods": ["..."],
                  "tempo": "120 BPM - Upbeat",
                  "instrumentation": ["..."],
                  "vocal_type": "Male",
                  "placements": ["TV Drama", "Commercial"]
                }}
              ]
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
            tagged = json.loads(response.text)
            
            # --- CSV Export ---
            import os
            csv_rows = ["Title,Genres,Moods,Tempo,Instrumentation,Vocal,Placements"]
            for t in tagged.get("tagged_tracks", []):
                csv_rows.append(f"{t.get('title','')},{'; '.join(t.get('genres',[]))},{'; '.join(t.get('moods',[]))},{t.get('tempo','')},{'; '.join(t.get('instrumentation',[]))},{t.get('vocal_type','')},{'; '.join(t.get('placements',[]))}")
            csv_payload = "\n".join(csv_rows)
            
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Bulk tagged {len(tagged.get('tagged_tracks',[]))} tracks.",
                additional={"tagged": tagged, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Music Library Tagger Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
