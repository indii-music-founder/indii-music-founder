# indii.music — Master Founder & Product Dossier

**Owner:** William Roberts  
**As of:** 2026-09-26  
**Purpose:** Durable internal source for funding, accelerators, diligence, product strategy, founder interviews, pitch development, and future Work-mode application execution.

This document synthesizes founder-reported history, current repository evidence, live product testing, screenshots, CI/workflow evidence, and the current application source of truth.

It is intentionally broader than a pitch deck. It preserves the reasoning behind the company while separating what is implemented, what is being hardened, and what remains an intended operating model.

---

## 1. Truth labels used throughout

Use these labels consistently in external work.

### VERIFIED
Supported by current repository code/tests/CI, current product behavior, current legal/account records, or other direct evidence.

### FOUNDER-CONFIRMED
Current statement from William Roberts. Appropriate for narrative use, but exact documentary support may still be required for a formal application.

### LIVE-TESTED
Observed in current founder use of the product. A live test can demonstrate behavior without proving every edge case or every deployment path.

### IN DEVELOPMENT
The architecture or feature exists in meaningful form, but an integration, production path, consistency threshold, or end-to-end verification remains incomplete.

### INTENDED OPERATING MODEL
A deliberate design direction for how indii.music and its future human staff are supposed to work. Do not present it as current headcount or fully deployed automation.

### DO NOT CLAIM
Historical mock/test data, stale acquisition assumptions, simulated metrics, unverified commercial relationships, or capabilities that have not crossed their required external proof gate.

---

# 2. Executive summary

**indii.music is business operating software for independent music artists.**

The product is designed around the business that begins once music exists: planning, rights and registrations, metadata, delivery preparation, campaigns, release operations, finance, audience/CRM, merchandise, touring/road operations, remote field work, and the repeatable administrative work of running an independent music career.

The core lifecycle is:

**Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat**

The product thesis is not that artists need one more isolated tool. It is that the same artist, song, rights, collaborators, release, assets, audience, and financial context should remain connected across the entire operating lifecycle.

indii.music is also being built as an **AI-native operating environment**, not as legacy software with a chatbot attached. Its architecture includes bounded specialist agents, persistent directives, code-enforced communication boundaries, deterministic business rules, semantic review, human approval gates, quality autoraters, remote execution, and product-native feedback/repair loops.

The company is currently **pre-revenue** and in **Founding Artist Beta**. The product is substantial working software, but the central company proof still ahead is real-user validation, commercial adoption, and live verification of certain external integrations.

---

# 3. Founder-market fit

## 3.1 Operating history

William Roberts is a nontraditional technical founder whose experience developed across two parallel operating worlds: music and hospitality.

**FOUNDER-CONFIRMED:** roughly four decades of music/nightlife experience and a parallel four decades of hospitality/food-and-beverage/operations experience.

The repeated founder pattern is:

**enter at the working level → learn the operation → assume responsibility for the system → identify what is broken or inefficient → improve the process**

That pattern appears repeatedly across:

- nightclub operations;
- DJing and event production;
- music production and mastering;
- label administration;
- restaurant operations and openings;
- acoustics/problem-solving;
- AI tooling;
- software/product architecture.

This is directly relevant to indii.music because the product is built around operational continuity rather than a single creative feature.

## 3.2 Music-business history

Professional music/nightlife work began seriously in the early 1990s in Florida and later included Jacksonville, Las Vegas, and Detroit.

William later created **Expressway Records** through New Detroit Music LLC and reports operating it as owner and sole worker.

Across roughly two active pre-COVID years, the label released just under 100 tracks, including multi-artist compilations.

William personally handled work that now maps directly to indii.music product requirements:

- artist coordination;
- release planning;
- metadata;
- identifiers;
- registrations;
- artwork requirements;
- business administration;
- distribution preparation;
- promotion;
- accounting/royalty work;
- compilation assembly;
- final mastering/cohesion.

The strongest founder-market-fit statement is:

> Expressway Records forced William to operate the entire business chain behind independent releases himself. indii.music is the operating system he repeatedly wished existed while doing that work.

