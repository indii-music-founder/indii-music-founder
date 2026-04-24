# Advanced Improvements Roadmap: 4-Phase Implementation Plan

**Status:** Planning Complete → Phase 1 Starting  
**Date Created:** 2026-04-24  
**Total Effort:** 10-12 weeks  
**Total New Code:** ~19,900 LOC across 46 new files

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Mobile & Offline (PWA)](#phase-1-mobile--offline-pwa)
3. [Phase 2: Agent Orchestration & Memory](#phase-2-agent-orchestration--memory)
4. [Phase 3: Performance & Observability](#phase-3-performance--observability)
5. [Phase 4: Analytics, API, & Ecosystem](#phase-4-analytics-api--ecosystem)
6. [Hard Blockers & Gotchas](#hard-blockers--gotchas)
7. [Verification Checklists](#verification-checklists)
8. [File Structure & Locations](#file-structure--locations)

---

## Executive Summary

indiiOS has achieved **100% TOP_50 Platinum Release completion** with all CI/CD checks passing. This roadmap outlines four sequential phases to extend the platform with enterprise-grade capabilities:

1. **Phase 1 (Weeks 1-2):** Mobile-first PWA with offline-capable workflows, adaptive layouts, background sync
2. **Phase 2 (Weeks 3-5):** Persistent memory layer, streaming agent responses, multi-turn reasoning loops
3. **Phase 3 (Weeks 6-7):** Real-User Monitoring (RUM), Core Web Vitals tracking, bundle optimization
4. **Phase 4 (Weeks 8-10):** REST API, BigQuery analytics pipeline, TypeScript SDK, webhooks

**Total Deliverables:**
- 46 new files, 30 modified files
- ~19,900 new lines of code
- 100+ new tests
- Full E2E coverage for critical paths

**Constraints:**
- All work must pass CI/CD (typecheck, lint, build, tests)
- Follow Platinum Quality Standards (see `docs/PLATINUM_QUALITY_STANDARDS.md`)
- No breaking changes to existing APIs
- Deterministic, testable code patterns

---

## Phase 1: Mobile & Offline (PWA)

### 1.1 Architecture Overview

**Objective:** Enable the app to function seamlessly on mobile devices and in offline scenarios with adaptive layouts, Service Worker background sync, and offline-first UX patterns.

**Key Deliverables:**
- ✅ Service Worker with background sync queue
- ✅ Responsive layout system (mobile/tablet/desktop breakpoints)
- ✅ Mobile gesture detection (swipe, tap-to-hold)
- ✅ Offline state tracking in Zustand (SyncSlice enhancements)
- ✅ Network quality monitoring (RTT, bandwidth adaptive batching)
- ✅ Media cache manager (IndexedDB blob storage)
- ✅ Mobile UI components and navigation patterns

### 1.2 Services to Create

#### BackgroundSyncManager
**File:** `packages/renderer/src/services/sync/BackgroundSyncManager.ts`

```typescript
// Orchestrates Service Worker sync with Zustand store updates
// - Registers background sync event handlers
// - Queues mutations when offline
// - Syncs queue when online detected
// - Handles conflict resolution
export class BackgroundSyncManager {
  constructor(syncService: OfflineFirstService)
  async queueMutation(mutation: SyncOperation): Promise<void>
  async syncAll(): Promise<SyncResult[]>
  onSyncQueueChange(callback: (queue: SyncItem[]) => void): Unsubscribe
}
```

#### ResponsiveLayoutProvider (Context)
**File:** `packages/renderer/src/providers/ResponsiveLayoutProvider.tsx`

```typescript
// React Context providing responsive breakpoints and layout helpers
// Breakpoints: mobile (0-640px), tablet (641-1024px), desktop (1025+px)
export const ResponsiveLayoutProvider: React.FC<{ children: React.ReactNode }>
export const useResponsiveLayout: () => {
  breakpoint: 'mobile' | 'tablet' | 'desktop'
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}
```

#### NetworkQualityMonitor
**File:** `packages/renderer/src/services/network/NetworkQualityMonitor.ts`

```typescript
// Monitors network connection quality and recommends batching strategy
export class NetworkQualityMonitor {
  async initialize(): Promise<void>
  getQuality(): NetworkQuality {
    rtt: number           // Round-trip time in ms
    downlink: number      // Mbps
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
    saveData: boolean     // User prefers reduced data usage
  }
  shouldBatchRequests(): boolean
  onQualityChange(callback: (quality: NetworkQuality) => void): Unsubscribe
}
```

#### MediaCacheManager
**File:** `packages/renderer/src/services/cache/MediaCacheManager.ts`

```typescript
// Lazy-loads media into IndexedDB with LRU eviction
export class MediaCacheManager {
  async cacheMedia(url: string, mediaType: 'image' | 'video' | 'audio'): Promise<Blob>
  async getCached(url: string): Promise<Blob | null>
  async clearOldest(): Promise<void>  // LRU eviction
  getStorageStats(): { used: number; total: number; percentage: number }
}
```

### 1.3 Components to Create

#### MobileAdaptiveLayout
**File:** `packages/renderer/src/components/layout/MobileAdaptiveLayout.tsx`

Wraps modules with responsive constraints. Shows/hides features based on breakpoint.

#### SyncQueueIndicator
**File:** `packages/renderer/src/components/sync/SyncQueueIndicator.tsx`

Visual badge showing pending offline operations. Tappable to view queue details.

#### LanguageSelectorMobile
**File:** `packages/renderer/src/components/shared/LanguageSelectorMobile.tsx`

Mobile-optimized language selector dropdown (already have desktop version).

### 1.4 Hooks to Create

#### useOfflineSync (Enhancement)
**File:** `packages/renderer/src/hooks/useOfflineSync.ts`

Extend existing hook to expose queue status, conflict handling, manual retry.

```typescript
export function useOfflineSync() {
  return {
    isOnline: boolean
    pendingOperations: number
    syncQueue: SyncItem[]
    retryItem: (id: string) => Promise<void>
    clearItem: (id: string) => Promise<void>
    syncNow: () => Promise<void>
  }
}
```

#### useNetworkQuality
**File:** `packages/renderer/src/hooks/useNetworkQuality.ts`

Monitor network quality and adapt UX accordingly.

```typescript
export function useNetworkQuality() {
  return {
    quality: NetworkQuality
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
    shouldBatch: boolean
    shouldLazyLoad: boolean
  }
}
```

#### useGestures
**File:** `packages/renderer/src/hooks/useGestures.ts`

Mobile gesture detection (swipe, tap-to-hold, pinch).

```typescript
export function useGestures(ref: React.RefObject<HTMLElement>) {
  return {
    onSwipeLeft: () => void
    onSwipeRight: () => void
    onTapHold: () => void
    onPinch: (scale: number) => void
  }
}
```

### 1.5 Service Worker Enhancements

**File:** `packages/renderer/src/service-worker.ts`

Add event handlers:
- `sync` event (background sync from queue)
- `message` event (push notifications, sync status)
- Cache strategies (network-first for fresh data, cache-first for assets)

### 1.6 Zustand Store Enhancements

**File:** `packages/renderer/src/core/store/slices/sync.ts`

Extend SyncSlice to track:
- Queue details (items, timestamps, retry counts)
- Conflict detection (same resource modified offline and online)
- Manual retry UI
- Sync progress percentage

### 1.7 Integration Points

1. **App.tsx**
   - Wrap with `ResponsiveLayoutProvider`
   - Render `SyncQueueIndicator` above toast
   - Initialize `NetworkQualityMonitor`
   - Initialize `MediaCacheManager`

2. **main.tsx**
   - Register Service Worker with offline-first initialization
   - Start background sync manager
   - Listen for online/offline events

3. **All mutations in store slices**
   - Check `isOnline` before direct dispatch
   - Queue through `BackgroundSyncManager` if offline
   - Update UI with sync status

### 1.8 Testing Strategy

**Unit Tests** (Vitest):
- `BackgroundSyncManager.test.ts` - queue/sync/conflict logic
- `NetworkQualityMonitor.test.ts` - quality detection
- `MediaCacheManager.test.ts` - cache hits/misses, LRU eviction
- `useOfflineSync.test.ts` - hook rendering, queue updates

**E2E Tests** (Playwright):
- `offline.spec.ts` - create item offline → sync online (verify state)
- `mobile-responsive.spec.ts` - layout adapts to 375px, 768px, 1440px
- `media-cache.spec.ts` - load image → check IndexedDB
- `gesture-detection.spec.ts` - swipe left/right, tap-hold

### 1.9 Phase 1 File Summary

| File | Type | Status | LOC |
|------|------|--------|-----|
| `BackgroundSyncManager.ts` | Service | New | 200 |
| `NetworkQualityMonitor.ts` | Service | New | 150 |
| `MediaCacheManager.ts` | Service | New | 180 |
| `ResponsiveLayoutProvider.tsx` | Context | New | 100 |
| `MobileAdaptiveLayout.tsx` | Component | New | 120 |
| `SyncQueueIndicator.tsx` | Component | New | 80 |
| `useOfflineSync.ts` | Hook | Modify | +60 |
| `useNetworkQuality.ts` | Hook | New | 100 |
| `useGestures.ts` | Hook | New | 140 |
| `service-worker.ts` | Service | Modify | +200 |
| `OfflineFirstService.ts` | Service | Modify | +100 |
| `sync.ts` (Zustand slice) | Store | Modify | +150 |
| `App.tsx` | Component | Modify | +20 |
| `main.tsx` | Initialization | Modify | +15 |
| Tests (8 files) | Test | New | 1,500 |
| **Subtotal** | | | **4,500** |

---

## Phase 2: Agent Orchestration & Memory

### 2.1 Architecture Overview

**Objective:** Implement multi-turn reasoning loops, persistent memory service, and streaming agent responses.

**Key Deliverables:**
- ✅ Streaming token handler (SSE from Cloud Functions)
- ✅ Persistent 5-layer memory service (Scratchpad, Session, CORE Vault, Captain's Logs, RAG Index)
- ✅ Memory indexing service (semantic search over past work)
- ✅ Multi-turn context stack (reflection loops, iteration)
- ✅ Streaming UI components and hooks
- ✅ Cloud Function SSE endpoint (streaming responses)

### 2.2 Services to Create

#### PersistentMemoryService
**File:** `packages/renderer/src/services/memory/PersistentMemoryService.ts`

5-layer memory hierarchy:
1. **Scratchpad** (session-local, ~5KB) - current task state
2. **Session** (IndexedDB, 24-hour window) - recent decisions, tool outputs
3. **CORE Vault** (Firestore, persistent) - long-term learned patterns, user preferences
4. **Captain's Logs** (Firestore, append-only) - all past decisions for audit
5. **RAG Index** (Pinecone or local embedding index) - semantic search over all memories

```typescript
export class PersistentMemoryService {
  async write(layer: MemoryLayer, key: string, value: unknown): Promise<void>
  async read(layer: MemoryLayer, key: string): Promise<unknown | null>
  async search(query: string, limit?: number): Promise<Memory[]>
  async getContext(task: string): Promise<ContextWindow>
}
```

#### AgentStreamingService
**File:** `packages/renderer/src/services/agent/AgentStreamingService.ts`

```typescript
export class AgentStreamingService {
  async streamResponse(
    agentId: string,
    input: string,
    onToken: (token: string) => void,
    onComplete: (response: string) => void
  ): Promise<void>
}
```

#### ReflectionLoop
**File:** `packages/renderer/src/services/agent/ReflectionLoop.ts`

Agent evaluates its own output, decides to iterate or finalize.

```typescript
export class ReflectionLoop {
  async evaluate(
    response: string,
    context: ContextWindow
  ): Promise<{ shouldIterate: boolean; feedback: string }>
}
```

#### ContextStackService
**File:** `packages/renderer/src/services/agent/ContextStackService.ts`

Manages multi-turn conversation state, prior decisions.

### 2.3 Components to Create

#### StreamingAgentCard
**File:** `packages/renderer/src/components/agent/StreamingAgentCard.tsx`

Renders streaming tokens with visual feedback (cursor blink, token count).

#### MemoryBrowserPanel
**File:** `packages/renderer/src/modules/memory/MemoryBrowserPanel.tsx`

UI for inspecting 5 layers of memory (read-only browser).

#### ReflectionPanel
**File:** `packages/renderer/src/modules/agent/ReflectionPanel.tsx`

Shows agent reasoning, iteration steps, decision log.

### 2.4 Zustand Store Enhancements

**File:** `packages/renderer/src/core/store/slices/agent.ts`

Add `AgentMemorySlice` for tracking:
- Current memory context
- Streaming response state (tokens received, ETA)
- Reflection status (iterating, awaiting feedback)
- Past decisions (for multi-turn context)

### 2.5 Cloud Function Changes

**File:** `packages/firebase/src/index.ts`

Add SSE endpoint:

```typescript
// POST /api/agents/stream
// Streams agent response tokens as text/event-stream
export const streamAgentResponse = functions.https.onRequest((req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  
  // Stream tokens from agent
  agent.on('token', (token) => {
    res.write(`data: ${JSON.stringify({ token })}\n\n`)
  })
})
```

**Note:** Cloud Functions v1 doesn't support SSE. This requires **migration to v2** (new runtime).

### 2.6 Integration Points

1. **BaseAgent.ts** - add streaming response handling
2. **OrchestrationService.ts** - add ReflectionLoop invocation
3. **MemoryService.ts** - integrate PersistentMemoryService
4. **store/slices/agent.ts** - add AgentMemorySlice
5. **hooks/** - add `useAgentStream`, `useMemoryQuery`, `useContextStack`

### 2.7 Testing Strategy

**Unit Tests:**
- `PersistentMemoryService.test.ts` - CRUD operations on all 5 layers
- `AgentStreamingService.test.ts` - token streaming, error recovery
- `ReflectionLoop.test.ts` - evaluation logic, iteration decisions
- `ContextStackService.test.ts` - multi-turn state management

**E2E Tests:**
- `agent-streaming.spec.ts` - stream response, verify token rendering
- `memory-persistence.spec.ts` - save to CORE Vault, retrieve across sessions
- `multi-turn-reasoning.spec.ts` - agent iterates, learns from feedback

### 2.8 Phase 2 File Summary

| File | Type | Status | LOC |
|------|------|--------|-----|
| `PersistentMemoryService.ts` | Service | New | 350 |
| `MemoryIndexService.ts` | Service | New | 250 |
| `AgentStreamingService.ts` | Service | New | 200 |
| `ReflectionLoop.ts` | Service | New | 180 |
| `ContextStackService.ts` | Service | New | 150 |
| `StreamingAgentCard.tsx` | Component | New | 120 |
| `MemoryBrowserPanel.tsx` | Component | New | 180 |
| `ReflectionPanel.tsx` | Component | New | 140 |
| `useAgentStream.ts` | Hook | New | 100 |
| `useMemoryQuery.ts` | Hook | New | 80 |
| `useContextStack.ts` | Hook | New | 70 |
| `BaseAgent.ts` | Service | Modify | +150 |
| `OrchestrationService.ts` | Service | Modify | +200 |
| `agent.ts` (store slice) | Store | Modify | +100 |
| Cloud Function SSE endpoint | Function | New | 100 |
| Tests (9 files) | Test | New | 2,000 |
| **Subtotal** | | | **5,200** |

---

## Phase 3: Performance & Observability

### 3.1 Architecture Overview

**Objective:** Implement Real-User Monitoring (RUM), Core Web Vitals tracking, bundle optimization, and observability dashboards.

**Key Deliverables:**
- ✅ RUM service (page load metrics, interaction latency, memory usage)
- ✅ Core Web Vitals reporter (CLS, LCP, FID, TTI → analytics backend)
- ✅ Request tracing with correlation IDs
- ✅ Bundle analysis and recommendations
- ✅ Observability dashboard (visualize RUM data, trends, alerts)
- ✅ Performance budget CI/CD checks

### 3.2 Services to Create

#### RealUserMonitoringService
**File:** `packages/renderer/src/services/observability/RealUserMonitoringService.ts`

```typescript
export class RealUserMonitoringService {
  async initialize(): Promise<void>
  recordPageLoad(metrics: { ttfb, fcp, lcp, dcl }): void
  recordInteraction(name: string, duration: number): void
  recordError(error: Error, context?: Record<string, unknown>): void
  getMetrics(): RUMMetrics
}
```

#### CoreWebVitalsReporter
**File:** `packages/renderer/src/services/observability/CoreWebVitalsReporter.ts`

```typescript
export class CoreWebVitalsReporter {
  async reportVitals(vitals: {
    cls: number    // Cumulative Layout Shift
    lcp: number    // Largest Contentful Paint
    fid: number    // First Input Delay
    tti: number    // Time to Interactive
  }): Promise<void>
}
```

#### RequestTracingService
**File:** `packages/renderer/src/services/observability/RequestTracingService.ts`

Adds correlation IDs to all HTTP requests for distributed tracing.

#### BundleAnalysisService
**File:** `packages/renderer/src/services/observability/BundleAnalysisService.ts`

Parses build output, recommends code splitting opportunities.

### 3.3 Components to Create

#### ObservabilityDashboard
**File:** `packages/renderer/src/modules/observability/ObservabilityDashboard.tsx`

New lazy-loaded module visualizing:
- RUM metrics (load time, interaction latency, error rates)
- Core Web Vitals trends (CLS, LCP, FID over time)
- User experience percentiles (p50, p75, p95)
- Error clustering and trends
- Performance budgets vs. actuals

### 3.4 CI/CD Enhancements

**File:** `.github/workflows/build.yml`

Add performance budget checks:

```bash
# Fail if bundle exceeds 500KB gzipped
# Fail if LCP > 2.5s, CLS > 0.1, FID > 100ms
npm run check:performance-budget
```

**File:** `build/check-performance-budget.js` (New)

Script validating bundle size and metrics against thresholds.

### 3.5 Vite Configuration

**File:** `packages/renderer/vite.config.ts`

Add `rollup-plugin-visualizer` for bundle analysis:

```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default {
  plugins: [
    visualizer({ open: false, filename: 'dist/stats.html' })
  ]
}
```

### 3.6 Integration Points

1. **main.tsx** - initialize RUM service, start collecting metrics
2. **SentryService.ts** - integrate RUM data alongside error tracking
3. **services/** - wrap all fetch calls with RequestTracingService
4. **store/slices/analyticsSlice.ts** - add RUM metrics slice

### 3.7 Testing Strategy

**Unit Tests:**
- `RealUserMonitoringService.test.ts` - metric collection, aggregation
- `CoreWebVitalsReporter.test.ts` - CLS/LCP/FID calculation
- `RequestTracingService.test.ts` - correlation ID injection

**E2E Tests:**
- `rum-collection.spec.ts` - metrics collected and reported
- `performance-budgets.spec.ts` - bundle size validated in CI

### 3.8 Phase 3 File Summary

| File | Type | Status | LOC |
|------|------|--------|-----|
| `RealUserMonitoringService.ts` | Service | New | 280 |
| `CoreWebVitalsReporter.ts` | Service | New | 150 |
| `RequestTracingService.ts` | Service | New | 120 |
| `BundleAnalysisService.ts` | Service | New | 100 |
| `ObservabilityDashboard.tsx` | Module | New | 800 |
| `check-performance-budget.js` | CI Script | New | 120 |
| `vite.config.ts` | Config | Modify | +30 |
| `build.yml` (CI/CD) | Workflow | Modify | +20 |
| `SentryService.ts` | Service | Modify | +80 |
| `analyticsSlice.ts` | Store | Modify | +60 |
| Tests (7 files) | Test | New | 1,200 |
| **Subtotal** | | | **3,800** |

---

## Phase 4: Analytics, API, & Ecosystem

### 4.1 Architecture Overview

**Objective:** Implement REST API, BigQuery analytics pipeline, TypeScript SDK, webhooks, and ecosystem integrations.

**Key Deliverables:**
- ✅ Event bus service (Inngest integration)
- ✅ BigQuery event pipeline (stream events, batching, sampling)
- ✅ REST API endpoints (/api/agents, /api/workflows, /api/analytics)
- ✅ Webhook system (event subscriptions, retry logic, signature verification)
- ✅ TypeScript SDK (@indiios/sdk npm package)
- ✅ OpenAPI schema (auto-generated API docs)
- ✅ Analytics query builder (pre-built BigQuery queries)

### 4.2 Services to Create

#### EventBusService
**File:** `packages/renderer/src/services/EventBusService.ts`

Publishes all significant user actions to Inngest event stream.

```typescript
export class EventBusService {
  async publish(event: DomainEvent): Promise<void>
  // Events: WorkflowCreated, AgentInvoked, FileUploaded, SyncCompleted, etc.
}
```

#### BigQueryEventsPipeline
**File:** `packages/firebase/src/bigquery-events.ts`

Cloud Function consuming Inngest events, batching writes to BigQuery.

```typescript
// Batches events, implements sampling (10% of users for cost control)
// Deduplicates on event ID, handles retries
```

#### APIRouter
**File:** `packages/firebase/src/api-router.ts`

Centralized REST endpoint dispatcher.

```typescript
// POST /api/agents - invoke agent
// POST /api/workflows - create workflow
// GET /api/workflows/:id - retrieve workflow
// GET /api/analytics - query analytics
```

#### WebhookDispatcher
**File:** `packages/firebase/src/webhooks.ts`

Delivers webhooks with retry logic, signature verification.

```typescript
export async function dispatchWebhook(
  subscription: WebhookSubscription,
  event: DomainEvent
): Promise<void>
```

### 4.3 TypeScript SDK

**Package:** `packages/sdk/` (New)

Publish as `@indiios/sdk` on npm.

```typescript
// packages/sdk/src/client.ts
export class IndiiOSClient {
  async invokeAgent(agentId: string, input: string): Promise<Response>
  async createWorkflow(definition: WorkflowDefinition): Promise<Workflow>
  async queryAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult>
  async subscribeWebhook(event: string, url: string): Promise<Subscription>
}
```

Includes:
- Type-safe client for all API endpoints
- Zod schema validation
- Automatic retry with exponential backoff
- Request correlation IDs
- Error handling with typed exceptions

### 4.4 Schema Registry

**File:** `packages/shared/src/schemas/api.ts`

Zod schemas for all API inputs/outputs.

```typescript
export const CreateAgentRequestSchema = z.object({
  agentId: z.string(),
  input: z.string(),
  context: z.record(z.unknown()).optional(),
})

export const AgentResponseSchema = z.object({
  result: z.string(),
  metadata: z.object({
    tokens: z.number(),
    duration: z.number(),
  }),
})
```

### 4.5 Analytics Queries

**File:** `packages/firebase/src/analytics-queries.ts`

Pre-built BigQuery queries for common dashboards:

```typescript
export async function getGrowthMetrics(period: '7d' | '30d' | '90d') {
  // SELECT COUNT(*), AVG(session_duration) FROM events WHERE...
}

export async function getEngagementMetrics() {
  // Cohort retention, feature adoption rates
}

export async function getRevenueMetrics() {
  // Revenue per user, subscription churn, LTV
}
```

### 4.6 OpenAPI Schema

**File:** `packages/firebase/src/openapi.json` (Generated)

Auto-generated from Cloud Function schemas via build script.

```bash
npm run generate:openapi  # Produces openapi.json
```

### 4.7 Inngest Integration

**File:** `packages/firebase/src/inngest.ts`

Event definitions and handlers.

```typescript
export const WorkflowCreatedEvent = inngest.createEvent({
  name: 'workflow/created',
  data: z.object({ workflowId: z.string(), userId: z.string() }),
})
```

### 4.8 Zustand Store Enhancements

**File:** `packages/renderer/src/core/store/slices/analyticsSlice.ts`

Modify to publish all state changes to EventBusService.

### 4.9 Integration Points

1. **All modules** - emit domain events to EventBusService
2. **store/slices/** - all mutations → events
3. **Cloud Functions** - APIRouter handles all /api/* routes
4. **Webhooks** - users can subscribe to events via Dashboard UI
5. **BigQuery** - analytics dashboard queries pre-built queries

### 4.10 Testing Strategy

**Unit Tests:**
- `EventBusService.test.ts` - event publishing, batching
- `APIRouter.test.ts` - endpoint routing, validation
- `WebhookDispatcher.test.ts` - delivery, retry, signature verification
- `IndiiOSClient.test.ts` (SDK) - request building, error handling

**E2E Tests:**
- `api-endpoints.spec.ts` - all /api/* routes return correct data
- `webhook-delivery.spec.ts` - webhooks dispatched, retried on failure
- `analytics-queries.spec.ts` - BigQuery queries return correct results

**Integration Tests:**
- `sdk-integration.spec.ts` - SDK client successfully invokes API

### 4.11 Publish Strategy

1. **Publish SDK to npm**
   ```bash
   cd packages/sdk && npm publish --access public
   ```

2. **Update npm registry listing** in README

3. **Generate OpenAPI docs**
   ```bash
   npm run generate:openapi
   # Publish to swagger.io or ReadTheDocs
   ```

### 4.12 Phase 4 File Summary

| File | Type | Status | LOC |
|------|------|--------|-----|
| `EventBusService.ts` | Service | New | 180 |
| `bigquery-events.ts` | Function | New | 250 |
| `api-router.ts` | Function | New | 300 |
| `webhooks.ts` | Function | New | 220 |
| `inngest.ts` | Config | New | 150 |
| `analytics-queries.ts` | Helpers | New | 400 |
| `openapi.json` | Schema | Generated | 500 |
| SDK Package (`packages/sdk/`) | Module | New | 2,500 |
| `packages/shared/schemas/api.ts` | Types | New | 350 |
| `analyticsSlice.ts` | Store | Modify | +100 |
| Tests (10 files) | Test | New | 2,200 |
| **Subtotal** | | | **6,500** |

---

## Hard Blockers & Gotchas

### 1. Cloud Functions v1 → v2 Migration (Phase 2 Blocker)

**Issue:** Cloud Functions v1 doesn't support Server-Sent Events (SSE) for streaming responses.

**Solution:** Migrate to Firebase Functions v2 (new runtime).

**Steps:**
```bash
# packages/firebase/package.json
"firebase-functions": "^7.0.0"  # Already on v7, but ensure v2 gen config

# packages/firebase/src/index.ts - use Express middleware
import * as express from 'express'
const app = express()
app.post('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  // Stream tokens
})
export const api = functions.https.onRequest(app)
```

### 2. Firestore Offline Persistence Conflict

**Issue:** Firestore has built-in offline persistence; BackgroundSyncManager may duplicate sync logic.

**Solution:** Use Firestore's offline capability for data sync, enhance BackgroundSyncManager for UX only:
- Track sync progress
- Show conflict resolution UI
- Queue user mutations while offline

### 3. IndexedDB Size Limits (Phase 1 Blocker)

**Issue:** ~50MB per origin in most browsers.

**Solution:** Implement LRU eviction in MediaCacheManager.

```typescript
async clearOldest(): Promise<void> {
  const allKeys = await getAllKeys()
  const oldest = allKeys.sort((a, b) => getTime(a) - getTime(b))[0]
  await delete(oldest)
}
```

### 4. BigQuery Streaming Costs (Phase 4 Blocker)

**Issue:** Streaming inserts are $0.025/GB; can become expensive at scale.

**Solution:** Implement sampling and batching.

```typescript
// Stream only 10% of users' events
if (Math.random() < 0.1) {
  await bigquery.insert(event)
}
```

### 5. Service Worker Scope

**Issue:** Service Worker is limited to its registration scope.

**Solution:** Register at root:

```typescript
navigator.serviceWorker.register('/sw.js')  // Not '/app/sw.js'
```

### 6. Memory Leaks in Zustand Selectors

**Issue:** Selector functions recreated per render cause unnecessary subscription updates.

**Solution:** Use `useShallow` for object comparisons.

```typescript
const metrics = useStore(state => state.metrics, useShallow)
```

### 7. Types in Python Sidecar (Phase 2/4 Blocker)

**Issue:** Python agent responses are untyped; hard to validate in TypeScript.

**Solution:** Add Pydantic models to all Python tool outputs.

```python
from pydantic import BaseModel

class AgentResponse(BaseModel):
  result: str
  tokens: int
  duration: float
```

### 8. Event Deduplication in BigQuery

**Issue:** Retry logic may send duplicate events.

**Solution:** Add idempotency keys, deduplicate on event ID in BigQuery.

```typescript
const eventId = `${userId}-${timestamp}-${action}`  // Unique key
```

---

## Verification Checklists

### Phase 1 Verification

- [ ] Service Worker registered at root (`/sw.js`)
- [ ] Background sync queue persists across page reloads
- [ ] Offline mutation queuing works (create item offline → see in queue)
- [ ] Sync triggers automatically when online
- [ ] `npm run build` passes (bundle size check)
- [ ] `npm test` all pass (Unit tests)
- [ ] `npm run test:e2e` all pass (E2E tests)
- [ ] Mobile layout adapts at breakpoints (375px, 768px, 1440px)
- [ ] Network quality detected correctly (test with throttling)
- [ ] Media cached to IndexedDB (verify in DevTools)

### Phase 2 Verification

- [ ] Cloud Functions v2 deployed and SSE endpoint accessible
- [ ] Streaming tokens render in real-time (no batching)
- [ ] Memory persists to Firestore (CORE Vault survives reload)
- [ ] Multi-turn context maintained across invocations
- [ ] Reflection loop invoked and feedback shown
- [ ] `npm run test:e2e -- streaming` passes
- [ ] Memory browser UI accessible and readable
- [ ] No memory leaks in Zustand selectors

### Phase 3 Verification

- [ ] RUM metrics collected and reported
- [ ] Core Web Vitals dashboard populated
- [ ] Bundle analysis output generated (`dist/stats.html`)
- [ ] Performance budget CI checks pass
- [ ] Request correlation IDs in network tab
- [ ] Observability dashboard renders correctly
- [ ] Error clustering works (duplicate errors grouped)

### Phase 4 Verification

- [ ] REST API endpoints respond correctly
- [ ] Webhook subscriptions work (receive events)
- [ ] BigQuery events batched and deduplicated
- [ ] TypeScript SDK published to npm
- [ ] OpenAPI docs generated and accessible
- [ ] Analytics pre-built queries return results
- [ ] SDK integration tests pass

---

## File Structure & Locations

### Core Locations

- **Services:** `packages/renderer/src/services/`
- **Components:** `packages/renderer/src/components/`
- **Hooks:** `packages/renderer/src/hooks/`
- **Store Slices:** `packages/renderer/src/core/store/slices/`
- **Modules:** `packages/renderer/src/modules/`
- **Cloud Functions:** `packages/firebase/src/`
- **Configuration:** `packages/renderer/vite.config.ts`, `packages/firebase/package.json`
- **Tests:** Co-locate with source (e.g., `Service.test.ts` next to `Service.ts`)

### Phase 1 Files

```
packages/renderer/src/
├── services/
│   ├── sync/
│   │   ├── BackgroundSyncManager.ts (NEW)
│   │   └── OfflineFirstService.ts (MODIFY)
│   ├── network/
│   │   └── NetworkQualityMonitor.ts (NEW)
│   └── cache/
│       └── MediaCacheManager.ts (NEW)
├── providers/
│   └── ResponsiveLayoutProvider.tsx (NEW)
├── components/
│   ├── layout/
│   │   └── MobileAdaptiveLayout.tsx (NEW)
│   └── sync/
│       └── SyncQueueIndicator.tsx (NEW)
├── hooks/
│   ├── useOfflineSync.ts (MODIFY)
│   ├── useNetworkQuality.ts (NEW)
│   └── useGestures.ts (NEW)
├── core/
│   ├── App.tsx (MODIFY +20 LOC)
│   └── store/
│       └── slices/
│           └── sync.ts (MODIFY +150 LOC)
└── main.tsx (MODIFY +15 LOC)

packages/renderer/src/service-worker.ts (MODIFY +200 LOC)
```

### Phase 2 Files

```
packages/renderer/src/
├── services/
│   ├── memory/
│   │   ├── PersistentMemoryService.ts (NEW)
│   │   └── MemoryIndexService.ts (NEW)
│   └── agent/
│       ├── AgentStreamingService.ts (NEW)
│       ├── ReflectionLoop.ts (NEW)
│       ├── ContextStackService.ts (NEW)
│       ├── BaseAgent.ts (MODIFY +150 LOC)
│       └── OrchestrationService.ts (MODIFY +200 LOC)
├── components/
│   └── agent/
│       └── StreamingAgentCard.tsx (NEW)
├── hooks/
│   ├── useAgentStream.ts (NEW)
│   ├── useMemoryQuery.ts (NEW)
│   └── useContextStack.ts (NEW)
├── modules/
│   ├── memory/
│   │   └── MemoryBrowserPanel.tsx (NEW)
│   └── agent/
│       └── ReflectionPanel.tsx (NEW)
└── core/
    └── store/
        └── slices/
            └── agent.ts (MODIFY +100 LOC)

packages/firebase/src/
└── streaming-responses.ts (NEW, SSE endpoint)
```

### Phase 3 Files

```
packages/renderer/src/
├── services/
│   └── observability/
│       ├── RealUserMonitoringService.ts (NEW)
│       ├── CoreWebVitalsReporter.ts (NEW)
│       ├── RequestTracingService.ts (NEW)
│       ├── BundleAnalysisService.ts (NEW)
│       └── SentryService.ts (MODIFY +80 LOC)
├── modules/
│   └── observability/
│       └── ObservabilityDashboard.tsx (NEW, 800 LOC)
├── core/
│   └── store/
│       └── slices/
│           └── analyticsSlice.ts (MODIFY +60 LOC)
└── main.tsx (MODIFY +10 LOC)

packages/renderer/
├── vite.config.ts (MODIFY +30 LOC)
└── build/
    └── check-performance-budget.js (NEW)

.github/workflows/
└── build.yml (MODIFY +20 LOC)
```

### Phase 4 Files

```
packages/renderer/src/
├── services/
│   └── EventBusService.ts (NEW)
└── core/
    └── store/
        └── slices/
            └── analyticsSlice.ts (MODIFY +100 LOC)

packages/firebase/src/
├── api-router.ts (NEW)
├── bigquery-events.ts (NEW)
├── webhooks.ts (NEW)
├── inngest.ts (NEW)
├── analytics-queries.ts (NEW)
└── openapi.json (Generated)

packages/shared/src/
└── schemas/
    └── api.ts (NEW)

packages/sdk/ (NEW NPM PACKAGE)
├── src/
│   ├── client.ts
│   ├── index.ts
│   └── types.ts
├── package.json
└── README.md
```

---

## Summary

This roadmap provides:

1. **Phase 1 (Weeks 1-2):** Mobile & offline foundation - 4,500 LOC
2. **Phase 2 (Weeks 3-5):** Agent memory & streaming - 5,200 LOC
3. **Phase 3 (Weeks 6-7):** Performance monitoring - 3,800 LOC
4. **Phase 4 (Weeks 8-10):** Analytics & ecosystem - 6,500 LOC

**Total:** 46 new files, 30 modified files, ~19,900 new lines of code

**Key Constraints:**
- All code passes CI/CD (typecheck, lint, build, tests)
- Follows Platinum Quality Standards
- Deterministic, testable patterns
- No breaking changes to existing APIs

**Critical Blockers:**
- Phase 2 requires Cloud Functions v2 (SSE support)
- Phase 1 requires IndexedDB LRU eviction (~50MB limit)
- Phase 4 requires BigQuery event sampling for cost control

---

**Next Step:** Begin Phase 1 implementation.

For updates and progress tracking, see `.agent/PHASE_PROGRESS.md` (updated after each phase completion).
