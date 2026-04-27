# Founders Program — Implementation Plan

**Date:** 2026-03-17 (Updated 2026-04-25)
**Scope:** Sign-up flow fix + $2,500 Founders Pass (10 seats, lifetime)

---

## What We're Building

Two tightly coupled features:

1. **A working sign-up flow** — prerequisite for everything
2. **The Founders Pass** — $2,500 one-time, 10 seats, lifetime access, names permanently encoded in the codebase as cryptographic proof, and delivery of standalone desktop applications (DMG for Mac, EXE for Windows).

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

### The Promise (Agreement Terms)

These terms will be encoded immutably in `src/config/founders.ts` and signed:

- **Price:** $2,500 USD, one-time payment. We explicitly DO NOT use Stripe for this investment to avoid SEC/investing compliance issues. Accepted methods: Cash App, Wire Transfer, or Check.
- **Access:** All current and future indiiOS features for the lifetime of the software.
- **Desktop Application Delivery:** Founders will receive standalone, installable applications (DMG for macOS, EXE for Windows) so they can run the system natively on their computers.
- **API costs:** Pass-through at cost — founders are not charged a markup, but are responsible for their own Gemini/Vertex AI token consumption billed monthly at Anthropic/Google cost.
- **Seats:** Exactly 10 founders total. No exceptions.
- **Name in code:** Each founder's name (or handle, their choice) is committed to the git repository in `src/config/founders.ts` and remains there for the lifetime of the software. This is their proof.
- **Agreement hash:** `SHA-256("{name}|{AGREEMENT_VERSION}|{joinedAt}")` is returned to the founder at checkout and stored in Firestore. If terms are ever disputed, the hash proves what was promised. The pipe-delimited formula is the canonical recipe — founders can recompute it at any time.

---

### Architecture & Delivery

```text
Landing page                Admin / Alternative Payment    Cloud Functions
────────────                ───────────────────────────    ───────────────
FoundersSection.tsx         Offline/Alt Payment            activateFounderPass()
 └─ "10 seats" counter        │                              ├─ verify payment (Manual/Alt)
 └─ Agreement preview         ▼                              ├─ check seat count
 └─ [Become a Founder]      Manual Verification / Webhook    ├─ write Firestore
                              │                              ├─ return verification hash
                              ▼                              └─ trigger git commit
                            Admin calls trigger
                             └─ activateFounderPass()

Desktop Build (Electron)
────────────────────────
Build process creates DMG and EXE.
Delivered securely to the verified founder.
```

---

### Files to Create / Modify

#### NEW: `src/config/founders.ts`

The permanent on-disk record. Committed to git. Immutable by design (git history).

```typescript
/**
 * FOUNDERS AGREEMENT
 *
 * This file is a permanent record of indiiOS founding members.
 * Entries are append-only. Removal of any entry is a breach of agreement.
 * Hash verification: SHA-256("{name}|{AGREEMENT_VERSION}|{joinedAt}")
 *
 * New Detroit Music LLC — chartered 2024
 */

export const AGREEMENT_VERSION = '1.0.0';

export const AGREEMENT_TERMS = {
  price_usd: 2500,
  seats_total: 10,
  access: 'lifetime',
  desktop_delivery: ['macOS DMG', 'Windows EXE'],
  api_costs: 'pass_through_at_cost',
  features: 'all_current_and_future',
  software_lifetime: true,
} as const;

export interface FounderRecord {
  seat: number;               // 1–10, permanent
  name: string;               // public display name or handle
  joinedAt: string;           // ISO date, UTC
  verificationHash: string;       // SHA-256("{name}|{AGREEMENT_VERSION}|{joinedAt}")
}

export const FOUNDERS: FounderRecord[] = [
  // Entries added here as founders join.
  // Each entry is a permanent commitment by New Detroit Music LLC.
];

export const FOUNDERS_SEATS_REMAINING = AGREEMENT_TERMS.seats_total - FOUNDERS.length;
```

#### MODIFIED: `functions/src/subscription/activateFounderPass.ts`

