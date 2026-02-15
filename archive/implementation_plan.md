# Implementation Plan - Component Kit Integration

This plan outlines the steps to integrate **Prompt Kit**, **Motion Primitives**, and **Kokonut UI** into the Rndr-AI-v1 project to enhance the UI/UX.

## User Review Required

> [!IMPORTANT]
> This plan involves manually configuring `shadcn/ui` infrastructure (`components.json`, `lib/utils.ts`) as it appears to be missing or non-standard.
> We will be replacing existing UI elements (File Drop, Assistant Input) with new components.

## Proposed Changes

### 1. Setup & Infrastructure

* **[NEW]** `src/lib/utils.ts`: Create standard `cn` utility for Tailwind class merging.
* **[NEW]** `components.json`: Create configuration file to enable `shadcn` CLI and registry support.
* **[NEW]** `src/components/ui`: Create directory for atomic components.

### 2. File Upload UI (Kokonut UI)

* **Goal**: Improve the file drop area and add "Take a picture" support.
* **Action**: Install Kokonut UI `file-upload` component.
* **Target**: Replace existing file drop implementation (likely in `VideoWorkflow.tsx` or `AssetManager`).

### 3. Assistant Input (Prompt Kit)

* **Goal**: Standardize and enhance the AI chat input.
* **Action**: Install Prompt Kit `prompt-input` component.
* **Target**: `src/app/assistant/page.tsx`. Replace the current `<textarea>` with `<PromptInput>`.

### 4. Visual Polish (Motion Primitives)

* **Goal**: Add "delight" to the UI.
* **Action**: Install Motion Primitives `text-effect`.
* **Target**: Apply to the "Hello" or welcome message in the Assistant view.

## Verification Plan

### Manual Verification

1. **File Upload**:
    * Drag and drop a file -> Verify it is accepted.
    * Click to upload -> Verify file picker opens.
    * Check mobile view for "Take a picture" option (if supported by component) or ensure responsive layout.
2. **Assistant Input**:
    * Type text -> Verify auto-resize.
    * Press Enter -> Verify message sends.
    * Shift+Enter -> Verify new line.
3. **Text Effect**:
    * Reload Assistant page -> Verify welcome text animates in.

---

# --- ARCHIVED MASTER_COMPLETION_PLAN.md ---

# Master Feature Completion Plan

This document serves as the single source of truth for the remaining implementation tasks to reach Release Candidate (RC1) status.

---

## 1. Video Infrastructure

### 1.1 Video Backend (Cloud Functions)

- [ ] **Implement `generateVideoFn` in `functions/src/index.ts`**
  * Replace placeholder with Vertex AI Veo-3.1 API integration.
  * Handle parameters: prompt, aspect ratio, duration.
  * Implement signed URL generation for output storage.
  * Add error handling and retry logic.
* [ ] **Job Status Management**
  * Implement status updates to Firestore (`videoJobs` collection).
  * Track states: `queued`, `processing`, `complete`, `failed`.

### 1.2 Video Studio Export (Frontend)

- [ ] **Implement Local Rendering Service**
  * Create `src/services/video/RenderService.ts`.
  * Use `@remotion/renderer` (or browser-based equivalent if Node not available) to render compositions.
  * *Note:* Since this is a browser/electron app, we might need to rely on the Cloud Function for high-quality rendering, or a local FFMPEG binary if Electron-capable. The plan suggests "Local Rendering Service" but also "Backend API Setup". We will prioritize the Backend API (Veo) first as it's the AI generation part, then look at composition rendering.

---

## 2. Agent System Expansion

The following agents currently exist as definitions but lack specialized tool implementations.

### 2.1 Brand Manager (`src/services/agent/definitions/BrandAgent.ts`)

- [ ] Implement `analyze_brand_consistency`: Check content against Brand Kit.
* [ ] Implement `generate_brand_guidelines`: Create structured guidelines from assets.
* [ ] Implement `audit_visual_assets`: Verify color palettes and typography.

### 2.2 Marketing Manager (`src/services/agent/definitions/MarketingAgent.ts`)

- [ ] Implement `create_campaign_brief`: Generate structured campaign plans.
* [ ] Implement `analyze_audience`: Demographic analysis (mock or API).
* [ ] Implement `schedule_content`: Calendar generation.

### 2.3 Publicist (`src/services/agent/definitions/PublicistAgent.ts`)

- [ ] Implement `write_press_release`: Format standard PR text.
* [ ] Implement `generate_crisis_response`: PR crisis management templates.
* [ ] Implement `pitch_story`: Email pitch generation.

