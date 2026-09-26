# indii.music — Application Evidence Map

**As of:** 2026-09-26  
**Purpose:** Tell application agents exactly what proves each important claim and what still needs verification.

## Evidence classes

- **Founder-confirmed:** current founder statement; use unless a form requires formal documentation.
- **Repository-proven:** current code/config/test/CI proves the engineering claim.
- **Publicly corroborated:** reliable outside source supports the historical claim.
- **Needs source record:** likely true but exact legal/financial/documentary proof should be checked before submission.
- **Do not claim:** stale, simulated, projected, or not externally verified.

## Core company facts

| Claim | Status | Evidence / next check |
|---|---|---|
| Founder is William Roberts | Founder-confirmed / repo | Git history, package metadata, current source-of-truth |
| Founder owns 100% | Founder-confirmed | Verify legal records only if requested |
| Current entity is New Detroit Music LLC | Founder-confirmed / repo | License/package/docs; verify Michigan registry before exact legal submission |
| LLC was formed in 2018 | Founder-confirmed | Verify exact Michigan formation date/status |
| indii.music build began Nov. 2025 | Founder-confirmed | Repository history can support development timeline |
| Revenue = $0 | Founder-confirmed | Use current accounting records if form requests evidence |
| Paying customers = 0 | Founder-confirmed | Current canonical funding source |
| Outside capital = $0 | Founder-confirmed | Verify cap table/bank records only if required |
| Startup/cloud credits received = $0 | Founder-confirmed | Recheck provider accounts before each credit application |
| Active external beta users = 0 confirmed | Founder-confirmed | Recheck at submission time |
| Small waitlist / invitations begun | Founder-confirmed + app/email evidence | Use exact count only after current admin/email check |

## Product / engineering

| Claim | Status | Evidence |
|---|---|---|
| Working web/desktop/cloud product | Repository-proven | packages/, current architecture, CI |
| Firebase/GCP backend | Repository-proven | packages/firebase, deploy workflows |
| Remote phone-to-Studio execution | Repository-proven architecture | RemoteRelayService, StudioExecutorCore, current-state docs; separate genuine two-device proof when needed |
| Conversational user error reporting | Repository-proven | ErrorReportTools, BugReportTools, USER_MANUAL_BUG_REPORTING.md |
| Founder-only technical error triage | Repository-proven | errorReportCallables.ts, ErrorReportsPanel.tsx |
| 23 registered department heads | Repository-proven snapshot | departments.ts on 2026-09-26 |
| Code-enforced agent scope boundaries | Repository-proven | BaseAgent.ts + AgentCommunicationPolicy; direct/department/boardroom restrictions |
| Required tuned routing for valid agents | Repository-proven | fine-tuned-models.ts; direct endpoint or explicit tuned-domain alias, no silent generic fallback |
| Modular tool/harness extensibility | Repository-proven architecture | BaseAgent tool allowlists, ToolPoolAssembler, department routing, common CI/security workflow; describe as reduced integration/blast radius, not zero-cost feature development |
| DDEX/readiness infrastructure | Repository-proven | shared DDEX builders, preflight, admin engine |
| Direct commercial DSP delivery | **Do not claim yet** | Requires real partner credentials, transmission and acknowledgement |
| Registration workflows | Repository-proven | Registration Center and adapters; distinguish manual-required external steps |
| Creative image/video workflows | Repository-proven | renderer/video packages and tests |
| Finance/expense/split workflows | Repository-proven | finance modules, fixed-point split logic |
| Merch workflows | Repository-proven | merchandise modules and tests |
| Instagram/Meta infrastructure | Repository-proven internally | Genuine external OAuth/webhook/publishing proof still required |
| Jev/TypeSafe product integration | Repository-proven | server-side typesafeJudge + central registry + guardrail service |
| 70 exported typed judge functions | Repository-proven snapshot | count from typesafeJudgments.ts on 2026-09-26 |
| SOC 2 readiness/evidence collection | Repository-proven | compliance/ + daily evidence workflow |
| SOC 2 certification | **Do not claim** | Independent auditor attestation does not exist |

## Live dogfooding / operating evidence