## 3.3 Formal music-business education

**FOUNDER-CONFIRMED:** William completed a two-year Music Business program at **SAE Institute Nashville**.

Verify the exact formal credential title from the diploma/transcript before a form requires the exact degree/program wording.

## 3.4 Hospitality and operations

William reports beginning hospitality work around age 15–16 and progressing through:

- busser/service;
- bartending;
- kitchen work;
- restaurant/nightlife management;
- openings;
- staff operations;
- high-volume guest operations;
- cash/P&L/vendor responsibility;
- training and safety.

The significance to indii.music is operational discipline: live environments taught him that failures, no-shows, customer issues, last-minute changes, money, safety, and incomplete information are normal operating conditions rather than exceptional events.

## 3.5 Failure philosophy

William's shorthand is that he has a **“degree from the University of Failure.”**

The intended meaning is practical, not motivational:

- successful events came after unsuccessful events;
- strong management came after management mistakes;
- label competence came from learning every function by doing it;
- software is being built through the same loop.

Safe founder wording:

> I do not treat failure as a separate chapter from success. My operating pattern is attempt, observe what failed, understand why, correct it, and keep moving.

## 3.6 Self-directed technical transition

William began serious experimentation with modern generative AI during the early ChatGPT/image-generation era, progressing through:

- image-generation tools;
- no-code/low-code experiments;
- small modular applications;
- increasingly coordinated AI-assisted software development.

In **November 2025**, he made the explicit decision that indii.music was the primary product being built.

The current repository's default-branch history begins with an initial commit dated **2025-11-28**, consistent with that founder-reported start period.

---

# 4. The technical-founder role

William should not be described merely as a founder who “used AI to write an app.”

His actual technical role is closer to:

- product/domain architect;
- system designer;
- technical decision-maker;
- AI-agent coordinator;
- acceptance-criteria author;
- review/test/CI process designer;
- primary product operator;
- final human authority on what the system should do.

The repository demonstrates that the founder designed a development operating system around AI-assisted engineering rather than accepting model output at face value.

Examples include:

- `/start`;
- `/middle`;
- `/end`;
- `/ci-validate`;
- exact-SHA CI validation;
- no-post-gate-edit rules;
- bounded scopes;
- targeted tests;
- error ledgers;
- handoffs/checkpoints;
- deploy/security safeguards;
- continuous compliance evidence;
- authenticity/truth rules.

The externally useful statement is:

> William learned enough software architecture and development practice to direct, constrain, test, and verify a large AI-assisted engineering system rather than outsourcing product judgment to the models.

---

# 5. Current engineering scale

A repository snapshot on 2026-09-26 showed approximately:

- **3,605 TypeScript/TSX files**
- **1,479 test/spec files**
- **79 Playwright E2E specs**
- **621 documentation files**
- **38 custom agent workflows**
- **23 registered department heads** in the current runtime registry snapshot

These are engineering-evidence counts, not customer traction.

A formal cadence snapshot taken at approximately **1:23 PM EDT on 2026-09-26** counted:

- **10,543 commits** across the then-303-calendar-day main-branch history;
- commits on **295 of 303 UTC calendar dates (97.4%)**;
- **25 commits** on 2026-09-26 between approximately 6:00 AM and 1:23 PM EDT.

Important limitation: these commits include AI/agent work, merge commits, tests, documentation, fixes, and multiple founder-controlled Git identities. They are evidence of sustained project execution under William's direction, not a claim that he personally typed every commit.

Safe external wording:

> William has worked full-time on indii.music since November 2025, directing a high-frequency AI-assisted development process with continuous testing, review, and CI evidence.

---

# 6. AI-native product architecture

## 6.1 Bounded specialist departments

**VERIFIED:** the runtime uses a department/specialist model with code-enforced communication boundaries.

Current communication modes include:

- **Direct** — private user-to-agent conversation; delegation blocked.
- **Department** — work remains inside the department boundary.
- **Boardroom** — seated department heads may share facts/context with one another, but cannot assign work peer-to-peer as if they were employees.

