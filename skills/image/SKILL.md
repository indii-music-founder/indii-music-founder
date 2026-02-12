---
name: image
description: Expert-level guide for creating, editing, and managing AI-generated images using Gemini 3 models in indiiOS.
version: 2.0.0
last_updated: 2026-02-06
---

# Image Generation Skill (Platinum Level)

**Expert mastery of Gemini 3 image models (`gemini-3-pro-image-preview`).**

---

## 1. Core Model Capabilities

| Capability | Model | Specs |
| --- | --- | --- |
| **Text-to-Image** | `gemini-3-pro-image-preview` | High-fidelity photorealism, text rendering, diverse styles |
| **Image Editing** | `gemini-3-pro-image-preview` | Inpainting, outpainting, object swap, style transfer, color adjustment |
| **Resolution** | Up to 4K | 1:1, 16:9, 4:3, 3:4, 9:16 aspect ratios |
| **Text Rendering** | Native | Can render legible text inside images |

---

## 2. Integration Pattern

The `ImageGenerationService` handles all interactions.

### 2.1 Generating Images

```typescript
// Core generation function
await imageService.generateImage({
  prompt: "A futuristic city with flying cars and neon lights",
  aspectRatio: "16:9",
  style: "photorealistic",
  count: 1
});
```

### 2.2 Editing Images

The AI can edit existing images based on natural language instructions.

```typescript
// Editing function
await imageService.editImage(originalImageBlob, {
  prompt: "Change the sky to a sunset",
  mask: optionalMaskBlob // Optional for targeted edits
});
```

---

## 3. Prompt Engineering (Platinum Standard)

**Structure:** `[Subject] + [Action/Context] + [Art Style] + [Lighting/Mood] + [Technical Specs]`

### 3.1 Examples

- **Photorealistic:** "A close-up portrait of an elderly woman with deep wrinkles and wisdom in her eyes, natural lighting, 85mm lens, f/1.8, high detail, 8k resolution."
- **Illustration:** "A whimsical illustration of a cat reading a book in a cozy library, warm colors, soft lighting, digital art style, detailed background."
- **Cyberpunk:** "A futuristic street scene at night, neon lights, rain on pavement, flying cars, cyberpunk aesthetic, high contrast, cinematic lighting."

### 3.2 Negative Prompts

*Note: Gemini 3 handles negative constraints naturally within the main prompt, but explicit negative prompts can still be useful.*

"Avoid: blurring, distortion, low resolution, bad anatomy, extra fingers, text watermark."

---

## 4. Troubleshooting Common Issues

### 4.1 "I see a grey box"

- **Cause:** Image failed to load or generation timed out.
- **Fix:** Check network tab for `generate_image` call. Verify Firebase Storage permissions.

### 4.2 "The text is gibberish"

- **Cause:** Model struggle with complex text or small fonts.
- **Fix:** Use specific instructions: "Text 'HELLO WORLD' written clearly on a billboard." Keep text short.

### 4.3 "It ignored my style"

- **Cause:** Conflicting prompt instructions.
- **Fix:** Move style keywords to the beginning of the prompt.

### 4.4 "Generation is slow"

- **Cause:** Cold start of Cloud Functions or high model latency.
- **Fix:** Implement optimistic UI updates. Use lower resolution for previews.

---

## 5. Python Tool Implementation

The `indii_image_gen.py` tool wraps the Gemini API.

### 5.1 Basic Usage

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="A robot painting a canvas",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K")
    ),
)
```

### 5.2 Advanced Configuration

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "Edit this image to add a hat",
        types.Part.from_bytes(
            data=original_image_bytes,
            mime_type="image/png"
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
| --- | --- |
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
| --- | --- | --- |
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
| --- | --- |
| 1K | $0.134 |
| 2K | $0.134 |
| 4K | $0.24 |
| Text Input | $2/1M tokens |
