# indii.music — Master Founder & Product Dossier

**Owner:** William Roberts  
**Canonical date:** 2026-09-26  
**Purpose:** Durable internal record for fundraising, accelerators, grants, diligence, hiring, product strategy, and future company operations.

> This document is the narrative layer above the application source of truth. It explains what indii.music is, why it exists, how it was built, how the system is governed, what is actually working, what is still being hardened, and what the company is intended to become.

---

## Status vocabulary

Every major claim in this document should be read through one of three labels:

- **VERIFIED** — supported by current repository evidence, current live product evidence, or direct founder verification.
- **IN DEVELOPMENT** — implemented in meaningful form but still being tuned, debugged, externally verified, or completed.
- **INTENDED OPERATING MODEL** — a designed company/product behavior that is not yet fully operational at scale.

This vocabulary is mandatory because indii.music is sophisticated enough that “implemented,” “tested,” “live-verified,” and “commercially proven” are not interchangeable.

---

# 1. Executive Summary

**indii.music is business operating software for independent music artists.**

It is designed around a simple problem: independent artists increasingly operate like small music companies, but the work around their music is fragmented across distributors, rights organizations, spreadsheets, accounting systems, creative tools, social platforms, calendars, inboxes, notes, and manual processes.

indii.music connects that work around shared artist, song, rights, release, campaign, financial, and audience context.

The canonical lifecycle is:

**Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat**

The product is not positioned as music-production AI. It is the operating layer around the music.

**Current stage:** Founding Artist Beta. A substantial working platform exists. The principal business gap is real-user validation and commercialization, not product ideation.

---

# 2. Founder

## 2.1 Founder-market fit

William Roberts is a nontraditional technical founder whose product thesis comes from decades of operating experience rather than from searching for a software category.

He reports roughly four decades of experience across music and, in parallel, hospitality / food-and-beverage / nightlife operations.

His career pattern repeatedly moved from frontline participation into responsibility for the broader system:

- hospitality: busser → service → bartender → management → openings / operations;
- music: front door → staff management → DJ → promoter → event producer → producer / engineer → label owner → release administration;
- technology: AI experimentation → modular tools → product architecture → agent orchestration → indii.music.

The consistent founder pattern is:

**encounter an operational problem → learn the domain → build or improve the process → test it in practice → iterate after failure.**

## 2.2 Music background

Professional music/nightlife work began seriously around 1992.

Founder history includes:

- The Edge in Orlando;
- Jacksonville club operations and event promotion;
- Las Vegas nightlife / Utopia-era DJ and event work;
- Detroit DJ / event / electronic-music work;
- early Ableton Live adoption;
- music production and mastering;
- Expressway Records through New Detroit Music LLC.

William reports that Expressway Records released just under 100 tracks across roughly two active pre-COVID years, including multi-artist compilations. He was the owner and only employee and personally handled the operating chain around releases: artist coordination, metadata, identifiers, registrations, artwork, distribution preparation, promotion, accounting / royalty matters, compilation assembly, and final mastering.

That label experience is one of the clearest direct origins of indii.music.

## 2.3 Education

Founder reports completion of a two-year Music Business program at **SAE Institute Nashville**.

Use the exact diploma/transcript title if an external form requires the formal credential wording.

## 2.4 Hospitality / operations background

Founder reports roughly four decades in hospitality beginning as a busser in his teens and progressing through service, bartending, kitchen management, openings, staff management, cash responsibility, P&L / purchasing, training, safety, and high-volume operations.

Reported examples include Darden, the original Ima location on Michigan Avenue in Detroit, Mister Dips Detroit / NoHo Hospitality Group, and Roosevelt's Billiards.

Exact dates and titles should be verified only when a form requires them.

## 2.5 Founder operating style

William describes his career as a “degree from the University of Failure.”

The useful meaning is not that failure is celebrated. It is that his operating style is iterative:

**attempt → observe → understand what failed → correct → repeat.**

That pattern is now visible in how indii.music is being built.

---

# 3. Origin of indii.music

## 3.1 Company history

New Detroit Music LLC was formed before indii.music for record-label activity. Founder reports 2018 as the formation year.

