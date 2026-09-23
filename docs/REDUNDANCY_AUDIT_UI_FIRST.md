# UI-First Backwards Redundancy Audit — indii Studio

**Status:** Stage 1 + 1b EXECUTED (see ISSUE-1442 in `.agent/test_ledger/OPEN_ISSUES_V3.md`). Deferred: zombie campaign links (concurrent ISSUE-1440 WIP file). Stages 2–3 pending founder sign-off. Audit direction: start at what the artist sees (UI surfaces), work backwards through modules → store → services → cloud functions, judging every layer against the product mission (`.agent-os/product/mission.md`, `docs/product/PRODUCT_COPYWRITING_BRIEF.md`).

**Headline numbers:** 45 registered ModuleIds → only 17 desktop-sidebar / ~21 mobile / 31 ⌘K destinations; 2 fully dead components kept lazy-chunked + themed (`audio-analyzer` 621 LOC, `format-foundry` 470 LOC); 1 unreachable module (`devops`); 1 duplicate nav identity (`campaign`); 1 deep-link-only lock screen (`investor`); 7 orphan services (~1,000 LOC) + 2 orphan module dirs (~1,250 LOC); ~20 client-dead cloud functions incl. a prod-reachable `setGodMode`; 6 chat surfaces; 3 capture UIs; 3 earnings dashboards; 7 marketing nav surfaces; 3+ memory/knowledge surfaces; 7 gating/nav/display-name defects.

**Judge (from product docs):** an independent artist's post-master business lifecycle; one-artist tenant; truthful capability; artist sovereignty; consolidate the 10–15-tool tax. Anything that duplicates another surface, serves label-scale ops, or is registry-dead is redundancy.

---

## Layer 0 — Confirmed dead UI code (zero reachability, zero references)

