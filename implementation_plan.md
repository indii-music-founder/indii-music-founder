# Implementation Plan - Video Keyframe Architect & UX Polish

## 1. UX Improvement: Explicit Analysis State

- **Goal**: Clarify to the user *exactly* what the AI is doing (`Analyzing Scene` -> `Predicting Climax` -> `Synthesizing Image`).
- **Files**: `src/modules/creative/components/CreativeCanvas.tsx`
- **Change**: [DONE]

## 2. API Hardening: Fix Vision Analysis (400 Error)

- **Goal**: Resolve the `Invalid Argument` error in `ImageGenerationService.captionImage`.
- **Files**: `src/services/image/ImageGenerationService.ts`
- **Fix**: [DONE]

## 3. Dual-View Pipeline (Gemini 3 Image Editing)

- **Goal**: Implement high-fidelity and high-speed image editing workflows.
- **Workflow A (Pro)**: Multimodal reasoning with Binary Mask + Source Image using `gemini-3-pro-image-preview`.
- **Workflow B (Flash)**: Fast inpainting with Binary Mask + Source Image using `gemini-2.5-flash-image`.
- **Ghost Export**: Fabric.js utility to extract pure black/white masks without UI flickering.
- **File API**: Automatic fallback to Gemini File API for images >15MB to bypass payload limits.

## 4. Verification

- **Manual**: Run `npm run typecheck` and `npm run build:studio`.
- **Browser**: Verify Magic Fill with "High Fidelity" toggle ON and OFF.
