# indiiOS Production Work Order

**Phase 1 — Ship Blockers + Critical Quality**

**Generated:** 2026-03-26 | **Source:** CEO Deep-Dive Review | **For:** Execution Agents

> Every item is equal priority — features, repairs, and upgrades. Build agents should pick up sections independently.
>
> **Phase 2** (ongoing improvements) is in a separate document: [PRODUCTION_WORK_ORDER_PHASE2.md](./PRODUCTION_WORK_ORDER_PHASE2.md)

> [!IMPORTANT]
> **Stripe Policy (CEO Directive):** Stripe integration stays in **Test Mode only**. Do NOT configure live keys or process real payments until explicitly authorized.

---

## WO-1: Shell Modules — Flesh Out or Gate

7 modules exist in the sidebar but have minimal UI. Each needs either a full implementation or a visibility gate (hide until ready).

| Module | Current State | LOC | Action Required |
|--------|--------------|-----|-----------------|
| `capture` | `QuickCapture.tsx` (400L), `GhostCapture.tsx` (185L) | 585 | Has substance — review if ready to show |
| `debug` | `MultimodalGauntlet.tsx` (214L) | 214 | Dev-only tool — hide from production sidebar |
| `desktop` | `DesktopWidget.tsx` (33L) | 33 | Electron stub — hide on web, show on desktop |
| `files` | `FilePreview.tsx` (102L) | 102 | Needs file browser, upload, and management UI |
| `history` | `HistoryDashboard.tsx` (22L) | 22 | Basically empty — needs version history UI |
| `memory` | `MemoryDashboard.tsx` (817L) | 817 | Has real substance — verify it's complete |
| `select-org` | `SelectOrg.tsx` (130L) | 130 | Org picker — likely functional, verify |

### Implementation Detail

**For modules to HIDE:** Gate them in `src/core/constants.ts` or the sidebar component. Use a feature flag (`VITE_SHOW_DEV_MODULES=true`) to enable them in dev mode only.

**For modules to BUILD:**

#### `files` — File Manager

- File browser with tree view (tracks, images, videos, contracts, merch assets)
- Upload dropzone with drag and drop
- File preview with metadata (format, size, dates)
- Integration with `StorageService.ts` and `CloudStorageService.ts`
- Organize by project/release

#### `history` — Version History

- Timeline of changes across the workspace (releases, edits, agent actions)
- Diff view for before/after states
- Rollback capability for agent-generated content
- Integration with `src/services/timeline/`

---

## WO-2: Office Space Design Vision

**CEO Directive:** Each agent/department module should have its own visual "office space" — when a user navigates to a different agent or department, the environment should change visually. The feeling should be "you're visiting their office."

### Design Requirements

- **Per-agent/department visual themes** — unique color accents, background textures, ambient elements
- **Consistent shell** — sidebar and command bar remain stable; the main content area transforms
- **Personality expression** — each "office" reflects the agent's domain:
  - **Brand Manager** → clean gallery wall, mood boards, brand palette displayed
  - **Road Manager** → map/itinerary aesthetic, tour pin markers, dark road vibes
  - **Campaign Manager** → dashboard war-room, metrics boards, calendar grid
  - **Booking Agent** → venue images, contract stacks, calendar availability
  - **Publicist** → press wall, media contact rolodex, release timeline
  - **Creative Director** → canvas/studio feel, inspiration boards, color wheels
  - **Video Producer** → film strip aesthetic, storyboard layout, director's chair vibe
  - **Marketing Department** → analytics dashboards, campaign cards, audience segments
  - **Social Media** → feed-style layout, platform icons, engagement metrics
  - **Legal Department** → formal/corporate, contract viewer, compliance checklists
  - **Publishing** → book/catalog aesthetic, royalty tables, release pipeline
  - **Finance** → ledger/spreadsheet clean, revenue charts, payout timeline
  - **Licensing** → license cards, deal flow boards, territory maps
  - **Audio Analyzer** → waveform-heavy, spectral display, dark studio monitor feel
  - **Workflow Builder** → node-graph canvas, blueprint aesthetic
  - **Knowledge Base** → library/bookshelf, search-centric, document cards
  - **Memory Agent** → neural network visualization, timeline, connection graph

### Implementation Approach

1. Create a `ModuleTheme` type in `src/core/themes/` with per-module accent color, background gradient, and ambient SVG/particle config
2. Map each `ModuleId` to its `ModuleTheme` in a `MODULE_THEMES` record
3. Apply theme via CSS custom properties when the active module changes in the Zustand `appSlice`
4. Use subtle transitions (Framer Motion) when switching between offices
5. Keep the shell (sidebar, top bar, command bar) consistent — only the main content area changes

### Files to Modify

- `src/core/App.tsx` — apply active module theme
- `src/core/store/slices/appSlice.ts` — track active module (already does this)
- `src/core/themes/` — new directory for module themes
- Each module's root component — add office-specific ambient elements

---