The relevant enforcement lives in `AgentCommunicationPolicy.ts`.

This matters because the agents are not intended to behave as one unrestricted general model. The architecture constrains authority and routing.

## 6.2 Boardroom orchestration

**VERIFIED / LIVE-TESTED:** Boardroom is a real operating surface, not a visual metaphor.

Current founder screenshots and repository code show:

- selectable/seated agents;
- Boardroom conversation;
- recent assets;
- tool execution;
- status/caveat surfaces;
- collaboration feeds;
- department participation;
- human-visible operational state.

The founder can work with the whole Boardroom, a department, or a direct specialist depending on the task.

Some UI counts may lag the canonical registry and should be derived dynamically rather than hard-coded. Issue #317 exists partly because status surfaces must not collapse nuanced capability state into blanket “everything is done” claims.

## 6.3 Message persistence versus context persistence

This distinction must remain precise.

**VERIFIED:** Boardroom/conversation messages persist through the unified `ConversationSession` spine and Firestore synchronization. Messages can survive reloads and support cross-device retrieval.

**LIMITATION:** persisted messages are not the same as an infinitely large model context window. A new model turn/session may still require retrieval, configuration, directives, summaries, or explicit context injection to keep all prior operating rules active.

Correct wording:

> indii supports durable conversation/session records and cross-device continuity, while model-context continuity still depends on explicit retrieval and persistence mechanisms rather than assuming every past token remains automatically in-context forever.

---

# 7. Directive architecture

This is one of the strongest technical differentiators discovered during founder testing.

## 7.1 Artist Master Directive

**VERIFIED:** the repository contains a Tier-0 **Artist Master Directive** schema.

The source describes it as a living operational playbook that can contain:

- sonic/mastering standards;
- business/legal red lines;
- branding/aesthetic rules;
- release/distribution protocol;
- custom freeform directives.

The schema explicitly describes the Master Directive as having **highest runtime prompt precedence** over base domain playbooks.

This is materially different from a one-off prompt.

## 7.2 Custom directives

**VERIFIED / LIVE-TESTED:** the Master Directive contains a custom-playbook/freeform directive surface, and founder testing on 2026-09-26 showed that a new visual rule materially influenced subsequent image behavior.

The founder added a custom rule requiring synthetic human faces to avoid a perfectly crisp presentation, instead using intentional motion/shutter-like blur so clean identifiable faces are reserved for real/reference people.

Initial results ranged from partial compliance to strong compliance, with more inconsistency in crowded scenes containing roughly 20 people.

Safe wording:

> Live founder testing shows that custom directives can materially influence repeated output behavior. Consistency still varies with scene complexity, so the mechanism is functioning but remains subject to tuning and quality enforcement.

Do not present one visual policy as the IP by itself. The stronger IP/architecture story is the directive-control system that allows persistent user/founder rules to sit above one-off task prompts.

## 7.3 Directive execution tracking

**VERIFIED:** `DirectiveService` persists directives per user, tracks status, goal ancestry, assigned agent, compute allocation, context files, and conversation thread.

The directive system therefore has both:

- **policy/directive semantics**, and
- **execution/goal tracking**.

---

# 8. Governance and control layers

The system contains more than four or five independent controls depending on how the architecture is grouped.

A useful high-level model is:

## Layer 1 — Persistent directive authority
Artist Master Directive and custom playbooks define durable user/founder rules.

## Layer 2 — Task/directive execution tracking
DirectiveService tracks goals, assignments, context, status, and compute bounds.

## Layer 3 — Agent scope and communication policy
AgentCommunicationPolicy limits who can delegate, communicate, and cross department boundaries.

## Layer 4 — Tool-risk and human approval gates
ToolApprovalService can persist a pending high-risk tool call and requires a human to approve the **exact original action** before it executes.

## Layer 5 — Model Armor
Input scanning blocks prompt-injection patterns; output scanning performs data-leakage redaction for secrets, credentials, PII patterns, private keys, and other sensitive data.

## Layer 6 — JEV / TypeSafe semantic guardrails
JEV evaluates ambiguous semantic conditions such as:

- unsupported action-completion claims;
- capability/readiness overclaims;
- unactionable responses;
- other confidence-based behavioral risks.

The current centralized judgment registry contains **70 exported typed `judge*` functions**, plus the separate guardrail service.

## Layer 7 — Autoraters
The repository includes multi-turn and visual output autoraters.

The **VisualOutputAutorater**:

- evaluates subject match;
- scene match;
- mood match;
- technical adherence;
- applies thresholds;
- can generate a corrective prompt;
- caps automatic correction attempts;
- records audit evidence;
- escalates to manual review when correction limits are reached.

This directly explains the “Visual Autorater Correction” output observed during founder testing.

## Layer 8 — Human escalation and operational review
When automated confidence, retry caps, risk level, or approval boundaries are exceeded, the architecture surfaces the issue to a human rather than pretending the system can proceed safely.

The important investor/diligence statement is:

> indii does not rely on one guardrail. It uses layered controls around directives, agent scope, tool authority, semantic claims, content/security boundaries, output quality, and human escalation.

---

# 9. Product-native debugging and repair loop

One of the most important product/company discoveries is that indii can increasingly help diagnose the software that is building and operating indii.

The intended loop is:

**use product → observe failure/gap → report conversationally → persist evidence → create/merge engineering issue → route work → implement → test → CI → verify**

## 9.1 Bug reporting

**VERIFIED:** repository tooling exists for conversational bug/error reporting, durable persistence, founder diagnostics, and GitHub issue forwarding.

## 9.2 Important 2026-09-26 finding

Issue #317 — Boardroom overclaiming readiness — was **hand-filed through the connected founder/agent GitHub workflow**, not proof that the exact in-app `reportBugFn` path fired.

That issue triggered a stronger implementation:

- deterministic capability-overclaim detection;
- JEV readiness-overclaim detection;
- app-originated forwarding through `reportBugFn`;
- cooldown/deduplication;
- visible sync-failure warnings.

## 9.3 Repair of the reporting pipeline

A same-day audit found a real problem:

- several in-product reports persisted in Firestore;
- the GitHub-forwarding leg had broken runtime configuration;
- later, the client-side path was found capable of falsely claiming success even when persistence had failed.

The current repair adds an **honesty gate**:

> the agent may not tell the user a bug was filed unless the server confirms durable persistence.

This episode is highly useful diligence evidence because it demonstrates the company's core philosophy in practice: failure is not hidden; it becomes evidence, repair work, tests, and stronger system rules.

## 9.4 Closed-loop repair-shop vision

**INTENDED OPERATING MODEL:** future engineering operations can use coding/browser/computer-control agents to monitor issues, attempt bounded fixes, run tests/CI, and escalate to human staff when judgment or authorization is required.

Do not claim fully autonomous software repair today.

Safe wording:

> indii is moving toward a closed-loop repair operation in which the product can capture its own defects, convert them into structured engineering work, and route them through the same bounded agent/human development system used to build the product.

---

# 10. Internal founder mode and dogfooding

indii.music is being built so the company can operate itself using the same product.

The founder/internal surface is not simply an unrelated admin console.

Authorized internal users can use the product for:

- Boardroom conversations;
- department/specialist work;
- campaign/content activity;
- business administration;
- operational status;
- approvals;
- diagnostics;
- remote work;
- background/scheduled activity.

Founder mode intentionally exposes richer operational truth than a normal subscriber should see.

This is a meaningful product differentiator because the company is continuously dogfooding the operating architecture.

## 10.1 Restricted founder/admin operations console

**VERIFIED:** indii has a separate standalone internal admin console in addition to the artist-facing product.

The current console is deliberately restricted to company accounts. Repository code shows:

- email-link Firebase authentication;
- only `@indii.music` accounts accepted by the frontend;
- server-side Firebase ID-token verification on protected data routes;
- no password or mock-token bypass;
- real-data-only empty/error states rather than invented dashboard metrics.

The current admin navigation includes:

