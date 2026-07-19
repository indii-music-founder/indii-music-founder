# Video Studio Implementation Brief

This brief is the repo-native version of the Veo 3.x sketch. It exists to keep future work aligned with the actual indii stack:

- Renderer: `packages/renderer`
- Backend: `packages/firebase`
- Shared types/schemas: `packages/shared`
- Playback layer: `video.js`
- Render/composition layer: Remotion

## Keep

- `video.js` as the playback and buffering layer for the Video Studio surface.
- Firestore-backed async job orchestration for video generation.
- Owner-scoped Storage for inputs, masks, outputs, thumbnails, and scratch artifacts.
- A hybrid retention model:
  - temp intermediates expire after 24 hours;
  - project assets persist until project/user deletion.
- Strict video job statuses and durable metadata on the job document.
- 24 FPS temporal math as the default director contract.
- A dedicated worker path for FFmpeg-based frame extraction if/when that lands.

## Adapt

- Do not use `next` or `src/components` paths from the sketch.
- Do not add a second backend platform unless the deployment plan changes deliberately.
- Treat `/jobs/{jobId}` examples as architecture only; in this repo, use the canonical video job collection already wired in the renderer/backend bridge.
- Keep storage paths owner-scoped and repo-native.

## Current canonical paths

- Video playback component: `packages/renderer/src/modules/creative/video/components/VideoStage.tsx`
- Video.js wrapper: `packages/renderer/src/modules/creative/video/components/VideoJsPlayer.tsx`
- Client job listener: `packages/renderer/src/services/video/VideoGenerationService.ts`
- Backend video gateway: `packages/firebase/src/functions/creative/gateway.ts`
- Firestore job schema: `packages/shared/src/schemas/videoJob.ts`
- Creative storage helper: `packages/renderer/src/services/creative/CreativeStorageService.ts`

## Storage shape

- Temp video assets: `creative/{userId}/video/tmp/{sessionId}/...`
- Project-scoped assets: `creative/{userId}/projects/{projectId}/...`
- Owner vault assets: `users/{userId}/vault/{scope}/...`
- Temp cleanup worker: `packages/firebase/src/devops/storageMaintenance.ts` (`cleanupExpiredVideoTemps`)

## Creative route isolation

- Creative Studio routes `/creative` and `/creative/**` are scoped in `firebase.json` to:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- This is the route intended for worker-backed frame extraction and any future `SharedArrayBuffer`-dependent media tooling.

## Job shape

The current canonical job document should carry:

- `id`
- `schemaVersion`
- `userId`
- `orgId`
- `projectId`
- `sessionId`
- `mode`
- `status`
- `progress`
- `prompt`
- `payload`
- `directorSettings`
- `inputUris`
- `tempUris`
- `persistentUris`
- `maskMetadata`
- `operationName`
- `provider`
- `model`
- `costEstimate`
- `costReservationId`
- `retryCount`
- `error`
- `createdAt`
- `updatedAt`
- `completedAt`
- `cancelledAt`

## Do not reintroduce

- A new Next.js app scaffold.
- Browser-side base64 video payloads in callable bodies.
- Unscoped `sessions/{sessionId}` asset paths.
- A second job collection without a bridge plan.
- Hand-rolled media buffering in place of `video.js`.
