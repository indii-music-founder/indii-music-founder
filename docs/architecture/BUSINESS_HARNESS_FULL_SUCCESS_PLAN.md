# Business Harness Full Success Plan

> **Status of this document:** Re-baselined against the actual codebase on
> 2026-05-28. The "Implementation Status Matrix" and "Verified Facts &
> Corrections" sections below reflect what is *really* built, not what is merely
> catalogued. Earlier versions of this plan described a compiler pattern and a
> "Wave 1 of core rails" as if they existed — they do not yet. Treat any
> domain not marked **Done** in the matrix as unbuilt regardless of how detailed
> its section reads.

## Purpose

This document exists to prevent the harness system from becoming one strong vertical slice surrounded by unfinished ideas. The target is the full indii.music operating system: every music-business domain has a deterministic harness, every harness produces structured outputs, and Boardroom can reconcile all of them into sourced decisions.

The upload/intake path is the reference slice, not the finish line. The whole system succeeds only when every harness listed in the catalog can run, persist, brief agents, create approval gates, and participate in Boardroom decisions.

## Success Definition

The work is successful when all of these are true:

- Every harness in `BUSINESS_HARNESS_CATALOG` has a registered compiler or an explicitly documented `planned` status.
- Every harness returns a normalized `HarnessRun` with scores, findings, recommendations, cost lines, legal basis when relevant, evidence refs, agent briefs, approval gates, assumptions, confidence, `schemaVersion`, and output.
- Every harness has tests for happy path, missing-data path, approval gates, and Boardroom consumption.
- Every irreversible external action is blocked behind explicit user approval, enforced by a shared approval-gate registry.
- Uploading a song can trigger the full chain: Song DNA, DDEX, Creator Protection, Publishing, Collaboration, Finance, Release, Marketing, Merch, Licensing, Legal, Security, and Boardroom — and every produced run is consumable by Boardroom.
- Hidden costs are captured across app time, manual work, travel, mileage, gear, merch, legal protection, and opportunity cost.
- Agent training examples exist for each primary owning department and each supporting department, with enforced minimum counts.
- UI surfaces exist for the workflows users naturally need, not just backend stubs.
- Boardroom can cite source harness run IDs and refuses to invent facts when inputs are missing.

## Implementation Status Matrix

This replaces the previous prose "Current Reality" section. It is the single
honest snapshot of build state. The intended source of truth in code is a
`HARNESS_IMPLEMENTATION_STATUS` map (see Wave 1) so this table and the code
cannot silently diverge.

Legend: **Done** = registered compiler that emits a normalized `HarnessRun`.
**Partial** = some service machinery exists but it is not yet a registered,
normalized harness. **Planned** = catalog entry only, no compiler.

| # | Domain | State | Emits `HarnessRun` | Tests | Storage rules | UI | Source |
|---|--------|-------|--------------------|-------|---------------|----|--------|
| 1 | artist_memory | Planned | — | — | — | — | — |
| 2 | song_dna | Done | yes (inline) | yes | yes | partial | `business-harness/UploadIntakeHarnessService.ts` |
| 3 | creator_protection | Done | yes (`CreatorProtectionRun = HarnessRun`) | yes | yes | partial | `creator-protection/` |
| 4 | distribution_ddex | Done | yes (inline) | yes | yes | partial | `business-harness/UploadIntakeHarnessService.ts` |
| 5 | release | **Partial** | **no** — own `ReleaseHarnessResult` shape, own storage | yes | yes (`releaseHarnessRuns`) | partial | `release-harness/` |
| 6 | finance | Partial | no — cost-line/summary service only | yes | yes (`businessCostLines`) | — | `business-harness/HiddenCostHarnessService.ts`, `finance/` |
| 7 | activity_time_value | Partial | no — event + cost-line service only | yes | yes (`businessActivityEvents`) | — | `business-harness/ActivityValueService.ts` |
| 8 | road_travel | Planned | — | — | — | — | (`touring/` exists, unwired) |
| 9 | gear_asset | Planned | — | — | — | — | — |
| 10 | merch_pod | Done | yes | yes | yes | partial | `business-harness/MerchPodHarnessService.ts`, `merchandise/`, `pod/` |
| 11 | marketing_growth | Planned | — | — | — | — | (`marketing/` exists, unwired) |
| 12 | fan_crm | Planned | — | — | — | — | — |
| 13 | publishing_rights | Planned | — | — | — | — | (`publishing/` exists, unwired) |
| 14 | collaboration_splits | Planned | — | — | — | — | — |
| 15 | licensing_sync | Planned | — | — | — | — | (`licensing/` exists, unwired) |
| 16 | royalty_revenue | Planned | — | — | — | — | (`finance/RoyaltyService.ts` etc., unwired) |
| 17 | legal_compliance | Planned | — | — | — | — | (`legal/` exists, unwired) |
| 18 | creative_production | Planned | — | — | — | — | (`creative/` exists, unwired) |
| 19 | opportunity | Planned | — | — | — | — | — |
| 20 | education_curriculum | Planned | — | — | — | — | — |
| 21 | security_trust | Planned | — | — | — | — | (`security/` exists, unwired) |
| 22 | boardroom_meta | Partial (by design) | no — emits `BoardroomHarnessDecision` consuming `HarnessRun[]` | yes | n/a | partial | `business-harness/BoardroomMetaHarnessService.ts` |

