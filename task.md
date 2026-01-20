# Task: AI Service & Backend Alignment

## Objectives

Ensure the backend Firebase Cloud Functions are perfectly aligned with the `FirebaseAIService.ts` frontend client. Fix parameter mismatches, missing functions, and region configuration issues to enable robust AI generation features (Image, Video, Speech).

## Status

- [x] **Image Generation (`generateImage`)**
  - [x] Move Cloud Function to `us-west1` for `gemini-3-pro-image-preview` availability.
  - [x] Fix parameter mismatch: Frontend now correctly maps nested `config` (aspectRatio, count) to the flat payload expected by the backend.
- [x] **Speech Generation (`generateSpeech`)**
  - [x] Diagnose missing backend function (Frontend call existed, backend implementation was absent).
  - [x] Implement `generateSpeech` Cloud Function using robust REST API pattern for Gemini TTS.
  - [x] Create `functions/src/lib/audio.ts` with Zod validation schema.
- [x] **Video Generation (`generateVideo`)**
  - [x] Verify alignment of `triggerVideoJob` parameters (Verified: Spread syntax handles flattening correctly).
- [x] **Verification**
  - [x] `npm run build` (Functions) - PASSED
  - [x] `npm run typecheck` (Frontend) - PASSED

## Context

This task resolves critical 500/404 errors in AI features by ensuring the contract between client and server is strictly honored.