indii.music itself should not be described as an eight-year-old software company.

The serious indii.music build began in **November 2025**.

## 3.2 Pre-build period

Before November 2025, William had already spent several years experimenting with modern generative AI and software-building tools, beginning in the early ChatGPT / image-generation period and progressing through modular applications and increasingly sophisticated development workflows.

November 2025 is the point at which he deliberately committed to building indii.music as the primary product.

## 3.3 Why it exists

indii.music is the operating system William wished had existed while he was:

- performing;
- promoting events;
- producing music;
- operating a label;
- handling registrations and metadata;
- dealing with distributors;
- assembling campaigns;
- tracking money and rights;
- managing real-world operations.

The product thesis is therefore not “AI for musicians.”

It is:

> Independent artists need connected operating infrastructure for the business around their music.

---

# 4. Product Thesis

## 4.1 Core problem

Independent artists have many specialized tools but little continuity between them.

A song may exist in:

- a DAW;
- a distributor;
- a PRO portal;
- a spreadsheet;
- a contract;
- an accounting system;
- an email campaign;
- a social scheduler;
- a merch platform;
- a calendar;
- a CRM;
- a note on a phone.

The repeated loss of context creates unnecessary work and missed business steps.

## 4.2 Core solution

indii.music keeps the business context around an artist and release connected.

A rights workflow should know the release.

A distribution workflow should know the rights and metadata.

A creative workflow should know the release and campaign.

A finance workflow should know the project.

A CRM should know the people and interactions surrounding the artist’s business.

The differentiator is therefore **continuity**, not feature count.

---

# 5. Current Product State

## VERIFIED

Repository and live-product evidence support substantial implementation across:

- React web application;
- Electron desktop application;
- Firebase / Google Cloud backend;
- local audio processing;
- project / file / memory context;
- registration and rights workflows;
- DDEX generation and delivery-readiness infrastructure;
- finance / splits / expenses / business tooling;
- CRM / social / campaign tooling;
- merchandise workflows;
- creative image and video tooling;
- mobile remote;
- Boardroom multi-agent orchestration;
- specialist-agent routing;
- Founding Artist waitlist / admin infrastructure;
- subscription / commerce code;
- security gates and CI;
- SOC 2 readiness / evidence collection;
- TypeSafe / Jev semantic judgment infrastructure.

A repository snapshot on 2026-09-26 showed approximately:

- 3,605 TypeScript / TSX files;
- 1,479 test/spec files;
- 79 Playwright E2E specs;
- 621 files under docs/;
- 38 custom agent workflows;
- roughly two dozen specialist-agent definitions / departments depending on which current registry surface is counted.

**External documents should not hard-code a fleet count. Runtime / registry evidence should be checked dynamically.**

## IN DEVELOPMENT

Important areas still being hardened or externally verified include:

- repeatable beta onboarding;
- active-user retention;
- first paid conversion;
- Meta / Instagram genuine-account verification;
- direct DSP / distributor production relationships;
- external registration submission where third-party credentials are required;
- complete bug-report / repair-loop delivery proof after recent fixes;
- richer field-encounter extraction;
- print / upscale workflows;
- some desktop packaging / signing / commercial-operating details.

## INTENDED OPERATING MODEL

The long-term system is meant to support the artist’s business from finished music through repeated release cycles, with humans remaining responsible for consequential decisions while agents perform bounded operational work.

---

# 6. AI-Native Architecture

The strongest technical-founder claim is not “AI wrote the code.”

William built a **governed development and operating system around AI**.

The product and development environment use layers rather than one unbounded chatbot.

---

# 7. Five-Layer Control & Governance Model

Repository evidence supports a practical five-layer model.

## Layer 1 — Tier 0 Master Directive

**VERIFIED**

The Artist Master Directive is explicitly defined in code as a **Tier 0 Living User Skill Protocol** with the highest runtime precedence.

It contains structured sections for:

- sonic / mastering standards;
- business / legal rules;
- branding / aesthetics;
- release / distribution;
- custom freeform directives.

The schema explicitly supports a custom playbook and supplemental custom directives.

This is the persistent policy surface above one-off prompts.

