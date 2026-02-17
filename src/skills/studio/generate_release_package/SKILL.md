---
name: generate_release_package
description: Creates the text and visual assets required to publish a song.
metadata:
  indii_os:
    requires:
      models: ["gemini-pro"]
    context: "Publishing Studio"
---

# Instruction
The Artist has a finished song. You need to create the "Release Package."

## Inputs Needed
- Song Title
- Genre/Vibe (from the `scan_audio_dna` output)
- Artist Name

## Actions
1.  **Draft Blurb:** Write a 150-word press release for music blogs.
2.  **Generate Image Prompts:** Create 3 detailed prompts for the "Creative Studio" to generate Cover Art based on the song's vibe.
3.  **Format Metadata:** Create the `metadata.json` file required for the DistroKid/Spotify API.

## Tool Code
```python
import json

def generate_release_package(song_title, artist_name, bpm, vibe):
    package = {
        "press_release": f"New release from {artist_name}: '{song_title}'. A {bpm} BPM track featuring {vibe} textures...",
        "image_prompts": [
            f"Album cover for '{song_title}', style: {vibe}, abstract, high contrast",
            f"Spotify Canvas loop, {vibe} atmosphere, dark background"
        ],
        "distrokid_payload": {
            "artist": artist_name,
            "title": song_title,
            "genre": vibe,
            "isrc": "GENERATE_NEW"
        }
    }

    # Write this to the Living File system
    with open('RELEASE_PACKAGE.json', 'w') as f:
        json.dump(package, f, indent=2)

    print("Release package generated in workspace.")

# Agent: Call generate_release_package(song_title, artist_name, bpm, vibe)
```
