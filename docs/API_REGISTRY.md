# API Registry: Master Endpoint Map

> [!IMPORTANT]
> **Source of Truth:** This document is the master manifest for all API endpoints in the indii-music system.
> **Backend Implementation:** All Firebase functions listed here are exported from `packages/firebase/src/index.ts`.
> **Calling Convention:** The majority of these are Firebase `onCall` (Gen 1) or `onCall` (Gen 2) functions, meaning they must be invoked from the client via the Firebase Functions SDK (`httpsCallable`), not via raw HTTP `fetch()`, unless explicitly marked as HTTP (`onRequest`).

## 1. Background Jobs & Orchestration (Inngest)
These functions interface with or trigger background jobs processed by Inngest.
- **`inngestApi`**: The main webhook endpoint (`onRequest`) that Inngest calls to execute background step functions.
- **`triggerVideoJob`**: Kicks off a standard video generation job.
- **`executeVideoJob`**: The actual execution step for the video job (often called by Inngest).
- **`triggerLongFormVideoJob`**: Initiates a long-form video composition job.
- **`renderVideo`**: Orchestrates video rendering (via Remotion or other rendering engines).

## 2. Creative & AI (Genkit / Gemini)
Core generative and analysis endpoints. Payloads typically include media URLs, prompt texts, and context objects.
- **`editImage`**: Modifies an existing image through the secured Vertex AI Gemini image-editing service, with optional masks and references.
- **`analyzeAudio`**: Audio intelligence processing (YAMNet / Essentia context).
- **`generateSpeech`**: Text-to-Speech (TTS) generation (Gemini 2.5 Pro TTS / Google Cloud TTS).
- **`generateContentStream`**: Streaming content generator (likely uses Genkit/Gemini).
- **`ragProxy`**: Retrieval-Augmented Generation endpoint for searching documents.
- **`generateImageV3` / `generateVideoV3` / `generateAudioV3`**: V3 image, Veo video, and TTS gateway functions.
- **`generateOmniRemixV3`**: Authenticated Gemini Omni Flash gateway. Supports `text_to_video`, `image_to_video`, `reference_to_video`, uploaded-video `edit`, and stateful follow-up edits. Inputs are validated `gs://` URIs in the caller's creative namespace; video inputs transfer through Gemini Files, output uses URI delivery, and cost reservations are settled or voided server-side. See [GEMINI_OMNI_INTEGRATION.md](./GEMINI_OMNI_INTEGRATION.md).

### Creative media invocation examples

These are Firebase callable functions, not ordinary REST routes. In application code, prefer the existing service adapters because they upload inputs, reserve cost, validate schemas, resolve `gs://` results, and handle job state:

| Capability | Deployed callable | Preferred renderer entry point |
| --- | --- | --- |
| Text/reference-to-image | `generateImageV3` | `ImageGenerationService.generate()` |
| Image editing, masks, and annotation edits | `editImage` | `Editing.editImage()` / inline `ImageAnnotator` |
| Veo text/image/reference-to-video | `generateVideoV3` | `VideoGenerationService.generateVideo()` |
| Cancel a queued/running Veo job | `cancelVideoJob` | Creative Studio cancellation action |
| Omni video generation/remix | `generateOmniRemixV3` | `remixVideo()` in `VideoRemixService.ts` |
| Text-to-speech | `generateAudioV3` | `generateSpeech()` in `SpeechGenerator.ts` |

Direct callable access uses the authenticated Firebase Functions client:

```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const call = <Request, Response>(name: string) =>
  httpsCallable<Request, Response>(functions, name);
```

Image generation requires a server-issued cost reservation from `CostControlService.checkAndReserve()`:

```ts
const generateImage = call('generateImageV3');
const result = await generateImage({
  prompt: 'Editorial portrait under soft window light',
  model: 'fast',
  aspectRatio: '4:5',
  imageSize: '2K',
  count: 1,
  costReservationId,
});
// result.data: { jobId, resultUri, resultUris }
```

Google Search grounding is available only with `model: 'pro'`. Image Search grounding is not supported by the current GA image models. Reference inputs must first be uploaded to the signed-in user's creative namespace and passed as owned `gs://` values in `referenceUri` or `referenceUris`.

Image editing accepts either an owned Cloud Storage image URI or inline base64 from the trusted renderer adapter:

```ts
const editImage = call('editImage');
const result = await editImage({
  imageUri: 'gs://PROJECT_BUCKET/users/CURRENT_UID/creative/objects/source.png',
  maskUri: 'gs://PROJECT_BUCKET/users/CURRENT_UID/creative/objects/mask.png', // optional
  prompt: 'Replace only the masked jacket with a blue denim jacket',
  model: 'pro',
  imageSize: '2k',
});
// result.data.candidates[0].content.parts contains the edited image.
```

The inline annotation system is a usable front end for `editImage`, not a separate Cloud Function. `ImageAnnotator` collects red/blue/yellow circles and per-color instructions, then dispatches this registered agent tool payload:

```ts
await new AgentService().dispatchToolCall(
  'generalist',
  'edit_image_with_annotations',
  {
    imageId: 'generated-image-id',
    imageUrl: 'https://signed-or-public-image.example/source.png',
    maskData: 'data:image/png;base64,...', // black background, white edited regions
    annotations: [{ color: 'red', cx: 420, cy: 260, r: 80 }],
    colorPrompts: { red: 'change this jacket to blue denim' },
  },
  'original-chat-message-id',
);
```

The UI converts the circles into a binary PNG mask. The tool accepts an image data URI or an HTTPS image URL, validates and loads it, combines the mask with a spatial edit prompt, and calls `Editing.editImage()`. The customer path is: open **Inline Annotator** on a generated chat image, draw one or more circles, enter instructions for each used color, then select **Apply Edits**.

Video generation also requires a cost reservation. Veo accepts `16:9` or `9:16`; reference images are supported by Fast and Pro, not Lite:

```ts
const generateVideo = call('generateVideoV3');
const result = await generateVideo({
  prompt: 'Slow dolly toward the performer as stage lights rise',
  model: 'fast',
  aspectRatio: '16:9',
  resolution: '1080p',
  durationSeconds: 8,
  firstFrameUri: 'gs://PROJECT_BUCKET/users/CURRENT_UID/creative/objects/first-frame.png',
  costReservationId,
});
// result.data: { jobId }; observe creative_jobs/{jobId} for completion.

await call('cancelVideoJob')({ jobId: result.data.jobId });
```

Omni exposes each supported task through one callable; inputs must be owned `gs://` objects:

```ts
const generateOmni = call('generateOmniRemixV3');
await generateOmni({
  task: 'reference_to_video',
  prompt: 'Create an eight-second performance clip matching these references',
  referenceUris: ['gs://PROJECT_BUCKET/users/CURRENT_UID/creative/objects/reference.png'],
  aspectRatio: '16:9',
  durationSeconds: 8,
  costReservationId,
});
// Other task shapes: text_to_video; image_to_video + firstFrameUri;
// edit + referenceVideoUri; or stateful edit + previousInteractionId + previousJobId.
```

Text-to-speech reserves and settles its cost inside the backend; retries are idempotent when they reuse `requestId`:

```ts
const generateAudio = call('generateAudioV3');
const result = await generateAudio({
  prompt: 'Welcome to tonight’s release party.',
  voice: 'Kore',
  requestId: crypto.randomUUID(),
});
// result.data: { jobId, libraryAssetId, resultUri, mimeType }
```

All examples require a real signed-in, verified user and the normal callable security context. Never send arbitrary third-party `gs://` paths or browser API keys; media provider credentials stay in Firebase.

## 3. Touring & Logistics (Agent Spoke)
Endpoints utilized by the touring and logistics subagents.
- **`generateItinerary`**: Creates tour schedules.
- **`checkLogistics`**: Validates routing and distances.
- **`findPlaces`**: Venue and POI lookup.
- **`calculateFuelLogistics`**: Generates fuel estimates based on routing.

## 4. Marketing & Social (Agent Spoke)
Endpoints for campaign execution.
- **`executeCampaign`**: Orchestrates a marketing campaign rollout.
- **`dispatchSocialPost`**: Sends a post to connected platforms via OAuth tokens.
- **`createInfluencerBounty`**: Creates an influencer marketing bounty.

## 5. App & System Health
- **`healthCheck`**: Standard health check (returns basic 200 OK + status).
- **`healthCheckWest1`**: Regional health check for multi-region validation.

## 6. User Data & Account Management
Privacy and compliance endpoints.
- **`exportUserData`**: Compiles all user data for GDPR/CCPA requests.
- **`requestAccountDeletion`**: Triggers full data wiping procedures.
- **`enrichFanData`**: Enriches fan profiles using external data APIs (Clearbit/Apollo).

## 7. Infrastructure (GCP Management)
Administrative operations on GCP resources.
- **`listGKEClusters` / `getGKEClusterStatus` / `scaleGKENodePool`**: Google Kubernetes Engine management.
- **`listGCEInstances` / `restartGCEInstance`**: Compute Engine management.

## 8. Data & Analytics (BigQuery)
- **`executeBigQueryQuery`**: Executes a predefined or validated BQ query.
- **`getBigQueryTableSchema`**: Retrieves schema for analytics consumption.
- **`listBigQueryDatasets`**: Lists available analytics datasets.

---

## Instructions for Agents

When requested to use or debug one of these endpoints:
1. **Find the Definition:** Go to `packages/firebase/src/index.ts` to see where the function is imported from (e.g., `import { triggerVideoJob } from "./lib/video"`).
2. **Check the Schema:** Open that specific source file and look for the Zod schema or TypeScript interface defining the payload.
3. **Verify Auth:** Note if the function enforces App Check or specific authentication claims (e.g., `requireAdmin` or `validateOrgAccess`).
4. **Client Invocation:** Use `httpsCallable(functions, "functionName")` from `@/core/services/firebase` in the frontend code. Do not write raw `fetch` routes unless the endpoint is specifically an `onRequest` HTTP trigger.