### 2.4 Road Manager (`src/services/agent/definitions/RoadAgent.ts`)

- [ ] Implement `plan_tour_route`: Logistics optimization.
* [ ] Implement `calculate_tour_budget`: Cost estimation.
* [ ] Implement `generate_itinerary`: Detailed day-sheets.

### 2.5 Security Guardian (`src/services/agent/definitions/SecurityAgent.ts`)

- [ ] Implement `audit_permissions`: Check project access levels.
* [ ] Implement `scan_for_vulnerabilities`: Config audit.

---

## 3. Distribution System (DDEX)

### 3.1 DDEX Services (`src/services/ddex/`)

- [ ] **Complete `ERNService.ts`**
  * Implement `mapContributors`, `mapResources`, `mapDeals`.
  * Ensure ERN 4.3 compliance for AI flagging.
* [ ] **Implement `DSRService.ts`**
  * Parse sales reports (XML/CSV) into Firestore `dsrReports`.

### 3.2 Adapters (`src/services/distribution/adapters/`)

- [ ] **DistroKid Adapter**: Implement `submitRelease`, `getEarnings`.
* [ ] **TuneCore Adapter**: Implement `submitRelease`, `getEarnings`.
* [ ] **CD Baby Adapter**: Implement `submitRelease`, `getEarnings`.

### 3.3 UI Components (`src/modules/publishing/`)

- [ ] `DistributorConnectionsPanel`: Manage API keys.
* [ ] `ReleaseStatusCard`: Track delivery status.
* [ ] `EarningsDashboard`: Visualize revenue from DSRs.

---

## 4. Social Commerce & Revenue

### 4.1 Revenue System

- [ ] **Create `src/services/RevenueService.ts`**
  * Aggregate revenue from `dsrReports` (Distribution) and `storeOrders` (Merch).
  * Provide `getTotalRevenue`, `getRevenueBySource`.

### 4.2 Social Drops

- [ ] **Update `SocialFeed`**
  * Support embedded `ProductCard` in posts.
  * "Buy Now" flow integration.

---

## 5. Financial & Integrity

### 5.1 Refactor `useFinance`

- [ ] Remove demo logic.
* [ ] Connect to `RevenueService` and `ExpenseService` (if exists) or Firestore.

### 5.2 Earnings Dashboard

- [ ] Update UI to V5.0 standards (Glassmorphism).
* [ ] Real-time data binding.

---

## Execution Order

1. **Video Infrastructure** (Backend + Export)
2. **Agent Expansion** (Tools Implementation)
3. **Distribution & Finance** (DDEX, Adapters, Revenue Service)
4. **Social Commerce** (UI integration)

---

# --- ARCHIVED docs/FEATURE_COMPLETION_PLAN.md ---

# indiiOS Feature Completion Plan

**Date:** 2025-12-26
**Scope:** Distribution System, Agent Implementations, Video Backend, Social Drops + Revenue

---

## Overview

This plan addresses 4 major gaps in the indiiOS platform plus additional overlooked items discovered during a comprehensive codebase audit. Each section is self-contained and can be executed independently.

---

## 1. Distribution System Completion

**Current State:** Adapter infrastructure exists but implementations are empty stubs.

### 1.1 Complete DDEX/ERN Service

**Files to modify:**

* `src/services/ddex/ERNService.ts` - Complete TODOs at lines 54-62

**Tasks:**

* [ ] Implement contributor mapping from ExtendedGoldenMetadata
* [ ] Implement resource list mapping (audio files, cover art)
* [ ] Implement deal list population for different release profiles
* [ ] Add Release Profile validation in `DDEXValidator.ts`

### 1.2 Implement Distribution Adapters

**Files to create/modify:**

* `src/services/distribution/adapters/DistroKidAdapter.ts`
* `src/services/distribution/adapters/CDBabyAdapter.ts`
* `src/services/distribution/adapters/SymphonicAdapter.ts`

**Tasks per adapter:**

* [ ] Implement `authenticate()` - OAuth or API key flow
* [ ] Implement `submitRelease(release: ERNMessage)` - Upload DDEX batch
* [ ] Implement `getStatus(releaseId: string)` - Poll delivery status
* [ ] Implement `getRoyalties(period: DateRange)` - Fetch royalty reports
* [ ] Add credential storage via `CredentialService` (Keytar for Electron)

### 1.3 Currency Conversion

**File:** `src/services/distribution/DistributorService.ts:360`

**Tasks:**

* [ ] Integrate currency conversion API (Open Exchange Rates or similar)
* [ ] Add conversion cache to avoid rate limit hits
* [ ] Display converted amounts in user's preferred currency

