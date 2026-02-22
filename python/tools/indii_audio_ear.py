
from python.helpers.files import safe_path

from python.helpers.rate_limiter import RateLimiter
import asyncio
import os
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig
from google import genai
from google.genai import types

class IndiiAudioEar(Tool):
    # Prompt Constants to avoid "hard coating"
    DEFAULT_ANALYSIS_PROMPT = (
        "Analyze the BPM, Key, Mood, instrumentation, and genre. "
        "Return ONLY a JSON object with keys: bpm, key, mood, instrumentation, genre, description."
    )
    SYSTEM_INSTRUCTION = (
        "Analyze the audio tokens of this file. Identify BPM, instrumentation, "
        "emotional tone, and genre characteristics."
    )

    async def execute(self, **kwargs) -> Response:
        try:
            file_path = kwargs.get("file_path", "")
            
            if not file_path or not os.path.exists(file_path):
                return Response(message="Error: file_path invalid or not found.", break_loop=False)

            self.set_progress("Uploading audio to Gemini Ear...")
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})

            # Upload file
            self.set_progress(f"Uploading {os.path.basename(file_path)}...")
            uploaded_file = client.files.upload(file=safe_path(file_path))
            
            self.set_progress("Analyzing audio tokens (BPM, Key, Mood)...")
            
            # Model selection: gemini-3-pro-preview for high-thinking multimodal analysis.
            model_id = "gemini-3-pro-preview" 
            
            
 
            
                        _rl = RateLimiter()
 
            
                        wait_time = _rl.wait_time("gemini")
 
            
                        if wait_time > 0:
 
            
                            self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
 
            
                            await asyncio.sleep(wait_time)
 
            
            esponse = client.models.generate_content(
                model=model_id,
                contents=[
                    uploaded_file,
                    self.DEFAULT_ANALYSIS_PROMPT
                ],
                config=types.GenerateContentConfig(
                    system_instruction=self.SYSTEM_INSTRUCTION,
                    response_mime_type="application/json"
                )
            )
            
            result_json = response.text
            
            # Save metadata next to the file
            dir_name = os.path.dirname(file_path)
            base_name = os.path.basename(file_path)
            meta_path = os.path.join(dir_name, f"{base_name}.metadata.json")
            
            with open(meta_path, "w") as f:
                f.write(result_json)

            return Response(
                message=f"Audio Analysis Complete for {base_name}:\n{result_json}",
                break_loop=False,
                additional={"metadata_path": meta_path, "analysis": json.loads(result_json)}
            )

        except Exception as e:
            return Response(message=f"Audio analysis failed: {str(e)}", break_loop=False)