### Live founder test — AI-human visual treatment

On 2026-09-26, William added a custom directive requiring AI-generated human faces to avoid fully clean presentation and instead use motion / shutter-like blur, while clean faces remain associated with real referenced people.

Founder live testing showed:

- early partial compliance;
- later images following the directive substantially better;
- dense scenes with many people still producing variable quality.

**Founder verdict:** the directive system is working; the exact aesthetic rule can continue to be refined.

This is important evidence that the directive system changes output behavior rather than merely storing text.

## Layer 2 — Bounded specialist-agent orchestration

**VERIFIED**

The Boardroom is not a generic chat surface.

Repository architecture shows:

- selectable / seated agents;
- a strict seated-agent manifest injected into context;
- shared recent assets / release context;
- a Conductor / generalist routing layer;
- delegation to specialists;
- concurrent multi-agent execution;
- Boardroom message persistence and context handshakes.

The founder can manually bring specialists into or out of a working conversation.

The system can also route work to specialists based on need.

The intended principle is that a specialist works inside its domain rather than wandering into another department’s authority.

## Layer 3 — Tool permissions, risk tiers, and approval gates

**VERIFIED**

The central Tool Risk Registry classifies tools by consequence.

Examples include:

- read-only operations that can proceed without approval;
- write operations;
- higher-impact actions requiring approval;
- staged administrative actions that may prepare work but not execute consequential external actions automatically.

The design explicitly separates “prepare / stage” from “execute.”

Human approval remains part of the operating model for consequential actions.

## Layer 4 — Semantic review, truth enforcement, and output guardrails

**VERIFIED**

The system contains multiple review mechanisms rather than treating agent output as automatically authoritative.

Current examples include:

- deterministic capability-truth checks;
- Jev / TypeSafe semantic judgments;
- confidence thresholds and deterministic fallbacks;
- ModelArmor prompt-injection and DLP protections;
- capability overclaim detection;
- underclaim / hallucinated-engineering-state detection;
- correction / replacement of ungrounded status responses.

A recent review-agent incident showed this layer in practice: a specialist misread conversational troubleshooting as an administrative command, fabricated a cache-clearing action, and inferred visual intent that had not actually been provided. The review layer identified the interpretation and capability errors, classified the situation as high risk, and escalated it for human attention.

The importance is not the individual cache mistake. It is the existence of a second-order system that evaluates whether another agent understood the instruction, stayed inside its authority, and made claims it could prove.

## Layer 5 — Human oversight, evidence, and engineering closeout

**VERIFIED**

The final authority is not the model.

The development process contains founder-defined workflows such as:

**/start → /middle → /end**

with supporting review / CI procedures.

The system emphasizes:

- bounded objectives;
- acceptance criteria;
- tests;
- error ledgers;
- handoffs;
- no-post-gate-edit discipline;
- exact-SHA CI verification;
- production evidence separate from simulation;
- human approval for consequential actions.

The rule is simple:

> An agent saying “done” is not proof that the work is done.

---

# 8. Jev / TypeSafe System One

**VERIFIED**

Jev / TypeSafe is used as a typed semantic judgment layer where exact deterministic parsing is a poor fit.

The architecture keeps:

- exact arithmetic;
- permissions;
- identifiers;
- security policy;
- legal truth;
- ownership truth;

out of probabilistic decision-making.

Current repository documentation describes more than 70 typed judgments and a server-side judgment gateway with deterministic fallbacks.

This gives indii.music a useful split:

**semantic ambiguity → bounded judgment**  
**exact business truth → deterministic code / human authority**

---

# 9. Boardroom

## VERIFIED

The Boardroom is a founder / team operating environment where:

- the founder converses with indii;
- specialist agents can be seated or removed;
- relevant recent assets and releases are injected into working context;
- tools execute inside the conversation;
- outputs, successes, and failures can be surfaced;
- specialist collaboration can be orchestrated.

A 2026-09-26 live photograph from the founder showed the Boardroom with a ring of available specialist agents, one active/seated agent, recent generated assets, tool execution, and visible image-generation successes/failures.

The Boardroom should be described as an **orchestration workspace**, not merely chat.

---

