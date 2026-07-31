# Marketing Swarm — Build Spec

> **Read this before writing any code in `packages/firebase/src/marketing/`,
> `warehouse/`, or `AgentSwarmDashboard.tsx`.**
>
> This spec is written to be executed mechanically. Every task states its files,
> its contract, and its acceptance tests. Where a decision has already been made
> and must not be revisited, it is listed under **Invariants** with the reason.
> If a task seems to require a judgment call, it is under-specified — stop and
> ask rather than inventing one.

Companion documents: `directives/autonomous_marketing_swarm.md` (the SOP),
`warehouse/README.md` (pipeline shape).

---

## 0. Where things stand

| Layer | Status |
| --- | --- |
| Conversion event contract (`@indii/shared`) | ✅ Built |
| Outbox + batched flusher → ClickHouse | ✅ Built |
| Smart-link redirect + click capture | ✅ Built |
| Meta Conversions API client | ✅ Built, **not yet called** |
| Warehouse DDL / Airbyte / dbt templates | ✅ Written, **not deployed** |
| Meta write path (creative only) | ⚠️ Partial — see Task 2.1 |
| Brand QC gate | ✅ Built, **no production caller** |
| Swarm dashboard | ✅ Built, reads live data |
| Pre-save / store conversion emitters | ❌ Tasks 1.1–1.3 |
| Ad hierarchy, budgets, idempotency | ❌ Tasks 2.1–2.4 |
| Decision loop | ❌ Phase 3 — **do not start** until Phase 1 and 2 are done |

**Nothing in this system can spend money yet.** `pushAdCreative` builds an
AdCreative, which is an asset, not a delivering ad. That is intentional for now.
Task 2.1 changes it, and everything in §Invariants becomes load-bearing at that
moment.

---

## Invariants

Breaking any of these is a defect even if tests pass. Each cost real money or
real correctness to learn.

**I1. Never INSERT into ClickHouse from a request path.**
Emit through `enqueueConversionEvent` / `enqueueConversionEventDetached`. Three
independent reasons: the redirect is fan-facing and must not wait on a
warehouse; a warehouse outage must not become a fan outage or silent data loss;
and MergeTree creates a data part per INSERT, so per-event writes cause part
explosion and eventually `TOO_MANY_PARTS` rejections. Batching is how this
engine is meant to be written to.

**I2. Never remove the pre-insert dedup filter in `flushOutboxBatch`.**
`daily_ad_performance_mv` is a materialized view. Views fire per *insert block*,
before `ReplacingMergeTree` collapses anything. A duplicate reaching the base
table is deduped there eventually but **double-counts in the rollup
permanently** — and the rollup is what the artist's dashboard and the optimizer
both read.

**I3. Money is integer minor units end to end.**
`revenueMinor` / `costMinor`, converted to Decimal exactly once in
`toWarehouseRow`. No floats, no `parseFloat` on money, no `Number` columns for
currency. These figures are shown to artists as their spend.

**I4. Never optimize toward `ad_click`.**
It is the metric Meta bills for; optimizing toward it rewards the platform for
charging us. Targets come from `OPTIMIZABLE_EVENT_TYPES` — outcomes we observe
ourselves.

**I5. Never show ROAS unless `revenueVisibility === 'measurable'`.**
Streams cannot be attributed to a click, and royalties arrive months later
unlinked. For an artist with no connected store, a ROAS tile reads `0.00x`
however well the ads performed. Show cost-per-outcome instead.

**I6. The Meta ads executor is write-only.**
Do not add a read endpoint to `WRITE_ENDPOINT_ALLOWLIST`. Read traffic against
the Marketing API gets ad accounts banned, and it is the artist's account at
risk. Analytics comes from the warehouse.

**I7. Every spend-increasing write checks the halt flag and fails closed.**
Spend-*reducing* writes (`pauseAd`) must never be gated — an artist who halts
the swarm still needs running ads stopped.

**I8. Never hardcode infrastructure identifiers.**
Ad account ids, pixel ids, Page ids, endpoint ids, project numbers, regions.
Meta and GCP rotate them. See `CLAUDE.md` Anti-Pattern #11.

**I9. Cloud Functions get `memory: '512MiB'` or more.**
Below ~259MiB the shared cold-start footprint OOMs before the container binds
its port, failing the whole functions deploy. `npm run check:functions`
enforces this.

**I10. Conversion emitters never throw into their caller.**
The fan-facing action already succeeded. Losing analytics is bad; failing a
pre-save because analytics failed is worse.

---

## Phase 1 — Finish the attribution spine

