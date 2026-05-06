# Master Execution Worksheet: Advanced Improvements & Feature Completion

We use the philosophy "Think First, Work Second". This worksheet represents all the thinking, ordered sequentially for implementation. This is the exact step-by-step order we will follow. No asking where to start—we start at Phase 1, Step 1, and work down the list.

## Phase 1: AI Refinement & Type Safety (Foundational Core)

*Goal: Solidify the agentic reasoning loop and eliminate brittle type assertions before adding complex agent features.*

- [x] **1.1. Core AI Types**: Update `ai.dto.ts` to include `thoughtSignature` across all content parts and streaming chunks.
- [x] **1.2. AI Service Injection**: Modify `AIService.ts` and `FirebaseAIService.ts` to correctly extract, store, and inject `thoughtSignature` on every payload.
- [x] **1.3. Agent Continuity**: Update `BaseAgent.ts` so `thoughtSignature` propagates seamlessly across multi-turn function calls to prevent context degradation.
- [x] **1.4. Env Var Typing**: Fix environment variable typing in `vite-env.d.ts`.
- [x] **1.5. Interface Harmonization**: Unify the `Project` interfaces between the global store and dashboard modules.
- [x] **1.6. Distribution Payload Typing**: Resolve IPC payload typing in distribution components (replacing `as any`).
- [x] **1.7. Verification**: Run `npm run typecheck` and ensure exactly **0 errors**.

## Phase 2: Agent System Expansion

*Goal: Wire up the specialized agents (Publicist, Brand, Marketing, Road, Security) so they can execute actual actions against the platform services.*

- [x] **2.1. Publicist Agent**:
  - [x] Import `PublicistService` into `src/services/agent/definitions/PublicistAgent.ts`.
  - [x] Add the `functions` execution block mapping tool declarations to actual service methods.
  - [x] Implement `create_campaign` logic.
  - [x] Update `write_press_release`, `generate_crisis_response`, and `pitch_story` to return structured validation rather than plain strings.
- [x] **2.2. Brand Agent**: Implement `analyze_brand_consistency`, `generate_brand_guidelines`, and `audit_visual_assets`.
- [x] **2.3. Marketing Agent**: Implement `create_campaign_brief`, `analyze_audience`, and `schedule_content`.
- [x] **2.4. Road Agent**: Implement `plan_tour_route`, `calculate_tour_budget`, and `generate_itinerary`.
- [x] **2.5. Security Agent**: Implement `audit_permissions` and `scan_for_vulnerabilities`.
- [x] **2.6. Orchestration Update**: Enable all agents in `agentConfig.ts` and verify they register with `indii Conductor`.

## Phase 3: Video Studio Export & Veo 3.1 Integration

*Goal: Turn the Remotion prototype into a working video generator connected to Veo 3.1, complete with export capabilities.*

- [x] **3.1. Veo 3.1 API & Infrastructure**:
  - [x] Implement `generateVideoFn` in `functions/src/index.ts` connecting to Vertex AI Veo-3.1 API.
  - [x] Update `MediaGenerator.ts` to construct the `reference_images` payload array (for Ingredients-to-Video).
  - [x] Set up `VideoJobs` Firestore collection to track jobs (`PENDING` -> `COMPLETED`).
- [x] **3.2. Veo UI (Ingredients to Video)**:
  - [x] Build `VideoPromptBuilder` (auto-expanding textarea).
  - [x] Build `IngredientDropZone` (accepts up to 3 images/frames or 1 base video, glassmorphic styling, proper empty/max states).
  - [x] Build `VideoGenerationControls` (Aspect Ratio, Duration settings).
  - [x] Build `VideoGenerationProgress` (non-blocking task card with pulsing text, polling `VideoJobs`).
- [x] **3.3. Advanced Editor Features**:
  - [x] **Transitions**: Update `VideoClip` model (`transitionIn`/`Out`), implement `TransitionWrapper`, add "Transitions" UI tab.
  - [x] **VFX**: Add `effects` array to model, implement CSS/Remotion filters (Blur, Sepia, Opacity), add "Effects" UI tab.
  - [x] **Audio Visualization**: Implement `@remotion/media-utils` for waveform rendering on audio clips.
  - [x] **Keyframing**: Add basic Start/End property states (scale/opacity).