- **Token Usage** — per-user model/token/cost telemetry;
- **AI Providers** — provider participation/operational telemetry without storing prompts or response bodies in the dashboard feed;
- **Founders Portal** — activated Founding Owners plus the Founding Artist waitlist lifecycle;
- **Inbox & Messaging** — internal business communications;
- **Google Workspace Hub** — connected Gmail/Calendar/Drive operations;
- **DDEX Deliveries** — delivery records/status;
- **Nexus System Monitor** — infrastructure/system-event visibility;
- **Access Log** — administrative access history.

The Founders Portal also contains operational controls for the verified beta queue, invitation sequencing, milestone communications, CRM history, notes, and direct outreach.

This internal console should not be confused with the customer-facing **Founding Owner License**. The console is an employee/founder operating surface; the Founding Owner program is a product-access tier for external customers.

The founder described the login from memory as receiving a code by email. **Current repository implementation uses an emailed magic link rather than a numeric code.** Use the current implementation in diligence/application descriptions unless deployment evidence proves a newer flow.

## 10.2 Public landing, education, and acquisition surface

**VERIFIED:** the public landing package is a substantial product-education and acquisition surface, not a placeholder marketing page.

Current sections include:

- the core ownership/independence hero;
- verified-email Founding Artist waitlist;
- Detroit/company story;
- the indii thesis;
- traditional/legacy comparison material;
- capability/product demonstrations;
- an **“overlooked work”** section covering business tasks artists may not initially realize belong in their operating system;
- Connected Intelligence / Conductor explanation;
- guided onboarding;
- Founding Owner access;
- beta pricing/term options.

Examples of currently surfaced “overlooked work” include:

- mileage/business-trip logging;
- venue research, day sheets, and technical-rider preparation;
- turning long-form video into separate social edits;
- moving artwork into merchandise/print-on-demand preparation.

The landing application also supports founder-specific routing/preview behavior while keeping public preview access closed by default unless explicitly enabled.

This surface matters to fundraising because it demonstrates that product positioning, customer education, waitlist capture, onboarding expectations, and pricing are already being designed as one connected commercial system.

## 10.3 Continuous limitation-to-capability development loop

The founder's daily product-development loop is broader than conventional bug fixing.

The recurring pattern is:

**use indii in real work → expose a bug, limitation, missing connection, or missing tool → classify the gap → move the evidence into engineering → implement or connect the missing capability → test/CI/review → return to the product and retest**

The Road Manager screenshots are a good example. The domain workspace, records, route draft, map surface, specialist agent, and structured report already exist. The remaining failure is not necessarily a defect in those surfaces; it is incomplete live service wiring for certain routing/map operations.

The same pattern applies elsewhere:

- when the product exposes a true bug, the repair/report loop handles it;
- when an agent lacks a capability the product genuinely needs, the founder can define the missing bounded tool/service;
- when a workflow exists but an external integration is not connected, the remaining work is classified as integration completion rather than pretending the feature is absent or fully finished.

This is the practical expression of the workshop architecture described later in this dossier: the founder is increasingly extending the system by adding bounded capabilities into an existing harness rather than rebuilding the application around each new need.

---

# 11. Case study: Road Manager — implemented surface, incomplete integration

The founder's 2026-09-26 Road Manager testing is an important example of the current product stage.

## What visibly exists

Current screenshots show:

- a Road Manager workspace;
- tour parameters;
- start/end dates;
- route waypoints;
- route drafts;
- schedule checks;
- a live map surface;
- Road Director agent conversation;
- domain-record lookup;
- tool execution;
- structured Road Logistics Report output.

## What is still incomplete

The agent correctly reports that certain mapping/routing capabilities are not currently authorized or connected to a live external map API/service.

Observed examples include:

- route draft created while routing/drive times remain unverified;
- map display existing while precise requested locator behavior is not connected;
- Road Director explicitly reporting that live map/geographical operations are unavailable without the required integration;
- existing tour records being discoverable while service-level mapping remains incomplete.

This should not be described simply as “a bug.”

It is an **integration-completion gap**:

> the domain surface, data model, agent, records, and user workflow exist; the remaining task is wiring and live-verifying the external/service layer.

