# Phase 2 Roadmap: Beta Finalization & Release Candidate

**Status:** Draft
**Last Updated:** 2025-12-29
**Target:** Release Candidate 1.0 (RC1)

---

## 1. Executive Summary

Having successfully upgraded the **Product Showroom**, **Publishing**, and **Legal** modules to "high-fidelity" Beta V5.0 standards, the focus now shifts to ensuring the **Financial Integrity** of the platform and eliminating technical debt to achieve a "Zero-Error" baseline for the Release Candidate.

This roadmap defines the critical paths for Phase 2: **Integrity, Interconnectivity, and Polish.**

---

## 2. Immediate Priorities (The "Fix-It" Logic)

### 2.1 💰 Financial Module Refactor (Critical)

**Objective:** Upgrade `useFinance` and `EarningsDashboard` to V5.0 standards.

- **Current State:** Functional but basic. Contains "demo" logic comments.
- **Requirements:**
  - **Real-time Hygiene:** Switch from one-off `fetchEarnings` to a subscribed model if possible, or robust `SWR` (Stale-While-Revalidate) pattern.
  - **Transaction Ledger:** Verify `FinanceService` implements double-entry book-keeping principles for local validation.
  - **UI/UX:** Apply "Liquid Logic V2" (Glassmorphism, Framer Motion) to `EarningsDashboard.tsx` and `ExpenseTracker.tsx`.

### 2.2 🧹 Zero-Error Policy (Technical Debt)

**Objective:** Eliminate the 26 pending TypeScript errors.

- **Key Targets:**
  - `modules/marketing/types.ts`: Fix `CampaignAsset` vs. `CampaignStatus` mismatch.
  - `core/store/index.ts`: Fix `AgentMessage` export and `StoreState` user property visibility.
  - `AppSlice`: Ensure correct exportation for `ProjectTools.ts`.

### 2.3 🧱 Module Standardization

**Objective:** Ensure every module follows the "Antigravity Protocol".

- **Marketing:** Move `useMarketing` from Beta to Production Ready.
- **Social:** Resolve lint errors (e.g., `SocialDashboard.tsx` line 21) and ensure `useSocial` handles high-volume feed data gracefully.

---

## 3. Future Architecture (V6.0 / RC Features)

### 3.1 🔌 Real-World Integrations

Currently, several adapters are simulated. Phase 3 (Release Candidate) requires valid connections or high-fidelity mock servers.

- **Distribution:** Real OAuth flow for DistroKid/TuneCore instead of mocks.
- **Banking:** Integration with Stripe Connect or Plaid for `FinanceService` (currently theoretical).

### 3.2 📱 Mobile Responsiveness

The "Liquid Logic" design is heavy on glassmorphism.

- **Task:** Audit all grids (Showroom, Publishing) for touch responsiveness on tablet/mobile breakpoints.
- **Action:** Refactor grid columns to stack on `< md` screens.

---

## 4. Documentation Strategy

To maintain velocity, documentation will serve as the "Living Memory".

| Document | Purpose | Status |
| :--- | :--- | :--- |
| `hooks.json` | Protocol configuration | ✅ Stable |
| `docs/HOOKS.md` | API Reference for Logic | 🔄 Needs Marketing/Social updates |
| `RULES.md` | Agent Behavior & Limits | ✅ V5.0 Active |
| `GEMINI.md` | AI Model Specs | ✅ V5.0 Active |
| `docs/PHASE_2_ROADMAP.md` | **This Document** | 🆕 Live |

---

## 5. Success Metrics for Phase 2

1. **Type Safety:** `npm run type-check` returns **0 errors**.
2. **Test Coverage:** All critical services (Finance, Publishing, Showroom) have passing unit tests.
3. **Visual Consistency:** All Dashboards share the same "Liquid Logic V2" design tokens (colors, spacing, motion).
4. **No "Any":** The codebase is strictly typed; `any` is forbidden.

> **Next Action:** Begin the `Finance Module Refactor` to address the `useFinance.ts` demo logic and `EarningsDashboard` UI.
