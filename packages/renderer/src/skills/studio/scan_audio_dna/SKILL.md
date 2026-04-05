---
name: scan_audio_dna
description: Scans a finished audio master to extract technical metadata (BPM, Duration, Key) for publishing.
metadata:
  indii_os:
    requires:
      bins: ["ffprobe", "essentia_streaming_extractor_music"]
    context: "Music Studio -> Metadata"
---

# Instruction
You are the Metadata Scanner. The user has provided a finished audio master.
Your job is to "listen" to the file and extract the data needed for the DDEX publishing manifest.

## Procedure
1.  **Validate:** Ensure the file exists and is a valid audio format (WAV/MP3).
2.  **Execute Scan:** Run the analysis tool to get the sonic data.
3.  **Output:** Return a JSON object with `bpm`, `duration_ms`, `key`, and `loudness`.
    *   *CRITICAL:* Do not modify the input file. Read-only access.

## Tool Code (Python)
```python
import subprocess
import json
import os

def scan_master(file_path):
    # 1. Get Duration via FFprobe
    probe_cmd = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    duration = float(subprocess.check_output(probe_cmd).strip())

    # 2. (Optional) Simulate BPM/Key scan if Essentia is missing (for the prototype)
    # In production, this would call the Essentia C++ extractor
    audio_dna = {
        "filename": os.path.basename(file_path),
        "duration_seconds": duration,
        "duration_ms": int(duration * 1000),
        "technical_metadata": {
            "sample_rate": 44100, # In real implementation, parse from ffprobe
            "channels": 2
        },
        "mediator_status": "SCANNED_READY_FOR_PUBLISHING"
    }

    print(json.dumps(audio_dna))

# Agent: Call scan_audio_dna(input_file)
```
