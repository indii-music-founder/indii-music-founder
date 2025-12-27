# TASKS.md - Active Work Items

**Last Updated:** 2025-12-27

This is the single source of truth for pending tasks. Completed plans have been archived to `archive/`.

---

## Current App State (Dec 26, 2025)

### Working Features

- **Electron Desktop App**: Packaged and running on macOS (arm64)
- **Dashboard**: Full project management (Create, Duplicate, Delete), Analytics w/ Gamification, Storage Health.
- **Fair AI Features (Beta)**:
  - **Economics**: Active CFO mode, Dividend forecasting.
  - **Metadata**: GoldenMetadata Schema, MetadataDrawer.
  - **Marketplace**: MerchTable UI for asset minting.
- **Auth System**: Full robust implementation (Electron → Bridge → Google → IPC → Firebase).

### Known Issues (Quality & Stability)

- **GPU Process**: Non-blocking crash on app exit (Monitored via `main.ts` hooks).
- **Audit Status**: All critical lint and security issues resolved (See `AUDIT_REPORT.md`).

---

## High Priority

### Code Hygiene & Stability (The Big Cleanup)

- [x] **Big Cleanup**: Fix `react-hooks/purity` and `no-require-imports` violations to ensure stability.
- [x] **React Hooks**: Fix `set-state-in-effect` violations (e.g. `verify-email` page).
- [x] **Types**: Reduce explicit `any` usage in core services and store slices (Fixed: DashboardService, DistributorService, MerchTable, VideoEditor, FinanceTools).
- [x] **Phase C**: Run "The Gauntlet" verification suite. (PASSED)

### Fair AI Platform Phase 2: Social & Commerce

- [x] **Social Layer**:
  - [x] Implement `SocialService` (Follow/Unfollow, Activity Feed) - `src/services/social/SocialService.ts`
  - [x] Update UserProfile with `accountType` (Fan/Artist/Label) and `socialStats` - `src/types/User.ts`
  - [x] Create `SocialFeed` component - `src/modules/social/components/SocialFeed.tsx`
- [x] **Commerce Engine**:
  - [x] Verify `MarketplaceService` product creation flow - `src/services/marketplace/MarketplaceService.ts`
  - [x] Implement "Buy" flow (MOCK payment) - `ProductCard.tsx` calls `purchaseProduct`
  - [x] Link `MerchTable` to `SocialFeed` (Product drops) - SocialFeed has product picker, posts embed products

---

## Medium Priority

### Gemini 3.0 Migration (Final Steps)

- [ ] **Enterprise**: Migrate `generateImageV3` from AI Studio (API Key) to Vertex AI (IAM) once `gemini-3-pro-image-preview` is available on Vertex endpoints.

### Mobile Experience Polish

- [x] **Touch Targets**: Audit and fix Dashboard components for mobile (44x44px minimum):
  - [x] GlobalSettings: Toggle switches enlarged to `w-12 h-7`
  - [x] ProjectHub: Menu button increased to `p-3` with `min-w-[44px]`
  - [x] SalesAnalytics: Period buttons increased to `px-4 py-2` with min dimensions
  - [x] ReferenceImageManager: Delete button enlarged to `p-2.5` with min dimensions
- [x] **Performance**: Fixed `DataStorageManager` progress bar animation (1000ms → 500ms)

---

## Recently Completed (Dec 2025)

### Dashboard Enhancements

- [x] **Storage Health**: `DataStorageManager` with real byte calculations and tier quotas.
- [x] **Project Mgmt**: Duplicate Project feature (metadata + history items).
- [x] **Analytics**: `AnalyticsView` with word clouds, streaks, and activity charts.

### Artist Economics (Fair AI Phase 1)

- [x] **Metadata**: Implemented `GoldenMetadata` schema and drawer.
- [x] **Finance Agent**: Upgraded to forecast dividends and manage splits.
- [x] **Marketplace UI**: `MerchTable` component created.

### Infrastructure & Mobile

- [x] **Mobile**: Verified Onboarding/Project modals on small screens.
- [x] **Inputs**: Fixed iOS zoom issues (16px base font).
- [x] **Tests**: Added coverage for `MembershipService` and `CleanupService`.

### Authentication

- [x] Full Electron deep-link auth flow.
- [x] Token refresh handling.
- [x] "Double-dipping" login UX fixed.

---

## Archive

- `archive/PLAN_AUTH_SYSTEM.md`
- `archive/showroom_plan.md`
- `archive/implementation_plan.md`
- `archive/ROADMAP.md`
- `PLAN_DASHBOARD_ENHANCEMENTS.md` (Implementation Complete)
