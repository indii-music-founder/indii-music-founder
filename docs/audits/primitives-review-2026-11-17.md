# Primitives review — 2026-11-17

Bounded review against the agent-harness primitives, taken at `main` = `b72f43f`.
This is not certification that every primitive or customer path is complete.

> **Scope note.** The full review body (all severities) was produced in a separate
> session and was not available in the container that wrote this file. This
> document records the two **high** findings, re-verified against the code at
> `b72f43f`, and the fixes applied for them. Paste the remaining findings
> (medium/low) under "Other findings" when the original text is at hand.

## High findings

### H1 — Output guardrail reserves the entire execution token allowance

- **Where:** `packages/renderer/src/services/agent/guardrails/JevGuardrailService.ts:196`
  (`runEvaluation`), called from `BaseAgent` at the tail of every agent turn.
- **Primitive:** Token budgeting / shared execution governance.
- **Defect:** The guardrail judgment called `budget.reserve(budget.remaining)`.
  `ExecutionTokenBudget` is shared by every agent in one execution (Boardroom,
  delegated tools, graph nodes), so while one guardrail call was in flight
  `remaining` read `0` for every concurrent agent — their routing, generation and
  guardrail reservations all failed. The UI stops waiting after 2 s but the
  provider call is not cancelled, so the hold persisted until the callable
  returned. If the receipt lacked a valid `usage` block (or transport failed),
  `settle(id, undefined)` retained the full hold: one guardrail call without a
  receipt permanently consumed the whole run allowance.
- **Failure scenario:** Boardroom fan-out with three agents. Agent A finishes and
  enters the guardrail; agents B and C attempt their next model call → `reserve`
  returns `null` → "allowance cannot cover" / silent skip. If A's `typesafeJudge`
  call drops (network blip), the run is exhausted for its remainder.
- **Fix:** Reserve a bounded per-call estimate derived from the exact payload
  (`estimateGuardrailReservation`: serialized state + questions via
  `TokenEstimator`, ×2 input headroom for judge framing, 64 output tokens per noul
  question). If the estimate exceeds `remaining`, the guardrail abstains (pass
  through), as before. A missing receipt now retains only the estimate; actual
  usage above the estimate is still recorded on settle.
- **Same pattern, also fixed:** `runBudgetedSemanticCall` in
  `governance/SemanticCallBudget.ts` held the whole allowance for every optional
  TypeSafe judgment (transient-error, mobile-remote intent, spoken intent, the
  shared `invokeTypesafeJudge`). It now requires the judge payload and reserves
  `estimateSemanticCallTokens(payload)`; the guardrail reuses that estimator.

### H2 — Campaign directive stuck in `claimed` after a Jev rejection

- **Where:** `packages/firebase/src/functions/marketing/adCampaignCallables.ts:176`
  (claim transaction) with the throw in
  `orchestration/marketing/campaign-orchestrator.ts` (`executeDirective`, step 3).
- **Primitive:** Idempotent side-effect execution / recoverable state.
- **Defect:** The callable claims the directive (`status: 'claimed'`) before
  orchestration. When Jev's creative-readiness check rejected the directive, the
  orchestrator threw before any ledger reservation or provider call, but nothing
  settled the claim. Every retry of that directive ID then hit
  `failed-precondition: Campaign directive outcome is unresolved`, telling the
  artist to reconcile provider accounts for a campaign that never existed. The
  same applied to failed post-mastering asset verification and the initial
  per-platform minimum check.
- **Fix:** The orchestrator raises `CampaignPreflightRejectedError` (reasons
  `JEV_CREATIVE_READINESS`, `ASSET_VERIFICATION`, `ALLOCATION_MINIMUM`) for
  definitive, pre-reservation refusals. The callable catches it, updates the
  execution record to `status: 'rejected'` with the reason, and returns
  `failed-precondition` with `details: { reason, retryable: true }`. The claim
  transaction reclaims a `rejected` record (same or corrected inputs).
- **Deliberately unchanged:** A judge that *throws* (service interrupted), a
  ledger reservation failure, and any post-reservation failure still leave the
  record `claimed`. Those outcomes are not proven side-effect-free under the
  existing contract, and the existing test pins that behaviour.

## Other findings

_Not available in this session — see scope note._

## Verification

- `JevGuardrailService.test.ts`: 37/37 pass; the 3 new budget tests fail on the
  pre-fix code.
- `ad-execution-and-attribution.test.ts`: 29/29 pass; the extended claim test
  fails on the pre-fix code.
- `tsc -b packages/renderer`, `tsc -b packages/firebase`,
  `tsc -p packages/firebase/tsconfig.test.json`: clean. ESLint on changed files:
  clean. The full `npm run typecheck` chain was not run end to end (it OOMs at the
  default heap in this container); each relevant project was checked separately.
- Semantic-call follow-up: `SemanticCallBudget.test.ts` rewritten for bounded
  holds (incl. a concurrent second call that now proceeds); renderer agent,
  config and intelligence suites 3258 passed / 18 skipped.
- Structural (mocked) tests only — no live Jev or ad-provider call was made.
- `npm ci` failing in the authoring container was npm 10.9 only; CI (npm 11.19)
  and the founder Mac (npm 11.12) accept the checked-in lockfile, so it was left
  unchanged.
