# Deel Patterns → indii Post-Mastering BOS — Implementation Plan (2026-11-28)

**Living plan.** Update §8 (Current State) before ending any session that touches this work.

Source brief: five Deel product/GTM patterns mapped to indii (split payout routing, contract
generation, cost/recoupment forecasting, event/webhook architecture, founder funnel).
Predecessor: [`post-mastering-admin-engine-plan-2026-09-26.md`](post-mastering-admin-engine-plan-2026-09-26.md)
— its master lifecycle FSM, administrative tasks, admin ledger receipts, and shared
share-units module have landed and are the foundation this plan builds on.

Product boundary (non-negotiable, from V4 ledger guidance): indii is the artist's
preparation, tracking, and execution layer. It is **not** the PRO, publisher, royalty
administrator, employer of record, tax adviser, or legal adviser. Every generated agreement,
forecast, and benchmark carries that disclosure.

---

## 0. Jev advisory (planning input, not authority)

Two synthetic advisory calls to TypeSafe System One (`jev-1.14.0`, requests
`req_01a2233f317078d7934b8ce81ee0a9df`, `req_01a2233f60c279a29dcbed9bab24cab3`). State held
only the pillar descriptions, an audit summary of existing code, and constraints — no user
data or credentials.

| Question | Jev answer | Adopted? |
|---|---|---|
| Which pillar first | **P4 events** (p=0.71; P1 0.24) | Yes |
| Which pillar last | **P5 onboarding/benchmarks** (p=0.62; P3 0.29) | Yes |
| Middle order | **P2 contracts → P1 payouts → P3 calculator** (p=0.76; P2→P3→P1 0.22) | Yes |
| Auto-execute transfers after signatures, no per-run approval | **No** (p(yes)=0.10) | Yes — staged + approved per run |
| Ship public third-party webhooks this phase | **No** (p(yes)=0.10) | Yes — internal outbox first |
| Contract generation method | **Deterministic versioned templates** (p=1.00) | Yes |
| Publish benchmarks from beta data | **No** (p(yes)=0.22) | Yes — instrument now, publish above k-threshold |
| Calculator math in shared pure module | **Yes** (p=0.88) | Yes |
| E-sign path independent of PandaDoc (creds are mock) | **Yes** (p=0.78) | Yes |
| Collaborator invite built inside signing flow | **Coin flip** (p=0.54) | Partial — mint invite token in P2, full funnel in P5 |
| Single biggest delivery risk | **Scope** (p=0.66; legal 0.18, money 0.15) | Mitigated by phase gates in §7 |

Final order: **P4 → P2 → P1 → P3 → P5.** Each phase ships alone; no phase starts until
the previous one's exit gate passes.

---

## 1. Audit — what exists vs what each pillar needs

| Pillar | Reuse (verified present) | Gap |
|---|---|---|
| **P4 Events** | `packages/shared/src/schemas/musicEvent.ts` (18 domain event types, provenance), `musicEventDelivery.ts` (lease / retry / dead-letter, opt-in, **not persisted**), HMAC `functions/webhooks/dispatcher.ts` + `webhook_queue`, Inngest (`functions/orchestration/inngest.ts`, `retryWebhookDelivery`), `functions/audit/masterFsm.ts` + `masterIngestionRunbook.ts` | No persisted outbox; no event types for DDEX validation, split signed, payout staged, ad campaign triggered, royalty ledger updated; FSM transitions don't emit events; `packages/sdk` targets routes no server serves |
| **P2 Contracts** | `legal/exportSplitSheet.ts`, `SplitSheetGeneratorModal.tsx`, `mcp/tools/registerSplitSheet.ts` (sha256 ids + idempotency), `DigitalSignatureService.ts`, `legal/digitalSignature.ts`, PandaDoc proxy/webhook (creds **mock**), `adminLedger.ts` (`LedgerSignatorySchema`), `shared/src/distribution/ddexBuilder.ts`, registration work-for-hire fields | No template registry; no generation from release/DDEX metadata; split sheets stuck at `recorded_unsigned`; no signature-request lifecycle |
| **P1 Payouts** | `shared/src/finance/shareUnits.ts` (basis points), `calculateRoyaltyAllocations.ts` (BigInt largest-remainder), `stripe/connect.ts` (`createTransfer`), `stripe/splitEscrow.ts`, `mcp/tools/stageStripePayouts.ts` (verifies accounts, moves no money), tax form collection, rules for `payouts`/`payoutJobs`/`payoutBatches` | `users/{uid}/splits` stores float `percentage`; no payout schedule entity; no link from signed agreement → payout recipients; no approval-then-execute path for a staged batch |
| **P3 Calculator** | `DecimalMoney.ts`, ad `base.adapter.ts` (budget invariants, cost-per-outcome math), Meta/TikTok/Google adapters, `firestore-recoupment-ledger.ts`, `LabelDealRecoupment.tsx`, `WaterfallChart.tsx`, `HiddenCostHarnessPanel.tsx`, `RevenueProjections.tsx` | No unified pre-release budget model; waterfall math lives in components; no break-even solver; no labelled-assumption contract |
| **P5 Funnel** | `foundingArtist/{waitlist,admin,communications}.ts`, admin `FoundersPortal.tsx`, share cards / `nowWhat` | No collaborator invite at sign-off; no opt-in benchmark instrumentation; no aggregation with minimum-sample guard |

