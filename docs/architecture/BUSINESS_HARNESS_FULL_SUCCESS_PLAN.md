# Business Harness Full Success Plan

## Purpose

This document exists to prevent the harness system from becoming one strong vertical slice surrounded by unfinished ideas. The target is the full Indii.music operating system: every music-business domain has a deterministic harness, every harness produces structured outputs, and Boardroom can reconcile all of them into sourced decisions.

The upload/intake path is the reference slice, not the finish line. The whole system succeeds only when every harness listed in the catalog can run, persist, brief agents, create approval gates, and participate in Boardroom decisions.

## Success Definition

The work is successful when all of these are true:

- Every harness in `BUSINESS_HARNESS_CATALOG` has a service implementation or adapter-backed compiler.
- Every harness returns a `HarnessRun` with scores, findings, recommendations, cost lines, legal basis when relevant, evidence refs, agent briefs, approval gates, assumptions, confidence, and output.
- Every harness has tests for happy path, missing-data path, approval gates, and Boardroom consumption.
- Every irreversible external action is blocked behind explicit user approval.
- Uploading a song can trigger the full chain: Song DNA, DDEX, Creator Protection, Publishing, Collaboration, Finance, Release, Marketing, Merch, Licensing, Legal, Security, and Boardroom.
- Hidden costs are captured across app time, manual work, travel, mileage, gear, merch, legal protection, and opportunity cost.
- Agent training examples exist for each primary owning department and each supporting department.
- UI surfaces exist for the workflows users naturally need, not just backend stubs.
- Boardroom can cite source harness run IDs and refuse to invent facts when inputs are missing.

## Current Reality

The project now has the right foundation, but it is not complete.

Already present or partially present:

- Shared business harness types and catalog.
- Upload intake compiler for Song DNA, DDEX readiness, Creator Protection readiness, and Release handoff.
- Creator Protection service and tests.
- Release Harness service and tests.
- Hidden cost and activity value services.
- Boardroom Meta-Harness first pass.
- Merch/POD harness first pass.
- Strong existing service areas for distribution, DDEX/proprietary ingestion, ISRC, UPC, finance, receipt OCR, royalty, publishing ISWC, legal, security, merch, and agent cards.
- Harness training plan and dataset validation tests.

Still required:

- Convert every domain into a first-class harness compiler.
- Wire existing service areas into harness outputs instead of leaving them as standalone tools.
- Add UI entries where the user needs to act.
- Add Boardroom integration tests across conflicting harness outputs.
- Add persistent run history and audit views for every harness.
- Add complete training datasets for every owning and supporting agent.

## Non-Negotiable Architecture

Every harness follows the same build pattern.

1. **Input Adapter**
   - Reads existing app data and user context.
   - Normalizes domain-specific records into harness input.
   - Does not perform irreversible actions.

2. **Domain Compiler**
   - Runs deterministic checks, scoring, blockers, and readiness logic.
   - Calls AI only for classification, extraction, summarization, or creative suggestions where uncertainty is expected.
   - Stores uncertainty in `confidence`, `assumptions`, and findings.

3. **HarnessRun Builder**
   - Emits one normalized `HarnessRun`.
   - Uses shared types from `packages/renderer/src/services/business-harness/types.ts`.
   - Includes cost lines, evidence, legal basis, agent briefs, and approval gates.

4. **Persistence**
   - Saves through shared harness storage where possible.
   - Uses domain-specific storage only for records that are not just harness run output.

5. **Agent Briefs**
   - Gives the owning agent a precise brief.
   - Gives supporting agents only the context they need.
   - Never asks agents to guess missing facts.

6. **Approval Gates**
   - Blocks money, DDEX delivery, legal notices, filings, contracts, biometric monitoring, public publishing, POD orders, paid ads, purchases, and destructive changes.

7. **Boardroom Consumption**
   - Every harness output must be usable by Boardroom.
   - Boardroom decides approve, defer, reroute, escalate, or block.