## WO-3: Placeholder Text Removal

Replace all user-facing "placeholder" instances across 15+ modules. Full locations below.

### By Module

#### Publishing (highest density)

- `MechanicalRoyaltyPanel.tsx` — L117, L119, L131, L132, L147, L148, L161
- `ReleaseListView.tsx` — L82, L85
- `ReleaseWizard.tsx` — L153, L154, L168, L169, L217, L218, L231, L232, L245, L246, L452, L453, L470, L472
- `ReleaseStatusCard.tsx` — L155

#### Video

- `VideoWorkflow.tsx` — L495, L498
- `BriefingStep.tsx` — L46, L47
- `DirectorPromptBar.tsx` — L164, L166
- `FrameSelectionModal.tsx` — L119, L150
- `IdeaStep.tsx` — L21, L22

#### Settings

- `SettingsShared.tsx` — L21
- `ProfileSection.tsx` — L108, L109, L119, L120

#### Touring

- `DaySheetModal.tsx` — L133, L139, L140, L180, L181, L186, L187, L197, L198
- `RiderChecklist.tsx` — L65, L67
- `RoadMode.tsx` — L513, L514
- `TechnicalRiderGenerator.tsx` — L118, L254, L257, L332, L335, L338, L348-350, L352, L372
- `SetlistAnalytics.tsx` — L109, L167, L175, L181, L201
- `PlanningTab.tsx` — L99, L171
- `OnTheRoadTab.tsx` — L138, L258

#### Social

- `AccountCreationWizard.tsx` — L92, L103
- `CreatePostModal.tsx` — L156, L158
- `SocialFeed.tsx` — L118, L120, L167

#### Publicist

- `PublicistDashboard.tsx` — L131, L184, L185
- `CreateCampaignModal.tsx` — L39, L100, L101, L113, L114, L128, L129
- `CreateContactModal.tsx` — L103, L104, L116, L117, L127
- `ContactDetailsModal.tsx` — L133, L142, L143
- `ReleaseKitModal.tsx` — L111, L122, L144, L154
- `SuperfanCRM.tsx` — L130, L131

#### Merchandise

- `TemplatePicker.tsx` — L93, L94, L202, L206
- `StandardMerch.tsx` — L90
- `StorefrontPreviewModal.tsx` — L42, L103
- `SmartContractGenerator.tsx` — L139, L157, L158, L163, L164

#### Other

- `capture/QuickCapture.tsx` — placeholder content
- `select-org/SelectOrg.tsx` — L96, L99
- `tools/TagMatrix.tsx` — L61
- `workflow/WorkflowLab.tsx` — L256
- `workflow/CustomNodes.tsx` — L60, L63
- `workflow/UniversalNode.tsx` — L160
- `workflow/WorkflowGeneratorModal.tsx` — L35
- `workflow/WorkflowNodeInspector.tsx` — L76, L89
- `onboarding/OnboardingModal.tsx` — L123, L283
- `onboarding/OnboardingPage.tsx` — L264, L266
- `mobile-remote/AgentChat.tsx` — L154, L177, L359, L361
- `mobile-remote/GenerationMonitor.tsx` — L297, L299

### Action

Replace each `placeholder` with contextually appropriate default text, hint text, or input labels. Most are form input placeholders that just need proper hint text (e.g., `placeholder="Enter track title..."` instead of `placeholder="placeholder"`).

---

## WO-4: Agent Tools — Wire to Real Backends

27 agent tool files are prompt-relay only (no external API calls). These need real integrations.

### Priority 1 — Revenue-Critical

| Tool | Backend Needed |
|------|---------------|
| `PublishingTools.ts` | Firestore CRUD for publishing catalog |
| `LicensingTools.ts` | Licensing deal creation, contract templates |
| `SocialTools.ts` | Social media API integration (post creation, scheduling) |
| `BrandTools.ts` | Brand kit persistence, asset management |

### Priority 2 — Operational

| Tool | Backend Needed |
|------|---------------|
| `RoadTools.ts` | Venue search API, tour date management |
| `PublicistTools.ts` | Press release distribution, media contact DB |
| `ProjectTools.ts` | Project CRUD, Firestore persistence |
| `OrganizationTools.ts` | Org management, team CRUD |
| `SecurityTools.ts` | Security audit logging, permission checks |

### Priority 3 — Enhanced Experience

| Tool | Backend Needed |
|------|---------------|
| `Web3Tools.ts` | Real smart contract deployment/minting |
| `BrowserTools.ts` | Web scraping/research capabilities |
| `KnowledgeTools.ts` | RAG retrieval from File Search API |
| `MemoryTools.ts` / `UserMemoryTools.ts` / `CoreVaultTools.ts` / `CaptainsLogTools.ts` | Firestore memory CRUD |
| `NavigationTools.ts` | Module navigation automation |
| `TimelineTools.ts` | Timeline event creation/retrieval |
| `ScreenwriterTools.ts` / `ProducerTools.ts` | Video production pipeline |
| `NarrativeTools.ts` | Story/content generation |
| `HiveTools.ts` / `SovereignTools.ts` / `SqueezerTools.ts` | Specialized agent capabilities |
| `UniversalTools.ts` | Cross-cutting utility operations |
| `ToolValidator.ts` | Tool validation framework (internal) |
| `CoreTools.ts` | Core agent operations |

