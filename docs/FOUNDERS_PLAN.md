# Founders Program — Implementation Plan

**Date:** 2026-03-17
**Scope:** Sign-up flow fix + $2,500 Founders Pass (10 seats, lifetime)

---

## What We're Building

Two tightly coupled features:

1. **A working sign-up flow** — prerequisite for everything
2. **The Founders Pass** — $2,500 one-time, 10 seats, lifetime access, names permanently encoded in the codebase as cryptographic proof

---

## Part 1 — Fix Sign-Up Flow

### Problem

The studio app (`localhost:4242`) shows `LoginForm` when unauthenticated. The form already has sign-up mode logic but it relies on `window.location.pathname === '/signup'`. Since the SPA is served from `/`, navigating to `/signup` renders the app shell without triggering the path check correctly in some contexts. The result: new users see no "Create Account" entry point from the studio.

The landing page (`landing-page/src/`) has a fully working `SignupForm` at `/signup`, but in dev port 3000 is not running, and there's no link from the studio login screen pointing there.

### Fix — 3 changes

**1a. `src/core/components/auth/LoginForm.tsx`**
Add a visible "Create account" toggle tab at the top of the form (like a sign-in / sign-up pill switcher). This is the primary fix — the mode toggle works today but is hidden. Make it a prominent first-class UI element so users can switch modes without needing a URL.

Also: read the URL path at mount and push the appropriate `isSignUpMode` state. On sign-up success, call `setModule('onboarding')` directly if `userProfile` is new (no existing profile data).

**1b. `src/core/store/slices/authSlice.ts`**
After successful `signUpWithEmail`, automatically set `isSignUpMode: false` and ensure the new user state triggers the onboarding redirect in `useOnboardingRedirect` (it already does via `userProfile?.id === 'pending'` check — verify this path is intact).

**1c. `landing-page/src/components/auth/LoginForm.tsx`**
Add a "New to indiiOS? **Create account →**" link that points to `/signup`. Ensure the landing page `SignupForm` redirects to the studio URL after successful signup (it already does at line 41, but verify it reads the correct `VITE_STUDIO_URL` env var).

---

## Part 2 — Founders Pass ($2,500, 10 seats, Lifetime)

### The Promise (Covenant Terms)

These terms will be encoded immutably in `src/config/founders.ts` and signed:

- **Price:** $2,500 USD, one-time payment (no recurring charges, ever)
- **Access:** All current and future indiiOS features for the lifetime of the software
- **API costs:** Pass-through at cost — founders are not charged a markup, but are responsible for their own Gemini/Vertex AI token consumption billed monthly at Anthropic/Google cost
- **Seats:** Exactly 10 founders total. No exceptions.
- **Name in code:** Each founder's name (or handle, their choice) is committed to the git repository in `src/config/founders.ts` and remains there for the lifetime of the software. This is their proof.
- **Covenant hash:** `SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")` is returned to the founder at checkout and stored in Firestore. If terms are ever disputed, the hash proves what was promised. The pipe-delimited formula is the canonical recipe — founders can recompute it at any time.

---

### Architecture

```text
Landing page                Studio app              Cloud Functions
────────────                ──────────              ───────────────
FoundersSection.tsx         FounderBadge.tsx        activateFounderPass()
 └─ "10 seats" counter       └─ badge on profile     ├─ verify payment
 └─ Covenant preview          └─ covenant viewer      ├─ check seat count
 └─ [Become a Founder]                                ├─ write Firestore
      │                                               ├─ return covenant hash
      ▼                                               └─ trigger git commit
createOneTimeCheckout()
 └─ $2,500 one-time
 └─ metadata: { type: 'founder_pass', name, handle }
      │
      ▼
stripeWebhook (existing)
 └─ payment_intent.succeeded
      │
      ▼
activateFounderPass()
 └─ Firestore: founders/{uid}
 └─ subscriptions/{uid}: tier = 'founder'
 └─ GitHub API: commit founders.ts update
```

---

### Files to Create / Modify

#### NEW: `src/config/founders.ts`

The permanent on-disk record. Committed to git. Immutable by design (git history).

```typescript
/**
 * FOUNDERS COVENANT
 *
 * This file is a permanent record of indiiOS founding members.
 * Entries are append-only. Removal of any entry is a breach of covenant.
 * Hash verification: SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")
 *
 * indiiOS LLC — chartered 2024
 */

export const COVENANT_VERSION = '1.0.0';

export const COVENANT_TERMS = {
  price_usd: 2500,
  seats_total: 10,
  access: 'lifetime',
  api_costs: 'pass_through_at_cost',
  features: 'all_current_and_future',
  software_lifetime: true,
} as const;

export interface FounderRecord {
  seat: number;               // 1–10, permanent
  name: string;               // public display name or handle
  joinedAt: string;           // ISO date, UTC
  covenantHash: string;       // SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")
}

export const FOUNDERS: FounderRecord[] = [
  // Entries added here as founders join.
  // Each entry is a permanent commitment by indiiOS LLC.
];

export const FOUNDERS_SEATS_REMAINING = COVENANT_TERMS.seats_total - FOUNDERS.length;
```

#### NEW: `functions/src/subscription/activateFounderPass.ts`