Summary: **4 Done** (song_dna, creator_protection, distribution_ddex, merch_pod),
**4 Partial** (release, finance, activity_time_value, boardroom_meta), **14 Planned**.

## Verified Facts & Corrections

These correct claims that prior versions of this plan got wrong or omitted.
Confirmed by reading the code on 2026-05-28.

- **The "core rails" do not exist.** There is no `HarnessCompiler` interface, no `HarnessRegistry`, and no `compileHarness()` entrypoint anywhere in `packages/`. Every existing service has a bespoke signature (`compileUploadIntake`, `compile`, `compileReadiness`, `compileReleaseHarness`, `createDecision`). Wave 1 is genuinely unbuilt and must come first.
- **Release is not Boardroom-consumable today.** `ReleaseHarnessResult` (`release-harness/types.ts`) is its own shape with **no** `scores`/`findings`/`recommendations`/`costLines`/`approvalGates`/`legalBasis`, and persists via its own `saveReleaseHarnessRun`. `boardroomMetaHarnessService.createDecision` only accepts `HarnessRun[]`, so Release output is structurally unreachable by the final decision layer until an adapter exists.
- **`release-harness` redefines a conflicting `HarnessAgentBrief`** that shadows the canonical one in `business-harness/types.ts` (constrained `agentId` union, no `departmentId`). This is type drift to retire.
- **`HarnessRun` has no `schemaVersion`.** Persisting 22 evolving domains to Firestore without a version field is a migration trap. Add an optional `schemaVersion` defaulted by `createHarnessRun`.
- **Firestore rules already cover the harness collections** — `harnessRuns`, `businessActivityEvents`, `businessCostLines`, `releaseHarnessRuns`, and `replicaIncidents` are all present at user and project scope (`packages/firebase/firestore.rules`). The prior plan listed these as "still required." They are partly done; remaining work is rules for future domain-specific collections only.
- **Royalty engines already exist under `finance/`**, not a `royalty/` directory: `finance/RoyaltyService.ts`, `finance/WaterfallEngine.ts`, `finance/RoyaltyPayoutService.ts`. Reference these paths, not a non-existent `royalty/` service.
- **The test `business-harness/BusinessHarnessService.test.ts` is misnamed** — there is no `BusinessHarnessService.ts`. It exercises the individual services. Rename to `BusinessHarnessCore.test.ts` when convenient.
- **Dataset count enforcement is missing.** `packages/renderer/src/test/harness-datasets.test.ts` validates record schema but does **not** enforce the training plan's minimum counts (25 gold per owner, 10 cross-domain per supporter). Add count enforcement.

## Non-Negotiable Architecture

Every harness follows the same build pattern. Wave 1 makes this pattern real by
shipping the interface and registry below; every domain after Wave 1 implements
this interface and nothing else.

### The compiler contract (Wave 1 deliverable)

```ts
// packages/renderer/src/services/business-harness/HarnessCompiler.ts
export interface HarnessContext {
  userId: string;
  projectId?: string;
  save?: boolean;
}

export interface HarnessCompiler<TInput = unknown, TOutput = Record<string, unknown>> {
  readonly domain: HarnessDomain;
  compile(input: TInput, ctx: HarnessContext): Promise<HarnessRun<TOutput>> | HarnessRun<TOutput>;
}

// HarnessRegistry maps HarnessDomain -> HarnessCompiler.
// compileHarness(domain, input, ctx) resolves the compiler and runs it,
// throwing a clear error for an unregistered domain.
```

Multi-domain orchestrators (e.g. upload intake) are **not** compilers; they call
several single-domain compilers and return the bundle. Each domain owns exactly
one compiler and one code path.