# 10. Founder/Internal Mode as Company Operating Surface

## INTENDED OPERATING MODEL, WITH VERIFIED COMPONENTS

indii.music is intended to be used by indii.music itself.

Founder and future employees should be able to use the platform for:

- creative work;
- campaigns;
- contacts;
- internal business operations;
- reporting;
- agent-team supervision;
- field activity;
- issue discovery;
- product improvement.

This creates a strong dogfooding loop: the company operates through the product it sells.

Founder/internal mode should expose richer operational truth than customer mode, including failures, gated capabilities, evidence state, and items requiring human attention.

---

# 11. Self-Debugging / Repair Loop

## VERIFIED COMPONENTS

The repository contains:

- in-app bug-report tools;
- a server-side reportBugFn;
- Firestore persistence;
- GitHub issue sync;
- truth-overclaim detection;
- review / guardrail logic;
- error ledgers;
- automated test and CI infrastructure.

Issue #319 is a concrete example of an app-formatted bug report under the wiil-tech pipeline identity. It documents the 3000×3000 image-generation failure and notes that earlier reports had been stranded before the pipeline repair.

Recent engineering work then hardened the reporting contract so the tool cannot claim a bug was filed unless durable persistence actually succeeded.

## IMPORTANT DISTINCTION

Issue #317 itself was hand-filed and should not be used as proof that the app auto-created that specific issue.

However, #317 directly drove engineering that now routes future capability-overclaim detections through the app-originated reporting pipeline.

## INTENDED OPERATING MODEL

The long-term repair loop is:

**user/internal observation → structured report → automated triage / agent analysis → GitHub engineering work → tests / CI → human escalation when required → repair → verification**

This is better described today as an **AI-assisted closed-loop repair model**, not as fully autonomous self-healing software.

---

# 12. Remote / Field Operating Layer

## VERIFIED

The remote architecture includes:

- authenticated cloud relay;
- phone-to-Studio execution;
- executor leases;
- explicit cloud-vs-local boundaries;
- approvals;
- mobile capture surfaces;
- encounter pipeline code;
- remote status / commands.

The remote is not merely a duplicate desktop UI.

Its role is to let business activity occurring away from the studio become structured input to indii.music.

## IN DEVELOPMENT — Field Encounter example

The intended field workflow includes scenarios such as:

1. founder meets a new person while doing music-business activity;
2. captures a short video / note;
3. system analyzes transcript / frames / context;
4. contact information and useful context are extracted;
5. a structured contact / Rolodex record is created;
6. follow-up can be routed into the business system.

The encounter pipeline and mobile encounter surfaces exist in code. Full live media-to-contact extraction should continue to be described as in development until repeatedly verified end-to-end.

---

# 13. Continuous Product Evolution Through Internal Use

This is one of the strongest current founder/product patterns.

William uses indii.music while building indii.music.

The loop is:

**use product → discover friction → articulate desired behavior → encode directive or engineering task → test → review → refine**

Examples from 2026-09-26:

- Boardroom status overclaim discovered through use;
- bug-report honesty gap discovered through use;
- 3000×3000 print requirement discovered through real creative use;
- image-resolution ceiling corrected;
- print-size planning and DPI metadata added;
- persistent AI-human face-treatment directive added and live-tested;
- review agents caught unsupported administrative claims.

This is not abstract roadmap work.

It is product development driven by daily operational use.

---

# 14. Modular Feature Expansion

## VERIFIED ARCHITECTURAL PRINCIPLE

Because capabilities are organized into bounded agents, tools, directives, registries, and deterministic services, new capability work can often be added as a new tool or bounded workflow rather than rewriting the entire application.

William’s shorthand analogy is useful:

> The carpenter keeps working. If the job needs a new tool, we make the tool and put it in the toolbox.

This should not be interpreted to mean every feature is trivial to add.

The stronger and defensible claim is:

> indii.music was architected so many new capabilities can be introduced through modular agent tools, directives, and services without redesigning the whole product.

---

# 15. Creative Infrastructure and Print Output

## IN DEVELOPMENT / RECENTLY VERIFIED IN CODE

Current engineering work includes:

- higher image-resolution ceilings aligned with model capability;
- print-size planning;
- album / sleeve-oriented dimensions;
- DPI metadata handling;
- print-ready export behavior;
- preflight checks for achievable output.

The founder’s current use case is 3000×3000 artwork suitable for record-release / sleeve workflows.

The product goal is to reduce the number of times an artist must leave indii.music for separate utility tools.

---

# 16. SOC 2 Readiness as Operating Philosophy

## VERIFIED

indii.music does not claim an external SOC 2 attestation.

It does have a proactive readiness / evidence system integrated into normal engineering.

Current evidence includes:

- documented policies;
- machine-readable controls;
- risk / vendor / incident / continuity material;
- daily scheduled evidence collection;
- change-triggered checks;
- dependency scanning;
- security-boundary checks;
- git-SHA-bound evidence artifacts.

The strategic point is important:

> The company is collecting audit evidence before an auditor requires it.

For a solo, nontraditional founder, this is strong evidence of systems thinking and future-enterprise readiness.

---

# 17. Development Process & Founder Work Ethic

## FOUNDER-REPORTED

William reports that his normal work pattern is to begin as soon as he wakes up, often working 10–12 hours per day and continuing to monitor / direct work while away from the desk through the mobile / remote system.

On 2026-09-26, a Saturday, he reported beginning around 6:00 AM and continued working through the day.

This should not be used externally as “hours worked = company value.”

The useful founder claim is sustained execution intensity.

## REPOSITORY-EVIDENCED

GitHub activity demonstrates frequent, multi-surface development across:

- product features;
- bug fixes;
- tests;
- CI;
- security;
- compliance;
- documentation;
- infrastructure;
- creative tooling;
- administrative engine work.

A deeper commit-history quantitative analysis can be maintained as supporting evidence rather than as the core narrative.

---

# 18. Post-Mastering Administrative Engine

## VERIFIED / ACTIVE DEVELOPMENT

This engine is a strong example of indii.music becoming domain-specific business infrastructure rather than generic AI chat.

Recent evidence includes:

- administrative rules;
- large automated test suites;
- audit / gap detection;
- registration-payload staging;
- split-invitation staging;
- risk registry integration;
- agent wiring;
- continuous catalog audit scheduling;
- semantic catalog projection work.

The design goal is to answer:

> Once the music is finished, what business work still has to happen — and what can be prepared automatically without falsely claiming an external action occurred?

That question is central to the indii.music thesis.

---

# 19. Business Model

Current Founding Artist Beta packaging:

| Plan | Price |
|---|---:|
| Free | $0 |
| Start | $22/month |
| Build | $55/month |
| Scale | $110/month |
| Founding Owner License | $2,500 one time |

Current planned commitment savings:

- 5% quarterly;
- 10% six-month;
- 20% annual.

Pricing is beta packaging and remains subject to operating-cost validation.

---

# 20. Current Business Truth

As of 2026-09-26:

- Revenue: **$0**
- MRR: **$0**
- Paying customers: **0**
- Confirmed active external beta users: **0**
- Outside capital received: **$0 reported**
- Startup/cloud credits received: **$0 reported**
- Ownership: **William Roberts — 100% reported**
- Stage: **Founding Artist Beta**

The strongest current traction is **product and engineering traction**, not customer traction.

The next major proof is real artists using important workflows, returning, identifying measurable value, and paying.

---

# 21. Funding Thesis

Funding is not primarily needed to discover what product to build.

A substantial product already exists.

Capital should fund:

- real artist onboarding;
- beta support and customer discovery;
- first paid adoption;
- production hardening;
- external integration verification;
- infrastructure / AI / CI;
- independent engineering review;
- security / legal / compliance;
- targeted contractor / employee capacity;
- a repeatable acquisition process.

Current capital ladder:

- **$10K–$15K** — immediate continuity / seed milestone;
- **~$50K** — local bridge to validation and commercialization;
- **~$350K** — constrained 12-month institutional case;
- **~$500K** — preferred 18-month institutional case.

Use the current financial source-of-truth document for allocation details.

---

# 22. What Should Be Protected as Potential IP / Know-How

Do not casually reduce the IP story to individual features such as face blur or image upscaling.

