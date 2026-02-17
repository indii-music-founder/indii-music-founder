import os
import json
import asyncio
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig
from google import genai
from google.genai import types

class GenerateReleasePackage(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            # Check inputs from kwargs (Agent Zero might pass them differently depending on extraction)
            song_title = kwargs.get("song_title", "")
            artist_name = kwargs.get("artist_name", "")
            bpm = kwargs.get("bpm", "")
            vibe = kwargs.get("vibe", "")

            # If arguments are missing, try to check if they were passed positionally or in a dictionary called 'data'
            # But Tool.execute receives **kwargs.

            if not song_title or not artist_name:
                 return Response(message="Error: song_title and artist_name are required.", break_loop=False)

            self.set_progress(f"Generating Release Package for '{song_title}' by {artist_name}...")

            # Use Gemini to generate the creative content
            try:
                api_key = AIConfig.get_api_key()
                client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
                model_id = AIConfig.TEXT_AGENT # gemini-3-pro-preview

                # Prompt for Press Release and Image Prompts in one go to save calls?
                # Or separate for clarity. Let's do separate for better structure.

                # 1. Press Release
                pr_prompt = (
                    f"Write a 150-word press release for a new song release.\n"
                    f"Artist: {artist_name}\n"
                    f"Title: {song_title}\n"
                    f"BPM: {bpm}\n"
                    f"Vibe/Genre: {vibe}\n"
                    "Focus on the emotional impact and the unique sound."
                )

                self.set_progress("Drafting press release...")
                pr_response = client.models.generate_content(
                    model=model_id,
                    contents=pr_prompt
                )
                press_release_text = pr_response.text

                # 2. Image Prompts
                img_prompt_prompt = (
                    f"Create 3 detailed image generation prompts for the cover art of this song.\n"
                    f"Artist: {artist_name}\n"
                    f"Title: {song_title}\n"
                    f"Vibe: {vibe}\n"
                    "Return ONLY a JSON array of strings. No markdown code blocks."
                )

                self.set_progress("Generating visual prompts...")
                img_response = client.models.generate_content(
                    model=model_id,
                    contents=img_prompt_prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )

                # Clean up markdown if present (though response_mime_type should handle it)
                img_text = img_response.text.strip()
                if img_text.startswith("```json"):
                    img_text = img_text[7:-3].strip()
                elif img_text.startswith("```"):
                    img_text = img_text[3:-3].strip()

                image_prompts = json.loads(img_text)

            except Exception as e:
                # Fallback to simple template if AI fails (e.g. no key or quota)
                print(f"AI Generation failed: {e}. Using fallback template.")
                press_release_text = f"New release from {artist_name}: '{song_title}'. A {bpm} BPM track featuring {vibe} textures..."
                image_prompts = [
                    f"Album cover for '{song_title}', style: {vibe}, abstract, high contrast",
                    f"Spotify Canvas loop, {vibe} atmosphere, dark background"
                ]

            # Assemble Package
            package = {
                "press_release": press_release_text,
                "image_prompts": image_prompts,
                "distrokid_payload": {
                    "artist": artist_name,
                    "title": song_title,
                    "genre": vibe,
                    "isrc": "GENERATE_NEW"
                },
                "metadata": {
                    "bpm": bpm,
                    "vibe": vibe
                }
            }

            # Save to file
            output_filename = "RELEASE_PACKAGE.json"
            # If project ID exists in context, use project dir.
            # But Agent Zero handles context via self.agent.context usually.
            # Let's save to current working directory for now as per user instruction.

            with open(output_filename, "w") as f:
                json.dump(package, f, indent=2)

            return Response(
                message=f"Release Package Generated in {output_filename}:\n\nPress Release:\n{press_release_text}\n\nVisual Prompts:\n{json.dumps(image_prompts, indent=2)}",
                break_loop=False,
                additional={"package": package, "file_path": os.path.abspath(output_filename)}
            )

        except Exception as e:
            return Response(message=f"Failed to generate release package: {str(e)}", break_loop=False)