1. **Input Adapter** — reads existing app data and user context; normalizes domain records into harness input; performs no irreversible actions.
2. **Domain Compiler** — deterministic checks, scoring, blockers, readiness; AI only for classification/extraction/summarization/creative suggestion; uncertainty captured in `confidence`, `assumptions`, findings.
3. **HarnessRun Builder** — emits one normalized `HarnessRun` via `createHarnessRun`, using shared types from `business-harness/types.ts`, including `schemaVersion`, cost lines, evidence, legal basis, agent briefs, and approval gates.
4. **Persistence** — saves through shared `HarnessStorage`; domain-specific storage only for records that are not just harness run output.
5. **Agent Briefs** — precise brief for the owning agent; minimal context for supporting agents; never asks agents to guess missing facts.
6. **Approval Gates** — blocks money, DDEX delivery, legal notices, filings, contracts, biometric monitoring, public publishing, POD orders, paid ads, purchases, and destructive changes, drawn from the shared approval-gate registry.
7. **Boardroom Consumption** — every harness output is a `HarnessRun` so Boardroom can read it without domain-specific branching.
8. **Tests** — unit (scoring/blockers), integration (storage, agent brief, Boardroom consumption), and a UI smoke test where a user-facing workflow exists.

### HarnessRun Schema Versioning & Migration

- Add optional `schemaVersion?: number` to `HarnessRun`; `createHarnessRun` defaults it to the current version (start at `1`). Optional-in-type + default-in-factory keeps every existing fixture and call site compiling.
- Stored runs are read back as historical records. Readers must tolerate older `schemaVersion` values; never assume the latest shape when hydrating Firestore documents.
- Any breaking change to `HarnessRun` bumps the version and adds a read-time upgrade path. Document the bump in this file.

### Irreversible-Action / Approval-Gate Registry

- Maintain a single source-of-truth list of irreversible actions (deliver to DSP, send legal notice, file registration, spend money, publish publicly, place POD order, run paid ads, enable biometric monitoring, destructive data changes) mapped to the required `HarnessApprovalGate` `riskTier`.
- A test asserts that any compiler whose output implies one of these actions attaches the corresponding gate. This is what makes "no irreversible action escapes approval" verifiable rather than aspirational.

## Build Order

The waves are dependency order. Because ~6 domains were already built **before**
the compiler contract existed (merch, finance, activity, the upload-intake pair,
boardroom), Wave 1 now includes **retrofitting** them, and the hard rule is:
**no new domain compiler is built until the rails land.** Otherwise more
divergent signatures accumulate and the rework cost compounds.

### Wave 1: Core Rails (rails-first, retrofit existing)

Goal: make it cheap and consistent to add every harness, and bring the existing
work onto the contract.

Deliverables:

- `HarnessCompiler` interface, `HarnessRegistry`, and `compileHarness(domain, input, ctx)` entrypoint.
- `HARNESS_IMPLEMENTATION_STATUS` map covering all 22 domains (source of truth for the matrix above).
- `schemaVersion` added to `HarnessRun` + defaulted in `createHarnessRun`.
- **Release→`HarnessRun` adapter** (`releaseResultToHarnessRun`) so Release is Boardroom-consumable, plus a registered `release` compiler.
- Register the already-normalized domains (song_dna, distribution_ddex, creator_protection, merch_pod) by extracting the two inline run builders out of `UploadIntakeHarnessService` so there is one code path.
- Shared test helper for fake users, projects, releases, tracks, expenses, and harness runs; shared Boardroom fixture builder.
- Approval-gate registry + coverage test.
- Catalog coverage CI: every `HarnessDomain` has a status entry, every `Done`/adapter domain is registered, every other domain is explicitly `planned`.

Acceptance:

- A new harness can be added by registering a compiler and tests, nothing else.
- Boardroom consumes any `HarnessRun` — **including Release** — without domain-specific branching (verified by a Boardroom-consumes-Release test).
- CI fails if a catalog domain has neither a registered implementation nor a documented `planned` status.

### Wave 2: Upload-To-Release Chain

Goal: a song upload becomes a complete, Boardroom-ready release business packet.

Harnesses: Artist Memory, Song DNA, Creator Protection, Distribution/DDEX, Publishing/Rights, Collaboration/Splits, Creative Production, Release, Legal/Compliance, Security/Trust, Boardroom.

Acceptance:

- Uploading a song produces a multi-harness packet whose every run is a `HarnessRun`.
- Missing identifiers, splits, rights, protection readiness, or legal issues block delivery.
- User can see what is ready, what is blocked, who owns the next action, and what requires approval.

### Wave 3: Money, Time, Road, Gear

Goal: capture the real economics of the user's music business.

Harnesses: Finance, Activity/Time Value, Road/Travel, Gear/Asset, Royalty/Revenue.

Acceptance:

- App time becomes project-level time-value records.
- A guitar-string run becomes equipment expense, mileage, drive-time value, gear consumable, and tax/project classification.
- Royalty and revenue records feed Finance and Boardroom.
- Boardroom can compare expected value against cash, time, legal, travel, and opportunity cost.

### Wave 4: Market Expansion

Goal: turn releases and audience data into money-making actions with gates.

Harnesses: Merch/POD, Marketing/Growth, Fan/CRM, Licensing/Sync, Opportunity, Education/Curriculum.

Acceptance:

- Merch ideas become POD provider comparisons, SKU plans, margins, samples, legal flags, and approval gates.
- Marketing uses Song DNA, Artist Memory, Fan/CRM, Release, Finance, and Legal inputs.
- Sync uses rights readiness, stems, clean versions, one-stop status, and pitch fit.
- Education appears only when it helps the workflow and never interrupts execution.

> Note: Merch/POD is already **Done** (built ahead of its wave). It still must be
> registered against the Wave 1 contract.

### Wave 5: Full System Hardening

Goal: no harness operates as a toy demo.

Deliverables: cross-domain Boardroom tests; UI smoke tests for every user-facing harness; training dataset target counts met **and enforced in CI**; audit logs for approval gates; configurable jurisdiction/date legal source snapshots; configurable tax/mileage rates; observability for harness failures and missing data; documentation links from UI, training docs, and architecture docs.

Acceptance: full CI passes; Boardroom reconciles conflicting harnesses; no irreversible action escapes approval; every domain has a user story, service, tests, storage path, and training coverage.

## Harness Completion Matrix

Each entry below carries its current **State** (from the matrix above). The
build/test detail is the target spec; for **Done** domains it is satisfied and
the remaining task is registration against the Wave 1 contract.

### 1. Artist Memory / Operating Model — Planned

Owner: Keeper / memory agent.

Build:

- Compile user preferences, genre history, risk tolerance, budget style, visual identity, collaborators, release cadence, business goals, time value, legal risk tolerance, and decision patterns.
- Distinguish observed behavior from user-stated preference.
- Add privacy controls for what memory can influence.
- Feed every other harness as personalization context.

Tests:

- Different users receive different recommendations from the same song input.
- Low-risk and high-risk artists produce different Boardroom decisions.
- Missing memory falls back to explicit assumptions.

Done when: every harness can optionally receive an Artist Operating Model summary, and the user can inspect or correct core operating-model assumptions.

### 2. Song DNA / Creative Intake — Done

Owner: Music agent. Source: `business-harness/UploadIntakeHarnessService.ts` (inline `song_dna` run).

Build:

- Use upload metadata and Gemini/audio analysis where available.
- Extract energy, mood, genre, audience, similar markets, lyrical themes, instrumentation, tempo, explicit status, AI involvement, visual direction, and release potential.
- Produce downstream briefs for Release, Marketing, Merch, Publishing, Licensing, Legal, and Boardroom.

Tests: audio profile path; metadata-only fallback; explicit/AI flags; low-confidence handling.

Done when: every uploaded song creates a Song DNA `HarnessRun` and downstream harnesses read structured output, not prose. **Remaining:** extract the inline builder into a registered `SongDnaCompiler`.

### 3. AI Digital Replica & Creator Protection — Done

Owner: Legal. Support: Security, Distribution, Publishing. Source: `creator-protection/` (`CreatorProtectionRun = HarnessRun<…>`).

Build:

- Maintain Identity Protection Profile, protected persona assets, voice/likeness consent records, authorized replica licenses, replica incidents, takedown cases, evidence packets, legal source snapshots, and readiness scores.
- Route incidents as copyright, voice clone, likeness/image, artist-name confusion, impersonation/fraud, platform policy, TAKE IT DOWN only when relevant, or uncertain.
- Draft notices but never send without approval.
- Require explicit opt-in for any biometric or fingerprint monitoring.

Tests: voice-clone classification; likeness misuse; DMCA vs platform policy vs attorney escalation routing; TAKE IT DOWN path only for qualifying facts; evidence packet integrity; AI contract clause risk review.

Done when: Creator Protection Center supports readiness, vault, evidence locker, takedown wizard, monitoring alerts, and law status; legal claims always show basis, confidence, and attorney-review boundaries. **Remaining:** register compiler; build remaining UI surfaces.

### 4. Distribution / DDEX — Done

Owner: Distribution. Support: Legal, Publishing. Source: `business-harness/UploadIntakeHarnessService.ts` (inline `distribution_ddex` run) + `distribution/`, `ingestion/`.

Build:

- Compile release delivery readiness, storefront requirements, territories, delivery blockers, takedown/update flows, and status.
- Track ISRC, UPC, catalog number, ISWC where applicable, IPI/CAE, PRO/MLC references, DPID, and DSP-required identifiers.
- Reuse proprietary ingestion, delivery, ISRC, UPC, DSP compliance, and adapter services.

Tests: missing-identifier blockers; complete package readiness; territory/storefront requirements; duplicate/fraud routing; delivery approval gate.

Done when: a release cannot be delivered externally unless Distribution, Legal, Publishing, Security, and Boardroom gates allow it and the user approves. **Remaining:** extract the inline builder into a registered `DistributionDdexCompiler`.

### 5. Release — Partial

Owner: Distribution. Support: Marketing, Creative, Finance, Legal. Source: `release-harness/`.

State: emits its own `ReleaseHarnessResult`, **not** a `HarnessRun`, and is therefore not Boardroom-consumable yet.

Build:

- Keep the Release Harness as the release-specific reference implementation.
- Add `releaseResultToHarnessRun` adapter (Wave 1) mapping confidence→scores, warnings→findings, strategy→recommendations, briefs→canonical `HarnessAgentBrief`, an explicit delivery approval gate, and budget→cost lines.
- Expand it to consume all upstream harnesses, not just basic release metadata.

Tests: complete release strategy; legal/protection blocker overrides release optimism; finance budget blocker changes plan; DDEX missing metadata blocks execution; **Boardroom consumes the adapted Release run.**

Done when: Release is the orchestrated deployment plan, emitted as a normalized `HarnessRun`, that Boardroom reconciles with every other domain.

### 6. Finance — Partial

Owner: Finance. Support: Accounting, Tax, Royalty. Source: `business-harness/HiddenCostHarnessService.ts`, `finance/`.

State: cost-line and summary machinery exists; not yet a registered `finance` harness emitting a `HarnessRun`.

Build:

- Aggregate revenue, expenses, receipts, royalties, merch, licensing, social income, travel, subscriptions, services, taxes, and project ROI.
- Use shared cost lines for cash, time value, mileage, asset depreciation, inventory, service fee, royalty obligation, opportunity cost, and legal protection cost.
- Reuse `FinanceService`, `ReceiptOCRService`, `finance/RoyaltyService.ts`, `finance/WaterfallEngine.ts`, payout, recoupment, and multicurrency services.

Tests: receipt → expense → cost line; hidden-cost summary; royalty and recoupment aggregation; project ROI with cash and non-cash investment.

Done when: Boardroom can answer "can we afford this action?" with cited cost and revenue inputs from a `finance` `HarnessRun`.

### 7. Activity / Time Value — Partial

Owner: Finance. Support: Keeper. Source: `business-harness/ActivityValueService.ts`.

State: produces `BusinessActivityEvent` + time-value cost lines; not yet a registered harness.

Build: track app time, active module/project, idle time, manual/agent work sessions, upload/generation wait, and category; convert summaries into time-value cost lines; settings for hourly value, privacy, project attribution.

Tests: idle detection; route/module attribution; manual correction; time value never treated as revenue.

Done when: user time can be summarized by project, release, task type, and investment value through a registered harness.

### 8. Road / Travel — Planned

Owner: Road. Support: Finance, Legal. Reuse: `touring/`, road/maps tools.

Build: compile route, mileage, gas, lodging, per diem, tolls, parking, drive time, backline, rehearsal, load-in/out, crew, insurance, and border/visa concerns; generate travel cost lines.

Tests: local supply run; gig trip; tour leg; border/visa warning; mileage and time-value generation.

Done when: Road decisions feed Finance and Boardroom before the artist spends or commits.

### 9. Gear / Asset — Planned

Owner: Finance. Support: Music, Road.

Build: track instruments, strings, cables, pedals, laptops, software, repairs, warranties, depreciation, replacement cycles, and project/tour use; separate durable assets from consumables; attach gear to sessions, releases, tours, and tax categories.

Tests: consumable purchase; durable asset depreciation; repair/warranty reminder; project allocation.

Done when: gear cost is visible as business infrastructure, not one-off expenses.

### 10. Merch / Print-on-Demand — Done

Owner: Merchandise. Support: Finance, Legal, Brand. Source: `business-harness/MerchPodHarnessService.ts`, `merchandise/`, `pod/`.

Build: reuse `MerchandiseService`, `PrintOnDemandService`, Printful functions, mockups, samples, manufacture requests, and POD catalog data; compile product line, SKU set, provider choice, margin table, break-even units, retail price, sample request, drop calendar, campaign briefs, and legal/trademark flags.

Tests: provider comparison; margin and break-even; sample approval gate; trademark/likeness flag; tour/release/drop recommendation.