| Target | Evidence | LOC | Risk |
|---|---|---|---|
| `packages/renderer/src/modules/royalty/` | 0 imports anywhere in monorepo; not in `MODULE_IDS`; roadmap lists royalty as "deferred Phase 1" — registry already dropped it | ~1,000 (11 files) | None — no e2e, no service deps |
| `packages/renderer/src/modules/design/` | Unregistered; its only consumer relationship is with `services/design`, whose only consumers are inside this same dead module | ~250 (5 files) | None — 0 e2e refs |
| `packages/renderer/src/services/design/` | Only consumers are the dead `modules/design` components | (THIN, 2) | None |
| `packages/renderer/src/services/ai/` | 4-LOC dead shim re-exporting `intelligence/AutonomousIntelligence`; sole external ref is a **broken** import of deleted `ai/AIService` in `scripts/verify-ai-features.ts` (fix script ref same commit) | 4 | None |
| `packages/renderer/src/services/daw/` | 0 consumers. Also violates the locked scope boundary (no DAW functionality — `decisions.md` #2) | 33 | None |
| `packages/renderer/src/services/education/` | 0 consumers (`EducationCurriculumCompiler`) | 164 | None |
| `packages/renderer/src/services/monitoring/` | 0 consumers (`UptimeMonitorService`, `CostAnomalyService`) — superseded by `services/observability` | 445 | Verify Sentry/uptime not relying on it |
| `packages/renderer/src/services/optimistic/` | 0 consumers (`OptimisticManager`) | 151 | None |
| `packages/renderer/src/services/config/` | `FeatureFlagService` — zero mentions repo-wide (runtime flags live in `src/config/featureFlags`) | 119 | None |
| `packages/renderer/src/services/firebase-guards.ts` | Zero mentions repo-wide | 91 | None |

Subtotal: ~2,250 LOC provably dead, zero user-visible behavior change.

## Layer 0b — Dead-by-rewrite UI components (registered, mounted, unreachable)

`core/moduleRegistry.ts` (ISSUE-1438) already documents these — the audit confirms and quantifies:

- `audio-analyzer` — **phantom alias**: `setModule` rewrites to Distribution QC tab (`useURLSync.ts:118`). `modules/tools/AudioAnalyzer.tsx` (~621 LOC) never renders. `services/audio` (32 consumers) is unaffected — QC lives in distribution now.
- `format-foundry` — **phantom alias** → Finance forensics tab. `modules/format-foundry/FormatFoundryModule.tsx` (~470 LOC) never renders. `services/foundry` stays (agent `FormatFoundryTools` still consumes it).
- `campaign` — "duplicate of Marketing Department" (ISSUE-1436): mounts the identical `CampaignDashboard` component as marketing; Home widgets still deep-link it. Component lives on via marketing; the second module ID is pure alias.
- `investor` — standalone module rendering a permanent lock screen. Dead weight unless an investor demo is actively scheduled (founder call).

## Layer 1 — Registered IDs with no real surface (or no nav entry)

- `devops` — registered, has a `DevopsDashboard`, **zero nav entries anywhere** (⌘K hides it as "internal ops"); infra tooling (GKE/GCE/BigQuery callables) inside an artist product.
- `crm` — registered ModuleId + 1-file `CRMDashboard`, no `services/crm`; real CRM lives in `packages/admin-dashboard`. Nav-visible in Tools — an artist-facing nav slot pointing at a shell.
- `screenwriter` — module (2 files) + `services/screenwriter` (sole consumer: itself). Screenplay tooling crosses the locked post-master scope boundary. Candidate: cut or demote.

## Layer 1b — Nav topology itself is redundant

Three different surfaces with three different counts: desktop Sidebar ~17 destinations, MobileTabBar+More ~21, ⌘K command menu 31 (all from `moduleRegistry.ts`). The same product shows a different department list depending on how you ask. Consolidation target: one registry (already exists) driving all three, with group-level parity.

## Layer 1c — Defects found during the audit (usefulness wins, fix regardless)

1. **`PROJECT_CANVAS` flag not enforced** — `enable_project_canvas` defined in `config/featureFlags.ts` but `project-canvas` is missing from `GATED_MODULES`: the module ships to production via ⌘K + mobile Workspace drawer regardless of flag. Real gating bug.
2. **Zombie campaign links** — `dashboard/components/CustomDashboardWidgets.tsx:1315,1329` still navigate to the hidden `campaign` alias instead of `marketing`.
3. **13 missing display names** — `MODULE_DISPLAY_NAMES` omits `analytics`, `crm`, `screenwriter`, `devops`, `mobile-remote`, `registration`, `security`, `settings`, `marketplace`, `onboarding`, `agent`, `select-org`, `founders-*` → `<h1>`/document outline falls back to raw ids (ISSUE-1189 regression surface).
4. **Mobile nav gaps** — `registration` and `security` are desktop Departments but absent from `MobileTabBar` `MORE_SECTIONS`; phones have no ⌘K → two Departments unreachable on mobile.
5. **Dead sidebar branch** — `Sidebar.tsx:51–57` special-cases a `history` nav item that exists in no sidebar array.
6. **Cosmetic color bug** — `moduleColors.ts:506,515` `cssVar` fields hold raw HSL strings for `screenwriter`/`crm` instead of variable names.
7. **`marketing` module is a 13-LOC wrapper** around `CampaignDashboard` — the very component `campaign` renders; three names, one surface.

## Layer 2 — Domain fragmentation (merge, don't delete)

0. **Cross-module duplicate components (verified):**
   - `modules/publishing/components/DistributorConnectionsPanel.tsx` vs `modules/distribution/components/DistributorConnectionsPanel.tsx`
   - `modules/publishing/components/EarningsDashboard.tsx` vs `modules/finance/components/EarningsDashboard.tsx`
   - Settings exists twice: `settings` module route AND `SettingsModal` (⌘,) wrapping the same `SettingsPanel`.
1. **Marketing domain: 7 nav surfaces** — `marketing`, `brand` (BrandManager lives *inside* marketing/components), `campaign` (confirmed duplicate), `publicist`, `social`, `crm`, `analytics`. Candidate: one Marketing dept surface with tabs; brand/campaign stop being top-level destinations.
2. **Memory domain: 3+ nav surfaces** — `memory` (always-on memory agent: feed, insights, ingest, query, engine controls), `knowledge` (upload + RAG doc chat), `notes` (+ global `QuickNotesDrawer` overlay), plus `history`. All sell Connected Intelligence ("never repeat yourself"). Candidate: one surface, tabs; QuickNotesDrawer stays as capture gesture.
3. **Orchestration surfaces** — **six chat surfaces**: `agent` chat tab, global `ChatOverlay`, `BoardroomModule` conversation panel, `KnowledgeChat`, memory query panel, `mobile-remote/AgentChat` (+ `RightPanel` archives). **Three capture UIs**: `capture/GhostCapture`, `mobile-remote/QuickCaptureView`, MobileTabBar's `capture/QuickCapture` sheet. Plus `workflow` (Workflow Lab) and `AgentCanvasPanel`/`TaskPlanWidget`/`AgentFeedbackWidget` overlays. Consolidation needs a UX pass.
4. **Earnings ×3** — `finance/components/EarningsDashboard.tsx`, `publishing/components/EarningsDashboard.tsx` (+ `EarningsBreakdown`, `PayoutHistory`), and Home widget revenue modes in `CustomDashboardWidgets.tsx` (1,053-line file with its own aggregation).
5. **Notes ×2** — route + `QuickNotesDrawer` (same store, drawer links to route). **Contact/campaign data models ×3** — publicist contacts+`SuperfanCRM`, `crm` module (`crmSlice` "Digital Vinyl" drops), marketing campaigns — three unrelated list/create flows for the same mental job.
6. **Canvases/editors** — Creative `InfiniteCanvas`/`CanvasEditor` (Fabric), `MerchDesigner` (second Fabric integration), `ProjectCanvas` (spatial blocks), video editor + `VideoPopout`. ProjectCanvas vs Creative canvas overlap in "arrange assets on a board".
7. **Layout shells ×3** — `AdaptiveWorkspace` (newest), `ThreePanelDashboard`, `ModuleDashboard` (only consumer: dead audio-analyzer), plus hand-rolled 3-panel grids in social/publishing/marketing.
8. **Primitive duplicates** — module-local `SettingsShared.tsx`, `SettingCard.tsx` (desktop), `PublishingSkeleton.tsx`; **two `EmptyState.tsx`** (dashboard-local vs shared); `ThreeDButton`/`ThreeDCard` decorative variants of `button`/`card`.
9. **Settings ×2 surfaces with internal overlaps** — route + ⌘ modal wrap the same `SettingsPanel`; its `DesktopSection` overlaps the `desktop` module, `RemoteSection` the mobile-remote pairing flow, `SecuritySection` the `security` module.
10. **AppShell always-on overlay count** — 15+ overlays mount on every screen (Approval, CostWarning, Transmission, Boardroom, ChatOverlay, TaskPlan, AgentCanvas, SettingsModal, QuickNotesDrawer…). Surface inflation independent of the module registry.
11. **Store layer mirrors the fragmentation** — 7+ agent slices (`agentSlice`, `agentCanvasSlice`, `agentFeedbackSlice`, `agentMemorySlice`, `agentPlanSlice`, `agentSwarmSlice`, `boardroomSlice`, `memoryAgentSlice`, `handoffSlice`) and `notesSlice`/`crmSlice`/`emailSlice` carrying domain UI state.
5. **Tools group crowding** — `debug` (MultimodalGauntlet) is artist-visible in ⌘K Tools; `raw-converter`, `marketplace`, `project-canvas` also sit there. Internal/dev surfaces belong behind the god-mode menu (which already carries observability).

## Layer 3 — Service layer

Full 95-service consumption map: 63 ALIVE / 25 THIN / 7 ORPHAN (see Layer 0 for the orphans).

Merge candidates (verified duplicates):
- **`services/blockchain` → `services/web3`**: two `OpenSeaService.ts` and two Pinata implementations in the same package. blockchain's only consumers are 2 merch components; web3 also backs Electron main + wallet dialog. Keep web3, port merch imports, delete blockchain.
- **`services/music`** — 3 raw consumers, all inside `services/` (audio×2, distribution) → fold into `services/audio` or mark internal.
- **`services/memory`, `services/knowledge`** — 1 consumer each; collapse into `services/rag` consumers.

## Layer 4 — Cloud Functions (219 exported; client-referenced diff, digit- and template-literal-aware)

**Dead client-facing callables (zero refs in renderer/main/landing/admin/sdk/shared):**
- Track CRUD REST family: `createTrack`, `getTrack`, `listTracks`, `updateTrack`, `deleteTrack` (onRequest) — the live pipeline writes Firestore directly + SFTP adapters.
- Distribution REST family: `createDistribution`, `getDistribution`, `submitDistribution`, `triggerUnifiedDistribution`, `verifyMasterAudio`, `createSocialHandoffDraft` — superseded by Firestore-direct path.
- `generateSpeech` — orphaned by the `generateAudioV3` migration (`SpeechGenerator.ts` now calls `generateAudioV3`).
- Telegram pair: `generateTelegramLinkCode`, `getTelegramLinkStatus` (webhook also unused).
- `createMicroTransaction` — has unit tests (ISSUE-1423) but no client ever calls it.
- `createStripeAccount` — dead sibling of the alive `createStripeConnectAccount`.
- `applyAudioRecipe`, `refreshSocialToken`, `activateFounderPass`, `queryAnalytics`.
- **`setGodMode` — a god-mode escalation callable reachable in production. Flag for removal/security review regardless of audit.**

**Alive-but-not-client-called (keep — infra):** all webhooks (`stripeWebhook`, `shopifyWebhook`, `telegramWebhook`*, `instagramWebhook`, `pandadocWebhook`, `handleEscrowWebhook`, `sendWebhookOnEvent`), all `onSchedule` crons, `onDocumentCreated` triggers, `pod_*` (dynamic `` `pod_${name}` `` dispatch — verified alive), health endpoints, `mcpEndpoint`, `inngestApi`, `ragProxy` (used via functions URL).

*telegramWebhook dies with the Telegram pair if the integration is confirmed unwired.

**Escrow family** (`signEscrow` dead while `initiateSplitEscrow`/`releaseEscrow` referenced) — needs one look at whether splits escrow UI is reachable before cutting.

## Execution plan (proposed, staged)

- **Stage 1 — pure deletions (zero behavior change, ~2,900 LOC):**
  Layer 0 table (orphan modules + services) + `services/blockchain` after porting 2 merch imports to `services/web3` + dead-by-rewrite components `modules/tools/AudioAnalyzer.tsx` (+ unreachable `TagMatrix`) and `modules/format-foundry/FormatFoundryModule.tsx` (keep `services/foundry` — agent tools still consume it) + registry entries for the phantom ids + `MODULE_COMPONENTS` mappings. Validate: typecheck, lint, affected unit tests, `build:studio`.
- **Stage 1b — usefulness fixes (small, high-value):**
  Layer 1c defects: enforce `PROJECT_CANVAS` gating; retarget zombie campaign links to `marketing`; fill 13 missing `MODULE_DISPLAY_NAMES`; add `registration`+`security` to mobile More drawer; delete dead sidebar `history` branch; fix `moduleColors` cssVar strings; fix the broken `scripts/verify-ai-features.ts` import when deleting `services/ai`.
- **Stage 2 — surface consolidation (product decisions, one commit per fold):**
  Marketing 7→1 (tabs; `campaign` alias removed after links fixed), memory/knowledge/notes 3→1 Brain/Library surface, earnings panels unified, `DistributorConnectionsPanel` unified into distribution and re-used by publishing, chat surfaces reduced (agent tab + boardroom stay; knowledge chat stays in-context), `devops`+`investor`+`desktop` module removal or explicit keep-with-rationale, primitives adoption (`SectionCard`, shared `EmptyState`, layout shells).
- **Stage 3 — backend pruning + security:**
  Remove client-dead callables (track-CRUD REST family, distribution REST family, `generateSpeech`, Telegram pair, `createMicroTransaction`, `createStripeAccount`, `applyAudioRecipe`, `refreshSocialToken`, `activateFounderPass`, `queryAnalytics`) + their dead tests. **Drop `setGodMode` (prod-reachable god-mode escalation).** Confirm escrow UI reachability before touching `signEscrow`. Deploy functions only after frontend callers confirmed zero.
- **Stage 4 — store-slice consolidation** behind the Stage 2 surface merges.

Every stage ships separately to `origin/main` with its own CI watch; nothing bundles unrelated work.
