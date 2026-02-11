---
name: Video Generation Skill (Veo 3.1)
description: Expert mastery of Veo 3.1 (Gemini 3) video generation models.
version: 2.0.0
last_updated: 2026-02-06
---

# Video Generation Skill (Platinum Level)

**Expert mastery of Google's Veo 3.1 video generation model.**

---

## 1. Core Model Capabilities

| Capability | Model | Specs |
|---|---|---|
| **Text-to-Video** | `veo-3.1-generate-preview` | High-fidelity, cinematic quality, 24/30/60 fps |
| **Video Extension** | `veo-3.1-generate-preview` | Extend Veo videos up to 20x (max 141s total) |
| **Resolution** | 1080p, 4K (Upscaled) | `16:9`, `9:16` aspect ratios |
| **Audio** | Native | Synchronized audio generation support |

**Fast Model:** `veo-3.1-fast-generate-001` (lower latency, good for prototyping)

---

## 2. Python Implementation (Vertex AI SDK)

> **Note:** Veo is primarily accessed via Vertex AI SDK.

```python
import time
from vertexai.preview.vision import VideoGenerationModel

def generate_video(prompt: str, output_path: str):
    model = VideoGenerationModel.from_pretrained("veo-3.1-generate-preview")
    
    print(f"Generating video for: {prompt}")
    
    response = model.generate_video(
        prompt=prompt,
        aspect_ratio="16:9",
        add_audio=True,
        person_generation="allow_adult"
    )
    
    # Save to file
    with open(output_path, "wb") as f:
        f.write(response.video_bytes)
    
    print(f"Video saved to {output_path}")

# Usage
generate_video(
    "A cinematic drone shot of a futuristic neon city at night, rain falling, synthwave vibe",
    "output_video.mp4"
)
```

---

## 3. Google Gen AI SDK (Unified)

```python
from google import genai
from google.genai import types

client = genai.Client(http_options={'api_version': 'v1alpha'})

# Text-to-Video
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="A cute red panda eating bamboo in a misty forest, 4k resolution, cinematic lighting",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        generate_audio=True
    ),
)

print("Waiting for video generation...")
# Poll for completion
while not operation.done:
    time.sleep(10)
    operation = client.operations.get(operation)

video = operation.response.generated_videos[0].video
print(f"Video URI: {video.uri}")
```

### 3.1 Frame Selection (Start/End Frames)

Control the exact visual flow by providing start and/or end frame images.

```python
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="A transformation from day to night in a timelapse style",
    config=types.GenerateVideosConfig(
        image_start=types.Image(uri="gs://bucket/day_frame.png"),
        image_end=types.Image(uri="gs://bucket/night_frame.png"),
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