### 1.4 Testing

* [ ] Add unit tests for each adapter (mock API responses)
* [ ] Add integration test for full submission flow

---

## 2. Agent System Completion

**Current State:** 5 agents have framework only - system prompts exist but no tool implementations.

### 2.1 Brand Manager Agent

**File:** `src/services/agent/specialists/BrandAgent.ts`

**Tasks:**

* [ ] Implement `analyze_brand_consistency` - Compare content against brand kit
* [ ] Implement `generate_brand_guidelines` - Create brand book from assets
* [ ] Implement `audit_visual_assets` - Check color palette, typography compliance
* [ ] Wire functions to TOOL_REGISTRY

### 2.2 Marketing Agent

**File:** `src/services/agent/specialists/MarketingAgent.ts`

**Tasks:**

* [ ] Implement `create_campaign_brief` - Generate marketing campaign outline
* [ ] Implement `analyze_audience` - Demographics and engagement analysis
* [ ] Implement `schedule_content` - Calendar-based content planning
* [ ] Implement `track_performance` - KPI tracking and reporting
* [ ] Add tools array with function declarations

### 2.3 Publicist Agent

**File:** `src/services/agent/specialists/PublicistAgent.ts`

**Tasks:**

* [ ] Implement `write_press_release` - Generate PR copy from event/announcement
* [ ] Implement `generate_crisis_response` - Draft crisis communication
* [ ] Implement `manage_media_list` - Contact database operations
* [ ] Implement `pitch_story` - Generate pitch emails for journalists

### 2.4 Road Manager Agent

**File:** `src/services/agent/specialists/RoadAgent.ts`

**Tasks:**

* [ ] Implement custom `plan_tour_route` - Optimize venue sequence
* [ ] Implement `calculate_tour_budget` - Estimate costs per leg
* [ ] Implement `book_logistics` - Coordinate travel, lodging
* [ ] Implement `generate_itinerary` - Day-by-day schedule with all details
* [ ] Wire existing MapsTools (search_places, get_distance_matrix)

### 2.5 Security Guardian Agent

**File:** `src/services/agent/specialists/SecurityAgent.ts`

**Tasks:**

* [ ] Implement `audit_permissions` - Review org/project access
* [ ] Implement `scan_for_vulnerabilities` - Check API configs
* [ ] Implement `rotate_credentials` - Automated key rotation workflow
* [ ] Implement `generate_security_report` - Summary of security posture

### 2.6 Enable Agents

**File:** `src/services/agent/agentConfig.ts`

**Tasks:**

* [ ] Uncomment BrandAgent, DevOpsAgent, RoadAgent, SecurityAgent
* [ ] Add new tools to TOOL_REGISTRY exports
* [ ] Update AgentOrchestrator routing logic if needed

---

## 3. Video Generation Backend

**Current State:** Inngest handler is a placeholder returning static message.

### 3.1 Implement Veo-3.1 Integration

**File:** `functions/src/index.ts` (around line 109)

**Tasks:**

* [ ] Replace placeholder with actual Vertex AI Veo-3.1 API call
* [ ] Handle video generation parameters (duration, aspect ratio, style)
* [ ] Implement signed URL generation for output storage
* [ ] Add proper error handling and retry logic

### 3.2 Job Status Management

**Files:**

* `functions/src/index.ts` - Add status update function
* Firestore collection: `videoJobs`

**Tasks:**

* [ ] Create `updateVideoJobStatus` callable function
* [ ] Track states: queued → processing → complete/failed
* [ ] Store output URL and metadata on completion
* [ ] Implement webhook callback for Veo completion

### 3.3 Frontend Integration

**File:** `src/services/video/VideoGenerationService.ts`

**Tasks:**

* [ ] Add polling mechanism for job status
* [ ] Handle progress updates in UI
* [ ] Display generated video in VideoStudio

### 3.4 Testing

**File:** `functions/src/__tests__/video.test.ts` (create)

**Tasks:**

* [ ] Mock Vertex AI responses
* [ ] Test job queuing and status updates
* [ ] Test error scenarios (quota exceeded, invalid prompts)

---

## 4. Social Drops + Revenue System

**Current State:** Per spec in `docs/specifications/SOCIAL_DROPS_IMPLEMENTATION.md`

### 4.1 Update Post Schema

**File:** `src/types/social.ts` (or create if missing)

**Tasks:**

* [ ] Add `productId?: string` to SocialPost interface
* [ ] Add Firestore index for `productId` queries

