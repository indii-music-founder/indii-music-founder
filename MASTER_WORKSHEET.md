# Master Execution Worksheet (Think First, Work Second)

**Status:** Planning Complete → Ready for Execution  
**Philosophy:** Execute deterministically, top-to-bottom. No skipping.  
**Date:** 2026-04-24  

This worksheet consolidates all pending roadmaps and implementation plans into a single, step-by-step execution order. It prioritizes foundational stability and type safety before moving to UI polish, agent integration, and finally heavy media processing (Image/Video).

---

## Step 1: Foundational AI Refinement & Type Safety
*Source: `docs/implementation_plan_ai_refinement.md`*

**Objective:** Guarantee type safety across the application and eliminate `as any` casting, ensuring `thoughtSignature` propagates correctly for Gemini 3 continuity.

- [ ] **1.1 Update DTOs:** Edit `src/types/ai.dto.ts` (or equivalent) to include `thoughtSignature` in all content parts and streaming chunks.
- [ ] **1.2 Update AI Services:** Modify `src/services/ai/AIService.ts` and `src/services/ai/FirebaseAIService.ts` to properly inject and extract `thoughtSignature`.
- [ ] **1.3 Base Agent Updates:** Ensure `src/services/agent/BaseAgent.ts` preserves `thoughtSignature` between conversation turns and function calls.
- [ ] **1.4 Resolve Type Errors:** 
  - Fix `vite-env.d.ts` environment variable typings.
  - Harmonize `Project` interfaces between the store and dashboard.
  - Resolve IPC payload typings in distribution components.
- [ ] **1.5 Validation:** Run `npm run typecheck` and ensure 0 errors before proceeding.

---

## Step 2: Publicist Agent Binding Fixes
*Source: `docs/implementation_plan_publicist.md`*

**Objective:** Bridge the gap between the `PublicistAgent` and `PublicistService` to enable actual database modifications.

- [ ] **2.1 Agent Definition:** Open `src/services/agent/definitions/PublicistAgent.ts`.
- [ ] **2.2 Imports:** Import `PublicistService`.
- [ ] **2.3 Function Declarations:** Add `create_campaign` to `tools.functionDeclarations`.
- [ ] **2.4 Implementation:** Add the `functions` object with an implementation for `create_campaign` that calls `PublicistService.addCampaign`.
- [ ] **2.5 Refine Tools:** Ensure `write_press_release` returns structured validation rather than plain text.
- [ ] **2.6 Validation:** Manually check the Publicist Dashboard to confirm the "New Campaign" trigger routes properly.

---

## Step 3: Founders Release Design Polish
*Source: `docs/design_review_fixes_plan.md`*

**Objective:** Apply the $100M "Antigravity" premium aesthetic fixes to core dashboard components.

- [ ] **3.1 PlatformCard Polish:** Edit `src/modules/dashboard/components/PlatformCard.tsx`.
  - Reduce vertical padding to compact the grid.
  - Swap `text-green-500` checkmarks to `text-amber-500` or `text-white/80` for theme harmony.
- [ ] **3.2 AgentWorkspace Glassmorphism:** Edit `src/modules/dashboard/components/AgentWorkspace.tsx`.
  - Add `bg-white/[0.03] backdrop-blur-md` to the command input wrapper to lift it off the background.
- [ ] **3.3 FoundersCheckout Tweaks:** Edit `src/modules/founders/FoundersCheckout.tsx`.
  - Remove the aggressive viewport edge blue glow (e.g., `shadow-[inset_0_0_100px_rgba(59,130,246,0.2)]`).
  - Darken the subtext contrast (`text-gray-500` to `text-gray-400`).
- [ ] **3.4 Validation:** Run UI component tests or visually verify local rendering.

---

## Step 4: Musical Independence Branding
*Source: `implementation_plan.md`*

**Objective:** Overhaul the landing page copy to pivot away from technical jargon towards "Musical Independence" and "Sovereign Command".

- [ ] **4.1 Copy Realignment:** Edit `packages/landing/src/page.tsx`, `AgentGrid.tsx`, and `ConductorSection.tsx`.
  - Replace extraction/technical terms with "Togetherness", "Independence", and "Sovereign Command".
  - Rename the Conductor section to the "Independence Hub".
  - Update the pipeline steps to: Sonic Identity, Crew Deployment, Global Impact.
- [ ] **4.2 Asset Integration:** Capture real screenshots of the IndiiOS studio (port 4242) and inject them into `AgentGrid.tsx`, maintaining the glowing 2026 aesthetic.
- [ ] **4.3 Validation:** Restart dev servers and verify the landing page (port 3000) looks correct.

---

## Step 5: Nano Banana Image Pipeline Integration
*Source: `nano_banana_workflow_map.md`*

**Objective:** Connect the Gemini 3 Image capabilities into the Creative Studio.

- [ ] **5.1 Orchestration Config:** Implement UI toggles for Tiered Model Selection (Pro, 2, Flash), Thinking Levels, and Media Resolution.
- [ ] **5.2 Reference Tray:** Build the `Reference Image Tray` allowing up to 14 references (4 people, 10 objects).
- [ ] **5.3 Aspect Ratios & Tools:** Add support for 14 dimensional layouts, Semantic Inpainting, and Outpainting inputs.
- [ ] **5.4 API Integration:** Map these UI inputs to the image generation payload. ENSURE the previous `thoughtSignature` is passed flawlessly on multi-turn edits.

---

## Step 6: Veo 3.1 & Remotion Video Studio
*Sources: `veo_3_1_ui_plan.md` & `docs/video-studio-implementation-plan.md`*

**Objective:** Build the ultimate Video Studio combining Veo 3.1 Generative AI with Remotion programmatic editing.

- [ ] **6.1 Veo 3.1 Generation UI:** 
  - Create the `VideoStudioTab` and `IngredientDropZone` (up to 3 images/frames).
  - Create the `VideoPromptBuilder` and `VideoGenerationControls` (aspect ratio, duration).
- [ ] **6.2 Asynchronous Job Handling:** 
  - Implement the `VideoJobs` Firestore collection tracking `PENDING` to `COMPLETED` status.
  - Implement non-blocking `VideoGenerationProgress` toaster using exponential backoff polling.
- [ ] **6.3 Remotion Export Backend:** 
  - Create the `/api/video/render` endpoint using `@remotion/renderer`.
  - Add `/api/video/status/[renderId]` for local rendering progress.
- [ ] **6.4 Advanced Editor UI:**
  - Add Transition support (`fade`, `slide`) to the properties sidebar.
  - Add Visual Effects (VFX) filters (blur, grayscale, sepia).
  - Integrate `@remotion/media-utils` for rendering actual audio waveforms on the timeline.
- [ ] **6.5 Validation:** Run full E2E video generation and export test.

---

## Final Validation Protocol (The 1%)
- [ ] **Code Quality:** Run `/plat` to ensure all files meet the Platinum Quality Standards.
- [ ] **Typecheck & Lint:** `npm run build:all` must pass.
- [ ] **E2E tests:** `npm run test:e2e` to confirm no regressions.
