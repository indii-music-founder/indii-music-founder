# Implementation Plan - Video Keyframe Architect & UX Polish

## 1. UX Improvement: Explicit Analysis State

- **Goal**: Clarify to the user *exactly* what the AI is doing (`Analyzing Scene` -> `Predicting Climax` -> `Synthesizing Image`).
- **Files**: `src/modules/creative/components/CreativeCanvas.tsx`
- **Change**:
  - Introduce a `processingStage` state (`idle` | `analyzing` | `synthesizing`).
  - Pass this state to `CanvasHeader` to display granular toast/status updates.

## 2. API Hardening: Fix Vision Analysis (400 Error)

- **Goal**: Resolve the `Invalid Argument` error in `ImageGenerationService.captionImage`.
- **Files**: `src/services/image/ImageGenerationService.ts`
- **Fix**:
  - Verify `AI.generateContent` payload structure matches SDK v1.55+ requirements.
  - Ensure `AI_MODELS.TEXT.AGENT` supports Vision/Multimodal input (it might be text-only). Switch to a model confirmed for vision if needed (e.g. `gemini-1.5-pro` or the specific preview alias).
  - `THINKING` config might be incompatible with Vision queries on some models.

## 3. Verification

- **Manual**: Run the `Create Last Frame` flow again via Browser Subagent.