### 4.2 ProductCard Embedded Variant

**File:** `src/modules/marketplace/ProductCard.tsx`

**Tasks:**

* [ ] Add `variant: 'default' | 'embedded'` prop
* [ ] Create compact layout for feed display
* [ ] Add quick purchase button
* [ ] Show price and availability inline

### 4.3 Update SocialFeed

**File:** `src/modules/social/SocialFeed.tsx`

**Tasks:**

* [ ] Detect posts with `productId`
* [ ] Render embedded ProductCard within post
* [ ] Add "Shop Now" CTA linking to checkout
* [ ] Fetch product data on mount (batch query)

### 4.4 Product Picker in PostComposer

**File:** `src/modules/social/PostComposer.tsx`

**Tasks:**

* [ ] Add "Attach Product" button
* [ ] Create ProductPickerModal component
* [ ] Show selected product preview before posting
* [ ] Validate product exists and is active

### 4.5 Create RevenueService

**File:** `src/services/RevenueService.ts` (create)

```typescript
interface RevenueEntry {
  id: string;
  productId: string;
  amount: number;
  source: 'direct' | 'social_drop';
  customerId: string;
  timestamp: Timestamp;
}

class RevenueService {
  getTotalRevenue(userId: string): Promise<number>;
  getRevenueByPeriod(userId: string, start: Date, end: Date): Promise<number>;
  getRevenueByProduct(userId: string): Promise<Map<string, number>>;
  getRevenueBySource(userId: string): Promise<{direct: number, social: number}>;
  recordSale(entry: Omit<RevenueEntry, 'id'>): Promise<void>;
}
```

**Tasks:**

* [ ] Implement all methods with Firestore queries
* [ ] Add caching for dashboard performance
* [ ] Add real-time listener for live updates

### 4.6 Revenue Dashboard Components

**Files to create:**

* `src/modules/dashboard/components/RevenueView.tsx`
* `src/modules/dashboard/components/SalesAnalytics.tsx`

**Tasks:**

* [ ] Total revenue display (all time + period)
* [ ] Revenue breakdown by product chart
* [ ] Revenue by source (direct vs social drops)
* [ ] Sales over time line chart
* [ ] Top performing products list
* [ ] Conversion rate metrics

### 4.7 Dashboard Integration

**File:** `src/modules/dashboard/Dashboard.tsx`

**Tasks:**

* [ ] Add "Revenue" card widget
* [ ] Show gamified progress (e.g., "50% to first $1000!")
* [ ] Link to full RevenueView

### 4.8 E2E Tests

**Files to create:**

* `e2e/merchant-product-creation.spec.ts`
* `e2e/merchant-social-drop.spec.ts`
* `e2e/merchant-purchase.spec.ts`
* `e2e/merchant-revenue.spec.ts`

---

## Execution Order (Recommended)

| Phase | Feature | Dependencies | Effort |
|-------|---------|--------------|--------|
| 1 | Video Backend | None | Medium |
| 2 | Agent Implementations | None | High |
| 3 | Distribution System | Agents (optional) | High |
| 4 | Social Drops + Revenue | Video (for promos) | High |

**Rationale:**

* Video backend is foundational and has no dependencies
* Agents can work in parallel with distribution
* Social Drops benefits from having video generation working (promo videos for products)

---

## Files Summary

### New Files to Create

```text
src/services/RevenueService.ts
src/modules/dashboard/components/RevenueView.tsx
src/modules/dashboard/components/SalesAnalytics.tsx
src/modules/social/components/ProductPickerModal.tsx
functions/src/__tests__/video.test.ts
e2e/merchant-product-creation.spec.ts
e2e/merchant-social-drop.spec.ts
e2e/merchant-purchase.spec.ts
e2e/merchant-revenue.spec.ts
```

### Files to Modify

```text
# Distribution
src/services/ddex/ERNService.ts
src/services/ddex/DDEXValidator.ts
src/services/distribution/DistributorService.ts
src/services/distribution/adapters/DistroKidAdapter.ts
src/services/distribution/adapters/CDBabyAdapter.ts
src/services/distribution/adapters/SymphonicAdapter.ts

# Agents
src/services/agent/specialists/BrandAgent.ts
src/services/agent/specialists/MarketingAgent.ts
src/services/agent/specialists/PublicistAgent.ts
src/services/agent/specialists/RoadAgent.ts
src/services/agent/specialists/SecurityAgent.ts
src/services/agent/agentConfig.ts

# Video Backend
functions/src/index.ts

# Social Drops
src/modules/marketplace/ProductCard.tsx
src/modules/social/SocialFeed.tsx
src/modules/social/PostComposer.tsx
src/modules/dashboard/Dashboard.tsx
```

