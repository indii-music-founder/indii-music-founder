# Founders Program — Gap Audit (2026-08-20)

Evidence-based audit of the Founders program implementation against
`docs/FOUNDERS_PLAN.md`. Every claim below is tied to inspected code, config,
rules, or ledger entries. No assumptions.

Audit scope: `packages/renderer/src/config/founders.ts`,
`packages/renderer/src/modules/founders/*`, `FounderBadge.tsx`,
`packages/firebase/src/subscription/activateFounderPass.ts`,
`packages/firebase/src/releases/generateDownloadUrl.ts`,
`packages/firebase/src/shared/subscription/SubscriptionTier.ts`,
`packages/firebase/firestore.rules`, `packages/firebase/storage.rules`,
`packages/landing/src/components/sections/FounderAccessSection.tsx`,
ledger entries ISSUE-1372/1373/1374, `docs/FOUNDERS_PLAN.md`.

---

## 1. Implemented (matches plan)

| Plan item | Evidence |
|---|---|
| `founders.ts` covenant (append-only, seats 11 = 1 reserved + 10 paid, SHA-256 receipts) | `config/founders.ts` — AGREEMENT_VERSION 1.0.0, AGREEMENT_TERMS (price 2500, seats_total 11, reserved_internal_seats 1, investment_rollover_basis), FOUNDERS array, seats-remaining math |
| `activateFounderPass` (admin-only onCall: sanitize name, transaction seat check, hash, Firestore writes, GitHub Contents-API commit, retry queue) | `subscription/activateFounderPass.ts` (384 lines) — all 9 plan steps present; 15s GitHub timeouts; queue write with loud failure logging (ISSUE-1365 fix) |
| FOUNDER tier + config (price 0/recurring-free, unlimited) | `SubscriptionTier.ts:20,207+` — FOUNDER tier, price 2500, billingPeriod 'once', unlimited generations |
| Storage quota | `StorageQuotaService.ts:55` — founder 10,240 GB |
| Founders module (checkout, portal, recognition) | `modules/founders/{FoundersCheckout,FoundersPortal,FoundersRecognition}.tsx` + tests |
| Founder badge (seat, hash copy, repo verify link) | `modules/settings/components/FounderBadge.tsx`, used by `ProfileSection.tsx` |
| Desktop download gating (storage rules + callable) | `storage.rules:331-338` (founders/releases read gated to founder tier); `releases/generateDownloadUrl.ts` (founder check + mac/windows filenames) |
| Landing founder offer | `packages/landing/.../FounderAccessSection.tsx` — $2,500, one-time, disclaimers (matches AGREEMENT_TERMS.price_usd) |

## 2. Gaps

### G1 — Payment method deviates from the plan's compliance decision (HIGH, founder decision)
- Plan: "We explicitly DO NOT use Stripe for this investment to avoid SEC/investing compliance issues. Accepted methods: Cash App, Wire Transfer, or Check." (`FOUNDERS_PLAN.md:44-45`)
- Code: `FoundersCheckout.tsx:76-91` calls `createOneTimePayment` (Stripe Checkout, $2,500, metadata `founder_seat`); on failure falls back to a `payment-option` state that only says "Stripe checkout is temporarily unavailable. Please try again or contact support." No Cash App / Wire / Check path exists in the component.
- Live status: `STRIPE_SECRET_KEY` is `MOCK_KEY_DO_NOT_USE` (ISSUE-1372) → checkout always fails → users only ever see the fallback message.
- Decision needed: (a) restore the plan's alternative-payment manual flow (receive Cash App/Wire/Check, admin calls `activateFounderPass`), or (b) formally amend the plan to Stripe. Compliance-sensitive — founder's call.

### G2 — No landing seat counter / public names / checkout deep link (MEDIUM)
- Plan: landing `FoundersSection` with live "11 seats" counter reading `founders_meta/count`, public founder names, "Become a Founder" CTA (`FOUNDERS_PLAN.md:149-154`).
- Code: landing `FounderAccessSection.tsx` is static (no `founders_meta` read, no counter, no names); its CTA is `getStudioUrl()` (studio root) — `founders-checkout` is a standalone studio module (`core/constants.ts:39,53`) with no deep link from the landing.
- Related: `firestore.rules` has NO rules for `founders`, `founders_meta`, or `founder_github_commit_queue` — default-deny means any client-side read (counter, names) would be denied even if built.