That distinction is representative of much of the current beta work.

---

# 12. Case study: creative directives and synthetic-face treatment

The founder used the app itself to identify a visual-policy requirement:

> synthetic human faces should not appear as perfectly crisp real-looking faces; they should use intentional shutter/motion treatment, while clean faces are reserved for real/reference people.

The founder then added the rule to the custom directive surface and retested image generation.

**LIVE-TESTED result:**

- the directive changed generated image behavior;
- some outputs showed desired face/head motion treatment;
- hand/body movement blur also appeared;
- output quality varied with scene complexity;
- crowded scenes were less consistent;
- repeated testing improved the prompt/rule.

This is valuable because it shows the product being used as a **behavioral control surface**, not merely a prompt box.

It also interacts naturally with the VisualOutputAutorater and manual escalation architecture.

---

# 13. Case study: print-ready creative output

Current 2026-09-26 repository activity includes active work on high-resolution/print output.

Evidence includes:

- model-resolution ceilings aligned with actual model capability;
- print-spec planning;
- print-size verdict UI;
- DPI-tagged export;
- byte-level PNG/JPEG density metadata;
- tests that inspect encoded result bytes;
- album/record-sleeve-oriented requirements.

The founder's practical target includes **3000 × 3000** artwork suitable for common music-release cover requirements and print-oriented use.

The larger product point is:

> artists should not have to leave indii for routine production steps that fit naturally inside the existing creative workflow.

Do not claim every upscale/print path is universally production-proven until current E2E/live verification confirms it.

---

# 14. Case study: Post-Mastering Administrative Engine

The Post-Mastering Administrative Engine is a concrete example of indii moving beyond a chatbot into deterministic music-business infrastructure.

The founder shared current phase evidence showing:

- P1 foundations verified;
- hundreds of rules;
- thousands of unit tests;
- production deploy recovered correctly from a transient Google infrastructure 503;
- P2 catalog audit work added;
- later phases moving toward catalog-gap queries, registration payload staging, split invitations, risk registry, agent wiring, and MCP parity.

The key product concept:

> finishing the audio should trigger the administrative work required to turn a recording into a commercially operable release.

This is one of the clearest manifestations of the product lifecycle thesis.

---

# 15. Case study: mobile remote and field business

indiiREMOTE is not intended to be a generic remote desktop.

Its purpose is to keep the music business operating away from the desk.

Current repository evidence includes:

- authenticated phone-to-Studio relay;
- Boardroom/Department/Direct targeting;
- quick capture;
- voice/photo/document/receipt/video/location/text capture;
- encounter/contact/note structures;
- mileage/business-field surfaces.

Target field use case:

1. meet somebody while doing music-business work;
2. capture the interaction once;
3. extract supported identity/contact context;
4. create/link the person in the contact system;
5. preserve the encounter context;
6. return to Studio without manually reconstructing the meeting.

Current boundary:

The durable field/capture structures exist, but some multimodal extraction paths remain incomplete/live-unverified. Media-derived transcription/OCR/contact extraction should not be claimed until the actual media is attached to the model request and proven end-to-end.

---

# 16. SOC 2 readiness as operating philosophy

indii.music does **not** claim SOC 2 certification.

It does have a proactive SOC 2 readiness/control framework.

Current evidence includes:

- security/availability/confidentiality policies;
- machine-readable controls;
- risk/vendor/incident/continuity material;
- automated control verification;
- scheduled evidence collection;
- security-boundary checks;
- dependency scanning;
- evidence artifacts tied to repository state.

The GitHub Actions evidence workflow is scheduled daily and also runs on relevant changes.

The significance is not a badge.

The significance is the founder's decision to collect evidence continuously so a future auditor does not begin with an empty folder and months of missing history.

Safe wording:

> indii.music is building SOC 2 readiness and continuous evidence collection into normal engineering operations.

---

# 17. Human-plus-agent operating model

The company is not intended to be “no humans.”

The intended structure is:

**small human staff + bounded specialist agents + durable scheduled/background workers**