---

## Success Criteria

1. **Distribution:** Artist can submit release via UI and see delivery status
2. **Agents:** All 5 agents respond with specialized tool outputs
3. **Video:** Jobs complete within 5 minutes, video plays in studio
4. **Social Drops:** Products render in feed, purchases update revenue dashboard

---

## 5. OVERLOOKED ITEMS (Additional Gaps from Audit)

### 5.1 Critical - Must Fix

#### Distribution Adapter Earnings - PARTIALLY FIXED

**Files:**

* `src/services/distribution/adapters/TuneCoreAdapter.ts:201`
* `src/services/distribution/adapters/CDBabyAdapter.ts:208`

**Issue:** `getEarnings()` methods threw "Method not implemented" - now return mocks.

**Tasks:**

* [x] Fix crash by implementing mock return (Completed)
* [ ] Implement actual TuneCore earnings API integration (Pending keys)
* [ ] Implement actual CD Baby earnings API integration (Pending keys)
* [ ] Add error handling for API failures

#### Type Safety Issues - 219 `any` Usages

**High-priority files:**

* `src/services/distribution/adapters/TuneCoreAdapter.ts`
* `src/modules/onboarding/pages/OnboardingPage.tsx`
* `src/core/App.tsx`

**Tasks:**

* [ ] Replace `any` with proper types in adapter files
* [ ] Fix malformed type annotations in `DistributorService.ts:63-64`

#### Deprecated RAG Methods Still Present - FIXED

**File:** `src/services/rag/GeminiRetrievalService.ts`

**Issue:** Methods throw "Deprecated" but still exist.

**Tasks:**

* [x] Remove deprecated methods (Completed)
* [x] Update any callers to use new API (Completed)

---

### 5.2 High Priority - Security & Stability

#### Missing Error Boundaries - FIXED

**Issue:** Only 1 ErrorBoundary exists (at root). Module crashes propagate up.

**Tasks:**

* [x] Add ErrorBoundary to Creative Studio (Completed)
* [x] Add ErrorBoundary to Video Studio (Completed)
* [x] Add ErrorBoundary to Music Studio (Completed)
* [x] Add ErrorBoundary to Workflow Lab (Completed)
* [x] Add ErrorBoundary to Publishing Dashboard (Completed)

#### Security Concerns - FIXED

**JSON.parse without try-catch (25 files)**

* Risk of runtime crashes on malformed data.

**Credential Logging:**

* `TuneCoreAdapter.ts:79` logs token prefix to console (Verified fixed in current version).

**Tasks:**

* [x] Wrap JSON.parse calls in try-catch (Completed)
* [x] Remove token logging from adapters (Verified)
* [ ] Audit SFTP temp file cleanup in CDBabyAdapter

#### Timer/Interval Memory Leaks

**Issue:** 34 instances of setInterval/setTimeout - not all cleaned up

**Tasks:**

* [ ] Audit all timer usages for proper cleanup
* [ ] Add cleanup to useEffect dependencies where missing

---

### 5.3 Medium Priority - Code Quality

#### Publishing Module Refresh Bug

**File:** `src/modules/publishing/components/ReleaseWizard.tsx:220`

**Issue:** TODO comment - releases list doesn't refresh after distribution

**Tasks:**

* [ ] Implement release list refresh after successful distribution
* [ ] Add loading state during refresh

#### Hardcoded Currency

**File:** `src/services/distribution/DistributorService.ts:360`

**Issue:** USD hardcoded, no currency conversion

**Tasks:**

* [ ] Add user currency preference to settings
* [ ] Integrate currency conversion API
* [ ] Display amounts in user's preferred currency

#### Deep Relative Imports (15 files) - PARTIALLY FIXED

**Issue:** Files using `../../../` imports - fragile

**Affected modules:**

* Workflow
* Video
* Dashboard

**Tasks:**

* [x] Refactor to use `@/` path alias (Major modules updated)
* [ ] Update tsconfig paths if needed

#### Dead Code - FIXED

**Files:**

* `src/genkit/flows.js`
* `src/genkit/server.js`

**Tasks:**

* [x] Remove legacy Genkit files (moved to backend) (Completed)

---

### 5.4 Low Priority - Accessibility & Polish

#### Accessibility Gaps

**Issue:** Only 9 files use ARIA attributes

**Tasks:**

