# Post-Mortem: Testing Cost Spike — May 2026

**Incident:** Agent test runs accumulated **$1000+ in charges** against the video generation pipeline before anyone noticed.
**Status:** Resolved. Three-layer safeguards now in place.
**Owner doc:** This file. Operational reference: [`TESTING_BUDGET_LIMITS.md`](./TESTING_BUDGET_LIMITS.md).

---

## What Happened

During a stretch of agent QA against the creative video pipeline, repeated test runs hit `VideoGenerationService` without ever being throttled. The bill crossed four figures before the spike showed up in GCP billing. There was no kill-switch, no per-test cap, and no separation between test and production spend.

## Root Cause

`VideoGenerationService.checkVideoQuota()` was **fail-open**.

When the subscription service didn't respond cleanly — common in dev, common under load, common during agent test sweeps — the quota check returned `{ canGenerate: true }` by default and let the call through. Three compounding problems:

1. **Fail-open default.** A failed quota check meant "allow," not "deny."
2. **No global ceiling.** There was no monthly spending cap that could halt all paid operations regardless of who called them.
3. **No test isolation.** Test runs counted against the same (absent) budget as production traffic, with no separate ledger or lower cap.

A single misbehaving test loop, multiplied by a fail-open quota, multiplied by no global cap, produced the spike.

## What We Fixed

Three commits, three layers of defense.

### 1. Fail-secure quota — commit `accda2e`
`fix(billing): integrate cost control and fix runaway vulnerability`

Quota checks now **deny on failure**. If the subscription service is unreachable or returns an error, `checkVideoQuota()` returns `{ canGenerate: false }`. Operations are blocked, not waved through.

### 2. Universal cost control — commit `87459a6`

Every expensive operation now flows through `CostControlService.checkAndReserve()` before execution. Enforcement happens at three layers so no single failure mode can bypass it:

- **Client** — `packages/renderer/src/services/billing/CostControlService.ts` reserves budget before the call.
- **Cloud Function** — `packages/firebase/src/functions/billing/enforceOperationCost.ts` re-validates server-side.
- **GCP infrastructure** — hard project-level budget caps as the final backstop.

Tier-based daily budgets: Free $5/day, Pro $25/day, Enterprise $100/day. **Global runaway kill-switch at $500/month** halts all paid ops if tripped.

### 3. Testing budget — commit `4fc6c11`
`feat(billing): enforce testing budget limit ($5/day max)`

Test-mode operations are now capped at **$5/day total**, tracked separately in `costLedger/test-{YYYY-MM-DD}`. Test spend does not touch user tier limits, and test ops over the daily cap are blocked outright.

## Staying Safe Going Forward

When you add a paid operation or write a test that exercises one:

- **Flag tests.** Pass `metadata: { isTest: true, testName: '...' }` to `CostControlService.checkAndReserve()`.
- **Or use the env var.** `VITE_TEST_MODE=true npm test` for CI suites.
- **Read the integration doc** before wiring a new paid API: [`COST_CONTROL_AGENT_INTEGRATION.md`](./COST_CONTROL_AGENT_INTEGRATION.md).
- **Never reintroduce fail-open defaults** on quota or billing checks. If the check can't complete, the answer is no.

## References

- [`TESTING_BUDGET_LIMITS.md`](./TESTING_BUDGET_LIMITS.md) — the $5/day testing policy
- [`COST_CONTROL_SYSTEM.md`](./COST_CONTROL_SYSTEM.md) — full system design
- [`COST_CONTROL_AGENT_INTEGRATION.md`](./COST_CONTROL_AGENT_INTEGRATION.md) — integration patterns
- [`COST_ANOMALY_ALERTS.md`](./COST_ANOMALY_ALERTS.md) — alerting layer
- `packages/renderer/src/services/billing/CostControlService.ts` — client reservation
- `packages/firebase/src/functions/billing/enforceOperationCost.ts` — server kill-switch