### G3 — Desktop binaries absent; auto-updater not configured (HIGH for the delivery promise)
- Promise: DMG/EXE delivery (`FOUNDERS_PLAN.md:165-174`; agreement term `desktop_delivery`).
- Code path exists: `generateDownloadUrl.ts` expects `founders/releases/indii-Installer.dmg` / `indii-Setup.exe`; storage rules gate reads.
- Evidence from ledger (ISSUE-1163/992): desktop signing secrets missing (Apple Developer ID / Windows cert) → no signed binaries have ever been built/uploaded → any founder download returns "The requested release file is currently unavailable."
- Auto-updater (plan gotcha #2, `FOUNDERS_PLAN.md:181`) is not configured anywhere in the audit scope.

### G4 — `GITHUB_TOKEN_FOUNDERS` is mock → paid-seat auto-commit blocked (BLOCKED on ISSUE-1373)
- Ledger ISSUE-1373 table: `GITHUB_TOKEN_FOUNDERS` = `MOCK_KEY_DO_NOT_USE`.
- Consequence: `activateFounderPass` GitHub commit fails for every paid seat → `githubCommitPending` + queue entry accumulates. Founder's own seat (1374) is resolved — no token needed for seat #1.
- Unblock: founder provides a fine-grained PAT (contents:write, this repo only) and sets the Secret Manager value.

### G5 — Founder's own Firestore record is inconsistent with the current schema (MEDIUM, needs founder approval to touch prod data)
- Ledger 1374 evidence: founder user `g2AcFApNZvQKYlGg0LQuVADCFoO2` has `tier: founder`, `founderSeats: {}`, NO `subscriptions/{uid}` doc, and (per this audit) no `founders/{uid}` doc.
- Consequence (verified in code): `FounderBadge.tsx:35` reads `founders/{uid}` → returns null without a doc → the founder sees no badge, no seat number, no verification hash receipt — the very "permanent founder recognition" the agreement promises.
- Fix (agent-actionable after founder approval): backfill `founders/{uid}` (seat 1, name, joinedAt, verificationHash per the 1374 resolution that the founder is the reserved internal seat) + `subscriptions/{uid}` (tier founder, lifetime) for the founder user.

### G6 — `FounderBadge.tsx:77` renders seat 11 as "ii" (`seat === 11 ? 'ii'`)
- Cosmetic oddity: seat #11 displays "ii". Either intentional roman styling or a typo — founder/designer to confirm.

### G7 — Firestore rules absent for founders collections (LATENT)
- No `founders`, `founders_meta`, `founder_github_commit_queue` entries in `packages/firebase/firestore.rules` (default-deny). Fine while all access is server-side (admin SDK bypasses rules); blocks any planned client-side reads (G2) and any public recognition names.

### G8 — Funnel: founders pass invisible to the general public (QUESTION, not necessarily a gap)
- The landing shows the founders offer only in founder mode (`founder` prop / hostname `founder.indii.music`); the public landing shows only the waitlist. If the program is a private release this is correct; if public interest is wanted, the counter + CTA (G2) would be the mechanism.

## 3. Mapping to the founders to-do list

| Item | Status |
|---|---|
| ISSUE-1374 (founder seat #1) | ✅ RESOLVED 2026-08-20 — founder = reserved internal seat; no FOUNDERS entry/token needed. G5 remains as data hygiene for the founder's own record. |
| ISSUE-1372 (Stripe mock key + price IDs) | Blocks G1's current (Stripe) path; if the plan's alternative-payment decision stands, 1372 matters less for founders but still blocks the general PRO/STUDIO checkout. |
| ISSUE-1373 (mock secrets) | Blocks G4 (GITHUB_TOKEN_FOUNDERS) and G3 indirectly (desktop signing is a separate secret set). |
| Desktop signing (ISSUE-1163/992) | Blocks G3. |

## 4. Suggested order (founder-approved)

1. **Founder decision:** G1 payment method (alternative vs Stripe) — the single highest-impact decision; everything downstream depends on it.
2. **Founder approval:** G5 backfill of the founder's own `founders/{uid}` + `subscriptions/{uid}` records so the badge/receipt works for the founder.
3. **Agent work once unblocked:** G4 (real PAT → verify auto-commit E2E), G2 (landing counter + rules + deep link), G7 (rules), G3 (signing + upload + auto-updater).
