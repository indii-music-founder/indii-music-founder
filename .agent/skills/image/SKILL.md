---
name: image-generation-expert
description: Platinum-level architect for Gemini 3 Pro Image (Nano Banana Pro), Imagen 3, and multimodal image workflows.
version: 2.0.0
last_updated: 2026-02-06
---

# Image Generation Expert (Platinum Level)

**Comprehensive guidelines for Gemini 3 Pro Image (Nano Banana Pro), Imagen 3, and Production Image Workflows.**

---

## 1. Model Selection Matrix

| Model | ID | Best For | Max Resolution | Max Refs |
|-------|-----|----------|----------------|----------|
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Complex reasoning, text rendering, charts, multi-turn editing | 4K (4096×4096) | 14 images |
| **Imagen 3** | `imagen-3.0-generate-002` | Photorealism, product photography, fine-tuning | 1024×1024 | N/A |
| **Imagen 3 Fast** | `imagen-3.0-fast-generate-001` | Quick iterations, prototyping | 1024×1024 | N/A |

### When to Use Which

- **Nano Banana Pro:** Text in images, infographics, charts, data visualization, brand consistency, multi-image composition, conversational editing
- **Imagen 3:** Product shots, portraits, landscapes, photorealistic scenes

---

## 2. Gemini 3 Pro Image Technical Specifications

### 2.1 Capabilities Overview

| Feature | Specification |
|---------|---------------|
| **Max Input Images** | 14 per prompt |
| **Max Input Tokens** | 65,536 |
| **Max Output Tokens** | 32,768 |
| **Inline Data Max** | 7 MB |
| **GCS Max** | 30 MB |
| **Supported Input MIME** | `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif` |
| **Knowledge Cutoff** | January 2025 |

### 2.2 Supported Aspect Ratios

```
1:1    — Social media squares, profile pictures
2:3    — Portrait photography
3:2    — Landscape photography, traditional print
3:4    — Portrait, mobile wallpapers
4:3    — Standard displays, presentations
4:5    — Instagram portrait, social media
5:4    — Large format print
9:16   — Mobile stories, vertical video
16:9   — Widescreen, presentations, YouTube
21:9   — Cinematic ultrawide
```

### 2.3 Resolution Options

| Size | Pixels (Approx) | Use Case | Price |
|------|-----------------|----------|-------|
| `1K` | 1024×1024 | Prototyping, quick tests | $0.134/image |
| `2K` | 2048×2048 | Web assets, social media | $0.134/image |
| `4K` | 4096×4096 | Print, production, hero images | $0.24/image |

---

## 3. Configuration Parameters

### 3.1 Output Configuration (`image_config`)

```python
from google.genai import types

config = types.GenerateContentConfig(
    response_modalities=["IMAGE"],  # REQUIRED for image output
    image_config=types.ImageConfig(
        aspect_ratio="16:9",
        image_size="2K",           # 1K, 2K, 4K (uppercase required)
        number_of_images=1         # 1-4 images per request
    )
)
```

### 3.2 Input Resolution for Image Understanding

```python
# Use v1alpha API for media_resolution
client = genai.Client(http_options={'api_version': 'v1alpha'})

# For detailed image analysis/editing
config = types.GenerateContentConfig(
    response_modalities=["IMAGE"],
    image_config=types.ImageConfig(aspect_ratio="1:1", image_size="2K")
)

# Set per-image resolution
image_part = types.Part.from_image(
    image_bytes,
    media_resolution="media_resolution_high"  # 1120 tokens for OCR/detail
)
```

---

## 4. Production Workflows

### 4.1 Text-to-Image Generation

```python
from google import genai
from google.genai import types
import base64

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="A futuristic Tokyo skyline at sunset with flying cars, neon signs in Japanese, 4K quality, cinematic lighting",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="21:9",
            image_size="4K"
        )
    ),
)

# Extract and save image
for part in response.candidates[0].content.parts:
    if hasattr(part, 'inline_data') and part.inline_data:
        image_data = base64.b64decode(part.inline_data.data)
        with open("tokyo_skyline.png", "wb") as f:
            f.write(image_data)
```

### 4.2 Multi-Image Composition (Up to 14 References)

```python
import base64
from google import genai
from google.genai import types

client = genai.Client()

# Load reference images
def load_image(path):
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")

ref1 = load_image("character_design.png")
ref2 = load_image("background_style.png")
ref3 = load_image("color_palette.png")

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        types.Part.from_bytes(data=base64.b64decode(ref1), mime_type="image/png"),
        types.Part.from_bytes(data=base64.b64decode(ref2), mime_type="image/png"),
        types.Part.from_bytes(data=base64.b64decode(ref3), mime_type="image/png"),
        types.Part.from_text(
            "Create a new scene using the character from image 1, "
            "the artistic style from image 2, and the color palette from image 3. "
            "The character should be standing in a fantasy forest."
        )
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="4K")
    ),
)
```

### 4.3 Conversational Editing (Strict `thoughtSignature` Required)