* [ ] Add `aria-label` to Sidebar navigation buttons
* [ ] Add `role="dialog"` to modal components
* [ ] Add keyboard trap to modals
* [ ] Add visible focus indicators
* [ ] Audit color contrast for WCAG compliance

#### Performance Optimization

**Issue:** Only 14 files use memoization

**Tasks:**

* [ ] Add React.memo to CreativeGallery
* [ ] Add React.memo to CampaignManager
* [ ] Add useMemo/useCallback to VideoPanel
* [ ] Add useMemo/useCallback to CreativePanel

#### Code Organization

**Issue:** Agent implementations scattered across:

* `src/agents/`
* `src/services/agent/specialists/`

**Tasks:**

* [ ] Consolidate agent implementations
* [ ] Standardize module structure

---

## 6. Complete Issue Inventory

### By Severity

| Severity | Count | Examples |
|----------|-------|----------|
| **Critical** | 6 | Earnings broken, DDEX incomplete, deprecated methods |
| **High** | 8 | Error boundaries, security, timer leaks |
| **Medium** | 10 | Type safety, dead code, deep imports |
| **Low** | 6+ | Accessibility, memoization, organization |

### By Category

| Category | Issues |
|----------|--------|
| Distribution System | 8 (adapters, DDEX, currency) |
| Agent System | 5 (framework-only agents) |
| Video Backend | 4 (placeholder, job status) |
| Social Drops | 8 (schema, UI, revenue) |
| Code Quality | 6 (types, imports, dead code) |
| Security | 4 (JSON parse, logging, SFTP) |
| Performance | 3 (timers, memoization) |
| Accessibility | 5 (ARIA, keyboard, focus) |
| Error Handling | 5 (boundaries per module) |

---

## 7. Recommended Execution Phases

### Phase A: Foundation Fixes (Before New Features)

1. Fix distribution adapter `getEarnings()` crashes
2. Add Error Boundaries to all major modules
3. Fix security issues (JSON.parse, credential logging)
4. Remove deprecated RAG methods

### Phase B: Core Features (Original 4 Priorities)

1. Video Generation Backend
2. Agent Implementations (5 agents)
3. Distribution System Completion
4. Social Drops + Revenue

### Phase C: Polish & Optimization

1. Type safety improvements
2. Accessibility additions
3. Performance optimization
4. Code organization cleanup

---

## 8. Files Quick Reference

### Critical Fixes

```text
src/services/distribution/adapters/TuneCoreAdapter.ts
src/services/distribution/adapters/CDBabyAdapter.ts
src/services/rag/GeminiRetrievalService.ts
src/services/distribution/DistributorService.ts
```

### Error Boundaries Needed

```text
src/modules/creative/CreativeStudio.tsx
src/modules/video/VideoStudio.tsx
src/modules/music/MusicStudio.tsx
src/modules/workflow/WorkflowLab.tsx
src/modules/publishing/PublishingDashboard.tsx
```

### Dead Code to Remove

```text
src/genkit/flows.js
src/genkit/server.js
```

### Deep Import Refactors

```text
src/modules/workflow/**
src/modules/video/**
src/modules/dashboard/**
```

---

## 9. Social Media Module Next Steps (Post-Beta Logic)

**Status:** Logic completed (BETA_READY), pending production verification.

**Tasks:**

* [ ] **Release Candidate Testing:**
  * Deploy current build to staging environment.
  * Verify `useSocial` hook behavior in production build.
  * Test `SocialDashboard` with live Firebase data.

* [ ] **User Acceptance Testing (UAT):**
  * Verify "Create Post" flow with attached products (Social Drops).
  * Validate real-time stats updates (Reach, Engagement).
  * Test "Share" functionality across platforms.

* [ ] **Documentation Verification:**
  * Audit `docs/HOOKS.md` for complete API accuracy.
  * Audit `walkthrough.md` for process integrity.

---

# --- ARCHIVED GAP_ANALYSIS_PLAN.md ---

# IMPLICATION: GAP ANALYSIS & FILLING PLAN

## 1. Onboarding & Profile (Priority: High)

* **Status**: **CRITICAL GAP**
* **Issue**: `src/services/storage/repository.ts` has a hardcoded `CURRENT_USER_ID = 'superuser-id'`.
* **Impact**: All profiles are saved to the same ID on the cloud. Real authentication is ignored by the repository layer.
* **Fix**:
  * Update `repository.ts` to accept `userId` as an argument or fetch it from `firebase/auth` directly.
  * Update `ProfileSlice` to pass the correct `uid` to storage methods.

## 2. Music Studio (Priority: Medium)

