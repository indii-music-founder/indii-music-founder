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