---

## 2. Phase P4 — Domain event outbox (foundation)

Goal: every release-relevant state change writes one deterministic, idempotent event that
internal consumers (Inngest, notifications, ledger projections) read. Public webhooks are
out of scope this phase.

### 2.1 Schema
- Extend `MusicDomainEventTypeSchema` (additive only — existing values untouched):
  `master.lifecycle_changed`, `ddex.validated`, `ddex.validation_failed`,
  `agreement.generated`, `agreement.signature_requested`, `agreement.signed`,
  `agreement.voided`, `split.locked`, `payout.batch_staged`, `payout.batch_approved`,
  `payout.transfer_settled`, `payout.transfer_failed`, `ad_campaign.triggered`,
  `royalty_ledger.updated`, `budget_plan.saved`.
- New `packages/shared/src/schemas/eventOutbox.ts`: `OutboxEntrySchema` wraps a
  `MusicDomainEvent` with `id = evt_v1_{sha256(type + aggregateId + aggregateVersion)[:40]}`
  (re-emits collapse), `aggregateType`, `aggregateId`, `aggregateVersion` (monotonic), and
  a `MusicEventDelivery` per registered consumer.

### 2.2 Write path
- `packages/firebase/src/lib/eventOutbox.ts` — `appendOutboxEvent(tx, event)` callable
  **only inside the same Firestore transaction** as the state change (transactional outbox).
  `users/{uid}/event_outbox/{eventId}`; rules: client read-only, server-only writes.
- Wire emitters into existing transition points (no new state machines):
  `masterFsm.ts` transitions, DDEX pre-flight (Judgment 28 gate), `stageStripePayouts`,
  `ingestEarningsReport.ts`, `adCampaignCallables.ts`, `firestore-recoupment-ledger.ts`.

### 2.3 Dispatch
- `functions/events/outboxRelay.ts` — `onDocumentCreated` on `event_outbox` → for each
  consumer, `inngest.send({ id: eventId, name: 'indii/<type>' })` (Inngest dedupes on `id`).
  Lease/retry/dead-letter uses `MusicEventDeliverySchema` states. Sweep schedule re-relays
  `PENDING`/`RETRY_WAIT` past lease.
- First consumers: (a) notification fan-out, (b) `administrative_tasks` auto-resolve when
  the blocking condition's event arrives, (c) release timeline projection.

### 2.4 Exit gate
- Unit: idempotent id derivation, transactional append rolls back with the state change,
  relay re-send collapses on the same id, dead-letter after N attempts.
- Rules tests: client cannot write `event_outbox`.
- Emulator: one master upload → `INGESTED` → event visible → Inngest consumer ran once.
- Deferred, logged: public webhook subscriptions over `dispatcher.ts` + SDK route alignment
  (Jev p=0.10 for doing it now).

---

## 3. Phase P2 — Standardized agreement generation + signing

