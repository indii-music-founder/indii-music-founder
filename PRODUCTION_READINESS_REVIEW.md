# Production Readiness Review: IndiiOS

**Date:** 2024-05-23
**Status:** 🚧 **NOT Production Ready**

## Executive Summary
IndiiOS has a solid architectural foundation (React/Vite, Electron, Firebase Functions, Inngest), but it is currently in a "High-Fidelity Prototype" or "Alpha" state. Critical business logic (payments, revenue data) is mocked, and security rules are too permissive for a public launch.

---

## 🔴 Critical Blockers (Must Fix)

### 1. Fake Financial Logic
- **Mock Payments:** `MarketplaceService.purchaseProduct` contains `const success = true; // Simulate 100% success rate`. Real payment processing (Stripe/LemonSqueezy) is implemented in `functions/src/subscription` but not connected to the Marketplace.
- **Data Fabrication:** `FinanceService.fetchEarnings` automatically seeds **fake revenue data** (e.g., "Spotify: $4500.20") for any new user if their collection is empty. This is deceptive for a real user.

### 2. Security Gaps
- **Permissive Storage Rules:** `storage.rules` allows writes to `projects/{projectId}/{userId}` without verifying that `userId` is actually a member of `projectId`.
- **Admin RCE Risk:** `executeBigQueryQuery` in Cloud Functions allows admins to execute raw SQL strings passed from the client. If an admin token is leaked, this allows full data exfiltration/destruction.
- **Client-Side Validation:** `TouringService` relies on Zod parsing *after* reading from Firestore or *before* writing, but `firestore.rules` does not enforce schema validation. A malicious user can write invalid data directly to Firestore, breaking the UI for themselves or others.

### 3. Hardcoded Configuration
- **Production Fallbacks:** `src/config/env.ts` contains hardcoded "fallback" API keys and Project IDs for the production environment (`indiios-v-1-1`). If a developer or staging environment misses an env var, it will silently read/write to the production database.

---

## 🟡 Hold Ups (Technical Debt)

### 1. Heavy Client Bundle
- **Bloated Dependencies:** The application bundles `ffmpeg-static`, `ffprobe-static`, `tesseract.js`, `three`, and `fabric`. This results in a massive download size.
- **Memory Usage:** The `MarketplaceService` uses an in-memory `Map` cache for products. While it has a size limit (`MAX_CACHE_SIZE = 100`), this state is lost on reload and duplicates data already cached by the Firestore SDK.

### 2. Incomplete Auth Flow
- **Onboarding Gaps:** `App.tsx` lacks a dedicated routing strategy for unauthenticated users, relying on a loose `useOnboardingRedirect` hook. Comments indicate: *"We probably need a Login Module or Overlay."*

### 3. "Auto-Admin" Functions
- **Missing granular permissions:** The backend relies heavily on a binary `admin: true` claim. There is no intermediate role (e.g., "Support", "Analyst") for internal tools like the DevOps dashboard.

---

## 🟢 Strong Points (Good to Go)

- **Architecture:** The use of `Inngest` for long-running video jobs is excellent and production-ready.
- **Error Handling:** Global `ErrorBoundary` usage in `App.tsx` prevents white-screen crashes.
- **Type Safety:** Extensive use of `Zod` for runtime validation in Cloud Functions is a best practice.
- **Segregation:** User data in Firestore is well-segregated by `userId` in security rules.

## Recommendations

1. **Connect Payments:** Replace `MarketplaceService` mocks with the actual Stripe endpoints found in `functions/src/subscription`.
2. **Remove Seeding:** Delete the auto-seeding logic in `FinanceService`.
3. **Harden Rules:** Update `firestore.rules` to strictly validate `request.resource.data` schema where possible, or move writes to Cloud Functions.
4. **Environment Safety:** Remove hardcoded production keys from `env.ts`. Fail fast (throw error) if config is missing.