Humans retain responsibility for:

- judgment;
- relationships;
- approvals;
- hiring/management;
- legal/financial responsibility;
- exceptions;
- strategy.

Agents/workers handle repeatable specialist work inside defined scope.

Technical pieces already exist:

- Boardroom/department routing;
- scheduled workflows;
- background workers;
- approval gates;
- remote execution;
- continuous evidence;
- issue/report systems.

Future staffing remains a plan, not current headcount.

---

# 18. Why the architecture changes feature-development economics

The founder's workshop/Home Depot analogy is useful if stated carefully.

Traditional feature work often requires creating new workflows, state handling, permissions, orchestration, review, and operational tooling from scratch.

indii's architecture already supplies many of those primitives.

A new capability can often be added as:

1. a bounded tool/service;
2. assigned to the correct specialist/department;
3. connected to existing directive/context structures;
4. placed behind existing approval/security policies;
5. covered by existing CI/test/review systems;
6. exposed through existing Boardroom/department/direct surfaces.

This does **not** make feature development effortless.

It reduces architectural blast radius and allows the existing operating framework to be reused.

Safe analogy:

> The workshop already exists. Adding a capability is often closer to building a new specialized tool for the workshop than constructing a second workshop from scratch.

---

# 19. Potential intellectual-property thesis

Do not claim patent protection or patentability without counsel.

However, the current system contains several areas that may warrant formal IP review:

- layered directive precedence and living user playbooks;
- bounded department/agent communication architecture;
- Boardroom orchestration with role/scope enforcement;
- semantic + deterministic + human approval layering;
- product-native bug/repair feedback loops;
- remote field-business capture tied back into persistent operating context;
- the use of the same agent/harness architecture to operate and evolve the company itself;
- music-specific post-mastering administrative orchestration;
- cross-module continuity around canonical song/artist/release/business context.

Recommended action once capital allows:

> engage qualified IP counsel to perform a patentability/trade-secret/copyright strategy review based on the actual architecture and prior art.

---

# 20. Business model

Current approved Founding Artist Beta packaging:

| Plan | Price |
| --- | ---: |
| Free | $0 |
| Start | $22/month |
| Build | $55/month |
| Scale | $110/month |
| Founding Owner License | $2,500 one time |

Current commitment-savings direction:

- 5% quarterly;
- 10% six-month;
- 20% annual.

Pricing is beta packaging and remains subject to operating-cost/customer validation.

---

# 21. Current traction truth

Current traction is primarily **product and engineering traction**, not customer/revenue traction.

Current facts:

- revenue: **$0**;
- MRR: **$0**;
- paying customers: **0**;
- confirmed active external beta users: **0**;
- outside capital received: **$0 reported**;
- startup/cloud credits received: **$0 reported**;
- small early waitlist/invitations exist.

Strong truthful traction claims:

- substantial working platform;
- sustained development since November 2025;
- large test/CI footprint;
- multiple domain-specific business workflows;
- real founder dogfooding;
- continuous issue discovery and repair;
- serious compliance/security/process infrastructure.

Do not substitute engineering activity for customer validation.

---

# 22. Current company stage

The correct description is:

> **A substantial working music-business operating platform entering real-user beta validation and commercialization.**

It is **not**:

- idea stage;
- mockup-only;
- production-perfect;
- product-market-fit proven;
- revenue-generating;
- live direct-DSP distribution at commercial scale.

The central company risk is now **market acceptance**, not product ideation.

---

# 23. Funding thesis

Capital is not needed to discover what product to build.

A substantial product already exists.

Funding is intended to convert product execution into company evidence:

- real artist onboarding;
- first paying customers;
- measured activation/retention;
- live external integration verification;
- production hardening;
- security/compliance maturity;
- targeted engineering capacity;
- bookkeeping/operations;
- founder operating runway;
- repeatable customer acquisition.

Current capital ladder:

- **$10K–$15K** — immediate continuity/seed milestone;
- **~$50K** — local bridge to structured beta commercialization;
- **institutional pre-seed** — derive from actual 12–18 month operating model and financing terms.

---

