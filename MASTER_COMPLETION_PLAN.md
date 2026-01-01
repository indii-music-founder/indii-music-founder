# Master Feature Completion Plan

This document serves as the single source of truth for the remaining implementation tasks to reach Release Candidate (RC1) status.

---

## 1. Video Infrastructure

### 1.1 Video Backend (Cloud Functions)
- [x] **Implement `generateVideoFn` in `functions/src/index.ts`**
    - Replace placeholder with Vertex AI Veo-3.1 API integration.
    - Handle parameters: prompt, aspect ratio, duration.
    - Implement signed URL generation for output storage.
    - Add error handling and retry logic.
- [x] **Job Status Management**
    - Implement status updates to Firestore (`videoJobs` collection).
    - Track states: `queued`, `processing`, `complete`, `failed`.

### 1.2 Video Studio Export (Frontend)
- [ ] **Implement Local Rendering Service**
    - Create `src/services/video/RenderService.ts`.
    - Use `@remotion/renderer` (or browser-based equivalent if Node not available) to render compositions.
    - *Note:* Since this is a browser/electron app, we might need to rely on the Cloud Function for high-quality rendering, or a local FFMPEG binary if Electron-capable. The plan suggests "Local Rendering Service" but also "Backend API Setup". We will prioritize the Backend API (Veo) first as it's the AI generation part, then look at composition rendering.

---

## 2. Agent System Expansion

The following agents currently exist as definitions but lack specialized tool implementations.

### 2.1 Brand Manager (`src/services/agent/definitions/BrandAgent.ts`)
- [ ] Implement `analyze_brand_consistency`: Check content against Brand Kit.
- [ ] Implement `generate_brand_guidelines`: Create structured guidelines from assets.
- [ ] Implement `audit_visual_assets`: Verify color palettes and typography.

### 2.2 Marketing Manager (`src/services/agent/definitions/MarketingAgent.ts`)
- [ ] Implement `create_campaign_brief`: Generate structured campaign plans.
- [ ] Implement `analyze_audience`: Demographic analysis (mock or API).
- [ ] Implement `schedule_content`: Calendar generation.

### 2.3 Publicist (`src/services/agent/definitions/PublicistAgent.ts`)
- [ ] Implement `write_press_release`: Format standard PR text.
- [ ] Implement `generate_crisis_response`: PR crisis management templates.
- [ ] Implement `pitch_story`: Email pitch generation.

### 2.4 Road Manager (`src/services/agent/definitions/RoadAgent.ts`)
- [ ] Implement `plan_tour_route`: Logistics optimization.
- [ ] Implement `calculate_tour_budget`: Cost estimation.
- [ ] Implement `generate_itinerary`: Detailed day-sheets.

### 2.5 Security Guardian (`src/services/agent/definitions/SecurityAgent.ts`)
- [ ] Implement `audit_permissions`: Check project access levels.
- [ ] Implement `scan_for_vulnerabilities`: Config audit.

---

## 3. Distribution System (DDEX)

### 3.1 DDEX Services (`src/services/ddex/`)
- [ ] **Complete `ERNService.ts`**
    - Implement `mapContributors`, `mapResources`, `mapDeals`.
    - Ensure ERN 4.3 compliance for AI flagging.
- [ ] **Implement `DSRService.ts`**
    - Parse sales reports (XML/CSV) into Firestore `dsrReports`.

### 3.2 Adapters (`src/services/distribution/adapters/`)
- [ ] **DistroKid Adapter**: Implement `submitRelease`, `getEarnings`.
- [ ] **TuneCore Adapter**: Implement `submitRelease`, `getEarnings`.
- [ ] **CD Baby Adapter**: Implement `submitRelease`, `getEarnings`.

### 3.3 UI Components (`src/modules/publishing/`)
- [ ] `DistributorConnectionsPanel`: Manage API keys.
- [ ] `ReleaseStatusCard`: Track delivery status.
- [ ] `EarningsDashboard`: Visualize revenue from DSRs.

---

## 4. Social Commerce & Revenue

### 4.1 Revenue System
- [ ] **Create `src/services/RevenueService.ts`**
    - Aggregate revenue from `dsrReports` (Distribution) and `storeOrders` (Merch).
    - Provide `getTotalRevenue`, `getRevenueBySource`.

### 4.2 Social Drops
- [ ] **Update `SocialFeed`**
    - Support embedded `ProductCard` in posts.
    - "Buy Now" flow integration.

---

## 5. Financial & Integrity

### 5.1 Refactor `useFinance`
- [ ] Remove demo logic.
- [ ] Connect to `RevenueService` and `ExpenseService` (if exists) or Firestore.

### 5.2 Earnings Dashboard
- [ ] Update UI to V5.0 standards (Glassmorphism).
- [ ] Real-time data binding.

---

## Execution Order
1.  **Video Infrastructure** (Backend + Export)
2.  **Agent Expansion** (Tools Implementation)
3.  **Distribution & Finance** (DDEX, Adapters, Revenue Service)
4.  **Social Commerce** (UI integration)