### Task 1.1 — Persist pre-saves and emit conversions

`packages/renderer/src/services/marketing/PreSaveCampaignService.ts` is a stub:
every persistence call is a commented-out line. Nothing is stored, so no
pre-save can ever become a conversion.

**Build**

1. `packages/firebase/src/marketing/presaveCallable.ts`
   - `presaveRegister` — `onCall`, App Check via `validateAppCheckV2`.
   - Input: `{ campaignId: string; dsp: string; email?: string; fbclid?: string }`
   - Writes `presaveCampaigns/{campaignId}/leads/{leadId}`.
   - Then `await enqueueConversionEvent({ ... eventType: 'presave', platform: 'presave' })`.
     **Awaited**, not detached — a pre-save is a durable outcome and I10's
     latency argument does not apply (no fan is mid-redirect).
   - `eventId` via `buildConversionEventId({ platform: 'presave', eventType: 'presave', sourceId: leadId })`.
2. Replace the stub bodies in `PreSaveCampaignService.ts` with calls to the
   callable. Delete the commented-out pseudo-code — do not leave it.
3. Firestore rules for `presaveCampaigns/{id}` and its `leads` subcollection:
   owner reads, **server-only writes** (a client-writable lead is a forged
   conversion that steers budget).

**Accept when**
- A pre-save produces exactly one outbox row with `eventType: 'presave'`.
- Re-submitting the same `leadId` overwrites rather than adding a second row.
- A Firestore write failure does not surface as a thrown error to the fan.
- Rules test: a signed-in user cannot write another artist's lead.

### Task 1.2 — Shopify / Stripe sale conversions

This is what makes ROAS real (I5). Until it exists, every artist is
`no_revenue_source`.

**Build**

1. Extend `packages/firebase/src/stripe/` webhook handling: on
   `checkout.session.completed`, emit a `sale` conversion.
   - `sourceId` = the Stripe session id. Stripe retries webhooks; the
     deterministic `eventId` is what stops a retry double-counting revenue.
   - `revenueMinor` = `amount_total` (Stripe is already in minor units — **do
     not divide**).
   - Carry `fbclid` from session metadata if the checkout began at a smart link.
2. `packages/firebase/src/marketing/shopifyWebhook.ts` — `onRequest`, HMAC-SHA256
   verified with a timing-safe compare (mirror `legal/pandadocWebhook.ts`).
   Emit `sale` on `orders/create`, `sourceId` = Shopify order id.

**Accept when**
- Same webhook delivered twice yields one outbox row.
- `revenueMinor` is an integer count of cents for a $25.99 order → `2599`.
- An unverified HMAC returns 401 and emits nothing.

### Task 1.3 — Wire the Conversions API into the flush

`metaConversionsApi.ts` is built and tested but has no caller, so Meta still
optimizes blind (see I4 — this is the fix for it).

**Build**

1. Store the artist's pixel id at `users/{uid}/analyticsTokens/instagram` →
   `adsPixelId`, captured during Meta connection. **Never hardcode it** (I8).
2. In `flushOutboxBatch`, after a successful warehouse insert, group the batch
   by `artistId` and call `sendConversions` per artist.
3. Send **after** the warehouse write, never before. The warehouse is the record
   of truth; Meta is a side-channel and already swallows its own errors.

**Accept when**
- Warehouse insert failure sends nothing to Meta.
- Meta failure does not prevent rows being marked flushed.
- Events without `fbclid` or contact data are not sent (`buildCapiPayload`
  returns null — do not "fix" this; it protects event-match quality).

### Task 1.4 — Smart-link management UI

Artists cannot currently create a smart link; the collection exists with rules
but no interface.

**Build** a panel under Marketing (new sidebar entry, mirror how
`swarm` was added in `MarketingSidebar.tsx` + `CampaignDashboard.tsx`):
slug availability check, per-DSP destinations, campaign association, copyable
`https://<landing-domain>/l/{slug}` URL.

**Accept when**
- Slug validates against `/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/` client-side with
  the same message the server uses.
- `artistId` is set from `auth.currentUser.uid`, never from a form field.
- A `javascript:` destination is rejected before save.

### Task 1.5 — Deploy the warehouse

Infrastructure, not code. Order matters.

1. Provision ClickHouse. Create **two** roles: read-only (`CLICKHOUSE_USERNAME`)
   and INSERT-only (`CLICKHOUSE_WRITER_USERNAME`). Do not reuse one credential —
   the split is the reason a bug in a query path cannot corrupt event history.