---

## WO-5: Math.random Cleanup

Replace `Math.random` with proper ID generation in non-test service files.

| File | Line | Current Usage | Fix |
|------|------|--------------|-----|
| `CollaborationService.ts` | L63 | Random color selection | Use deterministic hash from user ID |
| `CaptainsLogService.ts` | L86 | Log entry ID generation | Use `crypto.randomUUID()` |
| `CoreVaultService.ts` | L221 | Vault fact ID generation | Use `crypto.randomUUID()` |
| `SocialPostingService.ts` | L63, L69 | Simulated delay + 10% failure rate | **Remove simulated failure** — this is production code faking errors |
| `naturalFallback.ts` | L140, L170, L173 | Random array selection + randomized responses | Acceptable for variety in onboarding responses |
| `UsageTracker.ts` | L109 | Exponential backoff jitter | ✅ Correct usage — keep |
| `FirebaseAIService.ts` | L1047 | Retry backoff jitter | ✅ Correct usage — keep |

> [!CAUTION]
> `SocialPostingService.ts:L69` simulates a 10% failure rate with `Math.random() < 0.1`. This is a **simulated service** — real social posting isn't happening here. This needs to be either connected to a real social API or explicitly marked as a stub.

---

## WO-6: Type Safety Sprint

568 `as any` casts across the service layer. Target: eliminate 50 per sprint.

**Prioritize by impact:**

1. Agent service files (where type errors propagate to AI responses)
2. Distribution/DDEX (where type errors corrupt industry-standard XML)
3. Payment/subscription (where type errors affect billing)
4. AI service files (where type errors affect model calls)

---

## WO-7: Distribution Last Mile

| Task | Detail |
|------|--------|
| **SFTP test against real DSP** | Set up a test SFTP endpoint that mirrors DSP delivery specs. Validate full pipeline: DDEX XML gen → audio file packaging → metadata attachment → SFTP upload → delivery confirmation |
| **Per-DSP adapter configs** | Create delivery spec configs for: Spotify, Apple Music, Tidal, Amazon Music, Deezer, YouTube Music. Each has unique format, codec, metadata, and artwork requirements |
| **DSP compliance coaching** | After DNA extraction, compare track specs (LUFS, sample rate, bit depth, codec) against the selected DSP's delivery requirements. Flag mismatches with actionable guidance |

---

## WO-8: Payment Validation

| Task | Detail |
|------|--------|
| **Stripe Test Mode validation** | Run full checkout, subscription creation, webhook receipt, and invoice retrieval in Stripe Test Mode |
| **Micro-transaction architecture** | Design credit-based purchase system for per-unit overages (future feature — documented in `docs/FUTURE_FEATURES_ROADMAP.md`) |
| **MembershipService integration test** | Verify ledger, quota, budget, and circuit breaker all work end-to-end with real Stripe events |

---

## WO-9: App Check Enforcement

| Task | Detail |
|------|--------|
| **Enable App Check in production** | Activate debug token for local dev, enforce reCAPTCHA Enterprise or App Attest for production |
| **Gate Cloud Functions** | Add App Check verification to all `onCall` functions in `functions/src/index.ts` |
| **Test degraded mode** | Verify app behavior when App Check fails (graceful error, not crash) |

---

## WO-10: MusicAgent Scope Correction

| Task | Detail |
|------|--------|
| **Agent definition review** | Open `src/services/agent/definitions/MusicAgent.ts` and `agents/music/` — remove any references to mix feedback, production coaching, or DAW guidance |
| **Refocus on DNA-driven advice** | Agent should: analyze track DNA → suggest distribution metadata → recommend marketing angles → flag DSP compliance issues |
| **Training data audit** | Review `docs/agent-training/datasets/music.jsonl` (122 examples) — remove or rewrite production-focused scenarios |

---

## Summary

| WO | Description | Scope |
|----|-------------|-------|
| WO-1 | Shell modules — flesh out or gate | 7 modules |
| WO-2 | Office space design vision | 17 unique environments |
| WO-3 | Placeholder text removal | 15+ modules, 100+ instances |
| WO-4 | Agent tools — wire to backends | 27 tool files |
| WO-5 | Math.random cleanup | 7 files (2 critical) |
| WO-6 | Type safety sprint | 568 `as any` casts |
| WO-7 | Distribution last mile | 3 sub-tasks |
| WO-8 | Payment validation | 3 sub-tasks |
| WO-9 | App Check enforcement | 3 sub-tasks |
| WO-10 | MusicAgent scope correction | 3 sub-tasks |
