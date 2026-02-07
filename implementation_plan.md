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
- [x] Browser: Verify Magic Fill with "High Fidelity" toggle ON and OFF.

## 5. AI Verification & Persistence Hardening

- **Goal**: Ensure production reliability for AI services and Metadata saving.
- **Problem**: `AI Verification Failed` due to missing `VITE_FIREBASE_API_KEY` in prod env & `react-hot-toast` circular deps.
- **Solution (AI)**:
  - [x] Implement Fallback Mode in `FirebaseAIService.ts`.
  - [x] Add env var fallback (`VITE_API_KEY`) in `env.ts`.
  - [x] Improve error messaging for Fallback failures.
- **Solution (Persistence)**:
  - [x] Create `MetadataPersistenceService` (Lazy singleton).
  - [x] Use `EventBus` ('SYSTEM_ALERT') for UI feedback.
  - [x] Add Offline Queue support (indexedDB).
40:
41: ## 6. Image Upload Stability & Tracing Resolution
42:
43: - **Goal**: Resolve background hangs during image compression and prevent "Permission Denied" errors during trace persistence.
44: - **Fix (Compression)**:
45:   - [x] Add 30s timeout safety to `CloudStorageService.compressImage`.
46:   - [x] Enforce `crossOrigin = 'anonymous'` for all image loads to prevent tainted canvas SecurityErrors.
47: - **Fix (Persistence)**:
48:   - [x] Re-enable `smartSave` in `ImageGenerationService` with robust try/catch fallback.
49:   - [x] Fallback to local high-compression if Cloud Storage fails (avoids 1MB Firestore limit).
50: - **Fix (Tracing)**:
51:   - [x] Resolve UID asynchronously from `useStore` in `AgentExecutor` if `auth.currentUser` is null.
52: - **Infra**:
53:   - [x] Applied CORS policy to `gs://indiios-alpha-electron/` bucket.
