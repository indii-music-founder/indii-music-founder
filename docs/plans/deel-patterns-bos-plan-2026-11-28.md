# Deel Patterns → indii Post-Mastering BOS — Implementation Plan (2026-11-28)

**Living plan.** Update §8 (Current State) before ending any session that touches this work.

Source brief: five Deel product/GTM patterns mapped to indii (split payout routing, contract
generation, cost/recoupment forecasting, event/webhook architecture, founder funnel).
Predecessor: [`post-mastering-admin-engine-plan-2026-09-26.md`](post-mastering-admin-engine-plan-2026-09-26.md)
— its master lifecycle FSM, administrative tasks, admin ledger receipts, master ingestion
runbook, and shared share-units module have landed and are the foundation this plan builds on.

Product boundary (non-negotiable; see ERROR_LEDGER 2026-08-08 "Legal planning completion is
not filing or readiness authority"): indii is the artist's preparation, tracking, and
execution layer. It is **not** the PRO, publisher, royalty administrator, employer of
record, tax adviser, or legal adviser. Every generated agreement, forecast, and benchmark
carries that disclosure. A signature receipt records who signed which bytes; it is never a
claim of legal sufficiency, registration, or filing.

---

## 0. Jev advisory (planning input, not authority)

Three synthetic advisory calls to TypeSafe System One (`jev-1.14.0`). State held only pillar
descriptions, a code-audit summary, and constraints — no user data or credentials.
Requests: `req_01a2233f317078d7934b8ce81ee0a9df`, `req_01a2233f60c279a29dcbed9bab24cab3`,
`req_01a2234b584c77c9acda8abf98249ab1` (challenger pass on the verified audit).

| Question | Jev answer | Adopted? |
|---|---|---|
| Which pillar first | **P4 events** (p=0.71; P1 0.24) | Yes |
| Which pillar last | **P5 onboarding/benchmarks** (p=0.62; P3 0.29) | Yes |
| Middle order | **P2 contracts → P1 payouts → P3 calculator** (p=0.76; P2→P3→P1 0.22) | Yes |
| Auto-execute transfers after signatures, no per-run approval | **No** (p(yes)=0.10) | Yes — staged + approved per run |
| Ship public third-party webhooks this phase | **No** (p(yes)=0.10) | Yes — internal consumers first |
| Contract generation method | **Deterministic versioned templates** (p=1.00) | Yes |
| Publish benchmarks from beta data | **No** (p(yes)=0.22) | Yes — instrument now, publish above k-threshold |
| Calculator math in shared pure module | **Yes** (p=0.88) | Yes |
| E-sign path independent of PandaDoc (creds are mock) | **Yes** (p=0.78) | Yes |
| Collaborator invite built inside signing flow | **Coin flip** (p=0.54) | Partial — signing link in P2, full funnel in P5 |
| Single biggest delivery risk | **Scope** (p=0.66; legal 0.18, money 0.15) | Mitigated by phase gates in §7 |
| *Challenger:* reuse `musicCatalogEvents` + delivery machine over a new outbox | **Yes** (p=0.92) | Yes (§2) |
| *Challenger:* payout recipients only from admin ledger receipts; lock down `users/{uid}/splits` | **Yes** (p=0.85) | Yes (§4.0) |
| *Challenger:* treat in-app signing as net-new, minimal, no legal-sufficiency claim | **Yes** (p=0.85) | Yes (§3.3) |
| *Challenger:* client-writable splits read by payout staging is a fix-first defect | **Yes** (p=0.86) | Yes (§4.0) |

Final order: **P4 → P2 → P1 → P3 → P5.** Each phase ships alone; no phase starts until
the previous one's exit gate passes. §4.0 (splits lockdown) is a security prerequisite and
may ship ahead of P4.

---

## 1. Audit — what exists vs what each pillar needs (verified 2026-11-28)

| Pillar | Reuse (verified present) | Gap |
|---|---|---|
| **P4 Events** | `packages/shared/src/schemas/musicEvent.ts` (18 event types, `MUSIC_DOMAIN_EVENT_SUBJECT_TYPES`, provenance); **persisted, server-only** `users/{uid}/musicCatalogEvents` + `organizations/{orgId}/musicCatalogEvents` written by `functions/music/canonicalMusicCatalogStore.ts` (`appendEvent`; claims path writes state + event in one transaction with deterministic `eventId`); `packages/shared/src/schemas/musicEventDelivery.ts` (deterministic `deliveryId` per event+consumer, claim/ack/fail commands, lease, retry, dead-letter); HMAC `functions/webhooks/dispatcher.ts` + `webhook_queue`; Inngest (`functions/orchestration/inngest.ts`); `functions/audit/masterFsm.ts` (`transitionMasterLifecycle`) | Delivery machine has **no consumer and no persisted records**; nothing relays stored events to Inngest; no event types for master lifecycle, agreements, payouts, ad spend, royalty ledger, budget plans; no `payout_batch`/`budget_plan` entity types; `masterFsm` transitions emit nothing; `packages/sdk` targets `/tracks`, `/distributions` routes no server serves |
| **P2 Agreements** | `legal/exportSplitSheet.ts`, `modules/legal/components/SplitSheetGeneratorModal.tsx`, `mcp/tools/registerSplitSheet.ts` (sha256 ids + idempotency; sheets `recorded_unsigned`), PandaDoc adapter `legal/digitalSignature.ts` (`sendForDigitalSignature`) + `pandadocProxy.ts`/`pandadocWebhook.ts` (creds **mock**), renderer `services/legal/DigitalSignatureService.ts` (DocuSign/PandaDoc), `adminLedger.ts` (`LedgerSignatorySchema.receiptHash`), `shared/src/distribution/ddexBuilder.ts`, registration work-for-hire fields | No template registry; no generation from release/DDEX metadata; **no vendor-independent signing primitive**; no agreement lifecycle |
| **P1 Payouts** | `shared/src/finance/shareUnits.ts` (`toShareUnits`, `splitsResolveExactly`), immutable `AdminLedgerReceipt.splits` (`shareBasisUnits`, totals 1,000,000, written by `masterIngestionRunbook.ts`), `calculateRoyaltyAllocations.ts` (`calculateProvisionalAllocation`, BigInt largest-remainder), `stripe/connect.ts` (`createTransfer`), `stripe/splitEscrow.ts` (ISSUE-1079 hardening), `mcp/tools/stageStripePayouts.ts` (verifies accounts, moves no money, writes server-only `payoutBatches`), `functions/video/approveSessionEditPlan.ts` (server approval bound to content hash), tax-form callables | **Defect:** `stageStripePayouts` reads recipients from `users/{uid}/splits`, which `firestore.rules` lets the owner client write freely and no product code writes; `users/{uid}/payouts` is also owner-writable; no payout schedule; no approve-then-execute path for a staged batch |
| **P3 Calculator** | `shared/src/foundry/DecimalMoney.ts`, ad `execution/ad-adapters/base.adapter.ts` (integer-cent budget invariants, cost-per-outcome math) + Meta/TikTok/Google adapters, `orchestration/marketing/firestore-recoupment-ledger.ts` (`financeRecoupmentLedgers` / `financeRecoupmentReservations`, committed actual ad spend), `users/{uid}/credit_transactions` (`subscription/deductCredits.ts`) + `STANDARD_CREDIT_PACKS.priceUsdCents` (`creditWallet.ts`), finance UI `LabelDealRecoupment.tsx`, `WaterfallChart.tsx`, `HiddenCostHarnessPanel.tsx`, `RevenueProjections.tsx` | No unified pre-release budget model; waterfall/recoupment math lives in components; no break-even solver; no per-operation generation price table (cost must come from actual credit transactions or user input) |
| **P5 Funnel** | `foundingArtist/{waitlist,admin,communications}.ts` (`foundingArtistEvents`, `FOUNDING_ARTIST_CONSENT_VERSION`), admin `FoundersPortal.tsx`, share cards / `nowWhat` | No collaborator invite at sign-off; no opt-in benchmark instrumentation; no aggregation with a minimum-sample guard |

---

## 2. Phase P4 — Domain event relay (foundation)

Goal: every release-relevant state change records one deterministic event in the **existing**
event store, and a relay delivers it to internal consumers through the **existing** delivery
state machine. No new event collection. Public webhooks out of scope this phase.

### 2.1 Schema (additive only — existing values untouched)
- `MusicDomainEventTypeSchema` gains: `master.lifecycle_changed`, `agreement.generated`,
  `agreement.signature_requested`, `agreement.signed`, `agreement.voided`,
  `payout.batch_staged`, `payout.batch_approved`, `payout.transfer_settled`,
  `payout.transfer_failed`, `ad_spend.committed`, `royalty_ledger.updated`,
  `budget_plan.saved`. (DDEX validation is covered by `master.lifecycle_changed` into
  `DISTRIBUTION_READY`, which already requires the ERN build + validation.)
- `MusicEventEntityTypeSchema` gains `payout_batch` and `budget_plan`; every new event type
  gets a `MUSIC_DOMAIN_EVENT_SUBJECT_TYPES` entry (e.g. `agreement.*` → `agreement`,
  `master.lifecycle_changed` → `sound_recording`, `ad_spend.committed` → `campaign`,
  `royalty_ledger.updated` → `usage`).
- Cross-department review routes (`CROSS_DEPARTMENT_EVENT_ROUTES`, review pointers only):
  `master.lifecycle_changed` → distribution, publishing, rights, finance, marketing, creative;
  `agreement.*` → rights, publishing, finance; `payout.*` → finance;
  `ad_spend.committed` → marketing, finance, analytics; `royalty_ledger.updated` → finance,
  analytics, rights; `budget_plan.saved` → finance, marketing, creative, video. Jev
  (`req_01a223a944607de8a704babb8b130607`, `req_01a223a97363736190b29d79698f678b`) accepted
  the subject kinds (p=0.82). Its route additions at p≥0.60 were adopted: master +marketing
  0.70, +creative 0.65; budget +creative 0.64, +video 0.60. Below-threshold suggestions were
  not adopted.
- **Status:** §2.1 delivered 2026-11-28 (schema + routes + tests); no emitter writes these
  events yet.
- Event ids follow the existing deterministic convention (`claim-received:${claimId}`):
  `${eventType}:${aggregateId}:${aggregateVersion}`, which satisfies
  `InternalReferenceIdSchema` (never an ISRC/UPC-shaped value). Re-emits collapse on the
  same doc id via `transaction.create` (already-exists = already recorded).

### 2.2 Write path
- Extract the claims-path pattern into `packages/firebase/src/lib/recordDomainEvent.ts`:
  `recordDomainEvent(tx, scope, event)` parses with `MusicDomainEventSchema`, bounds JSON,
  and `tx.create`s into `scopeCollectionPath(scope, 'events')` **inside the caller's
  transaction** — the state change and its event commit or roll back together.
- Emitters (existing transition points only; no new state machines):
  `masterFsm.transitionMasterLifecycle`, `ingestEarningsReport.ts` (after the
  `dsr_processed_reports` receipt), `firestore-recoupment-ledger.ts` commit,
  `stageStripePayouts.ts`; P2/P1/P3 add theirs as they land.

### 2.3 Relay
- `functions/events/domainEventRelay.ts` — `onDocumentCreated('users/{uid}/musicCatalogEvents/{eventId}')`
  → for each registered consumer, `CreateMusicEventDeliveryInputSchema` →
  `users/{uid}/musicEventDeliveries/{deliveryId}` (server-only rules, mirroring
  `musicCatalogEvents`) → `inngest.send({ id: deliveryId, name: 'indii/domain-event', data })`.
- Consumers acknowledge/fail via the existing claim/ack/fail commands. A scheduled sweep
  re-sends `PENDING`/`RETRY_WAIT` past their lease. Inngest's `id` dedupe is a 24-hour
  window only; the delivery state machine — not Inngest — is the idempotency authority.
- Scheduled sweep follows Anti-Pattern #13: unrecoverable errors rethrow and land as
  durable `DEAD_LETTER`, never swallowed.
- First consumers: (a) notification fan-out, (b) `administrative_tasks` auto-resolve when the
  blocking condition's event arrives, (c) release timeline projection.

### 2.4 Exit gate
- Unit: deterministic event/delivery ids; state change + event roll back together; relay
  re-send collapses; dead-letter after max attempts; subject-type map covers every new type.
- Rules emulator: clients cannot read/write `musicEventDeliveries`.
- Emulator: one master upload → `INGESTED` → event stored → consumer ran exactly once.
- `cd packages/firebase && npm run build` (root typecheck does not cover `packages/firebase`).
- Deferred, logged: public webhook subscriptions over `dispatcher.ts` + SDK route alignment.

---

## 3. Phase P2 — Standardized agreement generation + signing

Goal: from release metadata, produce versioned, deterministic agreement drafts; collect
signatures without depending on a vendor; feed signatory receipts into the existing
split-lock path.

### 3.1 Template registry (deterministic, Jev p=1.00)
- `packages/shared/src/legal/agreementTemplates/` — one file per template exporting
  `{ templateId, version, jurisdictionScope, requiredFields: ZodSchema, clauses: Clause[] }`.
  Clauses are fixed, owner-approved text with typed slots; no LLM-authored clause text.
- v1 templates: `split_sheet`, `producer_agreement` (points + credit),
  `featured_artist_clearance`, `work_for_hire_session`, `publishing_admin_mandate`
  (names the artist's chosen administrator; indii is not the administrator).
- `renderAgreement(templateId, version, fields) → { text, contentHash }` — pure;
  `contentHash = sha256(canonical({ templateId, version, fields }))`.

### 3.2 Field sourcing
- `packages/shared/src/legal/agreementFieldResolver.ts` maps release metadata
  (`recordingSplits`/`compositionSplits`, as read by `masterIngestionRunbook.ts`) +
  `ddexBuilder` inputs + `musicEntity` identifiers → template fields, with shares as
  `shareBasisUnits`.
- Missing required field → new additive `AdministrativeTaskType` value
  `AGREEMENT_FIELD_MISSING` (schema + `isValidAdministrativeTask()` rules validator updated
  together); generation blocks until resolved.
- Jev (runtime, advisory): a server judgment beside `functions/audit/judgments.ts`
  (same cooldown/threshold/heuristic-fallback pattern, `typesafeClient.ts`):
  `judgeAgreementCoverageGap` (noul) — "does this credit list contain a contributor with no
  covering agreement, or a role routed to the wrong template?" It may open an administrative
  task; it may never edit agreement text, shares, or status.

### 3.3 Signing (net-new primitive, Jev p=0.85)
- `users/{uid}/agreements/{contentHash}`, status
  `draft → signature_requested → partially_signed → executed | voided`. Server-only writes
  via an FSM guard modeled on `masterFsm.ts`; every transition records a P4 event.
- `SignatureProvider` interface. Default `InAppSignatureProvider` is new code: per-signer
  single-use expiring link, typed-name consent over the exact `contentHash`, server
  timestamp, hashed IP; stores a per-signer receipt hash. No claim of legal sufficiency.
  The existing PandaDoc path (`legal/digitalSignature.ts`) becomes an optional adapter,
  enabled only with real credentials.
- **Payee binding (required by P1).** Today a receipt's `collaboratorId` is the holder's
  legal name (`evaluateAdminLock` maps `legalName`/`name`), so no receipt can name a payee.
  Each signer authenticates to sign, and the signature records the signer's uid against
  their share line. `LedgerShareLineSchema` gains an optional `payeeUid` (additive,
  schema-versioned); only a line whose holder signed while authenticated carries one.
- On `executed` for a `split_sheet`: record `agreement.signed`; the runbook re-evaluates the
  master in `SPLITS_PENDING` and, when splits resolve exactly, writes the
  `AdminLedgerReceipt` with `signatories[].receiptHash` = the signer receipt hashes and
  `payeeUid` on each bound share line. The runbook stays the only writer of ledger receipts.
- Collaborator invite (Jev p=0.54 — minimal): the signing link offers optional account
  creation. Full funnel and attribution land in P5.

### 3.4 Exit gate
- Golden-file tests per template (same input → byte-identical text and hash).
- Resolver tests from a fixture release; missing field → task, never a partial document.
- FSM tests for every illegal transition; rules tests (client cannot set `executed`).
- Disclosure text present on every rendered agreement.
- Signed-in acceptance per `.agent/REAL_USER_AUTHENTICITY.md` before any "works" claim.

---

## 4. Phase P1 — Split → payout schedule routing

Goal: locked, signed splits drive a payout schedule; each run is **staged, verified, and
human-approved** before money moves (Jev p(auto)=0.10). Applies the ERROR_LEDGER
2026-07-17 escrow lesson: no Stripe mutation until every leg of the plan is proven
executable.

### 4.0 Prerequisite — close the recipient trust gap (ISSUE-1725, delivered 2026-11-28)
- Before: `stageStripePayouts` read recipients from `users/{uid}/splits`, which the owner
  client could write freely.
- Receipts cannot name payees yet (see §3.3 payee binding), so the shipped fix fails closed
  rather than paying from receipts:
  - Any `users/{uid}/splits` document → `UNVERIFIED_SPLIT_DOCUMENTS`, nothing staged.
  - Earnings grouped by normalized ISRC against `users/{uid}/admin_ledger`. A multi-holder
    or schema-invalid latest receipt holds that ISRC (`heldEarnings`). Unreceipted and
    ISRC-less earnings are staged artist-sole with warnings. More than 2,000 receipts →
    `LEDGER_SCAN_LIMIT`.
  - ISRCs are matched in memory after normalization; an exact query would fail open on a
    differently spelled multi-holder receipt.
  - `firestore.rules`: `users/{uid}/splits` is owner read/delete only.
- `users/{uid}/payouts` reviewed: display-only (dashboard aggregate), no writer; unchanged.
- Remaining: deploy rules; audit production for existing `users/*/splits` documents.

### 4.1 Data
- `users/{uid}/payout_schedules/{releaseId}` — `{ cadence: 'on_statement' | 'monthly' |
  'quarterly', minimumPayoutMicros, ledgerReceiptId, recipients: [{ payeeUid,
  shareBasisUnits, taxFormStatus }] }`. Server-only writes; creatable only from a ledger
  receipt whose every recording share line carries a `payeeUid` (§3.3). The payee's Stripe
  account is read from the payee's own user record at staging time, never copied.
- Staging replaces the §4.0 hold for ISRCs whose receipt is fully payee-bound; receipts
  without bindings keep holding.
- `calculateProvisionalAllocation` gains a `shareBasisUnits` input path (skip the
  percentage → units conversion when units are already authoritative).
- v1 pays recording-side income only. Publishing income is paid by the writer's PRO /
  administrator; publishing lines are tracked, not paid, by indii.

### 4.2 Run
1. Trigger: `royalty_ledger.updated` event or cadence schedule.
2. Stage (one Firestore transaction, before any Stripe call): allocate via BigInt
   largest-remainder; verify every positive-share recipient has a payout-capable account
   (existing `verifyStripeAccount`) and a collected tax form; carry forward below-minimum
   amounts; write `payoutBatches` `staged_pending_approval` with a batch content hash;
   record `payout.batch_staged`. Any unpayable leg blocks the whole batch.
3. Approve: new server callable `approvePayoutBatch`, modeled on
   `functions/video/approveSessionEditPlan.ts` — owner only, App Check + Arcjet, approval
   bound to the batch content hash; a changed batch invalidates the approval.
4. Execute: `createTransfer` per line with idempotency key `${batchId}:${collaboratorId}`;
   per-line results → `payout.transfer_settled|failed`; partial failure leaves the batch
   `partially_settled` and never re-pays a settled line.
- Out of scope: FX, non-Stripe rails, withholding computation (forms are collected, not
  calculated).

### 4.3 Exit gate
- Property test: allocations sum to input micros for random share sets; never negative.
- Idempotency test: replayed approval/execute cannot double-transfer.
- Rules emulator: client cannot write `users/{uid}/splits`, `payout_schedules`, or
  `payoutBatches.status`.
- Stripe **test-mode** run with real test accounts; no mocked "settled" receipt cited as proof.

---

## 5. Phase P3 — Pre-release budget & break-even calculator

Goal: before release, show net break-even from labelled inputs, using the same fixed-point
math as the payout path (Jev p=0.88).

### 5.1 Pure model
- `packages/shared/src/finance/releaseBudget.ts`:
  - `ReleaseBudgetInputSchema`: cost lines `{ category: 'ads_meta' | 'ads_tiktok' |
    'ads_google' | 'artwork' | 'video' | 'distribution' | 'mastering' | 'other',
    amountMicros, source: 'actual' | 'quoted' | 'user_estimate' | 'adapter_minimum' }`;
    revenue assumption `{ perStreamMicros, source, assumptionLabel }`; recoupment terms;
    recipients in `shareBasisUnits`.
  - `computeWaterfall(input) → { totalCostMicros, recoupedAtStreams(n), breakEvenStreams,
    perRecipient[] }` with BigInt/`DecimalMoney`; no floating-point money.
  - Every output carries each input's `source`; any `user_estimate` marks the result
    `assumption_based`.
- Input sources, never invented:
  - Ad spend actuals: committed `financeRecoupmentReservations`; minimums from adapter
    `minBudgetCents`.
  - Generation cost actuals: the artist's `credit_transactions` × the purchased pack's
    `priceUsdCents`. There is no per-operation price table, so projected generation cost is
    a user input.
  - Per-stream rate: user input or the artist's own historical `earnings`; no default rate.

### 5.2 UI
- New `modules/finance/components/ReleaseBudgetPlanner.tsx` reusing `WaterfallChart.tsx`.
  `LabelDealRecoupment.tsx` and `HiddenCostHarnessPanel.tsx` move their math onto
  `releaseBudget.ts`; component-local math is deleted only after parity tests pass.
- Saved plans → `users/{uid}/budget_plans/{releaseId}` + `budget_plan.saved` event. After
  release, actuals overlay the plan from ledger events (plan vs actual, not a forecast).
- Optional Jev hint (`judgeBudgetAssumptionPlausibility`, noul): flags an input as
  implausible against the artist's own history only; never substitutes a number.

### 5.3 Exit gate
- Parity tests: new module reproduces `LabelDealRecoupment` outputs on existing fixtures.
- No floating-point money in `releaseBudget.ts` (test asserts BigInt/integer-only paths).
- UI labels every assumption source; empty state when inputs are missing (no placeholders).

---

## 6. Phase P5 — Founders onboarding, collaborator funnel, benchmarks

### 6.1 Collaborator funnel
- Extend P2's signing link: accept → collaborator account scoped to signing and payout
  onboarding → optional upgrade to a full artist workspace. `foundingArtistEvents` records
  `source: 'collaborator_signoff'`.
- Collaborator view: their agreements, share lines, payout status (read from P4 events).

### 6.2 Benchmarks (instrument now, publish later — Jev p(publish now)=0.22)
- Opt-in consent flag, versioned like `FOUNDING_ARTIST_CONSENT_VERSION`.
- Aggregation reads P4 events only: release lead time (`INGESTED` → `DISTRIBUTION_READY`),
  time to fully signed splits, ad spend vs attributed outcome bands.
- Publish guard: a metric renders only with ≥ k contributing artists (k ≥ 20, configurable)
  and no single artist > 30% of the sample; otherwise "not enough data". No synthetic or
  seeded rows.

### 6.3 Exit gate
- Consent off → zero contributed rows (test).
- k-threshold guard test; admin portal shows sample size beside every metric.

---

## 7. Scope control (Jev's top risk: scope, p=0.66)

- One phase in flight at a time; each phase = one coherent branch, locally validated,
  `/plat` GO before push.
- Phase work cards go into `.agent/test_ledger/OPEN_ISSUES_V4.md` when a phase starts, not
  all up front (except §4.0, logged immediately as a defect).
- Hard non-goals: employer-of-record, tax calculation/withholding, FX, public webhook API,
  LLM-authored legal text, auto-executing transfers, publishing-income payouts, benchmark
  publication below threshold.
- New Jev judgments: server-side via `functions/intelligence/typesafeClient.ts` following
  `functions/audit/judgments.ts` (thresholds, cooldown, heuristic fallback); renderer-side
  via `config/typesafeJudgments.ts` (`noteJudgmentFailure`). Advisory only: a judgment may
  open an administrative task; it may not change money, agreement text, shares, or lifecycle
  state.

| Phase | Depends on | Size (rough) | Highest-risk item |
|---|---|---|---|
| §4.0 splits lockdown | — | S | delivered; rules deploy + legacy-document audit remain |
| P4 events | landed master FSM | M | every emitter inside its state change's transaction |
| P2 agreements | P4 | L | clause text accuracy (owner/counsel review) |
| P1 payouts | §4.0, P2, P4 | M | idempotent execute under partial failure |
| P3 calculator | P1 math, ad adapters | M | source labelling; no invented inputs |
| P5 funnel | P2, P4 | M | consent + k-threshold correctness |

### Owner decisions needed before P2 ships
1. Clause text for each v1 template — who reviews (counsel or owner)?
2. Jurisdiction scope for v1 (US-only recommended).
3. Real PandaDoc credentials, or in-app signing only.

---

## 8. Current State

- **2026-11-28:** Plan authored, then verified claim-by-claim against source (`/plat`
  challenger pass). Corrections folded in: P4 reuses `musicCatalogEvents` + the delivery
  state machine; P1 sources recipients from admin ledger receipts and adds the §4.0
  splits-lockdown prerequisite; in-app signing marked net-new; DDEX validation mapped to the
  `DISTRIBUTION_READY` transition (the renderer gate is `judgeDDEXPreFlight`); payout
  approval modeled on `approveSessionEditPlan.ts`; generation-cost source corrected to
  `credit_transactions`.
- **2026-11-28 (`/middle`):** §4.0 delivered (ISSUE-1725, 🟡 PARTIAL pending rules deploy and
  legacy-document audit). Verification found that receipt `collaboratorId` is a legal name,
  so P2 §3.3 now requires payee binding and P1 §4.1 consumes it. Also fixed ISSUE-1726:
  stale duplicate MCP tool declarations in five agent definitions (squash `f59afdb8`).
  Next: §2.1 (P4 schema additions).
- **2026-11-28 (`/middle` unit 2):** §2.1 delivered — 12 event types, `payout_batch` and
  `budget_plan` entity kinds, one subject kind per new type, and cross-department routes
  (§2.1). Shared 820/820, firebase 2,549 passed, typecheck and firebase build pass. No
  emitter or relay exists yet. Next: §2.2 `recordDomainEvent` + first emitter
  (`masterFsm.transitionMasterLifecycle`).

---

## 9. Critical files

- Events: `packages/shared/src/schemas/{musicEvent,musicEventDelivery}.ts`,
  `packages/firebase/src/functions/music/canonicalMusicCatalogStore.ts`,
  `packages/firebase/src/functions/audit/masterFsm.ts`,
  `packages/firebase/src/functions/orchestration/inngest.ts`,
  `packages/firebase/src/functions/webhooks/dispatcher.ts`
- Agreements: `packages/firebase/src/legal/{exportSplitSheet,digitalSignature,pandadocProxy,pandadocWebhook}.ts`,
  `packages/firebase/src/mcp/tools/registerSplitSheet.ts`,
  `packages/renderer/src/services/legal/DigitalSignatureService.ts`,
  `packages/renderer/src/modules/legal/components/SplitSheetGeneratorModal.tsx`,
  `packages/shared/src/schemas/{adminLedger,administrativeTask}.ts`,
  `packages/shared/src/distribution/ddexBuilder.ts`,
  `packages/firebase/src/functions/audit/{masterIngestionRunbook,judgments}.ts`
- Payouts: `packages/shared/src/finance/shareUnits.ts`,
  `packages/firebase/src/functions/finance/calculateRoyaltyAllocations.ts`,
  `packages/firebase/src/mcp/tools/stageStripePayouts.ts`,
  `packages/firebase/src/stripe/{connect,splitEscrow}.ts`,
  `packages/firebase/src/functions/video/approveSessionEditPlan.ts`,
  `packages/firebase/firestore.rules` (`users/{uid}/splits`, `users/{uid}/payouts`,
  `payoutJobs`, `payoutBatches`)
- Calculator: `packages/shared/src/foundry/DecimalMoney.ts`,
  `packages/shared/src/schemas/creditWallet.ts`,
  `packages/firebase/src/subscription/deductCredits.ts`,
  `packages/firebase/src/execution/ad-adapters/*.ts`,
  `packages/firebase/src/orchestration/marketing/firestore-recoupment-ledger.ts`,
  `packages/renderer/src/modules/finance/components/{LabelDealRecoupment,WaterfallChart,HiddenCostHarnessPanel}.tsx`
- Funnel: `packages/firebase/src/foundingArtist/*.ts`,
  `packages/admin-dashboard/src/components/modules/FoundersPortal.tsx`
- Jev: `packages/firebase/src/functions/intelligence/typesafeClient.ts`,
  `packages/renderer/src/config/typesafeJudgments.ts`
