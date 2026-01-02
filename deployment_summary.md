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

- **Functions**: Deployed to configured Firebase project/region (see `firebase.json` and environment config).
- **PR**: Feature merged into main branch.

## Error Handling & Resilience

To ensure production reliability, the following mechanisms are in place:

*   **Inngest Retries:** Automatic retries are configured for transient failures (e.g., API timeouts, network glitches) during video generation steps.
*   **Transcoder Failures:** Stitching failures are captured and logged to Firestore (`stitchError` field), setting the job status to `failed` to notify the user.
*   **Input Validation:** Strict validation prevents invalid jobs from starting (e.g., empty prompt arrays).
*   **Dead Letter Queue:** Failed Inngest events can be inspected and replayed via the Inngest dashboard.

## Monitoring & Observability

We recommend tracking the following metrics in Google Cloud Monitoring / BigQuery:

*   **Job Latency:** Time from `queued` to `completed`.
*   **Segment Generation Success Rate:** Monitor Veo API error rates.
*   **Stitching Success Rate:** Monitor Transcoder API failures.
*   **Cost Tracking:** Monitor Vertex AI and Transcoder API usage per user/organization.

## Verification

- **Functional**: Validated connection between Client -> Cloud Function -> Inngest.
- **UI**: Verified "Director" and "Editor" view toggles and status feedback via browser automation.
- **Code**: Fixed linting errors (`prefer-const`) and ensured type safety.

## Future Improvements

- **Frame Extraction**: Implement "daisychaining" logic using a dedicated frame extraction service (e.g., Cloud Run with ffmpeg) to improve segment transition smoothness.