Done when: a merch idea becomes a gated, costed, legally checked business plan. **Remaining:** register against the Wave 1 contract.

### 11. Marketing / Growth — Planned

Owner: Marketing. Support: Social, Publicist, Brand. Reuse: `marketing/`, social tools.

Build: use Song DNA, Artist Memory, Release, Fan/CRM, budget, audience analytics, social tools, and campaign history; compile channel mix, content calendar, budget allocation, creative briefs, testing matrix, conversion goals, and optimization loop.

Tests: zero-budget plan; paid campaign approval gate; user-specific creative direction; post-release optimization from metrics.

Done when: Marketing acts on harness evidence, not generic advice.

### 12. Fan / CRM — Planned

Owner: Marketing. Support: Social, Merch, Road.

Build: track fan segments, email/SMS/social audiences, superfans, geography, purchases, engagement, and live-market demand; feed Marketing, Merch, Road, Finance, and Boardroom.

Tests: segment creation; superfan identification; geography drives road opportunity; purchases drive merch recommendation.

Done when: audience data changes business decisions across merch, road, and release planning.

### 13. Publishing / Rights — Planned

Owner: Publishing. Support: Legal, Royalty. Reuse: `publishing/` (`ISWCService`), `finance/` royalty.

Build: compile compositions, splits, PRO status, MLC/admin readiness, ISWC, IPI/CAE, publisher shares, co-writer workflows, and registration blockers.

Tests: missing split-sheet blocker; ISWC missing but not always delivery-blocking distinction; PRO/MLC readiness; co-writer approval gate.

Done when: rights readiness is clear before distribution, licensing, royalty collection, or legal claims.

### 14. Collaboration / Splits — Planned

Owner: Legal. Support: Publishing, Finance.

Build: capture collaborators, roles, contribution notes, proposed splits, approvals, disputes, and missing agreements; generate split-sheet readiness and missing-signature gates.

Tests: complete collaborator approvals; disputed split blocks release/licensing; missing producer agreement creates legal and finance findings.

Done when: no release can silently ignore collaborators or unresolved splits.

### 15. Licensing / Sync — Planned

Owner: Licensing. Support: Legal, Publishing. Reuse: `licensing/`.

Build: use Song DNA, rights readiness, clean/instrumental/stems availability, one-stop status, and pitch targets; compile sync readiness, pitch package, target categories, legal blockers, and opportunity value.

Tests: one-stop ready song; missing instrumental or stems; sample/legal blocker; target category matching.

Done when: sync pitching only happens when rights and assets support it.

### 16. Royalty / Revenue — Planned

Owner: Finance Royalty. Support: Publishing, Distribution. Reuse: `finance/RoyaltyService.ts`, `finance/WaterfallEngine.ts`, `finance/RoyaltyPayoutService.ts`, `revenue/`.

Build: track streaming, publishing, merch, licensing, direct sales, social monetization, statements, recoupment, waterfalls, and unpaid balances.

Tests: statement import; recoupment; split waterfall; unpaid balance; revenue feeds project ROI.

Done when: Finance and Boardroom can see what each project earned, owes, and has not collected.

### 17. Legal / Compliance — Planned

Owner: Legal. Support: Contracts, Compliance, Security. Reuse: `legal/`.

Build: expand beyond contracts into samples, trademarks, likeness, AI clauses, merch art, collaboration agreements, licensing restrictions, DDEX compliance, data privacy, and approval gates; own Creator Protection with Security support.

Tests: contract AI clause review; sample clearance warning; trademark/artist-name risk; privacy/biometric approval gate; DDEX compliance issue.

Done when: legal risk is visible before public release, spending, delivery, filing, notice sending, or signing.

### 18. Creative Production — Planned

Owner: Creative. Support: Producer, Director, Video. Reuse: `creative/`, `video/`.

Build: track demos, mixes, masters, stems, artwork, videos, derivatives, credits, revisions, and delivery readiness; feed Release, Distribution, Marketing, Licensing, Legal, and Merch.

Tests: missing master blocks delivery; missing stems reduces sync readiness; artwork legal/brand issue routes to Legal and Merch; credits feed DDEX/publishing.

Done when: creative assets are inventory with status, not loose files.

### 19. Opportunity — Planned

Owner: Generalist. Support: Finance, Legal, Marketing.

Build: score shows, playlists, collabs, sponsorships, sync leads, grants, placements, press, and brand deals; output value, cost, risk, fit, timing, and next action.

Tests: high-value/high-risk escalates; low-fit rejected or deferred; missing budget blocks commitment; legal contract needed before acceptance.