The more important system-level assets include:

- layered directive architecture;
- living Artist Master Directive;
- specialist-agent orchestration;
- Boardroom participation / context injection model;
- bounded tools and agent domains;
- risk-tiered tool execution;
- human approval boundaries;
- semantic judgment + deterministic fallback architecture;
- truth-enforcement and review mechanisms;
- internal-use / dogfooding operating model;
- app-to-engineering repair loop;
- remote / field business capture;
- domain-specific post-mastering administrative engine;
- continuous evidence / compliance-as-code processes.

Whether any individual component is patentable or protectable requires professional IP analysis.

The internal rule should be: **document invention chronology and implementation evidence before making broad public claims about novel architecture.**

---

# 23. What We Must Not Overclaim

Do not externally claim:

- product-market fit;
- active paying customers;
- revenue;
- thousands of artists;
- millions of streams;
- live direct-DSP delivery;
- all agents/departments fully production-ready;
- no remaining engineering work;
- fully autonomous self-healing software;
- SOC 2 certification;
- a fixed specialist count without checking the current registry;
- first-of-its-kind status without independent evidence;
- planned capability as live capability.

The product is impressive enough without fictionalizing it.

---

# 24. Current Company Narrative

A concise durable version:

> indii.music is a Detroit-built business operating system for independent artists. Founder William Roberts spent decades working across music, nightlife, hospitality, music production, and record-label operations before committing to the software in November 2025. Instead of building another isolated artist tool, he built around the operational continuity he repeatedly found missing: rights, registrations, release preparation, creative campaigns, finance, audience activity, merchandise, and ongoing business work sharing the same context.
>
> The platform is AI-native but deliberately governed. It uses persistent directives, bounded specialist agents, risk-tiered tools, semantic review, deterministic business logic, human approval boundaries, and founder-designed development/CI procedures. The same platform is increasingly used to operate and improve indii.music itself.
>
> A substantial working product exists. The company is pre-revenue and entering real-user beta validation. The next proof is not another feature list; it is artists using the system repeatedly and paying for measurable business value.

---

# 25. Evidence Sources

Primary repository evidence:

- docs/funding/APPLICATION_SOURCE_OF_TRUTH.md
- docs/funding/EVIDENCE_MAP.md
- docs/funding/APPLICATION_ANSWER_BANK.md
- docs/data-room/09_FINANCIALS_REVENUE_SUMMARY.md
- docs/data-room/10_LEGAL_COMPLIANCE.md
- packages/shared/src/schemas/artistMasterDirective.ts
- packages/renderer/src/services/directive/
- packages/renderer/src/modules/boardroom/
- docs/flowcharts/04-boardroom-context-orchestration.md
- packages/renderer/src/services/agent/ToolRiskRegistry.ts
- packages/renderer/src/services/agent/guardrails/JevGuardrailService.ts
- packages/renderer/src/services/agent/governance/ModelArmor.ts
- packages/renderer/src/services/agent/capabilityTruth.ts
- packages/renderer/src/services/agent/truthOverclaimReporter.ts
- packages/renderer/src/services/agent/tools/BugReportTools.ts
- packages/firebase/src/functions/agent/reportBugFn.ts
- packages/firebase/src/functions/encounters/processEncounterPipeline.ts
- .github/workflows/soc2-evidence-collector.yml
- .agent/workflows/
- issue #319 and related 2026-09-26 commits.

Founder-live evidence on 2026-09-26:

- Boardroom photograph;
- live Master / Custom Directive testing;
- AI-human face-treatment directive behavior;
- internal image-generation / print workflow testing;
- founder description of remote and field-use workflows.

---

# 26. Maintenance Rule

This dossier is durable, but it is not static.

Update it when a material state changes:

- first active beta user;
- first paying customer;
- first revenue;
- external integration becomes genuinely live;
- financing is received;
- company/entity structure changes;
- major directive / agent-control architecture changes;
- current registry count changes materially;
- independent security/compliance attestation is obtained.

The source-of-truth hierarchy remains:

**current founder-confirmed fact → current code/test/CI evidence → current provider/live evidence → dated historical documentation.**
