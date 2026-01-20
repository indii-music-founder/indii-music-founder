---
name: image-generation-expert
description: Use this skill when the user asks to generate images, edit photos, create assets, use "Nano Banana", or design graphics. Covers Gemini 3 Pro Image (Nano Banana Pro), Gemini 2.5 Flash Image, and Imagen 3.
---

# Google Image Generation Expert

This skill enables the agent to architect and implement image generation solutions using Google's diverse model ecosystem. It covers conversational generation, precise editing, and high-fidelity asset creation.

## 1. Model Selector & capabilities

| Model Name | Model ID | Best For | Key Features | Cost (Est.) |
| :--- | :--- | :--- | :--- | :--- |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | **Production Assets.** High-fidelity, complex logic, text rendering. | • **Thinking Process** (Reasoning before drawing)<br>• **Search Grounding** (Real-time data charts)<br>• **4K Resolution**<br>• **14 Reference Images** | ~$0.13 - $0.24 / img |
| **Nano Banana** | `gemini-2.5-flash-image` | **Speed & Iteration.** Prototyping, stickers, simple edits. | • **Fastest generation**<br>• **Conversational editing**<br>• **Inpainting** | ~$0.039 / img |
| **Imagen 3** | `imagen-3.0-generate-002` | **Photorealism.** Strict prompt adherence. | • **Highest Photorealism**<br>• **Subject Customization** (Fine-tuning on products) | ~$0.04 / img |

## 2. Technical Implementation (Unified SDK)

**Prerequisite**: All image generation requests generally require `response_modalities=["IMAGE"]` or `["TEXT", "IMAGE"]`.

### A. Nano Banana Pro (Gemini 3 Pro Image)

*Use for: Charts, Infographics with real data, 4K marketing assets.*

**Key Parameters**:

* `thinking_config`: Enable `include_thoughts=True` to see the model plan the composition.
* `tools`: Add `google_search` to ground the image in real-time facts (e.g., "Weather in Tokyo").
* `image_size`: Options: `"1K"`, `"2K"`, `"4K"` (Case sensitive).

```python
from google import genai
from google.genai import types

client = genai.Client(vertexai=True, project="YOUR_PROJECT", location="us-central1")

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Generate an infographic of the current weather in New York.",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())], # Grounding
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="4K" # Only available on Pro
        ),
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    ),
)

# Handle output
for part in response.candidates.content.parts:
    if part.thought:
        print(f"Thinking: {part.text}")
    if part.inline_data:
        image = part.as_image()
        image.save("weather_infographic.png")
```

### B. Multi-Turn Editing (Conversational)

*Use for: "Make the cat orange", "Add a hat".*

**CRITICAL**: You **MUST** pass the `thoughtSignature` returned in the previous response back to the model for the edit to work correctly.

```python
# Turn 1: Generate
chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)
response = chat.send_message("A photo of a cyberpunk city street.")

# Turn 2: Edit (SDK handles signatures automatically in chat mode)
response_edit = chat.send_message("Make it daytime and add flying cars.")
```

### C. Reference Image Blending (The "14 Image" Rule)

Gemini 3 Pro Image supports up to **14 reference images** to guide style and content.

* **Objects**: High fidelity for up to 6 distinct objects.
* **People**: Character consistency for up to 5 people.

```python
# Blending style and content
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "Create a group photo of these people in the style of the reference illustration.",
        types.Part.from_uri("gs://.../person1.png", mime_type="image/png"),
        types.Part.from_uri("gs://.../person2.png", mime_type="image/png"),
        types.Part.from_uri("gs://.../style_ref.png", mime_type="image/png"),
    ]
)
```

### D. Imagen 3 (Task-Specific Generation)

Use `imagen-3.0-generate-002` when you need strict photorealism or specific aspect ratios not supported by Gemini (like 3:4 or 4:3).

```python
response = client.models.generate_images(
    model='imagen-3.0-generate-002',
    prompt='A cinematic shot of a robot holding a red skateboard',
    config=types.GenerateImagesConfig(
        number_of_images=4,
        aspect_ratio="16:9",
        person_generation="allow_adult"
    )
)
for img in response.generated_images:
    img.image.show()
```

## 3. Advanced Workflows

### Subject Customization (Imagen Only)

Use this to insert a specific product (e.g., a specific handbag) into new scenes. This is a "Few-Shot" capability specific to Imagen on Vertex AI.

* **Format**: `Generate an image of [reference_id] on a beach.`
* **Code**: Requires `edit_image` or specialized prediction endpoints with `reference_images` payload defining `subject_type="product"`.

### Inpainting (Semantic Masking)

Instead of drawing a mask manually, use natural language with **Nano Banana**.

* **Prompt Template**: "Using the provided image, change only the [object] to [new object]. Keep everything else exactly the same."

## 4. Prompting Strategy

* **Describe, Don't List**: Unlike older models, Gemini Image models prefer narrative paragraphs over comma-separated keywords.
* **Photorealism Template**: "A photorealistic [shot type] of [subject], set in [environment]. Illuminated by [lighting], creating a [mood]. Captured with [lens details]."
* **Text Rendering**: "Create a [type of image] with the text '[text]' in a [font style]."

## 5. Troubleshooting

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| **Text is gibberish** | Using Nano Banana (Flash) for complex text. | Switch to **Nano Banana Pro** (`gemini-3-pro-image-preview`). |
| **Editing ignored** | Missing Thought Signatures (API 400 Error). | Ensure previous turn's `thoughtSignature` is passed in history. |
| **Low Resolution** | Default is 1K. | Set `image_size="2K"` or `"4K"` in `image_config` (Pro only). |
| **"I can't generate images"** | `response_modalities` missing. | Explicitly set `response_modalities=["IMAGE"]` in config. |