Done when: opportunities become comparable business decisions.

### 20. Education / Curriculum — Planned

Owner: Curriculum. Support: Keeper.

Build: use user behavior and harness gaps to decide what the artist needs to learn next; provide just-in-time guidance without interrupting workflows.

Tests: user repeatedly misses split-sheet steps; user lacks publishing readiness; user about to approve a high-risk action; guidance does not replace legal/tax advice.

Done when: education closes execution gaps without becoming generic content.

### 21. Security / Trust — Planned

Owner: Security. Support: Legal, DevOps. Reuse: `security/`.

Build: monitor sensitive actions, credentials, external APIs, spending, delivery, biometrics, legal evidence, and agent permissions; provide approval gates, audit logs, evidence integrity, and risk registry checks.

Tests: biometric monitoring opt-in required; legal notice approval required; external API credential handling; spending and publishing risk gates; evidence packet tamper warning.

Done when: Security is the enforcement layer under every harness.

### 22. Boardroom Meta-Harness — Partial (by design)

Owner: Generalist / Conductor. Support: all departments. Source: `business-harness/BoardroomMetaHarnessService.ts`.

State: consumes `HarnessRun[]` and emits a `BoardroomHarnessDecision`. It does not emit a `HarnessRun` (that is correct — it is the meta layer). Its limitation today is that it cannot see Release until the Wave 1 adapter exists.

Build: read all domain harness runs; decide approve, reject/defer, reroute, escalate, or block; cite source run IDs, findings, blockers, departments, costs, legal risk, and required approval; never invent missing facts.

Tests: Legal blocks release despite Distribution readiness; Finance blocks paid campaign despite Marketing urgency; Creator Protection escalates voice risk before delivery; Merch sample approval blocks POD order; Road cost changes Opportunity decision; **Release (adapted) participates in the decision.**

Done when: Boardroom is the final cross-domain decision layer and can reconcile every domain that produces a `HarnessRun`.

## UI Delivery Plan

Each harness needs a user-facing surface only where the user must understand, approve, correct, or act. Surfaces are lazy-loaded modules wired through `MODULE_COMPONENTS` in `packages/renderer/src/core/App.tsx` (standalone modules listed in `core/constants.ts`); add new module IDs there rather than inventing greenfield shells.

Required UI surfaces:

- Upload Intake Dashboard: Song DNA, DDEX, Creator Protection, Release summary.
- Creator Protection Center: readiness, vault, evidence locker, takedown wizard, monitoring alerts, law status.
- Release Readiness Board: blockers, identifiers, rights, assets, distribution gates.
- Finance Hidden Cost Ledger: cash, time, mileage, gear, legal protection, ROI.
- Road Cost Planner: routes, trips, mileage, drive time, trip cost lines.
- Gear and Asset Register: durable assets, consumables, repairs, depreciation.
- Merch/POD Planner: SKU/margin/provider/sample/drop planning.
- Marketing Campaign Planner: channel mix, content calendar, tests, approvals.
- Fan/CRM View: segments, geography, purchases, superfans.
- Publishing/Rights Center: splits, ISWC, PRO, MLC, publisher shares.
- Licensing/Sync Pitch Room: readiness, packages, targets, blockers.
- Boardroom Decision View: sourced decision, blockers, cost, legal risk, next action.

UI acceptance:

- Users see what the app knows, what it assumes, what is missing, and what it will not do without approval.
- Each approval gate explains the risk and the exact action being approved.
- No UI hides legal, finance, distribution, or security blockers behind optimistic language.

## Agent Training Delivery Plan

Training follows `docs/agent-training/HARNESS_TRAINING_PLAN.md`.

Minimum dataset work:

- 25 gold examples for each primary harness owner.
- 10 cross-domain examples for each supporting agent.
- Existing 100-example-per-agent target remains.
- Dataset count script runs before and after additions, and the **count minimums are enforced in CI** (today only the schema is enforced, in `packages/renderer/src/test/harness-datasets.test.ts`).

Training acceptance:

- Agents cite harness run state.
- Agents use tools only within authorization rules.
- Agents escalate legal/tax uncertainty.
- Agents refuse false notices, unauthorized filings, unauthorized spending, and biometric monitoring without consent.
- Boardroom examples cover conflicts between departments.

## Test Strategy

Every harness gets the same test classes.

Unit tests: compiler creates a valid `HarnessRun`; scores and blockers deterministic; missing data creates assumptions and recommendations; approval gates emitted for irreversible actions; agent briefs name the correct owner and support departments.

Integration tests: storage shape; Firestore rules; existing service adapters; Boardroom consumption; risk registry and approval enforcement.