```python
from google import genai
from google.genai import types
import base64

client = genai.Client()

# Initial generation
response1 = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="A red sports car parked on a city street at night",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K")
    ),
)

# CRITICAL: Capture BOTH image data AND thought signature
image_part = response1.candidates[0].content.parts[0]
thought_signature = image_part.thought_signature  # MUST include in next turn

# Build history with signature
history = [
    {"role": "user", "parts": [{"text": "A red sports car parked on a city street at night"}]},
    {
        "role": "model",
        "parts": [{
            "inline_data": image_part.inline_data,
            "thought_signature": thought_signature  # REQUIRED
        }]
    },
    {"role": "user", "parts": [{"text": "Change the car color to blue and add rain effects"}]}
]

# Edit request
response2 = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=history,
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K")
    ),
)
```

### 4.4 Inpainting with Natural Language

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        types.Part.from_bytes(data=original_image_bytes, mime_type="image/png"),
        types.Part.from_text("Replace the person's hat with a golden crown")
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="2K")
    ),
)
```

---

## 5. Advanced Features

### 5.1 Google Search Grounding for Factual Images

Generate images with real-world data (weather, stocks, sports scores):

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Create an infographic showing today's stock performance for GOOGL",
    config=types.GenerateContentConfig(
        tools=[{"google_search": {}}],  # Enable grounding
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="9:16", image_size="2K")
    ),
)
```

### 5.2 Character Consistency (Up to 5 People)

```python
# Reference images of the same character
character_refs = [
    types.Part.from_bytes(data=front_view, mime_type="image/png"),
    types.Part.from_bytes(data=side_view, mime_type="image/png"),
]

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=character_refs + [
        types.Part.from_text(
            "Generate this character in a new pose: sitting at a desk and typing, "
            "maintain exact same face, hair, and clothing style"
        )
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="4:3", image_size="2K")
    ),
)
```

### 5.3 Text Rendering in Images

Nano Banana Pro excels at accurate text rendering:

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=(
        "Design a professional business card with:\n"
        "- Name: 'Dr. Sarah Chen'\n"
        "- Title: 'Chief Technology Officer'\n"
        "- Company: 'Quantum Dynamics Inc.'\n"
        "- Email: 'sarah.chen@quantumdynamics.io'\n"
        "- Phone: '+1 (555) 123-4567'\n"
        "Use a minimalist dark theme with gold accents."
    ),
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="4K")
    ),
)
```

---

## 6. Editing Commands Reference

| Command Type | Example Prompt |
|--------------|----------------|
| **Color Change** | "Change the car from red to blue" |
| **Object Swap** | "Replace the coffee cup with a glass of wine" |
| **Background Change** | "Change the background to a beach sunset" |
| **Style Transfer** | "Apply a watercolor painting style" |
| **Lighting** | "Change to dramatic sunset lighting" |
| **Time of Day** | "Change to nighttime with city lights" |
| **Camera Angle** | "Show this from a bird's eye view" |
| **Add Object** | "Add a rainbow in the sky" |
| **Remove Object** | "Remove the person in the background" |
| **Aspect Ratio Zoom** | "Zoom in on the face, maintain 16:9" |
| **Weather** | "Add falling snow to the scene" |
| **Text Add** | "Add the text 'SALE 50% OFF' in red letters" |

---

## 7. TypeScript/Node.js Implementation

```typescript
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const ai = new GoogleGenAI({});

async function generateImage(prompt: string): Promise<Buffer> {
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: prompt,
        config: {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: "16:9",
                imageSize: "2K"
            }
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.[0];
    if (imagePart?.inlineData?.data) {
        return Buffer.from(imagePart.inlineData.data, "base64");
    }
    throw new Error("No image generated");
}

// Usage
const imageBuffer = await generateImage("A cyberpunk cat DJ in a neon club");
fs.writeFileSync("cat_dj.png", imageBuffer);
```

---

## 8. Error Handling & Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| **400** | Missing `response_modalities` | Add `response_modalities=["IMAGE"]` |
| **400** | Missing thought signature (editing) | Include `thought_signature` from previous response |
| **400** | Invalid aspect ratio | Use supported ratios only |
| **400** | `image_size` lowercase | Use uppercase: `2K` not `2k` |
| **413** | Image too large | Compress or use GCS for >7MB |
| **429** | Rate limit | Implement backoff, respect quotas |

---

## 9. Best Practices

1. **Prompt Engineering:**
   - Be specific: Include subject, action, mood, lighting, camera angle, style
   - For text: Specify exact text in quotes
   - For composition: Describe spatial relationships

2. **Resolution Strategy:**
   - Development/Testing: `1K`
   - Web/Social: `2K`
   - Print/Production: `4K`

3. **Multi-Turn Editing:**
   - ALWAYS capture and return thought signatures
   - Keep conversation history complete
   - Reference previous elements explicitly

4. **Performance:**
   - Use `1K` for rapid prototyping
   - Batch similar requests
   - Cache reference images

5. **Quality Control:**
   - Generate multiple candidates (`number_of_images: 4`)
   - Use grounding for data-driven visuals
   - Iterate conversationally for refinement

---

## 10. Pricing Summary

| Resolution | Price/Image |
|------------|-------------|
| 1K | $0.134 |
| 2K | $0.134 |
| 4K | $0.24 |
| Text Input | $2/1M tokens |
