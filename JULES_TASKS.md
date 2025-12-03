# Jules Task List (Synchronicity)

This document outlines the parallel tasks assigned to "Jules" (Secondary Agent/Background Processes) to support the main development track of **indiiOS**.

## 1. Quality Assurance & Testing

* **Unit Tests for ImageService:**
  * [x] Create `src/services/image/__tests__/ImageService.test.ts`.
  * [x] Mock `AI.generateContent` responses for success and error cases.
  * [x] Test `generateImages`, `remixImage`, and `generateVideo` fallback logic.
* **Component Tests:**
  * [x] Create tests for `CreativeCanvas` using `vitest` and `react-testing-library`.
  * [x] Mock `fabric.Canvas` to ensure initialization and disposal work correctly.
* **Electron IPC Verification:**
  * [x] Write an E2E test (using Playwright or similar) to verify `electronAPI.getPlatform()` and `electronAPI.getAppVersion()` return correct values in the built app.

## 2. Feature Expansion (The "Spokes")

* **Music Studio:**
  * [x] Initialize `src/modules/music/MusicStudio.tsx` with a basic layout.
  * [x] Integrate `Tone.js` and create a basic "Synth" component with Start/Stop buttons.
  * [x] Connect to `MusicService` (create a stub if needed).
* **Legal Dashboard:**
  * [x] Scaffold `src/modules/legal/LegalDashboard.tsx`.
  * [x] Create a "Contract Validator" UI with a file upload zone.
  * [x] Mock the validation response for now.
* **Marketing Dashboard:**
  * [x] Scaffold `src/modules/marketing/MarketingDashboard.tsx`.
  * [x] Create a "Campaign Calendar" view using a standard calendar component.
* **Knowledge Base:**
  * [x] Implement `src/modules/knowledge/KnowledgeBase.tsx`.
  * [x] Create a simple "Document Upload" interface that connects to Firebase Storage.

## 3. Infrastructure & DevOps

* **CI/CD Pipeline:**
  * [x] Create `.github/workflows/build.yml`.
  * [x] Define steps to install dependencies, run tests, and build the Electron app for macOS/Windows/Linux.
* **Security Audit:**
  * [x] Run `npm audit` and fix high-severity vulnerabilities.
  * [x] Review `scripts/configure_secrets.sh` and ensure it's in `.gitignore`.
* **Bundle Optimization:**
  * [x] Analyze the `dist/assets` folder.
  * [x] Implement code splitting for `fabric.js` and `ffmpeg.wasm` if they are bloating the main bundle.

## 4. Refactoring & Code Quality

* **Type Safety:**
  * [x] Review `functions/src/index.ts` and replace `any` types with proper interfaces (e.g., `GenerateVideoRequest`, `EditImageRequest`).
  * [x] Fix `fabric` type definitions in `CreativeCanvas.tsx` to remove `@ts-ignore` or `any` casts.
* **Service Decomposition:**
  * [x] Split `ImageService.ts` into `ImageGenerationService.ts`, `VideoGenerationService.ts`, and `EditingService.ts` if it exceeds 500 lines (currently ~660 lines).

## 5. Documentation

* **Module Documentation:**
  * [x] Create `README.md` files in each `src/modules/*` directory explaining the module's purpose and key components.
* **API Documentation:**
  * [x] Document the Firebase Functions endpoints (`generateVideo`, `editImage`, `creativeDirectorAgent`) using OpenAPI or simple Markdown.