Goal: from release metadata, produce versioned, deterministic agreement drafts; route them
for signature without depending on PandaDoc; write a hash receipt on completion.

### 3.1 Template registry (deterministic, Jev p=1.00)
- `packages/shared/src/legal/agreementTemplates/` — one file per template, each exporting
  `{ templateId, version, jurisdictionScope, requiredFields: ZodSchema, clauses: Clause[] }`.
  Clauses are fixed text with typed slots; no LLM-authored clause text.
- Initial templates (v1): `split_sheet`, `producer_agreement` (points + credit),
  `featured_artist_clearance`, `work_for_hire_session`, `publishing_admin_mandate`
  (scope-limited; indii is not the administrator — the mandate names the artist's chosen
  administrator).
- `renderAgreement(templateId, version, fields) → { text, contentHash }` — pure, same
  output for same input; `contentHash = sha256(canonical(templateId, version, fields))`.

### 3.2 Field sourcing
- `packages/shared/src/legal/agreementFieldResolver.ts` maps release metadata +
  `ddexBuilder` inputs + `musicEntity` identifiers + split rows (share units) → template
  fields. Missing required fields → `administrative_tasks` of new type
  `AGREEMENT_FIELD_MISSING`; generation blocks until resolved.
- Jev role (runtime, bounded): reuse `judgeCollaboratorRoleSemantics` to flag role ↔
  template mismatch (e.g., a "co-writer" routed to a work-for-hire). New judgment
  `judgeAgreementCoverageGap` (noul): "Does this credit list contain a contributor with no
  covering agreement?" Advisory only — produces an admin task, never edits the agreement.

### 3.3 Signing lifecycle
- `users/{uid}/agreements/{contentHash}` with status
  `draft → signature_requested → partially_signed → executed | voided`. Transitions only in
  functions (FSM guard pattern from `masterFsm.ts`); every transition emits a P4 event.
- `SignatureProvider` interface; default `InAppSignatureProvider` (typed-name + timestamp +
  IP hash + content hash, reuses `legal/digitalSignature.ts`); `PandaDocSignatureProvider`
  adapter enabled only when real credentials exist (Jev p=0.78).
- On `executed`: write `AdminLedgerReceipt` with `LedgerSignatorySchema` rows; for
  `split_sheet`, lock splits (emit `split.locked`) and advance the master FSM out of
  `SPLITS_PENDING`.
- Collaborator invite hook (Jev p=0.54 — keep minimal): signature request mints a
  single-use, expiring signing link that also offers account creation. Full invite funnel
  and attribution land in P5.

### 3.4 Exit gate
- Golden-file tests per template (same input → byte-identical text and hash).
- Field resolver tests from a fixture release; missing-field → task, not a partial doc.
- FSM tests for every illegal transition; rules tests (client cannot set `executed`).
- Disclosure text present on every rendered agreement.
- Signed-in acceptance per `.agent/REAL_USER_AUTHENTICITY.md` before any "works" claim.

---

## 4. Phase P1 — Split → payout schedule routing

Goal: executed split agreements drive a payout schedule; each run is **staged, verified,
and human-approved** before money moves (Jev p(auto)=0.10).

### 4.1 Data
- Migrate split reads to share units: `users/{uid}/splits` gains `shareUnits` (int,
  `toShareUnits`) + `agreementHash`; readers prefer `shareUnits`, fall back to
  `percentage` with an admin task when the two disagree. `stageStripePayouts.readSplitRecipients`
  and `calculateRoyaltyAllocations` both read through one `resolveSplitRecipients()` in
  `packages/firebase/src/functions/finance/splitRecipients.ts`.
- `users/{uid}/payout_schedules/{releaseId}` — `{ cadence: 'on_statement' | 'monthly' |
  'quarterly', minimumPayoutMicros, recipients: [{ uid|externalPayee, shareUnits,
  stripeAccountId?, taxFormStatus }], agreementHash }`. Only creatable from an `executed`
  split agreement whose hash matches.