UI smoke tests: user can open the surface, inspect assumptions, see blockers, approve/reject gated drafts, and cannot execute irreversible actions without explicit approval.

Dataset tests: required schema fields; minimum examples per target; refusal/escalation examples; cross-domain Boardroom examples.

## CI And Guardrails

Add or maintain these CI checks:

- **Catalog coverage:** every `HarnessDomain` has a status in `HARNESS_IMPLEMENTATION_STATUS`; every `Done`/adapter domain is registered; every other is explicitly `planned`.
- **Registered compiler coverage:** every buildable harness has a registry entry.
- **Boardroom consumption:** at least one test feeds an adapted Release run plus other domains into Boardroom and asserts a sourced decision.
- **Approval gate coverage:** every irreversible action in the registry has a test asserting its gate.
- **Dataset schema and count validation** (counts newly enforced).
- **Flowchart validation** when architecture changes.
- Typecheck, focused tests, and full CI before handoff.

## Non-Goals

- This plan does not require building all 22 domains at once; it requires the rails first, then dependency-ordered waves.
- It does not delete the `release-harness`-local `HarnessAgentBrief` immediately (flagged as debt; the adapter normalizes at the boundary instead).
- It does not add new UI surfaces or dataset rows as part of Wave 1.

## Risks & Sequencing Realism

- **Signature drift** is the primary risk and the reason for rails-first. Six services already diverged; building more before the contract lands multiplies retrofit cost.
- **Adapter fidelity:** the Release adapter is lossy by nature (no native findings). Mark Release as adapter-backed, not native, so the status matrix stays honest.
- **Schema evolution:** without `schemaVersion`, stored runs become unreadable after the first breaking change. Add it before more domains start persisting.
- **Optional typing:** keep `schemaVersion` optional in the type and defaulted in the factory so the change is non-breaking across existing fixtures.

## Work Breakdown For The Next Agents

Execute in this order. Do not brainstorm.

1. Add the `HarnessCompiler` interface, `HarnessRegistry`, and `compileHarness` entrypoint.
2. Add `schemaVersion` to `HarnessRun` (+ default in `createHarnessRun`).
3. Add `HARNESS_IMPLEMENTATION_STATUS` and the catalog-coverage test that fails for missing status.
4. Build the Release→`HarnessRun` adapter and register the `release` compiler.
5. Extract the inline Song DNA / DDEX builders and register `song_dna`, `distribution_ddex`, `creator_protection`, `merch_pod`.
6. Add the approval-gate registry + coverage test and the Boardroom-consumes-Release test.
7. Build Wave 2 harness compilers around upload-to-release.
8. Build Wave 3 economics harnesses and the hidden-cost ledger UI.
9. Build Wave 4 market expansion harnesses and UI surfaces.
10. Complete Wave 5 hardening, dataset count enforcement, remaining Firestore rules, and approval risk registry.
11. Run full CI and update checkpoints.

## Final Acceptance Checklist

- [ ] `HarnessCompiler` + `HarnessRegistry` + `compileHarness` exist.
- [ ] `HarnessRun` carries `schemaVersion`; `createHarnessRun` defaults it.
- [ ] `HARNESS_IMPLEMENTATION_STATUS` covers all 22 domains and matches this doc's matrix.
- [ ] All 22 harnesses are registered or explicitly `planned`.
- [ ] All buildable harnesses emit normalized `HarnessRun` output.
- [ ] Release is adapter-normalized and consumed by Boardroom.
- [ ] All harnesses have owner and supporting agent briefs.
- [ ] All harnesses have tests.
- [ ] All irreversible actions have approval gates, enforced by the registry test.
- [ ] Boardroom consumes all harness domains and cites source run IDs.
- [ ] Creator Protection includes evidence, takedown, consent, monitoring, and legal source snapshots.
- [ ] DDEX/distribution includes identifiers and direct-to-storefront blockers.
- [ ] Finance includes cash, time, mileage, gear, legal protection, inventory, royalty, and opportunity cost.
- [ ] Road, Gear, Merch, Marketing, Fan/CRM, Publishing, Licensing, Royalty, Legal, Creative, Opportunity, Education, and Security are not stubs.
- [ ] UI surfaces exist for all user-facing workflows.
- [ ] Training datasets meet minimum counts, enforced in CI.
- [ ] Full CI passes.

## Operating Principle

The harness is the business. Agents are labor. Boardroom is judgment. Security, Legal, Finance, and Distribution gates are enforcement. The app succeeds when the whole system turns music activity into accountable business state — not when one impressive harness demo works in isolation. Build the rails first, keep the status matrix honest, and let no irreversible action escape an approval gate.