- [x] **3.4. Backend Export Engine**:
  - [x] Create `/api/video/render` endpoint utilizing `@remotion/renderer`.
  - [x] Hook "Download MP4" button to the rendering service.
  - [x] Auto-save output to `generatedHistory` globally.

## Phase 4: Product Showroom Mode

*Goal: Build the "Mockup & Move" pipeline orchestrating Gemini 3 Pro and Veo 3.1 to generate photorealistic product demos.*

- [x] **4.1. State Management**: Add `showroom` to `OperationMode` and track `productAsset`.
- [x] **4.2. UI Layout (Three Columns)**:
  - [x] **Asset Rack**: Upload dropzone for transparent PNGs, Product Type selector (T-shirt, Poster, Mug), Placement hints.
  - [x] **Scenario**: Scene description input, Motion description input, preset buttons (Runway, Urban, Minimal).
  - [x] **Stage**: Preview monitor, `Generate Mockup` button, `Animate Scene` button.
- [x] **4.3. Pipeline Orchestration**:
  - [x] Implement Stage 1: `runShowroomMockup()` using `gemini-3-pro-image-preview` with explicit *texture mapping* system instructions.
  - [x] Implement Stage 2: `runShowroomVideo()` using `veo-3.1-generate-preview`, feeding it the mockup output.

## Phase 5: Distribution System Completion

*Goal: Finalize the DDEX pipeline and Distribution Adapters.*

- [x] **5.1. DDEX / ERN Service**:
  - [x] Complete `ERNService.ts` mapping logic for contributors, resources, and deals.
  - [x] Enforce ERN 4.3 compliance for AI generated flags.
  - [x] Parse sales reports into `dsrReports` in `DSRService.ts`.
- [x] **5.2. Distributor Adapters**:
  - [x] Replace mock implementations in `TuneCoreAdapter` and `CDBabyAdapter` with actual API logic.
  - [x] Implement `DistroKidAdapter`.
  - [x] Implement `submitRelease`, `getStatus`, and `getEarnings`/`getRoyalties` methods for all adapters.
- [x] **5.3. Currency & Connection UI**:
  - [x] Implement open-exchange-rates currency conversion in `DistributorService.ts`.
  - [x] Hook up `DistributorConnectionsPanel`, `ReleaseStatusCard`, and `EarningsDashboard` UI components.

## Phase 6: Social Commerce & Revenue (Production Verified ✅)

*Goal: Unify revenue streams and enable "Social Drops".*

- [x] **6.1. Revenue Aggregation**:
  - [x] Create `src/services/RevenueService.ts` to aggregate `dsrReports` and `storeOrders`.
  - [x] Create dashboard analytics widgets: `RevenueView.tsx` and `SalesAnalytics.tsx`.
- [x] **6.2. Social Feed Commerce**:
  - [x] Update `SocialPost` schema with `productId`.
  - [x] Build an embedded `ProductCard` variant with an inline checkout flow.
  - [x] Update `SocialFeed` to render these cards directly in the timeline.
  - [x] Add a `ProductPickerModal` to the `PostComposer`.

## Phase 7: UI Polish, Kokonut UI, & Branding

*Goal: Elevate the aesthetic to Platinum 10/10 standards and align the copy.*

- [x] **7.1. shadcn / Tooling Setup**:
  - [x] Create `components.json` and standard `src/lib/utils.ts` (Tailwind merge `cn` function).
  - [x] Scaffold `src/components/ui/` atomic directory.
- [x] **7.2. Kokonut UI & Prompt Kit**:
  - [x] Replace native dropzones with Kokonut UI `file-upload` component.
  - [x] Replace the Assistant's chat textarea with Prompt Kit's `<PromptInput>`.
  - [x] Apply Motion Primitives `text-effect` to the Assistant welcome messages.