| Evidence | What it proves | Important limit |
|---|---|---|
| Deploy run 36247269910 succeeded on P1 commit `ed84984a9` after transient Google 503 retry | Founder/agent workflow can diagnose infrastructure vs code failure and use sanctioned retry path | Does not prove every later phase is live |
| P2 commit `304e1c4b3` | Deterministic catalog audit + Jev triage + durable admin task worker exist in code/tests | P2 CI/live status should be checked if cited as current |
| GitHub issue #317 | Boardroom truthfulness defect became tracked engineering work through connected founder/agent workflow | It was not created by the exact in-product `reportBugFn` format/path |
| `reportBugFn.ts` + BugReportTools + bug-report docs | Authenticated conversational bug reports can persist and are designed to forward to GitHub with server-side credentials/dedup | Seven real reports persisted to Firestore while GitHub forwarding was misconfigured; repair commit `5504361c9`; fresh post-repair end-to-end proof still needed |
| Field Encounter pipeline | Durable encounter/media/contact/note structures and intended contact-extraction schema exist | Current `analyzeEncounterWithGemini()` call is text-only; captured audio/photo/video media are not yet attached to the model request, so media-derived transcription/OCR/contact extraction is not live-proven |
| GitHub issue #318 | The Field Encounter media-analysis gap is explicitly tracked, with a 2026-09-26 audit comment broadening it beyond video | Open issue; do not claim media-derived contact extraction until audio/photo/video cases are proven |
| GitHub issue #319 | Real in-product image-generation bug reports survived in Firestore and were recoverable/backfilled after the GitHub-forwarding failure was repaired | #319 is a backfill, not proof of a fresh automatic post-repair roundtrip |
| Issues #320–#329 | #319 was rapidly decomposed into bounded remediation workstreams for resolution truth, print math, upscaling, export, merchandise and E2E proof | Strong issue-to-work decomposition evidence; implementation/approval/tests/CI still remain gates |
| GitHub issue #330 | Cloud-relay parity audit found five current department heads absent from its relay-local prompt registry; unknown targets can fall back to Generalist | Do not claim every phone/cloud specialist request uses the same strict fine-tuned Studio runtime until parity is resolved |

## Development-cadence evidence

| Evidence | What it supports | Important limit |
|---|---|---|
| Default branch begins with `Initial commit` on 2025-11-28 | Founder-reported November 2025 build start is consistent with repository history | Repository date is not the same as first day of ideation |
| 10,538 commits reachable from `main` as of ~12:14 PM EDT 2026-09-26 | Very high sustained project execution across the 303-day build span | Includes AI/agent, merge, docs, tests, and other project commits; not all hand-coded by founder |
| 20 commits landed between 6:00 AM and 12:14 PM EDT on 2026-09-26; first ~6:04 AM | Corroborates the founder's statement that work began around 6 AM that Saturday and continued while away from the desk | Commit timestamps prove repository activity, not uninterrupted personal labor |
| `wiil-tech` and `the-walking-agency-det` both appear in the current history | The project uses more than one founder-controlled GitHub identity/workflow | Do not interpret identities as separate employees without evidence |

## Engineering-process evidence

- .agent/workflows/start.md
- .agent/workflows/middle.md
- .agent/workflows/end.md
- .agent/workflows/ci-validate.md
- branch-safety and authenticity rules
- build/deploy/security GitHub Actions
- weekly demo audit
- daily SOC 2 evidence collector
- exact-SHA CI practice
- CodeRabbit configuration
- TypeSafe/Jev shadow/live judgment records

Founder reports Greptile and Blacksmith are available on free/access tiers and intended for greater paid use as funding permits. Do not call them active paid infrastructure until verified.

## Founder-market-fit evidence

### Publicly corroboratable music history

Search/public-archive evidence already found for:

- The Edge / Florida-era history
- William Paul / WilliamPaul DJ identity
- Las Vegas/Utopia-era biography
- Detroit event appearances
- Thrillseeker project
- Expressway Records / Detroit compilation activity

For applications, use broad verified history. Avoid absolute first/invented claims unless independently proven.

### Founder-confirmed history

- roughly four decades in music
- parallel roughly four decades in hospitality/food & beverage
- Expressway Records owner/sole worker
- just under 100 tracks released across roughly two active pre-COVID years
- SAE Institute Nashville two-year Music Business program
- restaurant/nightlife operations, openings, staff and cash responsibility

### Needs exact documentation only when required

- exact SAE credential title
- exact employer titles/dates
- exact Michigan LLC formation date/status
- exact founder cash invested

## Retired evidence

Never use historical acquisition/test drafts as actual traction for:

- millions of streams
- DSP royalty revenue
- thousands of artists
- live direct-DSP commercial relationships
- fixed acquisition valuation
- simulated customers
- projected revenue as actual revenue
- unverified agent/model counts

## Submission rule

Before any external form is submitted, every numerical or externally verifiable claim should have one of:

1. current founder confirmation,
2. current repository/test/CI proof,
3. current provider/account proof,
4. current public/legal record.

If it has none, rewrite it as a plan or omit it.
