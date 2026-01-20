# Implementation Plan - Perfect Video Process (Veo 3.1)

## Context

The user wants to "perfect the video process" using Veo 3.1, specifically addressing the "very high-level" implementation gaps. This involves correctly implementing the "First and Last Frame" interpolation features via the Cloud Functions layer.

## Blockers

- `VideoJobSchema` in `functions/src/lib/video.ts` is missing the `image` field, causing the Start Frame data to be stripped during validation.
- `functions/src/lib/video_generation.ts` does not construct the Vertex AI payload correctly for Veo 3.1 (missing `image` in instances, `lastFrame` in parameters, and `personGeneration`).

## Tasks

- [ ] **Fix Schema**: Update `functions/src/lib/video.ts` to include `image` (start frame) in `VideoJobSchema`.
- [ ] **Fix Cloud Function Logic**: Update `functions/src/lib/video_generation.ts`:
  - [ ] Sanitize Base64 strings (remove data URI prefixes).
  - [ ] Construct `instances` with `image: { bytesBase64Encoded: ... }` for Start Frame.
  - [ ] Construct `parameters` with `lastFrame: { bytesBase64Encoded: ... }` for End Frame.
  - [ ] Set `personGeneration: 'allow_adult'` when images are present.
  - [ ] Ensure `aspectRatio` is propagated correctly.
- [ ] **Verification**:
  - [ ] Run typecheck.
  - [ ] (If possible) Run unit test for the function logic.

## Goal

A production-ready Veo 3.1 implementation that supports First/Last frame interpolation.
