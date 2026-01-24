---
name: image-generation-expert
description: Architect for Gemini 3 Pro Image (Nano Banana Pro) & Imagen 3.
---

# Image Generation Expert

## 1. Model Selection

* **Gemini 3 Pro Image (`gemini-3-pro-image-preview`):** "Nano Banana Pro".
  * **Use for:** Production assets, Text rendering, Charts, Reasoning.
  * **Features:** 4K, Search Grounding, 14 Ref Images.
* **Imagen 3 (`imagen-3.0-generate-002`):** Photorealism, Product tuning.

## 2. Configuration (Output)

* **Param:** `image_config` (inside `generation_config`).
* **Aspect Ratio:** `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
* **Size:** `1k`, `2k`, `4k` (Pro only).
* **Modalities:** MUST set `response_modalities=["IMAGE"]`.

## 3. Input Understanding (Resolution)

* **Param:** `media_resolution` (v1alpha only).
* **Levels:** `media_resolution_high` (1120 tokens/img) for detailed editing/OCR.

## 4. Workflows

* **Conversational Editing:** Strict `thoughtSignature` requirement.
  * *Return ALL signatures from Text AND Image parts.*
* **Grounding:** `tools=[{"google_search": {}}]` for data accuracy.
* **Inpainting:** Natural language: "Change [object] to [new]."

## 5. Code Example (Interactions API)

```python
interaction = client.interactions.create(
    model="gemini-3-pro-image-preview",
    input="Futuristic city.",
    generation_config={
        "image_config": {"aspect_ratio": "16:9", "image_size": "4k"}
    },
    response_modalities=["IMAGE"]
)
```
