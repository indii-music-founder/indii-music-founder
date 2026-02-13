# indiiOS — Completion Roadmap

> **Generated:** 2026-02-13 by Antigravity (deep codebase audit)  
> **Branch:** `fix/persona-publicist-legal-bugs` (current)  
> **Build Status:** ✅ TypeScript clean · 16/16 tests pass  
> **Last Deploy:** Firebase Hosting (studio + landing)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Infrastructure Health](#2-infrastructure-health)
3. [Module-by-Module Audit (25 modules)](#3-module-by-module-audit)
4. [Service Layer Audit (37 services)](#4-service-layer-audit)
5. [Missing Firestore Rules — Silent Data Loss](#5-missing-firestore-rules--silent-data-loss)
6. [Test Coverage Gap Analysis](#6-test-coverage-gap-analysis)
7. [Agent System Health](#7-agent-system-health)
8. [Known Bugs (Active Tracker)](#8-known-bugs-active-tracker)
9. [Prioritized Sprint Plan](#9-prioritized-sprint-plan)
10. [Technical Debt Register](#10-technical-debt-register)

---

## 1. Executive Summary

indiiOS is a massive 25-module, 37-service creative platform. The foundation is strong — the architecture is clean (Zustand slices, lazy modules, service layer), the build pipeline works, and the AI agent system is wired. But there are **critical gaps** that will cause user-facing failures:

### ⚠️ Top 3 Show-Stoppers

| # | Issue | Impact | Est. Effort |
|---|---|---|---|
| 1 | **Missing Firestore rules for 4+ collections** | Data silently fails to persist (scheduled_posts, smart_contracts, ledger, processed_reports) | 1 hour |
| 2 | **Only 6 unit tests for 25 modules + 37 services** | Zero service-level tests; 0% coverage on business logic | 3-5 days |
| 3 | **Cloud Storage uploads disabled** | Images only live as data URIs (lost on refresh) | 4-8 hours |

### 🏗️ Platform Maturity Summary

| Category | Status | Details |
|---|---|---|
| **Core Shell** (routing, sidebar, command bar) | ✅ Solid | Lazy-loaded, module system clean |
| **Auth + Onboarding** | ✅ Working | Firebase Auth, onboarding flows exist |
| **AI Agent System** | ⚠️ Functional but fragile | Persona propagation just fixed; hallucination guardrails added |
| **Image Generation** | ⚠️ Works but no persistence | Cloud Function works; storage uploads disabled |
| **Video Generation** | ⚠️ Untested in prod | Veo 3.1 integration exists; no E2E verification |
| **Distribution Engine** | ⚠️ Adapters exist, not connected | SymphonicAdapter, DistroKidAdapter, TuneCoreAdapter are stubs |
| **Finance/Revenue** | ⚠️ UI exists, data layer thin | FinanceService writes to Firestore but no revenue import pipeline |
| **Social Module** | ⚠️ Missing Firestore rules | `scheduled_posts` collection has NO rules → writes silently fail |
| **Blockchain/Legal** | 🔴 Missing rules + stubs | `smart_contracts`, `ledger` — no rules, service is skeleton |
| **Touring** | ✅ Solid | Rules exist, DaySheet modal, rider checklists, planning tab all wired |
| **Marketing** | ✅ Strong | Campaign AI, post generator, brand manager, asset library all functional |
| **Testing** | 🔴 Critical gap | 6 tests total across entire app (sanity/guideline only) |

---

## 2. Infrastructure Health

### Build Pipeline

| Check | Status | Notes |
|---|---|---|
| TypeScript `tsc --noEmit` | ✅ Zero errors | Strict mode on |
| ESLint | ✅ Clean (warnings only) | `no-explicit-any` is warn, not error |
| Vite Build | ✅ Production builds | Terser minification, console stripping |
| Firebase Deploy | ✅ Working | Two hosting targets (app + landing) |
| CI/CD (GitHub Actions) | ⚠️ Fragile | Has hung on agent tests before; needs timeout guards |
| Electron Build | ⚠️ Untested recently | `electron-builder` config exists but not validated |

### Environment & Config

| Item | Status | Notes |
|---|---|---|
| `.env` setup | ✅ | All `VITE_` vars documented in `.env.example` |
| Firebase config | ✅ | `firebase.json` with 2 hosting targets |
| Firestore rules | ⚠️ **Gaps** | See Section 5 — 4+ collections missing |
| Storage rules | ⚠️ Unknown | Need audit; CORS was previously an issue |
| App Check | ⚠️ | Debug token in CI; prod key needed for launch |

### Git Health

| Item | Status | Notes |
|---|---|---|
| Case sensitivity (`agents.md` vs `AGENTS.md`) | ⚠️ Chronic | macOS case-insensitive FS conflict; shows phantom diffs |
| Stash bloat | ⚠️ 38 stashes | Many are obsolete; cleanup recommended |
| Branch hygiene | ⚠️ | Multiple old feature branches likely exist on remote |

---

## 3. Module-by-Module Audit

### Tier 1: Core Modules (User-Facing Daily)

#### 🎨 Creative Studio (`src/modules/creative/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐⭐ | DirectGenerationTab, Canvas, Gallery, Whisk DropZone all polished |
| Image Gen | ⭐⭐⭐ | Works via Cloud Function; data URI only (no cloud storage) |
| Video Gen | ⭐⭐ | Veo 3.1 integration exists but untested E2E |
| Canvas Editing | ⭐⭐⭐ | Fabric.js canvas with magic edit prompt bar |
| Brand Assets | ⭐⭐⭐ | Drawer exists for asset management |
| **Needs:** | | Re-enable cloud storage uploads, test video gen E2E, test canvas persistence |

#### 📊 Dashboard (`src/modules/dashboard/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐⭐ | ProjectHub exists with stats |
| Data Flow | ⭐⭐⭐ | Connects to store slices |
| **Needs:** | | Review for stale data handling, empty state UX improvement |

#### 💬 Agent/Chat (`src/modules/agent/`, `src/core/components/ChatOverlay`)

| Aspect | Rating | Details |
|---|---|---|
| Chat UI | ⭐⭐⭐⭐ | ChatOverlay with message rendering, prompt area |
| Agent Routing | ⭐⭐⭐ | Hub-and-spoke architecture, 12+ specialist agents |
| Persona Propagation | ⭐⭐⭐⭐ | **Just fixed** — artist name now injected everywhere |
| Tool Execution | ⭐⭐⭐ | generate_image, generate_video, speak, recall_memories all wired |
| **Needs:** | | Long conversation memory (context window management), streaming reliability |

### Tier 2: Business Modules

#### 📦 Distribution (`src/modules/distribution/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | QC Panel, ISRC input, distributor selection |
| Adapters | ⭐⭐ | SymphonicAdapter, DistroKidAdapter, TuneCoreAdapter — all have classes but are **stubs** (commented out in index.ts) |
| DDEX | ⭐⭐⭐ | ERN/DSR generation exists in `execution/distribution/` |
| SFTP Upload | ⭐⭐ | BatchDeliveryService exists but untested |
| **Needs:** | | Activate adapters, wire up real distributor APIs, E2E test DDEX → SFTP pipeline |

#### 💰 Finance (`src/modules/finance/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Revenue tracking, expense management |
| Data Layer | ⭐⭐⭐ | FinanceService with earnings/expenses collections |
| Revenue Import | ⭐ | DSR upload service exists but pipeline incomplete |
| Waterfall Payouts | ⭐⭐ | Execution script exists in `execution/finance/` |
| **Needs:** | | Revenue data import pipeline, payout calculation testing, financial reports |

#### ⚖️ Legal (`src/modules/legal/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Contract validation, NDA gen, IP assignment, counsel directory |
| Quick Tools | ⭐⭐⭐ | **Fixed** — wired to LegalTools service |
| Contract Storage | ⭐⭐ | LegalService writes to `users/{uid}/contracts` subcollection |
| **Needs:** | | Template library for contracts, contract versioning, actual PDF generation |

#### 📰 Publicist (`src/modules/publicist/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Campaign cards, contact management, detail modals |
| Persistence | ⭐⭐⭐⭐ | **Just fixed** — Firestore rules added |
| AI Integration | ⭐⭐ | CampaignAIService exists but not deeply integrated in Publicist module |
| **Needs:** | | Wire AI campaign generation into Publicist flow, email template gen |

#### 📣 Marketing (`src/modules/marketing/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐⭐⭐ | Most polished module — brand manager, post generator, asset library, AI campaign modal |
| AI Integration | ⭐⭐⭐⭐ | CampaignAIService fully wired — plan gen, copy enhancement, image batches |
| Data | ⭐⭐⭐⭐ | MarketingService with campaigns collection |
| **Needs:** | | Social platform OAuth connections, real scheduling API |

#### 🎵 Publishing (`src/modules/publishing/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Release wizard with ISWC/ISRC inputs |
| Data | ⭐⭐ | PublishingAgent generates ISWCs but verification is AI-based (not real registry) |
| **Needs:** | | Real publishing admin integration, rights management, royalty splits UI |

#### 🔑 Licensing (`src/modules/licensing/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Dashboard with license types |
| Action Buttons | ⭐⭐ | "Draft License" button logs to console — **placeholder** |
| **Needs:** | | Wire draft modal to LicensingService, add pricing calculator |

#### 🚐 Touring (`src/modules/touring/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐⭐⭐ | Military-grade DaySheet, Rider Checklist, Planning Tab, OnTheRoad map |
| Firestore Rules | ✅ | tour_vehicles, tour_itineraries, tour_rider_items all have rules |
| Google Maps | ⭐⭐⭐ | MapsComponent with geocoding (needs VITE_GOOGLE_MAPS_API_KEY) |
| **Needs:** | | Calendar sync, venue database, routing optimization |

#### 🛍️ Merchandise (`src/modules/merchandise/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Catalog management, POD integration concept |
| Firestore Rules | ✅ | merchandise_catalog and merchandise collections have rules |
| **Needs:** | | POD provider integration (Printful/Printify API), order tracking |

#### 🌐 Social (`src/modules/social/`)

| Aspect | Rating | Details |
|---|---|---|
| UI/UX | ⭐⭐⭐ | Post creation, feed, following system |
| **🔴 Firestore Rules** | **MISSING** | `scheduled_posts` collection has **NO rules** — scheduling silently fails |
| **Needs:** | | Add `scheduled_posts` rule, platform OAuth, auto-posting engine |

### Tier 3: Support Modules

#### 🔬 Observability (`src/modules/observability/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | Agent trace viewer, system health dashboard. Functional but not deeply tested. |

#### 📁 Files (`src/modules/files/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | FileSystemService with cloud sync. `file_nodes` collection has rules. |

#### 📚 Knowledge (`src/modules/knowledge/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | Knowledge base module with RAG service. Exists but depth unclear. |

#### 🎬 Video (`src/modules/video/`)

| Status | Details |
|---|---|
| ⭐⭐ | Remotion-based video rendering. Veo 3.1 for generation. Untested E2E. |

#### 🔄 Workflow (`src/modules/workflow/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | React Flow node editor. WorkflowTemplateModal exists. Template library has TODO. |

#### 🎨 Design (`src/modules/design/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | TemplateSelector, design service with templates. Needs real template content. |

#### 🏪 Marketplace (`src/modules/marketplace/`)

| Status | Details |
|---|---|
| ⭐⭐ | Early stage. MarketplaceService exists. Needs sample/beat marketplace UI. |

#### 🔧 Tools (`src/modules/tools/`)

| Status | Details |
|---|---|
| ⭐⭐ | Utility tools collection. Needs audit for completeness. |

#### 🐛 Debug (`src/modules/debug/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | Developer debug panel. Good for internal use. |

#### 📜 History (`src/modules/history/`)

| Status | Details |
|---|---|
| ⭐⭐⭐ | History service for undo/redo and audit trail. Rules exist. |

#### 🚀 Onboarding (`src/modules/onboarding/`)

| Status | Details |
|---|---|
| ⭐⭐⭐⭐ | Interactive onboarding page + modal. Conversational style. Well-polished. |

#### 📋 Release (`src/modules/release/`)

| Status | Details |
|---|---|
| ⭐⭐ | Release management. Likely overlaps with Distribution. Needs dedup audit. |

---

## 4. Service Layer Audit

### Services With Known Issues

| Service | File | Issue | Severity |
|---|---|---|---|
| `ImageGenerationService` | `src/services/image/ImageGenerationService.ts` | Cloud storage uploads disabled; images only as data URIs | 🔴 High |
| `SmartContractService` | `src/services/blockchain/SmartContractService.ts` | Writes to `smart_contracts` & `ledger` — **no Firestore rules** | 🔴 High |
| `SocialService` | `src/services/social/SocialService.ts` | Writes to `scheduled_posts` — **no Firestore rules** | 🔴 High |
| `DSRUploadService` | `src/services/ddex/DSRUploadService.ts` | Writes to `processed_reports` — **no Firestore rules** | 🟡 Medium |
| `DistroKidAdapter` | `src/services/distribution/adapters/DistroKidAdapter.ts` | Commented out in `index.ts`; adapter is a stub | 🟡 Medium |
| `TuneCoreAdapter` | `src/services/distribution/adapters/TuneCoreAdapter.ts` | Commented out in `index.ts`; adapter is a stub | 🟡 Medium |
| `SymphonicAdapter` | `src/services/distribution/adapters/SymphonicAdapter.ts` | Imported in DistributorService but likely incomplete | 🟡 Medium |
| `TaxService` | `src/services/distribution/TaxService.ts` | Has comment about needing to check rules | 🟡 Medium |
| `EvolutionEngine` | `src/services/agent/evolution/EvolutionEngine.ts` | Contains TODO/FIXME pattern; likely incomplete | 🟡 Medium |

### Services That Appear Solid

| Service | Notes |
|---|---|
| `AIService` | Well-structured with caching, rate limiting, abort signals |
| `AgentService` | Hub-and-spoke routing, timeout handling improved |
| `PublicistService` | Firestore CRUD with Zod validation + real-time subscriptions |
| `MarketingService` | Campaign CRUD, proper userId scoping |
| `FinanceService` | Earnings + expenses with proper queries |
| `FileSystemService` | Cloud sync, tree structure, proper rules |
| `TokenUsageService` | Usage tracking with upsert pattern |
| `UserService` | Profile management, proper auth checks |

---

## 5. Missing Firestore Rules — Silent Data Loss

> **This is the #1 most critical issue.** Any collection that writes data without a matching Firestore rule will **silently fail**. The user sees no error but their data is gone on refresh.

### Collections Writing Data With NO Rules

| Collection | Service | Write Operations | Impact |
|---|---|---|---|
| `scheduled_posts` | `SocialService` | `addDoc`, queries | 🔴 Scheduled posts vanish |
| `smart_contracts` | `SmartContractService` | `addDoc` | 🔴 Contract data lost |
| `ledger` | `SmartContractService` | `addDoc`, queries | 🔴 Ledger entries lost |
| `processed_reports` | `DSRUploadService` | `addDoc` | 🟡 Report processing data lost |

### Collections With Rules (Confirmed Working)

<details>
<summary>Click to expand — 30+ collections with proper rules</summary>

- `users/{userId}` + subcollections (analyzed_tracks, usage, workflows, following, followers, stats, memories, context)
- `organizations/{orgId}` + subcollections (members, invitations)
- `projects/{projectId}` + subcollections (memories, context, creative_assets, releases, generated_images)
- `history/{docId}`
- `agent_traces/{traceId}`
- `user_usage_stats/{docId}`
- `user_rate_limits/{docId}`
- `licenses/{licenseId}`
- `license_requests/{requestId}`
- `posts/{postId}`
- `revenue/{revenueId}`
- `earnings_reports/{reportId}`
- `expenses/{expenseId}`
- `file_nodes/{nodeId}`
- `merchandise_catalog/{productId}`
- `merchandise/{productId}`
- `sample_platforms/{platformId}`
- `api_inventory/{apiId}`
- `onboarding_templates/{templateId}`
- `deployments/{deploymentId}`
- `distribution_tasks/{taskId}`
- `designs/{designId}`
- `tax_profiles/{profileId}`
- `isrc_registry/{isrcId}`
- `campaigns/{campaignId}`
- `publicist_campaigns/{campaignId}` ✅ Just added
- `publicist_contacts/{contactId}` ✅ Just added
- `tour_vehicles/{vehicleId}`
- `tour_itineraries/{itineraryId}`
- `tour_rider_items/{itemId}`

</details>

### Fix: Add These Rules

```
// In firestore.rules, before the catch-all deny:

match /scheduled_posts/{postId} {
  allow read, update, delete: if isOwner(resource.data.userId);
  allow create: if isOwner(request.resource.data.userId);
}

match /smart_contracts/{contractId} {
  allow read, update, delete: if isOwner(resource.data.userId);
  allow create: if isOwner(request.resource.data.userId);
}

match /ledger/{entryId} {
  allow read: if isOwner(resource.data.userId);
  allow create: if isOwner(request.resource.data.userId);
  allow update, delete: if false; // Ledger is append-only
}

match /processed_reports/{reportId} {
  allow read, update, delete: if isOwner(resource.data.userId);
  allow create: if isOwner(request.resource.data.userId);
}
```

---

## 6. Test Coverage Gap Analysis

### Current State: 6 Tests

| Test File | What It Tests | Domain |
|---|---|---|
| `sanity.test.ts` | Environment check | Foundation |
| `delay.behavior.test.ts` | Timer behavior | Foundation |
| `json.types.test.ts` | JSON type safety | Core |
| `agent-guideline.test.ts` (x4) | Agent guideline sync | Config |
| `agent-guideline-sync.test.ts` (x4) | Guideline consistency | Config |
| `async.test.ts` (x4) | Delay + retry utils | Utils |

### What's Missing (Priority Order)

| Priority | Test Category | Files to Test | Est. Tests |
|---|---|---|---|
| 🔴 P0 | **Service integration** | AIService, AgentService, ImageGenerationService | ~15-20 |
| 🔴 P0 | **Firestore operations** | PublicistService, MarketingService, FinanceService, SocialService | ~20-25 |
| 🟡 P1 | **Agent routing** | WorkflowCoordinator, ContextResolver, GeneralistAgent | ~10-15 |
| 🟡 P1 | **Store slices** | appSlice, authSlice, creativeSlice, distributionSlice | ~15-20 |
| 🟡 P1 | **Component rendering** | ChatOverlay, Sidebar, CommandBar, Creative panels | ~15-20 |
| 🟢 P2 | **Distribution pipeline** | DDEX generation, adapter methods | ~10 |
| 🟢 P2 | **Utility functions** | Export, cleanup, identity services | ~10 |
| 🟢 P2 | **E2E flows** | Onboarding → Dashboard → Creative → Generate | ~5-10 |

### Recommended Test Strategy

1. **Immediately**: Add integration tests for every service that writes to Firestore (mock Firestore)
2. **Next Sprint**: Add agent routing tests (does the right agent get the right context?)
3. **Pre-Launch**: E2E with Playwright for the 5 most critical user flows

---

## 7. Agent System Health

### Agent Roster

| Agent | Status | Notes |
|---|---|---|
| GeneralistAgent (hub) | ✅ Working | Persona propagation fixed, rules 1-9 clean |
| Creative Director | ✅ Working | Prompt updated with internal-engine enforcement |
| Brand Agent | ⭐⭐⭐ | Exists in registry |
| Finance Agent | ⭐⭐⭐ | Exists, can query expenses |
| Legal Agent | ⭐⭐⭐ | Wired to LegalTools |
| Marketing Agent | ⭐⭐⭐ | Good integration with CampaignAIService |
| Music Agent | ⭐⭐ | Exists but Essentia.js integration depth unclear |
| Publishing Agent | ⭐⭐ | Generates ISWCs (AI mock, not real registry) |
| Road Manager | ⭐⭐⭐ | Touring integration |
| Social Agent | ⭐⭐ | Needs scheduled_posts fix first |
| Video Agent | ⭐⭐ | Veo 3.1 wired but untested |
| Publicist Agent | ⭐⭐ | Campaign management |
| Licensing Agent | ⭐⭐ | Basic structure |

### Agent Issues to Fix

1. **Context window management**: No pruning for long conversations → eventually hits token limit
2. **Memory recall reliability**: `recall_memories` tool exists but RAG retrieval quality untested
3. **Multi-turn tool chaining**: Agent sometimes calls multiple tools when ONE AND DONE rule should stop it
4. **Error recovery**: When a tool fails, agent doesn't always gracefully handle it

---

## 8. Known Bugs (Active Tracker)

### 🔴 Critical (Data Loss / Broken Functionality)

| ID | Bug | Module | Status | Branch |
|---|---|---|---|---|
| BUG-001 | Cloud Storage uploads disabled — images are data URI only | Creative | 🟡 Open | — |
| BUG-002 | `scheduled_posts` has no Firestore rules | Social | 🟡 Open | — |
| BUG-003 | `smart_contracts` & `ledger` have no Firestore rules | Legal/Blockchain | 🟡 Open | — |
| BUG-004 | `processed_reports` has no Firestore rules | Distribution/DDEX | 🟡 Open | — |

### 🟡 Medium (Degraded Experience)

| ID | Bug | Module | Status | Branch |
|---|---|---|---|---|
| BUG-005 | Licensing "Draft License" button → `console.info` (placeholder) | Licensing | 🟡 Open | — |
| BUG-006 | Legal "Find Counsel" → hardcoded external URL (placeholder) | Legal | 🟡 Open | — |
| BUG-007 | AGENTS.md/agents.md case sensitivity phantom diffs | Git | ⚠️ Chronic | — |
| BUG-008 | 38 stale git stashes consuming disk | Git | ⚠️ Chronic | — |
| BUG-009 | GitHub CLI auth expired (`gh auth login` needed) | DevOps | 🟡 Open | — |

### ✅ Recently Fixed

| ID | Bug | Module | Fixed In |
|---|---|---|---|
| BUG-F01 | AI timeout errors | Agent | `fix/persona-publicist-legal-bugs` |
| BUG-F02 | Image generation 400 error | Creative | `Fix/gemini-secret-verification` |
| BUG-F03 | AI hallucinating wrong artist names | Agent | `fix/persona-publicist-legal-bugs` |
| BUG-F04 | Publicist campaigns not persisting | Publicist | `fix/persona-publicist-legal-bugs` |
| BUG-F05 | Legal quick tools not wired | Legal | `fix/persona-publicist-legal-bugs` |
| BUG-F06 | Agent hallucinating external tools (Midjourney/DALL-E) | Agent | `Fix/gemini-secret-verification` |

---

## 9. Prioritized Sprint Plan

### 🔴 Sprint 1: "Stop the Bleeding" (1-2 days)

**Goal:** Fix all silent data loss issues and re-enable image persistence.

| # | Task | Files | Est. |
|---|---|---|---|
| 1.1 | Add missing Firestore rules (scheduled_posts, smart_contracts, ledger, processed_reports, dsr_processed_reports) | `firestore.rules` | ✅ Done |
| 1.2 | Verify each Service includes `userId` in the data it writes | 4 service files | ✅ Done |
| 1.3 | Re-enable Cloud Storage uploads for generated images | `ImageGenerationService.ts` | ✅ Done |
| 1.4 | Fix CORS on Firebase Storage bucket (or use signed URLs) | GCP Console + service | 1-2 hours |
| 1.5 | Deploy firestore.rules to production | Firebase CLI | 15 min |

### 🟡 Sprint 2: "Test the Foundation" (3-5 days)

**Goal:** Get test coverage to ≥50 tests covering all critical services.

| # | Task | Est. |
|---|---|---|
| 2.1 | Write integration tests for AIService (mocked Gemini) | 4 hours |
| 2.2 | Write integration tests for PublicistService, MarketingService, FinanceService | 6 hours |
| 2.3 | Write integration tests for AgentService + WorkflowCoordinator routing | 4 hours |
| 2.4 | Write SocialService tests (with scheduled_posts) | 2 hours |
| 2.5 | Write component render tests for ChatOverlay, Sidebar, Dashboard | 4 hours |
| 2.6 | Add CI timeout guards to prevent hanging test runs | 2 hours |

### 🟢 Sprint 3: "Wire the Business" (5-7 days)

**Goal:** Connect stub services to real APIs.

| # | Task | Est. |
|---|---|---|
| 3.1 | Wire SymphonicAdapter to real Symphonic API | 1-2 days |
| 3.2 | Wire DistroKidAdapter (if API available) or remove | 1 day |
| 3.3 | Build revenue import pipeline (DSR → Firestore) | 2 days |
| 3.4 | Wire Licensing "Draft" button to real modal + persistence | 4 hours |
| 3.5 | Build contract PDF generation in Legal module | 1 day |
| 3.6 | Connect social module to at least ONE platform OAuth | 1-2 days |

### 🔵 Sprint 4: "Polish the Experience" (5-7 days)

**Goal:** UX polish, empty states, error handling.

| # | Task | Est. |
|---|---|---|
| 4.1 | Add empty state designs for all modules | 1-2 days |
| 4.2 | Add loading skeletons for all data-fetching views | 1 day |
| 4.3 | Add error boundaries to each module | 4 hours |
| 4.4 | Add Toast notifications for all CRUD operations | 4 hours |
| 4.5 | Audit + fix all `console.info('placeholder')` calls | 2 hours |
| 4.6 | Add keyboard shortcuts for power users | 4 hours |
| 4.7 | Mobile responsiveness audit (all 25 modules) | 2 days |

### 🟣 Sprint 5: "Agent Intelligence" (3-5 days)

**Goal:** Make the AI agent system production-reliable.

| # | Task | Est. |
|---|---|---|
| 5.1 | Implement context window pruning (max token limit) | 4 hours |
| 5.2 | Add structured output validation for all agent tool returns | 4 hours |
| 5.3 | Test all 12 specialist agents with real prompts | 1-2 days |
| 5.4 | Add fallback handling when agent tools fail | 4 hours |
| 5.5 | Improve memory recall quality (RAG tuning) | 1 day |

### ⚫ Sprint 6: "Launch Prep" (3-5 days)

**Goal:** Production readiness.

| # | Task | Est. |
|---|---|---|
| 6.1 | Enable App Check for production | 2 hours |
| 6.2 | Audit all Firestore rules for security (no overly permissive rules) | 4 hours |
| 6.3 | Set up monitoring (Cloud Monitoring + alerts) | 4 hours |
| 6.4 | Build Electron installer and test on macOS/Windows/Linux | 1-2 days |
| 6.5 | Performance audit (Lighthouse, bundle size, lazy loading) | 4 hours |
| 6.6 | Set up Stripe production keys + subscription tiers | 4 hours |
| 6.7 | Write user documentation / help system | 1-2 days |

---

## 10. Technical Debt Register

| ID | Debt | Severity | Location |
|---|---|---|---|
| TD-001 | Distribution adapters commented out in `index.ts` | 🟡 | `src/services/distribution/index.ts` |
| TD-002 | 38 stale git stashes | 🟢 | `.git/refs/stash` |
| TD-003 | Case-insensitive file conflict (AGENTS.md) | 🟡 | Root directory |
| TD-004 | `console.info('Open draft modal')` placeholder in Licensing | 🟡 | `LicensingDashboard.tsx:97` |
| TD-005 | Hardcoded external URL for counsel directory | 🟡 | `LegalDashboard.tsx:131` |
| TD-006 | Placeholder `lat: 0, lng: 0` in touring geocoding | 🟢 | `OnTheRoadTab.tsx:136` |
| TD-007 | Template library TODO in WorkflowLab | 🟢 | `WorkflowLab.tsx` |
| TD-008 | Design templates are static data, not from Firestore | 🟢 | `src/services/design/templates.ts` |
| TD-009 | Onboarding modal passes empty array as placeholder for files | 🟡 | `OnboardingModal.tsx:116` |
| TD-010 | `placeholder:dev-data-uri-too-large` in CreativeGallery | 🟡 | `CreativeGallery.tsx:72` |

---

## Appendix: Quick Reference Commands

```bash
# Dev
npm run dev                    # Vite on :4242
npm run desktop:dev            # Electron

# Build & Deploy
npm run build                  # Typecheck + lint + build
npm run deploy                 # Firebase deploy (studio)

# Test
npm test                       # Watch mode
npm test -- --run              # CI mode
npm run test:e2e               # Playwright

# Firebase
firebase deploy --only firestore:rules   # Deploy rules only
firebase deploy --only hosting:app       # Deploy app only

# Git
gh auth login                  # Fix expired credentials
git stash list                 # See all 38 stashes
git stash drop stash@{N}       # Clean up old stashes
```

---

*This document should be updated after each sprint. Last audit: 2026-02-13.*