8. **Tests**
   - Unit tests for domain scoring and blockers.
   - Integration tests for storage, agent brief, and Boardroom consumption.
   - UI smoke test where a user-facing workflow exists.

## Build Order

This is not a "do some now, do some later" plan. The waves are dependency order so the system can be built without rework.

### Wave 1: Core Rails

Goal: make it cheap and consistent to add every harness.

Deliverables:

- `HarnessCompiler` interface.
- `HarnessRegistry` that maps `HarnessDomain` to compiler.
- Shared `compileHarness(domain, input)` entrypoint.
- Shared test helper for creating fake users, projects, releases, tracks, expenses, and harness runs.
- Shared Boardroom fixture builder.
- Firestore rules coverage for harness runs, business activity events, cost lines, evidence packets, incidents, and takedown cases.
- Agent tool risk registry for all irreversible actions.

Acceptance:

- A new harness can be added by registering a compiler and tests.
- Boardroom can consume any `HarnessRun` without domain-specific branching.
- CI fails if a catalog domain has no registered implementation or documented adapter status.

### Wave 2: Upload-To-Release Chain

Goal: a song upload becomes a complete release business packet.

Harnesses included:

- Artist Memory / Operating Model
- Song DNA / Creative Intake
- Creator Protection
- Distribution / DDEX
- Publishing / Rights
- Collaboration / Splits
- Creative Production
- Release
- Legal / Compliance
- Security / Trust
- Boardroom Meta-Harness

Acceptance:

- Uploading a song produces a multi-harness packet.
- Missing identifiers, splits, rights, protection readiness, or legal issues block delivery.
- User can see what is ready, what is blocked, who owns the next action, and what requires approval.

### Wave 3: Money, Time, Road, Gear

Goal: capture the real economics of the user's music business.

Harnesses included:

- Finance
- Activity / Time Value
- Road / Travel
- Gear / Asset
- Royalty / Revenue

Acceptance:

- App time becomes project-level time-value records.
- A guitar-string run becomes equipment expense, mileage, drive time value, gear consumable, and tax/project classification.
- Royalty and revenue records feed Finance and Boardroom.
- Boardroom can compare expected value against cash, time, legal, travel, and opportunity cost.

### Wave 4: Market Expansion

Goal: turn releases and audience data into money-making actions with gates.

Harnesses included:

- Merch / Print-on-Demand
- Marketing / Growth
- Fan / CRM
- Licensing / Sync
- Opportunity
- Education / Curriculum

Acceptance:

- Merch ideas become POD provider comparisons, SKU plans, margins, samples, legal flags, and approval gates.
- Marketing campaigns use Song DNA, Artist Memory, Fan/CRM, Release, Finance, and Legal inputs.
- Sync opportunities use rights readiness, stems, clean versions, one-stop status, and pitch fit.
- Education appears only when it helps the workflow and does not interrupt execution.

### Wave 5: Full System Hardening

Goal: no harness operates as a toy demo.

Deliverables:

- Cross-domain Boardroom tests.
- UI smoke tests for every user-facing harness.
- Training dataset target counts met.
- Audit logs for approval gates.
- Configurable jurisdiction/date legal source snapshots.
- Configurable tax/mileage rates.
- Observability for harness failures and missing data.
- Documentation links from UI, training docs, and architecture docs.

Acceptance:

- Full CI passes.
- Boardroom can reconcile conflicting harnesses.
- No irreversible action escapes approval.
- Every domain has a clear user story, service, tests, storage path, and training coverage.

## Harness Completion Matrix

### 1. Artist Memory / Operating Model

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

Done when:

- Every harness can optionally receive an Artist Operating Model summary.
- User can inspect or correct core operating-model assumptions.

### 2. Song DNA / Creative Intake

Owner: Music agent.

Build:

- Use upload metadata and Gemini/audio analysis where available.
- Extract energy, mood, genre, audience, similar markets, lyrical themes, instrumentation, tempo, explicit status, AI involvement, visual direction, and release potential.
- Produce downstream briefs for Release, Marketing, Merch, Publishing, Licensing, Legal, and Boardroom.

