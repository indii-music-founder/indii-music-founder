# Implementation Plan - Perfect Video Process (Veo 3.1)

## Context

The user wants to "perfect the video process" using Veo 3.1, specifically addressing the "very high-level" implementation gaps. This involves correctly implementing the "First and Last Frame" interpolation features via the Cloud Functions layer.

## Blockers

- `VideoJobSchema` in `functions/src/lib/video.ts` is missing the `image` field, causing the Start Frame data to be stripped during validation.
- `functions/src/lib/video_generation.ts` does not construct the Vertex AI payload correctly for Veo 3.1 (missing `image` in instances, `lastFrame` in parameters, and `personGeneration`).

## Tasks

- [x] **Fix Schema**: Update `functions/src/lib/video.ts` to include `image` (start frame) in `VideoJobSchema`.
- [x] **Fix Cloud Function Logic**: Update `functions/src/lib/video_generation.ts`:
  - [x] Sanitize Base64 strings (remove data URI prefixes).
  - [x] Construct `instances` with `image: { bytesBase64Encoded: ... }` for Start Frame.
  - [x] Construct `parameters` with `lastFrame: { bytesBase64Encoded: ... }` for End Frame.
  - [x] Set `personGeneration: 'allow_adult'` when images are present.
  - [x] Ensure `aspectRatio` is propagated correctly.
- [x] **Verification**:
  - [x] Run typecheck.
  - [x] (If possible) Run unit test for the function logic.

## Goal

A production-ready Veo 3.1 implementation that supports First/Last frame interpolation.
