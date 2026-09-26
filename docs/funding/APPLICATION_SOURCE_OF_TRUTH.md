# indii.music — Application Source of Truth

**Owner:** William Roberts  
**As of:** 2026-09-26  
**Purpose:** Funding, grant, accelerator, startup-credit, and investor applications

This file is the canonical source for external application facts. If another document conflicts with it, verify the current implementation/source record before using the older claim.

## Company

- **Product:** indii.music
- **Canonical tagline:** `music business at the speed of you`
- **Location:** Detroit, Michigan
- **Current entity:** New Detroit Music LLC
- **Ownership:** William Roberts — 100%
- **Outside capital:** $0 reported
- **Revenue:** $0
- **MRR:** $0
- **Paying customers:** 0
- **Confirmed active external beta users:** 0
- **Startup/cloud credits received:** none reported
- **Build start:** November 2025
- **Stage:** Founding Artist Beta

New Detroit Music LLC was created before indii.music for record-label activity. Do not represent the age of the LLC as the age of the software startup.

## One-line description

indii.music is business operating software for independent music artists.

## Problem

Independent artists increasingly operate like small music companies, but the work is fragmented across distributors, rights organizations, spreadsheets, accounting systems, creative applications, social platforms, calendars, and other disconnected tools.

The problem is not simply the number of tools. It is the loss of context between them.

## Solution

indii.music keeps the artist, song, release, rights, collaborators, assets, campaign, and business records connected across the lifecycle:

```text
Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat
```

Specialist AI assists interpretation and planning. Deterministic software remains authoritative for exact calculations, identifiers, permissions, security, and state transitions.

## Product stage

Use:

> Working software entering founder-led beta validation. The core platform exists; the current work is production hardening, external-integration verification, real-user onboarding, and commercialization.

Do not use “idea stage.”

Do not imply beta invitations are active users.

Do not imply an external integration is live because its internal implementation exists.

## Engineering proof

The repository is a substantial web / desktop / cloud system with:

- React and Electron applications;
- Firebase / Google Cloud backend services;
- canonical audio/master handling;
- registration, rights, metadata, and DDEX systems;
- finance / split / royalty tooling;
- creative/video workflows;
- CRM, marketing, social, and merchandise modules;
- remote phone-to-Studio execution;
- specialist-agent orchestration;
- extensive automated testing and deployment gates.

Founder-created engineering procedures under `.agent/workflows/` define orientation, bounded execution, validation, closeout, exact-SHA CI, and authenticity requirements.

Repository scale snapshot on 2026-09-26: approximately 3,605 TypeScript/TSX files, 1,479 test/spec files, 79 Playwright E2E specs, 621 docs files, 38 custom agent workflows, and 22 specialist agent-card definitions. These are engineering-evidence counts, not customer traction.

This is an important technical-founder fact: the founder did not merely prompt AI to write code; he designed the operating process that governs how AI development work is accepted.

## Internal operations / founder surface

The founder/internal version of indii.music is also used to operate indii.music itself. The mobile Boardroom can send conversational requests through the remote relay to the desktop Studio, so the founder or authorized employees can ask about current capabilities, trigger business workflows, create content, coordinate campaign work, and inspect operational state from the same product they are building for artists.

The error model intentionally differs by audience: founder/internal users may see raw technical diagnostics needed to fix the system, while subscriber-facing flows can file a durable error report and return a reference ID without exposing internal technical detail.

This is useful evidence of dogfooding and product depth, but status answers must remain evidence-bound. A chat response may not claim a report was pushed, a system is production-ready, or a capability is live unless an actual tool/action or current runtime evidence proves it.

### Conversational bug reporting and founder diagnostics

The repository implements two deliberately different failure-reporting paths:

- **Subscriber/user path:** a user can tell the agent that something broke and ask it to report the problem. The `report_error` / `report_bug` tooling creates a durable report; the bug-report pipeline can persist to Firestore and forward authenticated reports to GitHub Issues. Subscriber-facing chat returns a short reference/result rather than exposing raw internal diagnostics.
- **Founder/internal path:** founder-authorized users can list and triage the underlying error reports, inspect technical detail, acknowledge them, and mark them resolved through founder-gated server callables.

That creates a closed product-feedback loop inside the product itself: use indii → encounter a problem → report it conversationally → preserve technical evidence → triage/fix it internally.

### Mobile Remote as a field-business operating surface

indiiREMOTE is not only a desktop remote. It extends indii.music into real-world music-business activity away from the desk.

Current repository evidence includes:

- authenticated phone-to-Studio command/response relay;
- mobile Boardroom, Department, and Direct conversation targeting;
- quick capture for voice, photo, document, receipt, video, location, and text;
- a Field Encounter pipeline designed to transcribe captured media, extract contact details such as name, phone, email, organization, and role, classify headshot/business-card imagery, create or link a FieldContact record, and generate a synced note;
- mobile mileage, venue/location, encounter, and status surfaces.

A concrete use case is meeting somebody while doing music-business work: capture the interaction on the phone, let the system extract the useful identity/contact context, and turn it into a structured contact/note record without waiting to reconstruct the encounter at a desk.

Some remote/capture paths are still being debugged and live-verified. The externally safe claim is that the architecture and workflows are implemented and actively being hardened—not that every mobile path is production-perfect today.

### Modular 23-department harness

The current runtime department registry contains **23 department heads**. Department, direct-chat, and Boardroom modes are not only prompt conventions: communication scope is enforced in code. Direct mode blocks delegation; Department mode blocks cross-department delegation; Boardroom mode allows department heads to collaborate only when seated.

Every valid agent ID must resolve to a required fine-tuned Vertex endpoint or an explicit tuned-domain alias; missing tuned routing fails loudly rather than silently downgrading to a generic model.

This architecture changes the economics of adding capability. New product functions can often be introduced as bounded tools/capabilities inside the existing harness, assigned to the appropriate specialist, and passed through the same approval, test, security, and CI machinery instead of requiring a new standalone application or parallel orchestration stack. That does **not** mean feature work is effortless: implementation, integration tests, security review, UI work, and live verification still apply. The advantage is reuse of the existing operating framework and reduced architectural blast radius.

## TypeSafe / JEV

JEV System One is integrated as a typed semantic judgment layer.

Production design keeps credentials server-side through `typesafeJudge`, uses centrally reviewable questions/thresholds, preserves deterministic fallbacks, and prevents semantic judgments from becoming legal/financial/security truth.

The central registry currently contains 70 exported typed `judge*` functions, plus a separate Jev guardrail service.

## SOC 2 readiness

The repository contains:

- compliance policies;
- a machine-readable controls registry;
- risk and vendor structures;
- incident and continuity procedures;
- a scheduled SOC 2 evidence collector;
- security boundary checks;
- evidence snapshots bound to git SHAs.

External wording:

> indii.music is building SOC 2 readiness and continuous evidence collection into normal engineering operations.

Do **not** claim SOC 2 certification.

The current 90-day GitHub artifact archive must be supplemented by durable long-term evidence storage before a longer Type II observation period.

## Engineering review / CI leverage

- CodeRabbit configuration is present in the repository.
- The founder reports free/access-tier availability for Greptile and Blacksmith and plans to use paid capacity as funding permits.
- Current GitHub workflows still show standard GitHub-hosted runners, so do not claim active paid Blacksmith execution until verified.

These tools fit the use-of-funds story as independent review capacity, checks-and-balances, and faster CI — not as current paid infrastructure unless live usage is proven.

## Distribution truth

Safe:

> DDEX generation, preflight, delivery-readiness packaging, and transport infrastructure are implemented.

Not safe until externally proven:

> indii.music directly delivers commercially to Spotify / Apple Music / TIDAL.

## Meta / Instagram truth

Safe:

> The repository contains Instagram publishing validation, OAuth/webhook foundations, inbound-message handling, analytics, and CRM integration.

Not safe until genuine-account verification:

> Instagram publishing is live-verified end to end.

## Current pricing

| Plan | Price |
| --- | ---: |
| Free | $0 |
| Start | $22/month |
| Build | $55/month |
| Scale | $110/month |
| Founding Owner License | $2,500 one time |

Pricing is beta packaging. Paid activation remains gated on backend entitlement / checkout alignment.

## Founder-market fit

William Roberts has approximately four decades of experience across music and a parallel four decades across hospitality, nightlife, food/beverage, and operations.

Professional music work began seriously in 1992 at The Edge in Orlando, followed by Jacksonville, Las Vegas, and Detroit work as a DJ, promoter, event producer, nightlife operator, and music creator.

He later created Expressway Records through New Detroit Music LLC. Over roughly two active pre-COVID years, the label released just under 100 tracks, including multi-artist compilations.

William was the owner and only employee and personally handled the operating chain: artists, release organization, metadata, identifiers, registrations, contracts/business administration, distribution preparation, artwork requirements, promotion, accounting/royalty matters, and final mastering.

He also completed a two-year Music Business program at SAE Institute Nashville. Use the exact diploma/transcript credential wording if an application requires the formal degree title.

Hospitality experience progressed from busser in his teens through service, bartending, kitchen management, openings, and staff/operations management. He has managed large shifts, cash responsibility, payroll/business operations, vendors, P&Ls, training, food safety, and high-volume customer operations.

Keep private medical information out of investor/funder applications unless the founder explicitly chooses otherwise for a specific purpose.

## Technical-founder narrative

William is a nontraditional technical founder.

He began experimenting seriously with modern generative AI after the early ChatGPT/image-generation period, progressed through modular applications and development tools, and committed to building indii.music in November 2025.

His role is product/domain/technical architecture and execution oversight:

- define the product and domain model;
- choose architecture and safety boundaries;
- coordinate specialized AI development agents;
- reject incorrect solutions;
- require tests and evidence;
- design repeatable development procedures;
- review and verify delivery.

## Traction answer

> indii.music is pre-revenue. There are currently no paying customers and no confirmed active external beta users. A small waitlist exists and invitations have begun. The strongest evidence to date is product execution; the immediate company objective is real-user validation and first commercial adoption.

## Capital ladder

- **$10K–$15K:** immediate seed / continuity milestone.
- **~$50K:** local bridge to beta validation and commercialization.
- **~$350K:** constrained 12-month pre-seed case.
- **~$500K:** preferred 18-month pre-seed case.

Detailed planning allocations live in `../data-room/09_FINANCIALS_REVENUE_SUMMARY.md`.

## What funding buys

Capital is not needed to discover what product to build.

A substantial product already exists.

Funding should create:

- real artist onboarding;
- first paying customers;
- measured activation and retention;
- external integration verification;
- production hardening;
- security/compliance maturity;
- targeted engineering and operations capacity;
- a repeatable artist-acquisition process.

## Primary company risk / gap

The largest gap is market validation, not feature ideation.

The next major proof is real independent artists using meaningful workflows, returning, identifying measurable value, and paying.

## Prohibited external claims without new evidence

Do not use:

- historical test-fixture revenue;
- fixture artists or streams as traction;
- acquisition-workbook valuations as current valuation;
- unverified direct-DSP claims;
- immediate-payout or guaranteed-collection claims;
- invented social proof;
- fabricated scarcity/deadlines;
- unverified “first of its kind” language;
- projections as actual revenue;
- a fixed agent count unless current repository evidence is checked.

## Evidence hierarchy

For an application answer, prefer:

1. current founder-confirmed facts;
2. current implementation;
3. exact-SHA CI / test evidence;
4. current business-decision documents;
5. current external/provider verification.

Historical documents remain useful for provenance, not automatic truth.
