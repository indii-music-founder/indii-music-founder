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

- `src/services/ddex/ERNService.ts` - Complete TODOs at lines 54-62

**Tasks:**

- [ ] Implement contributor mapping from ExtendedGoldenMetadata
- [ ] Implement resource list mapping (audio files, cover art)
- [ ] Implement deal list population for different release profiles
- [ ] Add Release Profile validation in `DDEXValidator.ts`

### 1.2 Implement Distribution Adapters

**Files to create/modify:**

- `src/services/distribution/adapters/DistroKidAdapter.ts`
- `src/services/distribution/adapters/CDBabyAdapter.ts`
- `src/services/distribution/adapters/SymphonicAdapter.ts`

**Tasks per adapter:**

- [ ] Implement `authenticate()` - OAuth or API key flow
- [ ] Implement `submitRelease(release: ERNMessage)` - Upload DDEX batch
- [ ] Implement `getStatus(releaseId: string)` - Poll delivery status
- [ ] Implement `getRoyalties(period: DateRange)` - Fetch royalty reports
- [ ] Add credential storage via `CredentialService` (Keytar for Electron)

### 1.3 Currency Conversion

**File:** `src/services/distribution/DistributorService.ts:360`

**Tasks:**

- [ ] Integrate currency conversion API (Open Exchange Rates or similar)
- [ ] Add conversion cache to avoid rate limit hits
- [ ] Display converted amounts in user's preferred currency

### 1.4 Testing

- [ ] Add unit tests for each adapter (mock API responses)
- [ ] Add integration test for full submission flow

---

## 2. Agent System Completion

**Current State:** 5 agents have framework only - system prompts exist but no tool implementations.

### 2.1 Brand Manager Agent

**File:** `src/services/agent/specialists/BrandAgent.ts`

**Tasks:**

- [ ] Implement `analyze_brand_consistency` - Compare content against brand kit
- [ ] Implement `generate_brand_guidelines` - Create brand book from assets
- [ ] Implement `audit_visual_assets` - Check color palette, typography compliance
- [ ] Wire functions to TOOL_REGISTRY

### 2.2 Marketing Agent

**File:** `src/services/agent/specialists/MarketingAgent.ts`

**Tasks:**

- [ ] Implement `create_campaign_brief` - Generate marketing campaign outline
- [ ] Implement `analyze_audience` - Demographics and engagement analysis
- [ ] Implement `schedule_content` - Calendar-based content planning
- [ ] Implement `track_performance` - KPI tracking and reporting
- [ ] Add tools array with function declarations

### 2.3 Publicist Agent

**File:** `src/services/agent/specialists/PublicistAgent.ts`

**Tasks:**

- [ ] Implement `write_press_release` - Generate PR copy from event/announcement
- [ ] Implement `generate_crisis_response` - Draft crisis communication
- [ ] Implement `manage_media_list` - Contact database operations
- [ ] Implement `pitch_story` - Generate pitch emails for journalists

### 2.4 Road Manager Agent

**File:** `src/services/agent/specialists/RoadAgent.ts`

**Tasks:**

- [ ] Implement custom `plan_tour_route` - Optimize venue sequence
- [ ] Implement `calculate_tour_budget` - Estimate costs per leg
- [ ] Implement `book_logistics` - Coordinate travel, lodging
- [ ] Implement `generate_itinerary` - Day-by-day schedule with all details
- [ ] Wire existing MapsTools (search_places, get_distance_matrix)

### 2.5 Security Guardian Agent

**File:** `src/services/agent/specialists/SecurityAgent.ts`

**Tasks:**

- [ ] Implement `audit_permissions` - Review org/project access
- [ ] Implement `scan_for_vulnerabilities` - Check API configs
- [ ] Implement `rotate_credentials` - Automated key rotation workflow
- [ ] Implement `generate_security_report` - Summary of security posture

### 2.6 Enable Agents

**File:** `src/services/agent/agentConfig.ts`

**Tasks:**

- [ ] Uncomment BrandAgent, DevOpsAgent, RoadAgent, SecurityAgent
- [ ] Add new tools to TOOL_REGISTRY exports
- [ ] Update AgentOrchestrator routing logic if needed

---

## 3. Video Generation Backend

**Current State:** Inngest handler is a placeholder returning static message.

### 3.1 Implement Veo-3.1 Integration

