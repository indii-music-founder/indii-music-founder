# Task: Perfect Video Process (Veo 3.1)

## Objectives

Implement robust Veo 3.1 video generation with support for "First and Last Frame" interpolation, fixing previous high-level placeholders.

## Status

- [x] **Video Generation Infrastructure**
  - [x] Fix `VideoJobSchema` in `functions/src/lib/video.ts` to support `image` object.
  - [x] Update `functions/src/lib/video_generation.ts` to construct correct Veo 3.1 payload.
  - [x] Implement fallback support for `firstFrame` (string) and `image` (object).
  - [x] Verify build of Cloud Functions.

## Context

This task ensures that the "First and Last Frame" interpolation feature of Veo 3.1 is correctly implemented in the backend, allowing users to generate smooth transitions between two images.
