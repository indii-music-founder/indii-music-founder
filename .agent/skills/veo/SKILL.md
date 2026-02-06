---
name: veo-video-expert
description: Platinum-level expert in Google Veo 3.1 for Video Generation, Understanding, Extension, and Production Workflows.
version: 2.0.0
last_updated: 2026-02-06
---

# Veo 3.1 Video Expert (Platinum Level)

**Comprehensive guidelines for Veo 3.1, Veo 3.0, video generation workflows, and production integration.**

---

## 1. Model Selection Matrix

| Model | ID | Best For | Max Resolution | Audio | Extension |
|-------|-----|----------|----------------|-------|-----------|
| **Veo 3.1** | `veo-3.1-generate-preview` | Production, 4K, best quality | 4K | ✅ Native | ✅ 20x |
| **Veo 3.1 Fast** | `veo-3.1-fast-generate-preview` | Quick iterations | 1080p | ✅ Native | ✅ 20x |
| **Veo 3.1 GA** | `veo-3.1-generate-001` | Production stable | 4K | ✅ Native | ❌ |
| **Veo 3.1 Fast GA** | `veo-3.1-fast-generate-001` | Production fast | 1080p | ✅ Native | ❌ |
| **Veo 3.0** | `veo-3.0-generate-001` | Standard generation | 1080p | ✅ Native | ❌ |
| **Veo 3.0 Fast** | `veo-3.0-fast-generate-001` | Rapid prototyping | 720p | ✅ Native | ❌ |

---

## 2. Technical Specifications

### 2.1 Output Specifications

| Parameter | Veo 3.1 | Veo 3.0 |
|-----------|---------|---------|
| **Video Lengths** | 4, 6, or 8 seconds | 4, 6, or 8 seconds |
| **Max Videos/Prompt** | 4 | 4 (preview: 2) |
| **Aspect Ratios** | `9:16`, `16:9` | `9:16`, `16:9` |
| **Resolutions** | 720p, 1080p, 4K | 720p, 1080p |
| **Frame Rate** | 24 FPS | 24 FPS |
| **Output Format** | `video/mp4` | `video/mp4` |
| **Extension Max** | 20x (141s total) | N/A |
| **Reference Images** | Up to 3 | N/A |

### 2.2 Native Audio Generation

Veo 3.1 generates **synchronized audio** including:

- Natural dialogue
- Environmental sounds
- Sound effects (SFX)
- Ambient audio

```python
config = types.GenerateVideosConfig(
    generate_audio=True,  # Enable native audio generation
    aspect_ratio="16:9",
    resolution="1080p"
)
```

---

## 3. Core Generation Workflows

### 3.1 Text-to-Video Generation

```python
from google import genai
from google.genai import types
import time

client = genai.Client()

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=(
        "Cinematic drone shot over a misty mountain range at sunrise, "
        "golden light breaking through clouds, epic orchestral music building, "
        "slow camera push forward, 4K quality"
    ),
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        resolution="1080p",
        generate_audio=True,
        number_of_videos=2,
        output_gcs_uri="gs://your-bucket/videos/"  # Optional GCS output
    ),
)

# Poll for completion
while not operation.done:
    time.sleep(15)
    operation = client.operations.get(operation)

# Access generated videos
for video in operation.response.generated_videos:
    print(f"Video URI: {video.video.uri}")
```

### 3.2 Image-to-Video Generation

```python
import base64
from google import genai
from google.genai import types

client = genai.Client()

# Load image
with open("hero_image.png", "rb") as f:
    image_data = f.read()

operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="The camera slowly pushes in while the subject turns their head and smiles",
    image=types.Image(
        data=base64.standard_b64encode(image_data).decode("utf-8"),
        mime_type="image/png"
    ),
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        resolution="1080p",
        generate_audio=True
    ),
)

# Wait for completion...
```

### 3.3 First/Last Frame Interpolation (Veo 3.1 Only)

Generate video by specifying start and end frames:

```python
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="Smooth transformation with magical particle effects",
    image=first_frame_image,  # Starting frame
    config=types.GenerateVideosConfig(
        last_frame=last_frame_image,  # Ending frame
        aspect_ratio="16:9",
        generate_audio=True
    ),
)
```

### 3.4 Reference Images ("Ingredients to Video")

Guide generation with up to 3 reference images for character/style consistency:

```python
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=(
        "The character walks through a futuristic city, "
        "maintaining the exact appearance and clothing style from the reference"
    ),
    config=types.GenerateVideosConfig(
        reference_images=[
            character_reference,
            style_reference,
            environment_reference
        ],
        aspect_ratio="16:9",
        resolution="1080p",
        generate_audio=True
    ),
)
```

---

## 4. Video Extension (Veo 3.1 Preview Only)

Extend previously generated videos up to 20 times (max 141 seconds total).

```python
# First, generate initial video
initial_operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="A butterfly lands on a flower in a sunlit garden",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        generate_audio=True
    ),
)

# Wait for initial video...
while not initial_operation.done:
    time.sleep(15)
    initial_operation = client.operations.get(initial_operation)

# Extend the video
extension_operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    video=initial_operation.response.generated_videos[0].video,  # Previous video
    prompt="The butterfly takes flight and explores more flowers",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        generate_audio=True,
        number_of_videos=1
    ),
)
```

**Extension Limits:**

- Input: Veo-generated videos only
- Max input length: 141 seconds
- Extension per call: 7 seconds
- Max extensions: 20x

---

## 5. Video Understanding (Input Analysis)

Use Gemini 3 models for video understanding with configurable resolution.

### 5.1 Token Usage per Frame