**File:** `functions/src/index.ts` (around line 109)

**Tasks:**

- [ ] Replace placeholder with actual Vertex AI Veo-3.1 API call
- [ ] Handle video generation parameters (duration, aspect ratio, style)
- [ ] Implement signed URL generation for output storage
- [ ] Add proper error handling and retry logic

### 3.2 Job Status Management

**Files:**

- `functions/src/index.ts` - Add status update function
- Firestore collection: `videoJobs`

**Tasks:**

- [ ] Create `updateVideoJobStatus` callable function
- [ ] Track states: queued → processing → complete/failed
- [ ] Store output URL and metadata on completion
- [ ] Implement webhook callback for Veo completion

### 3.3 Frontend Integration

**File:** `src/services/video/VideoGenerationService.ts`

**Tasks:**

- [ ] Add polling mechanism for job status
- [ ] Handle progress updates in UI
- [ ] Display generated video in VideoStudio

### 3.4 Testing

**File:** `functions/src/__tests__/video.test.ts` (create)

**Tasks:**

- [ ] Mock Vertex AI responses
- [ ] Test job queuing and status updates
- [ ] Test error scenarios (quota exceeded, invalid prompts)

---

## 4. Social Drops + Revenue System

**Current State:** Per spec in `docs/specifications/SOCIAL_DROPS_IMPLEMENTATION.md`

### 4.1 Update Post Schema

**File:** `src/types/social.ts` (or create if missing)

**Tasks:**

- [ ] Add `productId?: string` to SocialPost interface
- [ ] Add Firestore index for `productId` queries

### 4.2 ProductCard Embedded Variant

**File:** `src/modules/marketplace/ProductCard.tsx`

**Tasks:**

- [ ] Add `variant: 'default' | 'embedded'` prop
- [ ] Create compact layout for feed display
- [ ] Add quick purchase button
- [ ] Show price and availability inline

### 4.3 Update SocialFeed

**File:** `src/modules/social/SocialFeed.tsx`

**Tasks:**

- [ ] Detect posts with `productId`
- [ ] Render embedded ProductCard within post
- [ ] Add "Shop Now" CTA linking to checkout
- [ ] Fetch product data on mount (batch query)

### 4.4 Product Picker in PostComposer

**File:** `src/modules/social/PostComposer.tsx`

**Tasks:**

- [ ] Add "Attach Product" button
- [ ] Create ProductPickerModal component
- [ ] Show selected product preview before posting
- [ ] Validate product exists and is active

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

- [ ] Implement all methods with Firestore queries
- [ ] Add caching for dashboard performance
- [ ] Add real-time listener for live updates

### 4.6 Revenue Dashboard Components

**Files to create:**

- `src/modules/dashboard/components/RevenueView.tsx`
- `src/modules/dashboard/components/SalesAnalytics.tsx`

**Tasks:**

- [ ] Total revenue display (all time + period)
- [ ] Revenue breakdown by product chart
- [ ] Revenue by source (direct vs social drops)
- [ ] Sales over time line chart
- [ ] Top performing products list
- [ ] Conversion rate metrics

### 4.7 Dashboard Integration

**File:** `src/modules/dashboard/Dashboard.tsx`

**Tasks:**

- [ ] Add "Revenue" card widget
- [ ] Show gamified progress (e.g., "50% to first $1000!")
- [ ] Link to full RevenueView

### 4.8 E2E Tests

**Files to create:**

- `e2e/merchant-product-creation.spec.ts`
- `e2e/merchant-social-drop.spec.ts`
- `e2e/merchant-purchase.spec.ts`
- `e2e/merchant-revenue.spec.ts`

---

## Execution Order (Recommended)

| Phase | Feature | Dependencies | Effort |
|-------|---------|--------------|--------|
| 1 | Video Backend | None | Medium |
| 2 | Agent Implementations | None | High |
| 3 | Distribution System | Agents (optional) | High |
| 4 | Social Drops + Revenue | Video (for promos) | High |

**Rationale:**

- Video backend is foundational and has no dependencies
- Agents can work in parallel with distribution
- Social Drops benefits from having video generation working (promo videos for products)

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

- `src/services/distribution/adapters/TuneCoreAdapter.ts:201`
- `src/services/distribution/adapters/CDBabyAdapter.ts:208`

**Issue:** `getEarnings()` methods threw "Method not implemented" - now return mocks.

