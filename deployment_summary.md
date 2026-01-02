# Long-Form Video Generation - Deployment & Architecture

## Overview

We have successfully transitioned the Long-Form Video Generation workflow from a client-side polling mechanism to a robust, server-side background job system using **Inngest** and **Firebase Cloud Functions**.

This update also introduces **Server-Side Video Stitching** using the Google Cloud Transcoder API, automatically combining generated video segments into a single, unified MP4 file.

## Key Changes

### 1. Server-Side Architecture (Cloud Functions)

- **Trigger**: `triggerLongFormVideoJob` (Callable Function) now initiates an Inngest event (`video/long_form.requested`) instead of handling logic directly.
- **Generation**: `generateLongFormVideoFn` (Inngest Function) handles the generation loop:
  - Generates 5-second video segments via Vertex AI (Veo).
  - Saves segments to Cloud Storage.
  - Updates Firestore (`videoJobs` collection) with progress (0-100%).
- **Stitching**: Added `stitchVideoFn` (Inngest Function):
  - Triggered automatically via `video/stitch.requested` event after generation completes.
  - Uses **Google Cloud Transcoder API** to stitch segments.
  - Updates Firestore status to `stitching` -> `completed`.

### 2. UI Updates (Video Workflow)

- **Status Tracking**: Added handling for the new `stitching` job status.
- **Progress Bar**: Implemented a real-time progress bar in the "Director" view.
- **Feedback**: Added specific status messages:
  - "Imaginating Scene..." (Generation)
  - "Stitching Masterpiece..." (Stitching)

### 3. Deployment

- **Functions**: Successfully deployed to `indiios-v-1-1` (us-central1).
- **PR**: Updates pushed to PR #304 (`conflict-resolution...`).

## Verification

- **Functional**: Validated connection between Client -> Cloud Function -> Inngest.
- **UI**: Verified "Director" and "Editor" view toggles and status feedback via browser automation.
- **Code**: Fixed linting errors (`prefer-const`) and ensured type safety.

## Future Improvements

- **Frame Extraction**: Implement "daisychaining" logic using a dedicated frame extraction service (e.g., Cloud Run with ffmpeg) to improve segment transition smoothness.
- **Error Handling**: Enhance auto-retry policies for the Transcoder API interactions.