- [x] **7.3. "Musical Independence" Brand Voice**:
  - [x] Update landing page (`page.tsx`, `AgentGrid.tsx`, `ConductorSection.tsx`).
  - [x] Update landing page imagery to feature high-fidelity studio screenshots.

## Phase 8: Hierarchical Agent Modes

*Goal: Implement three conversation modes (Direct, Department, Boardroom) on top of the existing pattern stack and introduce worker agents.*

- [x] **8.1. Agent Mode Picker UI**
  - [x] Create `packages/renderer/src/components/AgentModePicker.tsx`.
  - [x] Implement a three-segment switch (Direct / Department / Boardroom).
  - [x] Direct Mode: Include an agent dropdown grouped by department (using `DEPARTMENTS` from `departments.ts`).
  - [x] Department Mode: Include a department dropdown.
  - [x] Boardroom Mode: Open existing Boardroom module (no extra selector).
  - [x] Connect picker to read/write `conversationMode`, `activeDepartmentId`, `directTargetAgentId` from `agentUISlice`.

- [x] **8.2. UI Integration**
  - [x] Mount `AgentModePicker` in the desktop CommandBar or sidebar.
  - [x] Refactor mobile agent picker (`packages/renderer/src/modules/mobile-remote/components/AgentChat.tsx`) to use the shared `AgentModePicker` component for parity.

- [x] **8.3. Agent Service Routing**
  - [x] Add `handleDepartmentFlow` method to `packages/renderer/src/services/agent/AgentService.ts`.
  - [x] In `handleDepartmentFlow`: force `forcedAgentId = dept.headId`, set `ctx.conversationMode = 'department'`, then run the head agent.
  - [x] Update `AgentService.sendMessage` to dispatch on `conversationMode` (`direct` -> `handleDirectChatFlow`, `department` -> `handleDepartmentFlow`, `boardroom` -> existing behavior).
  - [x] Verify `AgentContext` carries `conversationMode` through the runner (e.g., `ExecutionContextFactory`, `ToolExecutionContext`).

- [ ] **8.4. Manual QA (Phase 2)**
  - [ ] Direct Mode: Test Finance, ask "have legal review", verify no delegation and `DIRECT_MODE_NO_DELEGATION` error.
  - [ ] Department Mode: Test Finance dept with multi-step task, verify only finance head responds, test cross-dept to see `DEPARTMENT_SCOPE_VIOLATION`.
  - [ ] Boardroom Mode: Verify existing behavior is unchanged.

- [x] **8.5. Worker Agent Scaffold**
  - [x] Create `finance.accounting`, `finance.tax`, `finance.royalty` in `fine-tuned-models.ts` and `departments.ts`.
  - [x] Verify `AgentOrchestrator` allows head to delegate to worker but not vice versa, per pattern scope rules (from Phase 1).
  - [x] Add `roster.category = 'specialist'` and `roster.departmentId = 'finance'` to the workers' AgentCards.
  - [x] Update `DEPARTMENTS.finance.workerIds` in `departments.ts` to include them.
  - [x] Update `finance.card.ts` head card with `roster.workerIds = ['finance.tax', 'finance.royalty']`.
  - [x] Verify Department mode fan-out works (head calls `delegate_task('finance.tax', ...)`).
  - [x] Repeat for Legal, Distribution, Marketing, Brand as needed.

- [x] **8.6. Polish (Phase 4)**
  - [x] Update Boardroom UI (`BoardroomTable.tsx`) so clicking a seated head reveals their workers as a read-only inner orbit.
  - [x] Update Living Plans tracker to show worker steps under their head's plan node.
  - [x] Populate the 21 head AgentCards with real `capabilities[]` arrays based on `AgentConfig.tools` and system prompts.

- [ ] **8.7. Verification & Release**
  - [x] Run `npm run typecheck`.
  - [x] Run `npm test -- --run packages/renderer/src/services/agent/__tests__/scopeEnforcement.test.ts`.
  - [x] Run `npm test -- --run` to ensure no regressions in the full suite.
  - [x] Run `/plat` command for pre-push checklist.
  - [ ] Open a PR for `feat/hierarchical-agent-modes` (do not push to main).