# 24. Near-term proof milestones

The highest-value next evidence is not “more features.”

It is:

1. real artists onboarded;
2. meaningful workflows completed;
3. return/repeat use measured;
4. first paying customers;
5. onboarding/support process validated;
6. external integrations proven with genuine accounts/credentials;
7. billing/entitlements aligned;
8. product usage data used to remove or strengthen features;
9. founder-led acquisition converted into a repeatable motion.

---

# 25. What external applications should emphasize

## Accelerators / pre-seed investors

Lead with:

- founder-market fit;
- substantial working product;
- unusual AI-assisted engineering governance;
- speed of execution;
- connected operating-system thesis;
- current gap: customer validation/commercialization.

## Detroit/local grants

Lead with:

- Detroit-built technology;
- founder's Detroit/music history;
- working product;
- local artist validation;
- local contractor/job capacity;
- non-dilutive capital converting engineering into market evidence.

## Cloud/startup-credit programs

Lead with:

- real Firebase/GCP/Vertex workload;
- no prior credits reported;
- server-side AI/security architecture;
- beta/production workload;
- credits directly reducing commercialization cost.

---

# 26. Claims that require caution

Do not claim without fresh proof:

- direct commercial delivery to Spotify/Apple/TIDAL/etc.;
- thousands of artists;
- millions of streams;
- revenue or MRR;
- active beta users;
- product-market fit;
- universal cross-session model memory;
- every department fully production-ready;
- every remote specialist identical to the Studio runtime;
- complete autonomous self-repair;
- SOC 2 certification;
- patent protection;
- all external integrations live;
- old acquisition valuation;
- “first of its kind” unless independently supportable.

---

# 27. Canonical narrative

The strongest concise company/founder story is:

> William Roberts spent decades doing the operational work behind music and hospitality before building software. As a DJ, promoter, event operator, label owner, mastering engineer, restaurant operator, and manager, he repeatedly encountered the same pattern: the difficult part was rarely one isolated task; it was keeping the entire operation connected while things changed in real time.
>
> Expressway Records made that problem explicit. Running a label alone required William to coordinate artists, metadata, rights, registrations, artwork, delivery, promotion, accounting, and mastering across disconnected systems.
>
> In November 2025 he committed to building indii.music — business operating software for independent artists. Using AI-assisted development, he did not simply generate code; he designed a harness around the agents that builds and runs the system: bounded departments, persistent directives, deterministic business rules, human approval gates, semantic guardrails, autoraters, CI, continuous compliance evidence, and product-native feedback loops.
>
> Today the result is a substantial working platform rather than an idea-stage prototype. William uses indii itself to operate the company, test workflows, discover gaps, set persistent directives, surface defects, and turn those findings into engineering work. The remaining challenge is not deciding what to build. It is proving that independent artists adopt it, return to it, and pay for it.

---

# 28. Evidence hierarchy for future Work sessions

When future application or diligence work begins, use this order:

1. `docs/funding/APPLICATION_SOURCE_OF_TRUTH.md`
2. this master dossier
3. `docs/funding/EVIDENCE_MAP.md`
4. current production code/tests/CI
5. `docs/funding/FOUNDER_BACKGROUND_DOSSIER.md`
6. `docs/funding/PRODUCT_DIFFERENTIATORS.md`
7. current financial/data-room truth files
8. historical docs only when explicitly labeled as historical

When a live application reveals a missing fact:

- do not guess;
- verify it once;
- add it to the canonical source;
- reuse it thereafter.

---

# 29. Final internal framing

The most accurate high-level description of the company today is:

> **indii.music is a founder-built, AI-native operating system for the business behind independent music. Its technical differentiation is not one model or one feature, but a layered operating architecture that connects persistent directives, bounded specialist agents, deterministic workflows, human approvals, remote execution, quality review, and continuous repair around shared music-business context.**

The most accurate statement of what remains is:

> **The platform is substantially built. The company now has to finish key integrations, harden consistency, validate real artist usage, and convert technical execution into repeatable commercial evidence.**

**Last updated:** 2026-09-26