* **Status**: **GAP DETECTED**
* **Issue**: `MusicStudio` scans files and runs heavy analysis (Essentia WASM) but stores results in local React state. Reloading loses all analysis.
* **Fix**:
  * Create `MusicLibraryService` (Firestore `music_library` collection).
  * Store: `filePath` (or hash), `bpm`, `key`, `energy`, `fingerprint`.
  * checking existing entries before re-analyzing.

## 3. Creative Canvas (Priority: Medium)

* **Status**: **PARTIAL GAP**
* **Issue**: `saveCanvas` only triggers a browser download.
* **Fix**:
  * Add "Save to Project" button in `CreativeCanvas`.
  * Upload PNG to Firebase Storage.
  * Create `Asset` entry in `assets` collection (linked to Project).

## 4. Video Director (Priority: Low)

* **Status**: [CHECKING STORE]
* **Gap**: `VideoDirector` calls `addToHistory`. We are verifying if `addToHistory` in `index.ts` actively persists to Firestore.
* **Plan**: If `addToHistory` is just local state, we need to add persistence there too.

## 5. Audio Analysis

* **Status**: **EPHEMERAL**
* **Fix**: Covered by `MusicLibraryService`.

## Action Plan

1. [x] Check `ProfileSlice`.
2. [x] Check `VideoDirector`.
3. [ ] Check `store/index.ts` for history persistence.
4. [ ] Implement `MusicLibraryService` & Update `MusicStudio`.
5. [ ] Fix `repository.ts` hardcoded ID.
6. [ ] Update `CreativeCanvas` with "Save to Asset".

---

# --- ARCHIVED docs/AUTH_IMPLEMENTATION_PLAN.md ---

# Authentication System Implementation Plan

**Status:** In Progress
**Last Updated:** 2025-12-24
**Current Phase:** Phase 5 & 7 - Integration & Upgrades

---

## Overview

Implement full authentication (email/password + Google OAuth) for indiiOS, with auth UI on the landing page and protected access to the studio app.

---

## Current State

| Component | Status |
|-----------|--------|
| Firebase Project | `indiios-v-1-1` (configured) |
| Current Auth | Email/Pass + Google + Anon |
| User Profiles | Firestore (`users` collection) |
| Organizations | Firestore with `members[]` |
| Login UI | Implemented (`/login`, `/signup`) |

---

## Phases

### Phase 1: Firebase Auth Setup (Backend)

* [ ] Enable Email/Password provider in Firebase Console
* [ ] Enable Google OAuth provider in Firebase Console
* [ ] Configure authorized domains
* [x] Create `users` collection schema (in lib/auth.ts)
* [ ] Update Firestore security rules

### Phase 1.5: Landing Page Firebase SDK ✅ COMPLETE

* [x] Install Firebase SDK
* [x] Create `lib/firebase.ts`
* [x] Create `lib/auth.ts` (all auth helper functions)
* [x] Create `.env.example`

### Phase 2: Landing Page Auth Routes ✅ COMPLETE

* [x] Add Firebase SDK to landing page
* [x] Create `/login` page
* [x] Create `/signup` page
* [x] Create `/reset-password` page
* [x] Create auth layout

### Phase 3: Auth Components ✅ COMPLETE

* [x] AuthProvider (React context)
* [x] LoginForm (email/password + Google + Electron Bridge)
* [x] SignupForm
* [x] PasswordResetForm

### Phase 4: User Service ✅ COMPLETE

* [x] Create `UserService.ts` (Integrated in `@/modules/auth/UserService.ts`)
* [x] Migrate profiles from localStorage to Firestore (Partial - New users go to Firestore)
* [x] Sync brandKit to Firestore (Implemented in `UserServicesyncUserProfile` and `authSlice`)

### Phase 5: Studio App Integration 🚧 IN PROGRESS

* [x] Remove auto `signInAnonymously()` (Disabled in `firebase.ts`)
* [x] Add auth state listener (`authSlice` handles this)
* [x] Redirect unauthenticated users to landing (`App.tsx` handles this)
* [x] Update authSlice for Firestore profiles (Connected to `UserService`)
* [ ] Verify End-to-End flow in Production Build

### Phase 6: Polish ✅ COMPLETE

* [x] Loading states
* [x] Error messages
* [x] Account settings page
* [ ] Anonymous account linking

### Phase 7: Account Upgrades & Billing Integration 🚧 IN PROGRESS

* [ ] Integrate Stripe SDK for checkout
* [ ] Create `/upgrade` pricing table on landing page
* [ ] Implement webhook for subscription sync
* [ ] Add `subscriptionStatus` to Firestore `users` collection
* [/] Verify tier limits enforcement in `MembershipService` (Limits defined)