Tests:

- Audio profile path.
- Metadata-only fallback.
- Explicit content and AI involvement flags.
- Low-confidence handling when analysis is missing.

Done when:

- Every uploaded song creates a Song DNA `HarnessRun`.
- Downstream harnesses can read the Song DNA output without parsing prose.

### 3. AI Digital Replica & Creator Protection

Owner: Legal. Support: Security, Distribution, Publishing.

Build:

- Maintain Identity Protection Profile, protected persona assets, voice/likeness consent records, authorized replica licenses, replica incidents, takedown cases, evidence packets, legal source snapshots, and readiness scores.
- Route incidents as copyright, voice clone, likeness/image, artist-name confusion, impersonation/fraud, platform policy, TAKE IT DOWN only when relevant, or uncertain.
- Draft notices but never send without approval.
- Require explicit opt-in for any biometric or fingerprint monitoring.

Tests:

- Voice clone classification.
- Likeness misuse classification.
- DMCA vs platform policy vs attorney escalation routing.
- TAKE IT DOWN path only for qualifying facts.
- Evidence packet integrity.
- AI contract clause risk review.

Done when:

- Creator Protection Center supports readiness, vault, evidence locker, takedown wizard, monitoring alerts, and law status.
- Legal claims always show basis, confidence, and attorney-review boundaries.

### 4. Distribution / DDEX

Owner: Distribution. Support: Legal, Publishing.

Build:

- Compile DDEX package readiness, storefront requirements, territories, delivery blockers, takedown/update flows, and status.
- Track ISRC, UPC, catalog number, ISWC where applicable, IPI/CAE, PRO/MLC references, DPID, and DSP-required identifiers.
- Reuse proprietary ingestion, delivery, ISRC, UPC, DSP compliance, and adapter services.

Tests:

- Missing identifier blockers.
- Complete package readiness.
- Territory/storefront requirements.
- Duplicate/fraud release routing.
- Delivery approval gate.

Done when:

- A release cannot be delivered externally unless Distribution, Legal, Publishing, Security, and Boardroom gates allow it and the user approves.

### 5. Release

Owner: Distribution. Support: Marketing, Creative, Finance, Legal.

Build:

- Continue using Release Harness as reference implementation.
- Expand it to consume all upstream harnesses, not just basic release metadata.
- Output readiness, blockers, release date, budget split, pre-save plan, agent briefs, and Boardroom summary.

Tests:

- Complete release strategy.
- Legal/protection blocker overrides release optimism.
- Finance budget blocker changes plan.
- DDEX missing metadata blocks execution.

Done when:

- Release is the orchestrated deployment plan, not a standalone recommender.

### 6. Finance

Owner: Finance. Support: Accounting, Tax, Royalty.

Build:

- Aggregate revenue, expenses, receipts, royalties, merch, licensing, social income, travel, subscriptions, services, taxes, and project ROI.
- Use shared cost lines for cash expense, time value, mileage, asset depreciation, inventory, service fee, royalty obligation, opportunity cost, and legal protection cost.
- Reuse FinanceService, ReceiptOCRService, RoyaltyService, WaterfallEngine, payout, recoupment, and multicurrency services.

Tests:

- Receipt to expense to cost line.
- Hidden-cost summary.
- Royalty and recoupment aggregation.
- Project ROI with cash and non-cash investment.

Done when:

- Boardroom can answer "can we afford this action?" with cited cost and revenue inputs.

### 7. Activity / Time Value

Owner: Finance. Support: Keeper.

Build:

- Track app time, active module, active project, idle time, manual work sessions, agent work sessions, upload/generation waiting time, and category.
- Convert summaries into time-value cost lines.
- Provide settings for hourly value, privacy, and project attribution.

Tests:

- Idle detection.
- Route/module attribution.
- Manual correction.
- Time value is not treated as revenue.

Done when:

- User time in the app can be summarized by project, release, task type, and investment value.

### 8. Road / Travel