### 4.2 Run
1. Trigger: `royalty_ledger.updated` event (from `ingestEarningsReport`) or cadence cron.
2. Stage: `calculateProvisionalAllocation` (BigInt largest-remainder) → `payoutBatches`
   doc `staged_pending_approval`, per-recipient Stripe verification (existing
   `verifyStripeAccount`), tax-form gate, below-minimum carry-forward. Emit
   `payout.batch_staged`.
3. Approve: owner approval via `ToolApprovalService` approve-then-replay-exact-args; the
   approval binds the batch content hash.
4. Execute: `createTransfer` per line with idempotency key `{batchId}:{recipient}`;
   results → `payout.transfer_settled|failed`; failures leave the batch
   `partially_settled`, never re-pay settled lines.
- Out of scope: multi-currency FX, non-Stripe rails, withholding computation (tax forms
  are collected, not calculated).

### 4.3 Exit gate
- Property test: sum of allocations == input micros for random splits; never negative.
- Idempotency test: replayed approval cannot double-transfer.
- Rules: clients cannot mutate `payoutBatches.status`.
- Stripe test-mode run with real test accounts (no mocked "settled" receipts cited as proof).

---

## 5. Phase P3 — Pre-release budget & break-even calculator

Goal: before release, show net break-even from labelled inputs, using the same fixed-point
math the payout path uses (Jev p=0.88 for a shared module).

### 5.1 Pure model
- `packages/shared/src/finance/releaseBudget.ts`:
  - `ReleaseBudgetInputSchema`: cost lines `{ category: 'ads_meta' | 'ads_tiktok' |
    'ads_google' | 'artwork' | 'video' | 'distribution' | 'mastering' | 'other',
    amountMicros, source: 'actual' | 'quoted' | 'user_estimate' | 'adapter_minimum' }`;
    revenue assumptions `{ perStreamMicros, source, assumptionLabel }`; recoupment terms;
    split share units.
  - `computeWaterfall(input) → { grossNeeded, artistNetAtStreams(n), breakEvenStreams,
    perRecipient[] }` using `DecimalMoney` / BigInt; no floats.
  - Every output carries the `source` of each input; any `user_estimate` input marks the
    result `assumption_based`.
- Ad cost inputs come from adapter budget invariants (`base.adapter.ts` minimums) and
  actual spend from `firestore-recoupment-ledger.ts`; generation costs from the credit
  wallet (`creditWallet.ts`) price table. No invented CPMs: if no source exists, the field
  is empty and the user must enter it.

### 5.2 UI
- New `modules/finance/components/ReleaseBudgetPlanner.tsx` reusing `WaterfallChart.tsx`;
  `LabelDealRecoupment.tsx` and `HiddenCostHarnessPanel.tsx` migrate their math onto
  `releaseBudget.ts` (delete component-local math once parity tests pass).
- Saved plans → `users/{uid}/budget_plans/{releaseId}` + `budget_plan.saved` event; after
  release, actuals overlay the plan from ledger events (plan vs actual, not a forecast
  claim).
- Optional Jev: `judgeBudgetAssumptionPlausibility` (noul) flags an input as implausible
  vs the artist's own history only; shown as a hint, never substitutes a number.

### 5.3 Exit gate
- Parity tests: new module reproduces `LabelDealRecoupment` outputs on existing fixtures.
- No float arithmetic in `releaseBudget.ts` (lint rule or test grep).
- UI labels every assumption source; empty-state when no inputs (no placeholder numbers).

---

## 6. Phase P5 — Founders onboarding, collaborator funnel, benchmarks

### 6.1 Collaborator funnel
- Extend P2's signing link: accept → lightweight collaborator account (signing +
  payout-onboarding scope only) → optional upgrade to full artist workspace. Attribution
  doc `foundingArtistEvents` gains `source: 'collaborator_signoff'`.
- Collaborator dashboard: their agreements, splits, payout status (read via P4 events).

### 6.2 Benchmarks (instrument now, publish later — Jev p(publish now)=0.22)
- Opt-in consent flag (versioned, like `FOUNDING_ARTIST_CONSENT_VERSION`).
- Aggregation job computes metrics from P4 events only: release lead time (ingest →
  `DISTRIBUTION_READY`), time-to-fully-signed splits, ad spend vs attributed outcome
  bands.
