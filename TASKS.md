> **NOTE:** For high-level feature completion tracking (Release Candidate 1.0), please refer to [MASTER_COMPLETION_PLAN.md](./MASTER_COMPLETION_PLAN.md). This document tracks operational tasks and recent logs.

# TASKS.md - Active Work Items

**Last Updated:** 2026-01-04

This is the single source of truth for pending tasks. Completed plans have been archived to `archive/`.

---

## Current App State (Jan 4, 2026)

### Working Features

- **Electron Desktop App**: Packaged and running on macOS (arm64)
- **Dashboard**: Full project management (Create, Duplicate, Delete), Analytics w/ Gamification, Storage Health.
- **Fair AI Features (Beta)**:
  - **Economics**: Active CFO mode, Dividend forecasting.
  - **Metadata**: GoldenMetadata Schema, MetadataDrawer.
  - **Marketplace**: MerchTable UI for asset minting.
- **Auth System**: Full robust implementation (Electron → Bridge → Google → IPC → Firebase).
- **Distribution**: DDEX generation and multi-distributor adapters (DistroKid, TuneCore, etc).
- **Social Commerce**: Product drops in social feed, "Buy Now" flows.

### Known Issues (Quality & Stability)

- **GPU Process**: Non-blocking crash on app exit (Monitored via `main.ts` hooks).
- **Audit Status**: All critical lint and security issues resolved (See `AUDIT_REPORT.md`).
- **Adapter Mocking**: Distributor adapters use a hybrid approach (SFTP if configured, Mock fallback).

---

## High Priority

### Post-Launch Monitoring
- [ ] Monitor Sentry for production errors after release.
- [ ] Validate real-world DDEX delivery with test payloads.

---

## Recently Completed (Jan 2026)

### Feature Completion (Alpha Release)
- [x] **Social Commerce**: Integrated `ProductCard` into `SocialFeed` for product drops.
- [x] **Finance**: Refactored `useFinance` to use `RevenueService` and remove demo logic.
- [x] **Distribution**: Completed `DistroKidAdapter`, `TuneCoreAdapter`, and `ERNService` implementation.
- [x] **Video Infrastructure**: Implemented `generateVideoFn` (Veo) and `stitchVideoFn` (Transcoder) in Cloud Functions.

### Image Generation Migration (Fix)

- [x] **Gemini 3 Pro Image IAM**: Migrated `generateImageV3` from API Key to Vertex AI IAM authentication.
  - Resolves 403 Permission Denied errors with `gemini-3-pro-image-preview`
  - Updated `functions/src/index.ts` to use `GoogleAuth` with Bearer token
  - Aligned with video generation architecture (Veo)

### AI Service Refactoring

- [x] **Client-Side SDK**: Migrated from server-proxy to `firebase/ai` SDK (`FirebaseAIService`).
- [x] **Security**: Enabled App Check `useLimitedUseAppCheckTokens` and Vertex AI Backend.
- [x] **Model Policy**: Enforced Gemini 3 models; deprecated legacy models.
- [x] **Agent Tests**: Updated `BrandTools`, `VideoTools`, and Specialist tests to pass with new service layer.

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