Cloud Function (`onCall`) that:
1. Verifies the caller is authenticated as an Admin OR handles an authenticated server-side webhook from the alternative payment provider.
2. Sanitizes `displayName` input (character whitelist, 64-char max length cap).
3. Short-circuits duplicate activations via idempotency guard (based on transaction ID).
4. Confirms payment was made via the alternative payment provider.
5. Checks `founders` collection count < 10 atomically via Firestore transaction.
6. Generates verification hash: `SHA-256("{name}|{AGREEMENT_VERSION}|{joinedAt}")`.
7. Writes to Firestore `founders/{uid}` and `subscriptions/{uid}` with `tier: 'founder'`.
8. Makes a commit to `main` via the GitHub Contents API (PUT), writing the new entry permanently to `src/config/founders.ts`.
9. Returns `{ verificationHash, seat, joinedAt, message, githubCommitPending }` to the client.

#### MODIFIED: `functions/src/shared/subscription/SubscriptionTier.ts`

Add `FOUNDER = 'founder'` to the enum. Add to `TIER_CONFIGS` with:
- All limits set to `Infinity` (or a very high cap)
- `apiCosts: 'pass_through'` flag
- `label: 'Founder'`
- `price: 0` (paid upfront — no recurring)

#### MODIFIED: `src/services/StorageQuotaService.ts`

Add `founder` → `Infinity` (or 10_000 GB as practical limit) to `TIER_LIMITS_GB`.

#### NEW: `landing-page/src/components/FoundersSection.tsx`

Marketing section for the landing page showing:
- "10 Founding Seats" with live counter (reads from Firestore `founders_meta/count`).
- Agreement terms displayed (price, desktop app access, the "name in code" commitment).
- A "Become a Founder" CTA that initiates the alternative checkout/onboarding flow.
- Names of existing founders (publicly visible once they join).

#### NEW: `src/modules/settings/components/FounderBadge.tsx`

UI component shown in the studio settings/profile page for users with `tier === 'founder'`:
- Gold/founders badge.
- Their seat number and verification hash.
- A "Verify your agreement" link that checks the hash against `founders.ts`.
- Download links for their standalone Desktop Apps (DMG / EXE).

---

### Desktop App Delivery (DMG / EXE)

Since the project uses Electron, generating platform-specific binaries is already natively supported.
**Building the Binaries:**
- Run `npm run build:desktop:mac` to produce the macOS `.dmg` file.
- Run `npm run build:desktop:win` to produce the Windows `.exe` file.
**Delivery Mechanism:**
- The compiled binaries can be securely hosted (e.g., in a protected Firebase Storage bucket).
- Access to download these binaries is restricted via Firebase Security Rules to users where `tier === 'founder'`.
- The `FounderBadge.tsx` will display secure download links.

---

### Gotchas & Edge Cases

1. **Alternative Payment Processing:** Since we are moving away from Stripe to avoid legal issues, we need a reliable alternative. **Gotcha:** Manual processing or a different payment gateway means we cannot rely on `stripeWebhook`. We must build a custom admin endpoint or a new webhook handler to trigger `activateFounderPass()` securely.
2. **Desktop App Auto-Updates:** **Gotcha:** If a founder downloads a standalone DMG/EXE, they need to receive updates when new features are pushed. We must ensure Electron Auto-Updater is configured (e.g., using GitHub Releases or a dedicated update server) so their local app stays in sync with the web version.
3. **Authentication in Desktop Apps:** **Gotcha:** The desktop app must still connect to Firebase Auth to verify their Founder tier. The standalone app isn't "offline only"; it serves as a native client to the cloud infrastructure.
4. **GitHub API Rate Limits/Failures:** **Gotcha:** Direct commits to `main` via the GitHub API can fail due to network issues or concurrent edits. The `githubCommitPending` flag and a manual retry queue (`founder_github_commit_queue`) are critical to ensure the `founders.ts` file is eventually updated if the initial commit fails.

---

### Open Questions (Resolved / Updated)

1. **API cost pass-through:** **Decision:** Founders provide their own API keys.
2. **Name in code:** **Decision:** Founder's choice — public name/handle or `Founder #N`.
3. **GitHub commit:** **Decision:** Direct push to `main` (current implementation), with fallback queue.
4. **Landing page:** **Decision:** Always visible, creates FOMO.
5. **Desktop App Access:** **Decision:** DMG/EXE builds generated via Electron Forge/Builder and hosted in secure Cloud Storage for founder downloads.
6. **Alternative Checkout:** **TODO:** Finalize the payment processing method that replaces Stripe for this specific tier.