---

## Security Rules Addition

```javascript
// firestore.rules - add to existing rules
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
}
```

---

# --- ARCHIVED docs/knowledge/MASTER_IMPLEMENTATION_PLAN.md ---

# ⚡ MAXIMUM EFFICIENCY ARTIFACT: The IndiiOS Dividend Protocol

> **Objective:** Systematically eliminate the "Artist Economy Leakage" identified in research (approx. $11k/yr lost).
> **Method:** 4-Pillar Implementation Strategy.

---

## 🏗️ Pillar 1: The "Black Box" Hunter (Metadata Fortress)

**Goal:** Recover the 10-15% of revenue lost to bad data.
**Target Module:** `src/modules/music/MusicStudio.tsx`

### 1.1 The "Golden File" Schema

We must define a strict metadata contract. No file leaves the studio without this.

```typescript
// src/services/metadata/types.ts
export interface GoldenMetadata {
    // 1. Core Identity (The "Who")
    trackTitle: string;
    artistName: string;
    isrc: string; // The License Plate
    iswc?: string; // Composition ID

    // 2. The Splits (The "Who Gets Paid")
    splits: {
        legalName: string;
        role: 'songwriter' | 'producer' | 'performer';
        percentage: number; // Must sum to 100%
        email: string;
    }[];

    // 3. Rights Admin (The "Who Collects")
    pro: 'ASCAP' | 'BMI' | 'SESAC' | 'None';
    publisher: string;
}
```

### 1.2 The Implementation Steps

1. [x] **Create Schema:** Create `src/services/metadata/types.ts`
2. [x] **Create UI:** Build `MetadataDrawer.tsx` component in `src/modules/music/components/`
    * Form fields for ISRC, Splits (with % validation).
    * "Golden Seal" visual indicator (Green Check = Ready for Release).
3. [x] **Integrate:** Add `MetadataDrawer` to `MusicStudio.tsx`.
4. [x] **Enforce:** Disable "Export" button until Golden Metadata is complete.

---

## 📉 Pillar 2: The Agent CFO (Manager Replacement)

**Goal:** Eliminate the 20% Agent/Manager tax.
**Target Agent:** `src/services/agent/definitions/FinanceAgent.ts`

### 2.1 The Logic Upgrade

The current `FinanceAgent` is passive. It must be **Proactive**.

### 2.2 The Implementation Steps

1. [x] **Inject Knowledge:** Give `FinanceAgent` access to `Artist_Economics_Deep_Dive.md` via system prompt override.
2. [x] **New Capabilities:**
    * `audit_metadata()`: Check recent tracks for "Golden File" status.
    * `forecast_revenue()`: Use the "Dividend" model to show saved fees (Gamification).
3. [ ] **Integration:** Display "Fees Saved: $XXXX" in `FinanceDashboard.tsx`.

---

## 📢 Pillar 3: The Hype Machine (PR Automation)

**Goal:** Eliminate the $3k-$5k/mo PR retainer.
**Target Agent:** `src/services/agent/definitions/PublicistAgent.ts`

### 3.1 The "Hype Engine" Workflow

1. **Input:** "Golden File" Metadata + Audio Analysis (Energy, Key).
2. **Process:**
    * Agent searches Knowledge Base for `Music_Industry_History_Deep_Dive` to find "hooks" (e.g., "This track channels the 1980s synth-pop resurgence...").
    * Generates 3 angles: "The Story", "The Industry Pitch", "The Fan Hook".
3. **Output:** Press Release PDF + 5 Social Post drafts.

### 3.2 The Implementation Steps

1. [ ] **Update Agent:** Add `generate_campaign_assets` tool to `PublicistAgent`.
2. [ ] **UI:** Add "Generate Release Kit" button in `MusicStudio` (only unlocking when Golden Metadata is present).

---

## 📦 Pillar 4: One-Click Release (Distribution)

**Goal:** Eliminate fragmentation fees.
**Target Module:** `src/modules/publishing`

*(Deferred for Phase 2 - Focus on Pillars 1-3 first)*

---

## 🚀 Execution Order (The "Right Now" Plan)

1. **Define Schema:** Create `src/services/metadata/types.ts`.
2. **Build UI:** Create `MetadataDrawer` (The "Form").
3. **Wire It Up:** Block exports in `MusicStudio` until the form is filled.
4. **Activate Agents:** Tell `FinanceAgent` to start tracking the savings.

*This artifact is your compass. Proceed efficiently.*