Owner: Road. Support: Finance, Legal.

Build:

- Compile route, mileage, gas, lodging, per diem, tolls, parking, drive time, backline, rehearsal, load-in/out, crew, insurance, and border/visa concerns.
- Reuse TouringService, RoadTools, MapsTools, vehicle stats, itineraries, and budget tools where present.
- Generate travel cost lines.

Tests:

- Local supply run.
- Gig trip.
- Tour leg.
- Border/visa warning.
- Mileage and time-value generation.

Done when:

- Road decisions feed Finance and Boardroom before the artist spends or commits.

### 9. Gear / Asset

Owner: Finance. Support: Music, Road.

Build:

- Track instruments, strings, cables, pedals, laptops, software, repairs, warranties, depreciation, replacement cycles, and project/tour use.
- Separate durable assets from consumables.
- Attach gear to sessions, releases, tours, and tax categories.

Tests:

- Consumable purchase.
- Durable asset depreciation.
- Repair/warranty reminder.
- Project allocation.

Done when:

- Gear cost is visible as business infrastructure, not just one-off expenses.

### 10. Merch / Print-on-Demand

Owner: Merchandise. Support: Finance, Legal, Brand.

Build:

- Reuse MerchandiseService, PrintOnDemandService, Printful functions, mockups, samples, manufacture requests, and POD catalog data.
- Compile product line, SKU set, provider choice, margin table, break-even units, retail price, sample request, drop calendar, campaign briefs, and legal/trademark flags.

Tests:

- Provider comparison.
- Margin and break-even.
- Sample approval gate.
- Trademark/likeness flag.
- Tour/release/drop recommendation.

Done when:

- A merch idea becomes a gated, costed, legally checked business plan.

### 11. Marketing / Growth

Owner: Marketing. Support: Social, Publicist, Brand.

Build:

- Use Song DNA, Artist Memory, Release, Fan/CRM, budget, audience analytics, social tools, and campaign history.
- Compile channel mix, content calendar, budget allocation, creative briefs, testing matrix, conversion goals, and optimization loop.

Tests:

- Zero-budget plan.
- Paid campaign approval gate.
- User-specific creative direction.
- Post-release optimization from metrics.

Done when:

- Marketing acts on harness evidence, not generic music-business advice.

### 12. Fan / CRM

Owner: Marketing. Support: Social, Merch, Road.

Build:

- Track fan segments, email/SMS/social audiences, superfans, geography, purchases, engagement, and live-market demand.
- Feed Marketing, Merch, Road, Finance, and Boardroom.

Tests:

- Segment creation.
- Superfan identification.
- Geography drives road opportunity.
- Purchases drive merch recommendation.

Done when:

- Audience data changes business decisions across merch, road, and release planning.

### 13. Publishing / Rights

Owner: Publishing. Support: Legal, Royalty.

Build:

- Compile compositions, splits, PRO status, MLC/admin readiness, ISWC, IPI/CAE, publisher shares, co-writer workflows, and registration blockers.
- Reuse ISWCService, mechanical royalty, LOD, royalty, and publishing services.

Tests:

- Missing split sheet blocker.
- ISWC missing but not always delivery-blocking distinction.
- PRO/MLC readiness.
- Co-writer approval gate.

Done when:

- Rights readiness is clear before distribution, licensing, royalty collection, or legal claims.

### 14. Collaboration / Splits

Owner: Legal. Support: Publishing, Finance.

Build:

- Capture collaborators, roles, contribution notes, proposed splits, approvals, disputes, and missing agreements.
- Generate split sheet readiness and missing signature gates.

Tests:

- Complete collaborator approvals.
- Disputed split blocks release/licensing.
- Missing producer agreement creates legal and finance findings.

Done when:

- No release can silently ignore collaborators or unresolved splits.

### 15. Licensing / Sync

Owner: Licensing. Support: Legal, Publishing.

Build:

- Use Song DNA, rights readiness, clean/instrumental/stems availability, one-stop status, and pitch targets.
- Compile sync readiness, pitch package, target categories, legal blockers, and opportunity value.

