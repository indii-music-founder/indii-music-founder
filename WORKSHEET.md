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

- [ ] **2.1. Publicist Agent**:
  - [ ] Import `PublicistService` into `src/services/agent/definitions/PublicistAgent.ts`.
  - [ ] Add the `functions` execution block mapping tool declarations to actual service methods.
  - [ ] Implement `create_campaign` logic.
  - [ ] Update `write_press_release`, `generate_crisis_response`, and `pitch_story` to return structured validation rather than plain strings.
- [ ] **2.2. Brand Agent**: Implement `analyze_brand_consistency`, `generate_brand_guidelines`, and `audit_visual_assets`.
- [ ] **2.3. Marketing Agent**: Implement `create_campaign_brief`, `analyze_audience`, and `schedule_content`.
- [ ] **2.4. Road Agent**: Implement `plan_tour_route`, `calculate_tour_budget`, and `generate_itinerary`.
- [ ] **2.5. Security Agent**: Implement `audit_permissions` and `scan_for_vulnerabilities`.
- [ ] **2.6. Orchestration Update**: Enable all agents in `agentConfig.ts` and verify they register with `indii Conductor`.

## Phase 3: Video Studio Export & Veo 3.1 Integration
*Goal: Turn the Remotion prototype into a working video generator connected to Veo 3.1, complete with export capabilities.*

- [ ] **3.1. Veo 3.1 API & Infrastructure**:
  - [ ] Implement `generateVideoFn` in `functions/src/index.ts` connecting to Vertex AI Veo-3.1 API.
  - [ ] Update `MediaGenerator.ts` to construct the `reference_images` payload array (for Ingredients-to-Video).
  - [ ] Set up `VideoJobs` Firestore collection to track jobs (`PENDING` -> `COMPLETED`).
- [ ] **3.2. Veo UI (Ingredients to Video)**:
  - [ ] Build `VideoPromptBuilder` (auto-expanding textarea).
  - [ ] Build `IngredientDropZone` (accepts up to 3 images/frames or 1 base video, glassmorphic styling, proper empty/max states).
  - [ ] Build `VideoGenerationControls` (Aspect Ratio, Duration settings).
  - [ ] Build `VideoGenerationProgress` (non-blocking task card with pulsing text, polling `VideoJobs`).
- [ ] **3.3. Advanced Editor Features**:
  - [ ] **Transitions**: Update `VideoClip` model (`transitionIn`/`Out`), implement `TransitionWrapper`, add "Transitions" UI tab.
  - [ ] **VFX**: Add `effects` array to model, implement CSS/Remotion filters (Blur, Sepia, Opacity), add "Effects" UI tab.
  - [ ] **Audio Visualization**: Implement `@remotion/media-utils` for waveform rendering on audio clips.
  - [ ] **Keyframing**: Add basic Start/End property states (scale/opacity).
- [ ] **3.4. Backend Export Engine**:
  - [ ] Create `/api/video/render` endpoint utilizing `@remotion/renderer`.
  - [ ] Hook "Download MP4" button to the rendering service.
  - [ ] Auto-save output to `generatedHistory` globally.

## Phase 4: Product Showroom Mode
*Goal: Build the "Mockup & Move" pipeline orchestrating Gemini 3 Pro and Veo 3.1 to generate photorealistic product demos.*

- [ ] **4.1. State Management**: Add `showroom` to `OperationMode` and track `productAsset`.
- [ ] **4.2. UI Layout (Three Columns)**:
  - [ ] **Asset Rack**: Upload dropzone for transparent PNGs, Product Type selector (T-shirt, Poster, Mug), Placement hints.
  - [ ] **Scenario**: Scene description input, Motion description input, preset buttons (Runway, Urban, Minimal).
  - [ ] **Stage**: Preview monitor, `Generate Mockup` button, `Animate Scene` button.
- [ ] **4.3. Pipeline Orchestration**:
  - [ ] Implement Stage 1: `runShowroomMockup()` using `gemini-3-pro-image-preview` with explicit *texture mapping* system instructions.
  - [ ] Implement Stage 2: `runShowroomVideo()` using `veo-3.1-generate-preview`, feeding it the mockup output.

## Phase 5: Distribution System Completion
*Goal: Finalize the DDEX pipeline and Distribution Adapters.*

- [ ] **5.1. DDEX / ERN Service**:
  - [ ] Complete `ERNService.ts` mapping logic for contributors, resources, and deals.
  - [ ] Enforce ERN 4.3 compliance for AI generated flags.
  - [ ] Parse sales reports into `dsrReports` in `DSRService.ts`.
- [ ] **5.2. Distributor Adapters**:
  - [ ] Replace mock implementations in `TuneCoreAdapter` and `CDBabyAdapter` with actual API logic.
  - [ ] Implement `DistroKidAdapter`.
  - [ ] Implement `submitRelease`, `getStatus`, and `getEarnings`/`getRoyalties` methods for all adapters.
- [ ] **5.3. Currency & Connection UI**:
  - [ ] Implement open-exchange-rates currency conversion in `DistributorService.ts`.
  - [ ] Hook up `DistributorConnectionsPanel`, `ReleaseStatusCard`, and `EarningsDashboard` UI components.

## Phase 6: Social Commerce & Revenue
*Goal: Unify revenue streams and enable "Social Drops".*

- [ ] **6.1. Revenue Aggregation**:
  - [ ] Create `src/services/RevenueService.ts` to aggregate `dsrReports` and `storeOrders`.
  - [ ] Create dashboard analytics widgets: `RevenueView.tsx` and `SalesAnalytics.tsx`.
- [ ] **6.2. Social Feed Commerce**:
  - [ ] Update `SocialPost` schema with `productId`.
  - [ ] Build an embedded `ProductCard` variant with an inline checkout flow.
  - [ ] Update `SocialFeed` to render these cards directly in the timeline.
  - [ ] Add a `ProductPickerModal` to the `PostComposer`.

## Phase 7: UI Polish, Kokonut UI, & Branding
*Goal: Elevate the aesthetic to Platinum 10/10 standards and align the copy.*

- [ ] **7.1. shadcn / Tooling Setup**:
  - [ ] Create `components.json` and standard `src/lib/utils.ts` (Tailwind merge `cn` function).
  - [ ] Scaffold `src/components/ui/` atomic directory.
- [ ] **7.2. Kokonut UI & Prompt Kit**:
  - [ ] Replace native dropzones with Kokonut UI `file-upload` component.
  - [ ] Replace the Assistant's chat textarea with Prompt Kit's `<PromptInput>`.
  - [ ] Apply Motion Primitives `text-effect` to the Assistant welcome messages.
- [ ] **7.3. "Musical Independence" Brand Voice**:
  - [ ] Update landing page (`page.tsx`, `AgentGrid.tsx`, `ConductorSection.tsx`).
  - [ ] Replace jargon with "Independence Hub", "Sonic Identity", and "Sovereign Command".
  - [ ] Update landing page imagery to feature high-fidelity studio screenshots.
