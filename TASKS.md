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
- [x] **Types**: Reduce explicit `any` usage in core services and store slices (Fixed: DashboardService, DistributorService, MerchTable).

### Fair AI Platform Phase 2: Social & Commerce

- [ ] **Social Layer**:
  - [ ] Implement `SocialService` (Follow/Unfollow, Activity Feed).
  - [ ] Update UserProfile with `accountType` (Fan/Artist/Label) and `socialStats`.
  - [ ] Create `SocialFeed` component.
- [ ] **Commerce Engine**:
  - [ ] Verify `MarketplaceService` product creation flow (already initiated in `MerchTable`).
  - [ ] Implement "Buy" flow (simulated or real integration).
  - [ ] Link `MerchTable` to `SocialFeed` (Product drops).

---

## Medium Priority

### Gemini 3.0 Migration (Final Steps)

- [ ] **Enterprise**: Migrate `generateImageV3` from AI Studio (API Key) to Vertex AI (IAM) once `gemini-3-pro-image-preview` is available on Vertex endpoints.

### Mobile Experience Polish

- [ ] **Touch Targets**: Audit new Dashboard components for mobile touchability.
- [ ] **Performance**: Profile `AnalyticsView` animations on lower-end devices.

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
