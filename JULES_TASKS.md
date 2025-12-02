# Jules Task List (Synchronicity)

This document outlines the parallel tasks assigned to "Jules" (Secondary Agent/Background Processes) to support the main development track of **indiiOS**.

## 1. Quality Assurance & Testing

* **Unit Tests for ImageService:**
  * [ ] Create `src/services/image/__tests__/ImageService.test.ts`.
  * [ ] Mock `AI.generateContent` responses for success and error cases.
  * [ ] Test `generateImages`, `remixImage`, and `generateVideo` fallback logic.
* **Component Tests:**
  * [ ] Create tests for `CreativeCanvas` using `vitest` and `react-testing-library`.
  * [ ] Mock `fabric.Canvas` to ensure initialization and disposal work correctly.
* **Electron IPC Verification:**
  * [ ] Write an E2E test (using Playwright or similar) to verify `electronAPI.getPlatform()` and `electronAPI.getAppVersion()` return correct values in the built app.

## 2. Feature Expansion (The "Spokes")

* **Music Studio:**
  * [ ] Initialize `src/modules/music/MusicStudio.tsx` with a basic layout.
  * [ ] Integrate `Tone.js` and create a basic "Synth" component with Start/Stop buttons.
  * [ ] Connect to `MusicService` (create a stub if needed).
* **Legal Dashboard:**
  * [ ] Scaffold `src/modules/legal/LegalDashboard.tsx`.
  * [ ] Create a "Contract Validator" UI with a file upload zone.
  * [ ] Mock the validation response for now.
* **Marketing Dashboard:**
  * [ ] Scaffold `src/modules/marketing/MarketingDashboard.tsx`.
  * [ ] Create a "Campaign Calendar" view using a standard calendar component.
* **Knowledge Base:**
  * [ ] Implement `src/modules/knowledge/KnowledgeBase.tsx`.
  * [ ] Create a simple "Document Upload" interface that connects to Firebase Storage.

## 3. Infrastructure & DevOps

* **CI/CD Pipeline:**
  * [ ] Create `.github/workflows/build.yml`.
  * [ ] Define steps to install dependencies, run tests, and build the Electron app for macOS/Windows/Linux.
* **Security Audit:**
  * [ ] Run `npm audit` and fix high-severity vulnerabilities.
  * [ ] Review `scripts/configure_secrets.sh` and ensure it's in `.gitignore`.
* **Bundle Optimization:**
  * [ ] Analyze the `dist/assets` folder.
  * [ ] Implement code splitting for `fabric.js` and `ffmpeg.wasm` if they are bloating the main bundle.

## 4. Refactoring & Code Quality

* **Type Safety:**
  * [ ] Review `functions/src/index.ts` and replace `any` types with proper interfaces (e.g., `GenerateVideoRequest`, `EditImageRequest`).
  * [ ] Fix `fabric` type definitions in `CreativeCanvas.tsx` to remove `@ts-ignore` or `any` casts.
* **Service Decomposition:**
  * [ ] Split `ImageService.ts` into `ImageGenerationService.ts`, `VideoGenerationService.ts`, and `EditingService.ts` if it exceeds 500 lines (currently ~660 lines).

## 5. Documentation

* **Module Documentation:**
  * [ ] Create `README.md` files in each `src/modules/*` directory explaining the module's purpose and key components.
* **API Documentation:**
  * [ ] Document the Firebase Functions endpoints (`generateVideo`, `editImage`, `creativeDirectorAgent`) using OpenAPI or simple Markdown.