**Tasks:**

- [x] Fix crash by implementing mock return (Completed)
- [ ] Implement actual TuneCore earnings API integration (Pending keys)
- [ ] Implement actual CD Baby earnings API integration (Pending keys)
- [ ] Add error handling for API failures

#### Type Safety Issues - 219 `any` Usages

**High-priority files:**

- `src/services/distribution/adapters/TuneCoreAdapter.ts`
- `src/modules/onboarding/pages/OnboardingPage.tsx`
- `src/core/App.tsx`

**Tasks:**

- [ ] Replace `any` with proper types in adapter files
- [ ] Fix malformed type annotations in `DistributorService.ts:63-64`

#### Deprecated RAG Methods Still Present - FIXED

**File:** `src/services/rag/GeminiRetrievalService.ts`

**Issue:** Methods throw "Deprecated" but still exist.

**Tasks:**

- [x] Remove deprecated methods (Completed)
- [x] Update any callers to use new API (Completed)

---

### 5.2 High Priority - Security & Stability

#### Missing Error Boundaries - FIXED

**Issue:** Only 1 ErrorBoundary exists (at root). Module crashes propagate up.

**Tasks:**

- [x] Add ErrorBoundary to Creative Studio (Completed)
- [x] Add ErrorBoundary to Video Studio (Completed)
- [x] Add ErrorBoundary to Music Studio (Completed)
- [x] Add ErrorBoundary to Workflow Lab (Completed)
- [x] Add ErrorBoundary to Publishing Dashboard (Completed)

#### Security Concerns - FIXED

**JSON.parse without try-catch (25 files)**

- Risk of runtime crashes on malformed data.

**Credential Logging:**

- `TuneCoreAdapter.ts:79` logs token prefix to console (Verified fixed in current version).

**Tasks:**

- [x] Wrap JSON.parse calls in try-catch (Completed)
- [x] Remove token logging from adapters (Verified)
- [ ] Audit SFTP temp file cleanup in CDBabyAdapter

#### Timer/Interval Memory Leaks

**Issue:** 34 instances of setInterval/setTimeout - not all cleaned up

**Tasks:**

- [ ] Audit all timer usages for proper cleanup
- [ ] Add cleanup to useEffect dependencies where missing

---

### 5.3 Medium Priority - Code Quality

#### Publishing Module Refresh Bug

**File:** `src/modules/publishing/components/ReleaseWizard.tsx:220`

**Issue:** TODO comment - releases list doesn't refresh after distribution

**Tasks:**

- [ ] Implement release list refresh after successful distribution
- [ ] Add loading state during refresh

#### Hardcoded Currency

**File:** `src/services/distribution/DistributorService.ts:360`

**Issue:** USD hardcoded, no currency conversion

**Tasks:**

- [ ] Add user currency preference to settings
- [ ] Integrate currency conversion API
- [ ] Display amounts in user's preferred currency

#### Deep Relative Imports (15 files) - PARTIALLY FIXED

**Issue:** Files using `../../../` imports - fragile

**Affected modules:**

- Workflow
- Video
- Dashboard

**Tasks:**

- [x] Refactor to use `@/` path alias (Major modules updated)
- [ ] Update tsconfig paths if needed

#### Dead Code - FIXED

**Files:**

- `src/genkit/flows.js`
- `src/genkit/server.js`

**Tasks:**

- [x] Remove legacy Genkit files (moved to backend) (Completed)

---

### 5.4 Low Priority - Accessibility & Polish

#### Accessibility Gaps

**Issue:** Only 9 files use ARIA attributes

**Tasks:**

- [ ] Add `aria-label` to Sidebar navigation buttons
- [ ] Add `role="dialog"` to modal components
- [ ] Add keyboard trap to modals
- [ ] Add visible focus indicators
- [ ] Audit color contrast for WCAG compliance

#### Performance Optimization

**Issue:** Only 14 files use memoization

**Tasks:**

- [ ] Add React.memo to CreativeGallery
- [ ] Add React.memo to CampaignManager
- [ ] Add useMemo/useCallback to VideoPanel
- [ ] Add useMemo/useCallback to CreativePanel

#### Code Organization

**Issue:** Agent implementations scattered across:

- `src/agents/`
- `src/services/agent/specialists/`

**Tasks:**

- [ ] Consolidate agent implementations
- [ ] Standardize module structure

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
