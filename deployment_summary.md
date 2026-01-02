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

### 3. Architecture: Error Handling & Resilience

To ensure production reliability, we have implemented the following strategies:

- **Inngest Retries**: Inngest automatically retries failed steps (e.g., Veo API timeouts) with exponential backoff.
- **State Recovery**: Each segment generation step updates Firestore, allowing the UI to resume progress tracking even if a transient error occurs.
- **Failure Status**: If the stitching process or generation loop fails permanently, the job status is explicitly set to `failed` with an error message, triggering UI error states.
- **Transcoder API**: We handle Transcoder job creation errors; future improvements will include polling for Transcoder job failures (currently fire-and-forget).

### 4. Observability & Monitoring Strategy

We are adopting a backend-first monitoring approach:

- **Key Metrics**:
  - **Generation Latency**: Time per 5s segment (tracked via Inngest logs).
  - **Stitch Latency**: Time from generation end to final video URL.
  - **Failure Rate**: Percentage of jobs ending in `failed` status.
  - **Quota Usage**: Tracking Vertex AI and Transcoder API quota hits.
- **Logging**: All Cloud Functions use structured logging with `jobId` and `userId` context.
- **BigQuery Integration**: Future work will export `videoJobs` Firestore data to BigQuery for cost analysis and usage patterns (aligned with our "Move expensive AI to backend" learning).

### 5. Deployment

- **Functions**: Successfully deployed to `<PROJECT_ID>` (`<REGION>`).
- **PR**: Updates pushed to "Video Generation Updates" PR.

## Verification

- **Functional**: Validated connection between Client -> Cloud Function -> Inngest.
- **UI**: Verified "Director" and "Editor" view toggles and status feedback via browser automation.
- **Code**: Fixed linting errors (`prefer-const`) and ensured type safety.

## Future Improvements

- **Frame Extraction**: Implement "daisychaining" logic using a dedicated frame extraction service (e.g., Cloud Run with ffmpeg) to improve segment transition smoothness.
- **Error Handling**: Enhance auto-retry policies for the Transcoder API interactions and implement webhook/polling for Transcoder job completion.