2. Apply `warehouse/clickhouse/migrations/001_initial_analytics_schema.sql`.
3. Set all five secrets in Secret Manager (see `config/secrets.ts`).
4. Deploy Airbyte, resolve the connector templates.
5. Verify: emit one test event → confirm it lands in `omnichannel_events`
   within 5 minutes → confirm the dashboard renders it.

---

## Phase 2 — Complete the Meta write path

**Do not start Phase 2 until `ads_management` is approved.** Everything here is
untestable without it.

### Task 2.1 — The ad hierarchy

`pushAdCreative` creates an AdCreative. A creative does not deliver impressions.
To spend, all four rungs must exist:

```
Campaign  (objective, spend_cap)
  └─ AdSet (daily_budget, targeting, schedule, optimization_goal, billing_event)
       └─ Ad (creative_id + adset_id)   ← the only rung that spends
```

**Build** in `facebookAdsExecutor.ts`: `createCampaign`, `createAdSet`,
`createAd`. Extend `WRITE_ENDPOINT_ALLOWLIST` with `act_\d+/campaigns`,
`act_\d+/adsets`, `act_\d+/ads` — **writes only** (I6).

Each must call `assertSwarmActive` first (I7).

Set the AdSet's `optimization_goal` to an outcome from
`OPTIMIZABLE_EVENT_TYPES`, reported via the Conversions API (I4).

**Accept when**
- Creating an ad while halted makes no Graph call.
- A read-shaped path added to the allowlist fails the existing write-only test.
- Every new function has the same discriminated-result shape as `pushAdCreative`.

### Task 2.2 — Ad account provisioning

`adAccountId` is currently a parameter with no source.

**Build** — extend the Meta connection flow to `GET /me/adaccounts`, let the
artist choose, store `adAccountId` on the `instagram` platform doc beside
`facebookPageId`. Read it server-side in the executor; **remove the parameter**
so a caller cannot pass someone else's account.

### Task 2.3 — Budget as a server-enforced entity

**Build** — on the campaign record: `dailyBudgetMinor`, `lifetimeCapMinor`,
`cpaCeilingMinor`, `spentToDateMinor`. Artist writes; agents read only.

Enforce before every spend-increasing write: refuse if
`spentToDate >= lifetimeCap`. Rules must forbid agents (and clients) raising a
ceiling — an agent that can raise its own budget has no budget.

### Task 2.4 — Idempotency on ad writes

Inngest and Cloud Scheduler retry. Publishing an ad is not idempotent: a retry
today would create a second ad and double the spend.

**Build** — deterministic key per `(campaignId, creativeId, adSetId)`. Check
`marketingAdWrites/{key}` in Firestore before the Graph POST; record after.
Same pattern as `buildConversionEventId`.

**Accept when** — invoking `createAd` twice with identical inputs produces one
Meta ad and one Firestore record.

---

## Phase 3 — Decision loop

**Do not begin until Phase 1 and Phase 2 are complete and verified against real
spend.** An optimizer running on unmeasured conversions is a random number
generator attached to an artist's credit card.

Design constraints, already decided:

- **One Media Buyer agent**, not a swarm. The decision is narrow and
  quantitative; multiple negotiating agents add failure modes, latency, and cost
  without improving it.
- **The budget math is deterministic, not an LLM call.** CPA thresholds,
  minimum-sample gates, Thompson sampling. Layer 3, testable. The LLM's job is
  creative, copy, and brand judgment — Layer 2.
- **Escalate autonomy in this order**, each behind a flag:
  1. Auto-pause losers (spend-reducing only — safe, ship first)
  2. Auto-shift budget between existing adsets within a fixed envelope
  3. Auto-launch within pre-approved bounds
- Before rung 1: a spend circuit breaker, spend-velocity anomaly halt, and
  stored decision receipts (which metrics, which threshold, which rule fired).
  "The agent decided" is not an acceptable answer when an artist asks where
  $200 went.

---

## Verification for every task

```bash
npm run typecheck        # exact CI command — not local tsc --noEmit
npm run lint             # includes check:functions, which enforces I9
npx vitest run <paths>
```

Per `CLAUDE.md`: check `.agent/skills/error_memory/ERROR_LEDGER.md` before
debugging anything, run `/plat` before pushing, and log issues only to
`.agent/test_ledger/OPEN_ISSUES_V2.md`.

`REAL_USER_AUTHENTICITY.md` applies with particular force here: **a mock-backed
test is never evidence that an ad path works.** The only proof that Phase 2
functions is a real ad, on a real account, with real money, verified in Ads
Manager.
