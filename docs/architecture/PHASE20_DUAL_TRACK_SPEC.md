# Phase 20 Dual-Track Architectural Specification: Operational Gates & Micro-Transactions

## 1. Executive Summary

Phase 20 delivers the dual-track mandate bridging prior milestone operational gates with foundational platform expansion:
- **Track A (Operational Gates for Prior Phases):**
  1. *Phase 12 Operational Gate (Claims Inbox UI):* Connects the advisory `RightsIntelligenceService.projectClaims()` projection to the creator dashboard via `ClaimsInboxTab.tsx`, embedded directly into `LegalDashboard.tsx`. Surfaces potential claimant conflicts without mutating legal ownership or bypassing administrative review.
  2. *Phase 14 & 17 Operational Gates (Authoritative Gates & Workflow Executions):* Enforces server-authoritative persistence for `workflowExecutions`, denying direct client writes while preserving owner read access for advisory next-best-action predictions. Enforces non-authorizing status for AI-use rights ingestion.
- **Track B (Platform Expansion: Micro-Transactions & Credit-Based Purchases):**
  1. Implements `@indii/shared` schemas for `CreditWallet`, `CreditTransaction`, and standard credit packs (`STANDARD_CREDIT_PACKS`).
  2. Implements `MembershipService` credit ledger primitives: `getCreditBalance()`, `canDeductCredits()`, `deductCredits()`, and `addCredits()`.
  3. Secures Firestore paths under `users/{userId}/wallet` and `users/{userId}/credit_transactions` with owner-read, backend-only atomic write security rules.

---

## 2. Architecture & Subsystems

```
                                  ┌───────────────────────────┐
                                  │      Legal Dashboard      │
                                  └─────────────┬─────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │    ClaimsInboxTab     │
                                    └───────────┬───────────┘
                                                │
                               ┌────────────────▼────────────────┐
                               │     RightsIntelligenceService    │
                               │        (projectClaims)          │
                               └────────────────┬────────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │   @indii/shared Schemas   │
                                  │  (claimsInbox / credit)   │
                                  └─────────────┬─────────────┘
                                                │
                                 ┌──────────────▼──────────────┐
                                 │      MembershipService      │
                                 │ (Credit Wallet / Deduction) │
                                 └──────────────┬──────────────┘
                                                │
                                ┌───────────────▼───────────────┐
                                │     Firestore Security        │
                                │ (Server-authoritative rules)  │
                                └───────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1 Claims Inbox Operational Gate (`ClaimsInboxTab.tsx` & `LegalService.ts`)
- **Location:** `packages/renderer/src/modules/legal/components/ClaimsInboxTab.tsx`
- **Tab Trigger:** `legal-tab-claims` located under `LegalDashboard.tsx` tab rail.
- **Behavior:**
  - Invokes `LegalService.getClaimsInbox()`, consuming canonical `RightsClaim` records and Phase 11 domain events.
  - Groups overlapping claims where distinct claimants assert rights over overlapping territories or time ranges.
  - Explicitly tags items with `REVIEW_REQUIRED`, listing granular review reasons (e.g. `POTENTIAL_OVERLAPPING_ASSERTION`).
  - Strict advisory gate: zero automated take-down actions or split rewrites without legal counsel review.

### 3.2 Credit Wallet & Micro-Transactions Subsystem (`@indii/shared` & `MembershipService.ts`)
- **Schemas:**
  - `CreditWalletSchema`: Tracks `userId`, non-negative integer `balanceCredits`, auto top-up preferences, and audit timestamps.
  - `CreditTransactionSchema`: Immutable ledger of credit deductions, additions, and reference task IDs.
  - `STANDARD_CREDIT_PACKS`: Standardized tiers ($5 for 500, $20 for 2500, $70 for 10000).
- **Service Integration:**
  - `MembershipService.getCreditBalance(userId)`: Reads user's current credit balance from `users/{userId}/wallet/current`.
  - `MembershipService.canDeductCredits(amount, userId)`: Preflight quota check before dispatching high-resource AI generation or track distribution tasks.
  - `MembershipService.deductCredits(amount, reason, referenceId, userId)`: Atomic Firestore transaction that decrements balance and appends an immutable transaction record to `users/{userId}/credit_transactions`. Fails closed if balance is insufficient.
  - `MembershipService.addCredits(amount, reason, type, referenceId, userId)`: Atomic Firestore transaction for Stripe one-off purchases or administrator credits.

### 3.3 Server-Authoritative Security Rules (`firestore.rules`)
- **Paths:**
  - `users/{userId}/wallet/{walletId}`: Read allowed for authenticated owner (`isOwner(userId)`); write denied (`allow write: if false;`).
  - `users/{userId}/credit_transactions/{txId}`: Read allowed for authenticated owner (`isOwner(userId)`); write denied (`allow write: if false;`).
  - `users/{userId}/workflowExecutions/{executionId}`: Read allowed for owner; direct client write denied (`allow write: if false;`).

---

## 4. Verification Evidence Matrix

| Surface | Test Suite | Status |
|---------|------------|--------|
| Credit Wallet Schemas | `packages/shared/src/schemas/creditWallet.test.ts` | Passing (4/4 tests) |
| Credit Wallet Service | `packages/renderer/src/services/MembershipService.credit.test.ts` | Passing (6/6 tests) |
| Claims Inbox UI | `packages/renderer/src/modules/legal/components/ClaimsInboxTab.test.tsx` | Passing (4/4 tests) |
| Legal Dashboard Integration | `packages/renderer/src/modules/legal/LegalDashboard.test.tsx` | Passing (6/6 tests) |
| Firestore Security Rules | `packages/firebase/src/test/security/firestore.rules.test.ts` | Passing (276 tests) |
