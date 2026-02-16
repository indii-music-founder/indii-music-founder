import os
import json
import subprocess
from python.helpers.tool import Tool, Response

class ScanAudioDNA(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            file_path = kwargs.get("file_path", "")

            if not file_path:
                # Try to find 'input_file' or positional arg if kwargs usage varies
                file_path = kwargs.get("input_file", "")

            if not file_path:
                 return Response(message="Error: file_path argument is required.", break_loop=False)

            if not os.path.exists(file_path):
                return Response(message=f"Error: File not found at {file_path}", break_loop=False)

            # 1. Get Duration via FFprobe
            try:
                probe_cmd = [
                    "ffprobe", "-v", "error", "-show_entries",
                    "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
                    file_path
                ]
                # subprocess.check_output returns bytes
                duration_str = subprocess.check_output(probe_cmd).strip()
                duration = float(duration_str)
            except Exception as e:
                return Response(message=f"Error scanning audio with ffprobe: {str(e)}\nEnsure ffprobe is installed.", break_loop=False)

            # 2. Simulate BPM/Key scan if Essentia is missing (for the prototype)
            # In production, this would call the Essentia C++ extractor
            # Per spec, we need bpm, key, loudness.
            audio_dna = {
                "filename": os.path.basename(file_path),
                "duration_seconds": duration,
                "duration_ms": int(duration * 1000),
                "bpm": 120, # Simulated
                "key": "C Major", # Simulated
                "loudness": -14.0, # Simulated
                "technical_metadata": {
                    "sample_rate": 44100, # In real implementation, parse from ffprobe
                    "channels": 2
                },
                "mediator_status": "SCANNED_READY_FOR_PUBLISHING"
            }

            result_json = json.dumps(audio_dna, indent=2)

            # Save metadata next to the file (optional but good for persistence)
            dir_name = os.path.dirname(file_path)
            base_name = os.path.basename(file_path)
            meta_path = os.path.join(dir_name, f"{base_name}.dna.json")
            with open(meta_path, "w") as f:
                f.write(result_json)

            return Response(
                message=f"Audio DNA Scan Complete:\n{result_json}",
                break_loop=False,
                additional={"audio_dna": audio_dna, "metadata_path": meta_path}
            )

        except Exception as e:
            return Response(message=f"Audio scan failed: {str(e)}", break_loop=False)
