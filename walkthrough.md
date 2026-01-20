# Walkthrough: AI Service & Backend Alignment

## Overview

 This walkthrough documents the systematic alignment of the Firebase Cloud Functions backend with the `FirebaseAIService` client SDK. The goal was to resolve runtime errors caused by mismatched parameters, missing functions, and region availability issues.

## Key Changes

### 1. Backend (`functions/`)

- **`src/index.ts`**:
  - **Moved** `generateImageV3` to `us-west1` to access `gemini-3-pro-image-preview`.
  - **Implemented** `generateSpeech` function (previously missing) using the Gemini REST API for Text-to-Speech support.
- **`src/lib/audio.ts`**: Created new Zod schema `GenerateSpeechRequestSchema` to validate TTS requests.
- **`src/config/models.ts`**: Added `SPEECH` model configuration (`gemini-2.5-pro-tts`).

### 2. Frontend (`src/services/ai/`)

- **`FirebaseAIService.ts`**:
  - **Fixed** `generateImage`: The `GenerateImageBackendPayload` interface now explicitly maps nested `config.aspectRatio` and `config.numberOfImages` to the flat structure (`aspectRatio`, `count`) expected by the backend validation schema.
- **`AIService.ts`**: Confirmed correct routing of configuration options.

## Verification

- **Backend Build**: `npm run build` in `functions/` passed successfully.
- **Frontend Types**: `npm run typecheck` passed, confirming type safety of the new payload interfaces.
- **Video Logic**: Verified that `generateVideo` correctly spreads configuration options, matching the backend's expected flat structure.

## Next Steps

- **Test**: Manually verify "Generate Campaign" (Image) and "Voice" features in the UI.
- **Feature**: Consider implementing `editImage` in the frontend service if image editing UI is added later.