Tests:

- One-stop ready song.
- Missing instrumental or stems.
- Sample/legal blocker.
- Target category matching.

Done when:

- Sync pitching only happens when rights and assets support it.

### 16. Royalty / Revenue

Owner: Finance Royalty. Support: Publishing, Distribution.

Build:

- Track streaming, publishing, merch, licensing, direct sales, social monetization, statements, recoupment, waterfalls, and unpaid balances.
- Reuse RoyaltyService, WaterfallEngine, RoyaltyPayoutService, earnings processors, and distribution earnings services.

Tests:

- Statement import.
- Recoupment.
- Split waterfall.
- Unpaid balance.
- Revenue feeds project ROI.

Done when:

- Finance and Boardroom can see what each project earned, owes, and has not collected.

### 17. Legal / Compliance

Owner: Legal. Support: Contracts, Compliance, Security.

Build:

- Expand beyond contracts into samples, trademarks, likeness, AI clauses, merch art, collaboration agreements, licensing restrictions, DDEX compliance, data privacy, and approval gates.
- Own Creator Protection with Security support.

Tests:

- Contract AI clause review.
- Sample clearance warning.
- Trademark/artist-name risk.
- Privacy/biometric approval gate.
- DDEX compliance issue.

Done when:

- Legal risk is visible before public release, spending, delivery, filing, notice sending, or signing.

### 18. Creative Production

Owner: Creative. Support: Producer, Director, Video.

Build:

- Track demos, mixes, masters, stems, artwork, videos, derivatives, credits, revisions, and delivery readiness.
- Feed Release, Distribution, Marketing, Licensing, Legal, and Merch.

Tests:

- Missing master blocks delivery.
- Missing stems reduces sync readiness.
- Artwork legal/brand issue routes to Legal and Merch.
- Credits feed DDEX/publishing.

Done when:

- Creative assets are inventory with status, not loose files.

### 19. Opportunity

Owner: Generalist. Support: Finance, Legal, Marketing.

Build:

- Score shows, playlists, collabs, sponsorships, sync leads, grants, placements, press, and brand deals.
- Output value, cost, risk, fit, timing, and next action.

Tests:

- High-value/high-risk opportunity escalates.
- Low-fit opportunity is rejected or deferred.
- Missing budget blocks commitment.
- Legal contract needed before acceptance.

Done when:

- Opportunities become comparable business decisions.

### 20. Education / Curriculum

Owner: Curriculum. Support: Keeper.

Build:

- Use user behavior and harness gaps to decide what the artist needs to learn next.
- Provide just-in-time guidance without interrupting workflows.

Tests:

- User repeatedly misses split-sheet steps.
- User lacks publishing readiness.
- User is about to approve a high-risk action.
- Guidance does not replace legal/tax advice.

Done when:

- Education closes execution gaps without becoming generic content.

### 21. Security / Trust

Owner: Security. Support: Legal, DevOps.

Build:

- Monitor sensitive actions, credentials, external APIs, spending, delivery, biometrics, legal evidence, and agent permissions.
- Provide approval gates, audit logs, evidence integrity, and risk registry checks.

Tests:

- Biometric monitoring opt-in required.
- Legal notice approval required.
- External API credential handling.
- Spending and publishing risk gates.
- Evidence packet tamper warning.

Done when:

- Security is the enforcement layer under every harness.

### 22. Boardroom Meta-Harness

Owner: Generalist / Conductor. Support: all departments.

Build:

- Read all domain harness runs.
- Decide approve, reject/defer, reroute, escalate, or block.
- Cite source run IDs, findings, blockers, departments, costs, legal risk, and required approval.
- Never invent missing facts.

Tests:

- Legal blocks release despite Distribution readiness.
- Finance blocks paid campaign despite Marketing urgency.
- Creator Protection escalates voice risk before delivery.
- Merch sample approval blocks POD order.
- Road cost changes Opportunity decision.

Done when:

- Boardroom is the final cross-domain decision layer for the music business.

## UI Delivery Plan

Each harness needs a user-facing surface only where the user must understand, approve, correct, or act.

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

- Users can see what the app knows, what it assumes, what is missing, and what it will not do without approval.
- Each approval gate explains the risk and exact action being approved.
- No UI hides legal, finance, distribution, or security blockers behind optimistic language.

## Agent Training Delivery Plan

Training follows `docs/agent-training/HARNESS_TRAINING_PLAN.md`.

Minimum dataset work:

- 25 gold examples for each primary harness owner.
- 10 cross-domain examples for each supporting agent.
- Existing 100-example-per-agent target remains.
- Dataset count script must run before and after additions.

Training acceptance:

- Agents cite harness run state.
- Agents use tools only within authorization rules.
- Agents escalate legal/tax uncertainty.
- Agents refuse false notices, unauthorized filings, unauthorized spending, and biometric monitoring without consent.
- Boardroom examples cover conflicts between departments.

## Test Strategy

Every harness gets the same test classes.

Unit tests:

- Compiler creates valid `HarnessRun`.
- Scores and blockers are deterministic.
- Missing data creates assumptions and recommendations.
- Approval gates are emitted for irreversible actions.
- Agent briefs name the correct owner and support departments.

Integration tests:

- Storage shape.
- Firestore rules.
- Existing service adapters.
- Boardroom consumption.
- Risk registry and approval enforcement.

UI smoke tests:

- User can open the harness surface.
- User can inspect assumptions.
- User can see blockers.
- User can approve or reject gated drafts.
- User cannot execute irreversible actions without explicit approval.

Dataset tests:

- Required schema fields.
- Minimum examples per target.
- Refusal/escalation examples.
- Cross-domain Boardroom examples.

## CI And Guardrails

Add or maintain these CI checks:

- Catalog coverage: every `HarnessDomain` has an implementation status.
- Registered compiler coverage: every buildable harness has a registry entry.
- Approval gate coverage: every irreversible action has a test.
- Flowchart validation when architecture changes.
- Dataset schema and count validation.
- Typecheck, focused tests, and full CI before handoff.

## Work Breakdown For The Next Agents

The next agents should not brainstorm. They should execute in this order:

1. Add the `HarnessCompiler` interface and registry.
2. Add catalog coverage tests that fail for missing implementation status.
3. Convert existing partial harness services to registered compilers.
4. Build Wave 2 harness compilers around upload-to-release.
5. Add Boardroom cross-domain tests for Wave 2.
6. Build Wave 3 economics harnesses and hidden-cost ledger UI.
7. Build Wave 4 market expansion harnesses and UI surfaces.
8. Complete Wave 5 hardening, datasets, Firestore rules, and approval risk registry.
9. Run full CI and update checkpoints.

## Final Acceptance Checklist

- [ ] All 22 harnesses are registered.
- [ ] All 22 harnesses emit normalized `HarnessRun` output.
- [ ] All 22 harnesses have owner and supporting agent briefs.
- [ ] All 22 harnesses have tests.
- [ ] All irreversible actions have approval gates.
- [ ] Boardroom consumes all harness domains.
- [ ] Creator Protection includes evidence, takedown, consent, monitoring, and legal source snapshots.
- [ ] DDEX/distribution includes identifiers and direct-to-storefront blockers.
- [ ] Finance includes cash, time, mileage, gear, legal protection, inventory, royalty, and opportunity cost.
- [ ] Road, Gear, Merch, Marketing, Fan/CRM, Publishing, Licensing, Royalty, Legal, Creative, Opportunity, Education, and Security are not stubs.
- [ ] UI surfaces exist for all user-facing workflows.
- [ ] Training datasets meet minimum counts.
- [ ] Full CI passes.

## Operating Principle

The harness is the business. Agents are labor. Boardroom is judgment. Security, Legal, Finance, and Distribution gates are enforcement. The app succeeds when the whole system turns music activity into accountable business state, not when one impressive harness demo works in isolation.
