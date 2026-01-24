---
name: veo-video-expert
description: Expert in Google Veo 3.1 for Video Generation & Understanding.
---

# Veo 3.1 Video Expert

## 1. Generation Specs

* **Models:** `veo-3.1-generate-preview` (4K/Production), `veo-3.1-fast-generate-preview`.
* **Params:** `aspect_ratio="16:9"|"9:16"`, `resolution="1080p"|"4k"`.
* **Audio:** `generate_audio=True` (Native SFX/Dialogue).

## 2. Video Understanding (Input)

* **Token Usage (v1alpha `media_resolution`):**
  * `media_resolution_low` / `medium`: **70 tokens/frame** (Standard action recognition).
  * `media_resolution_high`: **280 tokens/frame** (Text-heavy/OCR).

## 3. Workflows

* **Text-to-Video:** Direct generation.
* **Image-to-Video:** First/Last frame interpolation.
* **Extension:** Extend clips (Max 20x).
* **Ingredients:** Up to 3 reference images for consistency.

## 4. Code (Python SDK)

```python
# Generation
op = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="Cinematic drone shot...",
    config=types.GenerateVideosConfig(aspect_ratio="16:9", generate_audio=True)
)

# Understanding (Interactions)
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
        {"type": "text", "text": "Describe this video."},
        {"type": "video", "uri": "...", "mime_type": "video/mp4"}
    ]
)
```
