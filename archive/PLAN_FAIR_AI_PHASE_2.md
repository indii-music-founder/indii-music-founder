# Plan: Fair AI Platform Phase 2 & Code Hygiene

**Status**: Active
**Date**: 2025-12-26

This plan outlines the next phase of development, focusing on the "Social Layer" and "Commerce Engine" components of the Fair AI Platform, while concurrently addressing remaining technical debt (explicit `any` Types).

## 1. Social Layer (Fair AI Platform)

Implement the social graph and activity feed to enable "Myspace-like" connectivity.

- [x] **Data Model & Types**
  - [x] Create `src/services/social/types.ts`: Define `Post`, `Comment`, `Connection`, `SocialStats`.
  - [x] Update `User.ts` interface: Add `accountType` (Fan/Artists/Label) and `socialStats`.
- [x] **SocialService**
  - [x] Implement `followUser(targetId: string)`
  - [x] Implement `unfollowUser(targetId: string)`
  - [x] Implement `getFeed(userId: string)` (Aggregated activity from connections)
  - [x] Implement `createPost(content: string, media?: string[])`
- [ ] **UI Components**
  - [x] **SocialFeed**: Component to display the activity stream (text, generated art, milestones).
  - [x] **UserProfileHeader**: Update to show "Follow" button and stats (Followers/Following).

## 2. Commerce Engine (Fair AI Platform)

Enable direct-to-fan sales of digital assets and merchandise.

- [x] **Marketplace Integration**
  - [x] Review `MarketplaceService` (ensure `createProduct` is fully functional).
  - [x] Implement `purchaseItem(productId: string)`:
    - [x] Mock payment gateway logic for Alpha.
    - [x] Update inventory and transaction history.
- [x] **UI Integration**
  - [x] **ProductCard**: Display product details, price, and "Buy" button.
  - [x] **Social Drop**: Allow products to be embedded in `SocialFeed` posts.

## 3. Code Hygiene: Type Safety Refactor

Eliminate explicit `any` usage in core services to improve maintainability and prevent runtime errors.

- [x] **Service Audits** (Replace `any` with interfaces)
  - [x] `src/services/video/VideoService.ts`: Define `VideoConfig` interface.
  - [x] `src/services/utils/PDFService.ts`: Type `pdfjs` items.
  - [x] `src/services/AuthService.ts`: Define `ElectronWindow` interface for `window.electronAPI`.
  - [x] `src/services/agent/tools/NavigationTools.ts`: Type `module` argument (Enum `AppModule`).
- [ ] **Test Files** (Lower Priority, but good to clean)
  - [ ] `src/services/ProjectService.test.ts`
  - [ ] `src/services/agent/tools/FilmmakingTools.test.ts`