- Publish guard: a metric renders only when ≥ k contributing artists (k ≥ 20, configurable)
  and no single artist > 30% of the sample; otherwise "not enough data". No synthetic or
  seeded rows, ever.

### 6.3 Exit gate
- Consent off → zero rows contributed (test).
- k-anonymity guard test; admin portal shows sample size beside every metric.

---

## 7. Scope control (Jev's top risk: scope, p=0.66)

- One phase in flight at a time; each phase = one coherent branch, locally validated,
  `/plat` GO before push.
- Phase work cards go into `.agent/test_ledger/OPEN_ISSUES_V4.md` when a phase starts, not
  all up front.
- Hard non-goals this plan: employer-of-record, tax calculation/withholding, FX,
  public webhook API, LLM-authored legal text, auto-executing transfers, benchmark
  publication below threshold.
- Each new Jev judgment follows the canonical shape in `config/typesafeJudgments.ts`
  (bounded confidence, heuristic fallback, `noteJudgmentFailure`), runs server-side via
  `functions/intelligence/typesafeClient.ts`, and is advisory: it may open an
  administrative task; it may not change money, agreement text, or lifecycle state.

| Phase | Depends on | Size (rough) | Highest-risk item |
|---|---|---|---|
| P4 events | landed master FSM | M | transactional append coverage across all emitters |
| P2 agreements | P4 | L | template legal accuracy (needs owner/legal review of clause text) |
| P1 payouts | P2 (executed split), P4 | M | idempotent execute under partial failure |
| P3 calculator | P1 math, ad adapters | M | source labelling / no invented inputs |
| P5 funnel | P2, P4 | M | consent + k-threshold correctness |

### Owner decisions needed before P2 ships
1. Clause text for each v1 template — who reviews (counsel or owner)?
2. Jurisdiction scope for v1 (US-only recommended).
3. Real PandaDoc credentials, or ship in-app signing only.

---

## 8. Current State

- **2026-11-28:** Plan authored. Audit of existing primitives done; Jev advisory captured
  (§0). No code changes. Next: open P4 work card in `OPEN_ISSUES_V4.md` and start §2.1.

---

## 9. Critical files

- Events: `packages/shared/src/schemas/musicEvent.ts`, `musicEventDelivery.ts`,
  `packages/firebase/src/functions/webhooks/dispatcher.ts`,
  `packages/firebase/src/functions/orchestration/inngest.ts`,
  `packages/firebase/src/functions/audit/masterFsm.ts`
- Agreements: `packages/firebase/src/legal/{exportSplitSheet,digitalSignature,pandadocProxy,pandadocWebhook}.ts`,
  `packages/firebase/src/mcp/tools/registerSplitSheet.ts`,
  `packages/renderer/src/services/legal/DigitalSignatureService.ts`,
  `packages/renderer/src/modules/legal/components/SplitSheetGeneratorModal.tsx`,
  `packages/shared/src/schemas/adminLedger.ts`, `packages/shared/src/distribution/ddexBuilder.ts`
- Payouts: `packages/shared/src/finance/shareUnits.ts`,
  `packages/firebase/src/functions/finance/calculateRoyaltyAllocations.ts`,
  `packages/firebase/src/mcp/tools/stageStripePayouts.ts`,
  `packages/firebase/src/stripe/{connect,splitEscrow}.ts`, `packages/firebase/firestore.rules`
  (`splits`, `payouts`, `payoutJobs`, `payoutBatches`)
- Calculator: `packages/shared/src/foundry/DecimalMoney.ts`,
  `packages/firebase/src/execution/ad-adapters/*.ts`,
  `packages/firebase/src/orchestration/marketing/firestore-recoupment-ledger.ts`,
  `packages/renderer/src/modules/finance/components/{LabelDealRecoupment,WaterfallChart,HiddenCostHarnessPanel}.tsx`
- Funnel: `packages/firebase/src/foundingArtist/*.ts`,
  `packages/admin-dashboard/src/components/modules/FoundersPortal.tsx`
- Jev: `packages/firebase/src/functions/intelligence/typesafeClient.ts`,
  `packages/renderer/src/config/typesafeJudgments.ts`