Cloud Function (`onCall`) that:
1. Verifies the caller is authenticated
2. Confirms a `payment_intent` was paid via Stripe API
3. Checks `founders` collection count < 10
4. Generates covenant hash: `SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")`
5. Validates payment amount ($2,500 USD) and currency
6. Writes to Firestore `founders/{uid}` and `subscriptions/{uid}` with `tier: 'founder'`
7. Makes a direct commit to `main` via the GitHub Contents API (PUT), writing the new entry permanently to `src/config/founders.ts`
8. Returns `{ covenantHash, seat, joinedAt, message, githubCommitPending }` to the client

The direct commit to `main` makes the record immediately permanent and publicly verifiable. If the GitHub commit fails (non-fatal), the Firestore record remains authoritative and the commit is queued for manual retry. The `githubCommitPending` flag in the response lets the client distinguish committed vs queued states.

#### MODIFIED: `functions/src/shared/subscription/SubscriptionTier.ts`

Add `FOUNDER = 'founder'` to the enum. Add to `TIER_CONFIGS` with:
- All limits set to `Infinity` (or a very high cap)
- `apiCosts: 'pass_through'` flag
- `label: 'Founder'`
- `price: 0` (paid upfront — no recurring)

#### MODIFIED: `functions/src/stripe/webhookHandler.ts`

Add handler for `checkout.session.completed` where `metadata.type === 'founder_pass'`. This calls `activateFounderPass` internally (or triggers via Firestore write that a separate function picks up).

#### MODIFIED: `src/services/StorageQuotaService.ts`

Add `founder` → `Infinity` (or 10_000 GB as practical limit) to `TIER_LIMITS_GB`.

#### NEW: `landing-page/src/components/FoundersSection.tsx`

Marketing section for the landing page showing:
- "10 Founding Seats" with live counter (reads from Firestore `founders_meta/count`)
- Covenant terms displayed (price, what's included, the "name in code" commitment)
- A "Become a Founder" CTA that initiates the Stripe checkout
- Names of existing founders (publicly visible once they join)

#### NEW: `src/modules/settings/components/FounderBadge.tsx`

UI component shown in the studio settings/profile page for users with `tier === 'founder'`:
- Gold/founders badge
- Their seat number and covenant hash
- A "Verify your covenant" link that checks the hash against `founders.ts`

---

### Stripe Configuration (Manual — GCP Console)

Create one new Stripe Product:
- **Name:** "indiiOS Founders Pass"
- **Type:** One-time payment
- **Price:** $2,500.00 USD
- **Metadata:** `{ type: 'founder_pass' }`
- Add `STRIPE_PRICE_FOUNDER_PASS` to GitHub Secrets and Cloud Function env

---

### GitHub Configuration (Manual)

Add a `GITHUB_TOKEN_FOUNDERS` secret with a fine-grained PAT scoped to:
- `contents: write` on `the-walking-agency-det/indiiOS-Alpha-Electron`
- Used only by `activateFounderPass` CF to commit the new founder entry

---

### Implementation Order

1. `SubscriptionTier.ts` — add `FOUNDER` tier (15 min)
2. `src/config/founders.ts` — create the covenant file (15 min)
3. `activateFounderPass.ts` — Cloud Function with payment verification + Firestore write + GitHub commit (2–3 hrs)
4. `webhookHandler.ts` — add `founder_pass` metadata routing (30 min)
5. `StorageQuotaService.ts` — add founder → unlimited (5 min)
6. `LoginForm.tsx` (studio) — sign-up mode toggle UI fix (1 hr)
7. `FoundersSection.tsx` (landing page) — marketing + CTA (2–3 hrs)
8. `FounderBadge.tsx` (studio settings) — profile badge + covenant viewer (1 hr)
9. Wire checkout: `createOneTimeCheckout` called with founder product price ID (30 min)

---

### What "Permanently In Code" Means (For Founders)

When a founder pays:

1. Their name and a cryptographic hash of their deal terms are committed to `src/config/founders.ts` in this repository
2. That commit is permanent in the git history — it cannot be erased without also erasing all subsequent commits (which would be publicly visible)
3. The hash is computed as: `SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")` and is returned to them at checkout as their receipt
4. They can verify their hash at any time by recomputing it — if it matches what's in `founders.ts`, the deal is intact
5. The covenant terms (`COVENANT_TERMS` constant) define exactly what they were promised — also committed to the same file

This gives founders a trust mechanism that doesn't rely on a database (which can be edited) — it relies on git history (which is auditable and public).

---

### Open Questions (Resolve Before Implementation)

1. **API cost pass-through:** How are founder API costs billed? Options:
   - Monthly invoice via Stripe for actual Gemini/Vertex usage
   - Founders pre-fund a credit balance (simpler)
   - Founders provide their own API keys (most direct)

2. **Name in code:** Public name/handle, or can founders choose to remain anonymous (listed as "Founder #N")?

3. **GitHub commit:** Direct push to `main` on activation, or a PR that auto-merges? (PR is safer but adds latency between payment and proof)

4. **Landing page:** Should the Founders section be gated (visible only when < 10 seats remain) or always visible for credibility?

5. **VITE_STUDIO_URL:** What is the production studio URL that `SignupForm` redirects to? Needs to be set in landing-page env.