| Resolution | Tokens/Frame | Use Case |
|------------|--------------|----------|
| `media_resolution_low` | 70 | Action recognition, motion analysis |
| `media_resolution_medium` | 70 | Standard understanding |
| `media_resolution_high` | 280 | Text-heavy, OCR, fine details |

### 5.2 Video Analysis Example

```python
from google import genai
from google.genai import types

client = genai.Client(http_options={'api_version': 'v1alpha'})

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        types.Part.from_text("Describe what happens in this video in detail."),
        types.Part.from_uri(
            uri="gs://your-bucket/video.mp4",
            mime_type="video/mp4",
            media_resolution="media_resolution_medium"
        )
    ],
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high")
    ),
)

print(response.text)
```

---

## 6. Prompt Engineering for Video

### 6.1 Prompt Structure

```
[Camera Movement] + [Subject/Action] + [Environment] + [Mood/Lighting] + [Audio Cues] + [Quality Markers]
```

### 6.2 Camera Movement Keywords

| Movement | Description |
|----------|-------------|
| `drone shot` | Aerial perspective |
| `tracking shot` | Following subject |
| `push in` / `dolly in` | Moving closer |
| `pull back` / `dolly out` | Moving away |
| `pan left/right` | Horizontal rotation |
| `tilt up/down` | Vertical rotation |
| `static shot` | Fixed camera |
| `handheld` | Slight organic shake |
| `crane shot` | Vertical movement |
| `steadicam` | Smooth following |
| `zoom in/out` | Lens zoom |
| `slow motion` | Reduced speed |
| `time lapse` | Accelerated time |

### 6.3 Audio Prompt Examples

```python
# With dialogue
"Two friends having a conversation at a coffee shop, we hear their friendly chat and ambient cafe sounds"

# With sound effects
"A sports car revving its engine, tires screeching as it accelerates down a street"

# With music
"A montage of city life with upbeat electronic music building in intensity"

# Ambient
"A peaceful forest stream, birds chirping, gentle water flowing"
```

### 6.4 Quality Markers

- `cinematic quality`
- `4K resolution`
- `professional lighting`
- `film grain`
- `shallow depth of field`
- `anamorphic lens`
- `golden hour lighting`

---

## 7. TypeScript/Node.js Implementation

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ vertexai: true, project: "your-project", location: "us-central1" });

async function generateVideo(prompt: string, outputUri: string): Promise<string> {
    let operation = await ai.models.generateVideos({
        model: "veo-3.1-fast-generate-001",
        prompt: prompt,
        config: {
            aspectRatio: "16:9",
            generateAudio: true,
            outputGcsUri: outputUri
        }
    });

    // Poll until complete
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 15000));
        operation = await ai.operations.get({ name: operation.name });
    }

    if (operation.response?.generatedVideos?.[0]?.video?.uri) {
        return operation.response.generatedVideos[0].video.uri;
    }
    throw new Error("Video generation failed");
}

// Usage
const videoUri = await generateVideo(
    "A cat playing piano in a jazz club, cinematic lighting",
    "gs://your-bucket/cat_piano/"
);
console.log(`Generated video: ${videoUri}`);
```

---

## 8. Vertex AI REST API

```bash
# Generate video from text
curl -X POST "https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:predictLongRunning" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "prompt": "A robot dancing in Times Square at night"
    }],
    "parameters": {
      "aspectRatio": "16:9",
      "sampleCount": 1,
      "generateAudio": true,
      "storageUri": "gs://your-bucket/output/"
    }
  }'

# Check operation status
curl -X GET "https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/operations/${OPERATION_ID}" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

---

## 9. Best Practices

### 9.1 Generation

1. **Prompt Specificity:** Include camera, subject, environment, lighting, and audio cues
2. **Aspect Ratio:** Choose based on platform (16:9 for YouTube, 9:16 for Shorts/TikTok)
3. **Resolution:** Use 1080p for web, 4K for production/archival
4. **Audio:** Enable `generate_audio=True` for synchronized sound

### 9.2 Performance

1. **Fast Models:** Use `veo-3.1-fast-*` for prototyping
2. **GCS Output:** Specify `output_gcs_uri` for large-scale workflows
3. **Polling Interval:** 15 seconds is optimal for status checks
4. **Batch Processing:** Generate multiple videos per prompt (`number_of_videos: 4`)

### 9.3 Quality

1. **Reference Images:** Use for character/style consistency
2. **Frame Interpolation:** Specify first/last frames for precise control
3. **Extension:** Build longer narratives with video extension
4. **Upscaling:** Use 1080p → 4K workflow for cost efficiency

---

## 10. Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| **400** | Invalid aspect ratio | Use only `9:16` or `16:9` |
| **400** | Invalid resolution | Check model support (4K not on all) |
| **400** | Extension on non-Veo video | Only Veo outputs can be extended |
| **413** | Input image too large | Max 20MB for image-to-video |
| **429** | Rate limit | 50 requests/min per model |
| **503** | Service overload | Retry with exponential backoff |

---

## 11. Pricing Reference (Feb 2026)

| Model | Price |
|-------|-------|
| Veo 3.1 | See Vertex AI pricing page |
| Veo 3.0 | See Vertex AI pricing page |

*Pricing varies by resolution and length. Check the official Vertex AI pricing for current rates.*

---

## 12. Platform Availability

- **Gemini API** (Google AI Studio)
- **Vertex AI** (Google Cloud)
- **Gemini App** (Consumer)
- **YouTube Shorts** (Creator tools)
- **Flow** (Google creative tools)
- **Google Vids** (Workspace)
