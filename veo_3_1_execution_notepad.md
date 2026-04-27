# Veo 3.1 Platinum Execution Notepad

This document serves as the master, step-by-step execution plan for achieving a 10/10 Platinum integration of the Veo 3.1 capabilities (Ingredients-to-Video, Scene Extension, Frame Transitions) into the indiiOS Creative Studio.

## Phase 1: Core State & Type Architecture
- [ ] **Audit & Update `schemas.ts`:**
  - Verify `VideoGenerationOptionsSchema` supports all required Veo 3.1 features: `aspectRatio` (16:9, 9:16, 1:1), `duration` (4s, 8s), and `cameraMovement`.
  - Ensure support for `referenceImages` (up to 3), `baseVideo` (for scene extension), and `transitionFrames` (start/end).
- [ ] **Enhance `creativeControlsSlice.ts`:**
  - Ensure Zustand state handles the new Veo-specific configurations seamlessly.
  - Add state for managing active background video generation jobs (e.g., `activeVideoJobs: Record<string, VideoJobStatus>`).

## Phase 2: The Non-Blocking Task System & Background Polling
- [ ] **Refactor `useDirectGeneration.ts`:**
  - Decouple the UI from the synchronous `generateVideo` block. Remove the global blocking `isGenerating` state for video.
  - Upon submission, queue the job and receive a `jobId`.
- [ ] **Implement Polling/Subscription Loop:**
  - Utilize `VideoGenerationService.subscribeToJob(jobId)` (or implement exponential backoff polling against Firestore `VideoJobs` collection).
  - Sync the active job status to the Zustand store so the UI can reflect real-time progress (PENDING, PROCESSING, COMPLETED, FAILED).

## Phase 3: Platinum UI Components (The "Task Card")
- [ ] **Build `VideoGenerationProgress.tsx`:**
  - Create a dedicated, non-blocking Task Card component for active video generations.
  - **Aesthetics:** Glassmorphism, smooth Framer Motion layout transitions.
  - **Feedback:** Clear "Generating..." pulsing text, progress estimation (2-4 minutes).
  - **Error States:** Explicit explanations (e.g., "Safety Violation", "Rate Limit") with an actionable "Retry" button.
- [ ] **Integrate Task Cards into Layout:**
  - Display active jobs in a sidebar or toaster layout so the user can continue ideating or generating images concurrently.

## Phase 4: Creative Controls & Drop Zones
- [ ] **Upgrade `IngredientDropZone.tsx`:**
  - Add specific modes: "Reference Images" (max 3), "Base Video" (Scene Extension), and "Transition Frames".
  - Implement warm empty states ("Drag up to 3 reference images here...") and distinct "full" states.
  - Add keyboard navigation (accessibility) and strict validation (file format, size limits < 10MB).
- [ ] **Build `VeoSettingsDropdown.tsx` / `VideoGenerationControls`:**
  - Create sleek, unobtrusive controls for Aspect Ratio and Duration.
  - Ensure these controls sync perfectly with the primary `VideoPromptBuilder`.

## Phase 5: Assembly, Polish & Validation
- [ ] **Final Layout Assembly:**
  - Integrate all components into the `VideoStudioTab` / `DirectGenerationTab`.
  - Add skeleton loaders for the video player space before generation completes.
- [ ] **Micro-animations & Aesthetics Review:**
  - Verify all interactions feel premium and adhere to the Platinum standards.
- [ ] **Execute `/plat` Protocol:**
  - Run the complete CI validation, type-checking, and ESLint sweeps to ensure 100% compliance with repository standards.
