# Higgsfield-Inspired Video Process Checklist (Google API Edition)

This checklist is inspired by the video **"I Cancelled Higgsfield & Built This Claude Skill Instead"** by *Systems by Vic*. In the video, the creator discusses replacing a costly, rigid Higgsfield AI subscription with a modular, pay-per-use **Claude Skill** powered by various media APIs (Fal.ai, Kling 3, Flux, Topaz).

For the **indii** platform, we follow a strict **Google API-only** architecture. We replace these third-party services with native Google Cloud and Vertex AI capabilities (specifically **Veo 3.1** and **Imagen 3/4**).

This document audits our actual feature set, identifies implementation gaps, and lists verification steps to ensure our video generation is as smooth, robust, and cost-efficient as the workflow demonstrated in the video.

---

## 📊 Feature Comparison Matrix

| Feature | Video / Claude Skill Implementation | Google API Alternative | indii Status | Implementation Details / Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Model Hosting & APIs** | Fal.ai (hosting Kling 3, Flux, Topaz) | Vertex AI API / Firebase Cloud Functions (`generateVideoV3`) | **Fully Supported** | Uses Firebase Cloud Functions to proxy secure API calls to Vertex AI / Google AI Studio. |
| **Video Model** | Kling 3 / Luma / Runway | **Google Veo 3.1** (Pro, Fast, Lite) | **Fully Supported** | Integrated via `veo-3.1-generate-preview` (Pro) and `veo-3.1-fast-generate-preview` (Fast). |
| **Image Model** | Flux / Midjourney | **Google Imagen 3 / 4** | **Fully Supported** | Mapped to `imagen-4.0-generate-001` (with Search Grounding) and `imagen-3.0-generate-002`. |
| **Cost Estimation** | Displays cost/credits before execution | Credit cost calculation per second | **Backend Only** | **GAP:** `estimateVideoCost` exists in `VideoGenerationService`, but the cost is **not** displayed to the user in the UI before generation. |
| **Prompt Enrichment** | Auto-optimizes user prompts with camera & style details | Gemini 3 prompt expansion + Audio DNA | **Fully Supported** | Prompts are enriched via `enrichPrompt` (cinematography settings) and `enrichPromptWithAudioDNA` (using the song's audio mapping). |
| **Image-to-Video** | Animates a generated image | Veo `firstFrame` & `lastFrame` input | **Fully Supported** | Users can supply a custom start frame and end frame to guide the interpolation. |
| **Subject Consistency** | Face swapping & character references | Veo 3.1 `referenceImages` (consistency) | **Fully Supported** | Supports up to 3 style/character reference images mapped to Veo's reference inputs. |
| **Stitching (Long Form)** | Sequentially generates and links clips | `generateLongFormVideo` daisychain | **Fully Supported** | Backend splits long durations into 8s segments and stitches them using Cloud Functions. |
| **Image Compression** | Auto-compresses reference files if too large | HTML5 Canvas resize (`CloudStorageService`) | **Partial** | **GAP:** Image compression is used in direct image generation, but **not** inside `CreativeStorageService` for reference images. |
| **Upscaling** | Topaz video upscaler | Veo 3.1 Pro native 1080p/4K | **Fully Supported** | Users select high-definition resolution directly, rendered natively by Veo 3.1 Pro. |

---

## 🛠️ Detailed Checklist & Quality Standards

### 1. Cost & Credit Estimation (Cost Control)
To match the video's cost-consciousness and prevent accidental credit burn:
- [ ] **UI Cost Representation:** Display the estimated cost in the UI (e.g. `ReviewStep.tsx`) before the user clicks "Generate Video".
  - *Pricing Metrics:* Fast model = $0.10/sec, Pro model = $0.40/sec.
  - *Formula:* `Duration (seconds) * Rate`.
- [ ] **Auto-Quota Gate:** Check user subscription tier limits and remaining video generation minutes before queuing the job.
- [ ] **Circuit Breaker:** Block generation if consecutive API failures exceed 5 within a 1-minute window to avoid burning credits on broken requests.

### 2. Prompt Enrichment & Cinematography (Creative Guidance)
To ensure high-quality cinematic results without requiring professional prompting:
- [ ] **Prompt Enhancement Tag:** Support prefixing prompt-level directives (e.g. `[Think CINEMATIC PHYSICS & CONTINUITY]`) for high thinking models.
- [ ] **Audio DNA Mapping:** Inject physical descriptors matching the song's timbre, tempo, and mood into the prompt.
- [ ] **Camera Movements:** Support camera settings (`pan`, `dolly`, `zoom`, `dynamic`) and automatically append them to the prompt.
- [ ] **Audio Muting Workaround:** Append silent video negative prompts (`(no sound effects)`, `(muted)`) when `generateAudio` is disabled, since Veo 3.1 has no native audio toggle.

### 3. Visual Guidance (Image-to-Video & Subject Consistency)
To achieve smooth scene animation and character continuity:
- [ ] **Interpolation Guidance:** Allow the user to specify both `firstFrame` and `lastFrame` reference URIs.
- [ ] **Style/Subject Reference:** Provide up to 3 reference images (style or subject refs) for consistent character generation.
- [ ] **Thin-Client Boundary Enforcement:** Automatically upload reference files to Firebase Cloud Storage, returning `gs://` URIs. Avoid sending massive base64 payloads through HTTPS callable connections.

### 4. File Size Safety & Compression (Robustness)
To prevent API payload rejections from large files:
- [ ] **Pre-Flight Compression:** Resize reference images using HTML5 canvas before uploading. If width or height exceeds 2048px, downscale while keeping the aspect ratio.
- [ ] **Format Validation:** Verify that all uploaded references are valid formats (`JPEG`, `PNG`, `WebP`).

### 5. Multi-Clip Stitching (Daisy Chaining)
To support music videos and Spotify Canvases longer than 8 seconds:
- [ ] **Segment Splitting:** Automatically divide long requests into multiple consecutive 8s segments.
- [ ] **Frame Chaining:** Feed the end frame of segment $N$ as the start frame of segment $N+1$ to ensure seamless flow.
- [ ] **Stitching Pipeline:** Call the cloud-based stitcher function once all segments are compiled.

---

## 📈 Roadmap for Gaps (Next Action Steps)

### Gap 1: UI Cost Display
*Add estimated price/credit consumption warning directly to the generate button on `ReviewStep.tsx`.*
```tsx
const rate = studioControls.model === 'pro' ? 0.40 : 0.10;
const cost = studioControls.duration * rate;
// Render: "Generate Video (Est. Cost: $X.XX)"
```

### Gap 2: Reference Image Auto-Compression
*Ensure `CreativeStorageService.uploadReferenceMedia` compresses raw base64 and File images using `CloudStorageService.compressImage` before uploading to Storage to save bandwidth and storage limits.*
```typescript
if (mediaType === 'image') {
    const compressed = await CloudStorageService.compressImage(rawDataUri);
    // Upload compressed.blob instead of raw bytes
}
```
