# indii.music — Master Application Answer Bank

**As of:** 2026-09-26  
**Use:** Starting point for grants, accelerators, investors, startup-credit programs, and interviews. Customize to the exact prompt and word limit.

## What are you building?

indii.music is business operating software for independent music artists. It connects the work around finished music — planning, rights and registrations, delivery preparation, creative campaigns, release operations, finance, audience/CRM, merchandise, and repeatable business workflows — around shared artist and project context.

## What problem are you solving?

Independent artists increasingly run small music companies without company-grade operating infrastructure. Their work is fragmented across distributors, rights organizations, spreadsheets, accounting tools, creative tools, social platforms, email, notes, and manual processes. Each tool may solve one problem, but context is lost between them.

## What is the solution?

An artist works from one connected operating environment. The same song, release, rights, collaborators, assets, campaign, audience, and financial context can move through:

Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat.

AI assists interpretation and planning where it adds value. Deterministic software remains authoritative for exact calculations, identifiers, permissions, security, and workflow state. Consequential actions remain human-approved.

## Why now?

Artist independence has transferred more label, management, administration, marketing, and operating work to individual artists. AI can now help one person operate across complex workflows, while modern cloud infrastructure and music-data standards make a connected operating layer practical.

## Why are you the founder for this?

I have spent roughly four decades across music and hospitality/operations. I have worked as a DJ, promoter, event producer, nightclub operator, music producer, label owner, mastering engineer, restaurant operator, manager, and opening-team member. Through Expressway Records I personally handled the operating chain around releases, including artists, metadata, registrations, distribution preparation, promotion, accounting/royalty work, and final mastering.

I also completed a two-year Music Business program at SAE Institute Nashville. Since committing to indii.music in November 2025, my role has been product, domain architecture, technical direction, AI-agent coordination, review, testing standards, and delivery proof.

## How long have you been working on this, and is it full-time?

I committed to building indii.music in November 2025 and it has been my full-time daily focus since then. I use AI-assisted development heavily, but I direct the product, architecture, scope, review, testing, and acceptance process. The repository history is consistent with that intensity: the current default branch starts on Nov. 28, 2025 and shows sustained high-frequency activity through today.

I would not present raw commit count as a quality metric, but it is useful corroborating evidence of development cadence when an accelerator or investor asks how much work has actually happened.

## What is your stage?

Working software entering founder-led beta validation. The core platform exists. Current work is production hardening, live external-integration verification, real-user onboarding, first commercial adoption, and turning intensive founder-led development into a repeatable operating company.

## What traction do you have?

indii.music is pre-revenue. Revenue is $0, there are no paying customers, and there are no confirmed active external beta users yet. A small waitlist exists and invitations have begun.

The strongest traction today is product execution: a substantial working web/desktop/cloud platform, extensive automated tests and CI/security controls, domain-specific music-business workflows, and continued development velocity since November 2025.

## What have you built technically?

The product includes a React/Electron application, Firebase/Google Cloud backend, local audio processing, remote phone-to-Studio execution, registration and rights workflows, DDEX/distribution-preparation infrastructure, finance/split/expense tooling, CRM/social systems, merchandise workflows, creative image/video systems, waitlist/admin infrastructure, and specialist-agent orchestration.

A 2026-09-26 repository snapshot contained roughly 3,605 TypeScript/TSX files, 1,479 test/spec files, 79 Playwright E2E specs, 621 docs files, 38 custom agent workflows, and 22 specialist agent-card definitions. These counts are engineering evidence, not customer traction.

## How are you using AI to build the company?

I use AI as development labor and reasoning assistance inside a process I designed. I set the product and architecture, break work into bounded objectives, decide what must remain deterministic, review and reject wrong approaches, require tests and evidence, and use custom start/middle/end/CI workflows to prevent an agent from declaring work complete without proof.

The process includes exact-SHA CI validation, security guards, no-post-gate-edit rules, handoffs, error ledgers, review gates, and continuous compliance evidence.

## What is differentiated?

The differentiation is continuity, not feature count. Distribution preparation can understand rights and metadata. Creative workflows can understand the release and campaign. Finance can understand projects and expenses. Registration can use the same canonical artist/song context. The product is designed as an operating system for the business around music rather than disconnected point tools.

A second differentiator is the product's harness architecture. The current runtime registry contains 23 department heads with code-enforced communication boundaries. New capabilities can often be added as bounded tools within an existing specialist/department and inherit the same routing, permissions, approval, testing, security, and CI framework. That reduces the architectural cost and blast radius of extending the product, while still requiring normal implementation and verification work.

## How does bug reporting work?

Users can report a failure conversationally. The agent can create a durable error or bug report; the bug pipeline persists reports and can forward authenticated bug reports to GitHub Issues without exposing GitHub credentials to the client.

The internal/founder side is deliberately different: founder-authorized users can inspect the underlying technical details, triage reports, acknowledge them, and mark them resolved. This creates a product-native feedback loop from user experience to engineering triage.

The current architecture is real, but its production GitHub-forwarding leg was repaired on 2026-09-26 after seven reports were found preserved in Firestore but not forwarded. The preserved reports were recoverable; a fresh post-repair automatic roundtrip remains the final live-verification step.

## How is the agent system bounded?

The current department runtime has 23 registered department heads. Direct mode prevents delegation, Department mode prevents cross-department delegation, and Boardroom mode restricts collaboration to seated department heads. Valid agent IDs must resolve to a required fine-tuned Vertex endpoint or an explicit tuned-domain alias; missing routing fails rather than silently falling back to a generic model.

## How do you operate indii.music itself?

The founder/internal version is used to operate indii.music, not only to build it. Authorized internal users can use the same Boardroom, specialist agents, remote control, content/campaign workflows, status surfaces, and diagnostic systems while running the company.

The internal error experience is deliberately richer than the customer experience. Customers can report a problem conversationally and create a durable report without being exposed to raw engineering details. Founder/internal users can inspect deeper diagnostics and route the issue into engineering work.

That creates a short feedback loop: use the product → encounter a defect or missing capability → preserve evidence → create/route engineering work → verify the fix.

A current example is GitHub issue #317, opened after the Boardroom overstated production readiness. Another review found that Field Encounter video capture is stored but not yet analyzed frame-by-frame for contact extraction; that gap is now tracked as issue #318.

## What is the operating model as the company grows?

The planned operating model is a small human team supervising bounded specialist agents and durable scheduled/background workers. Humans handle relationships, judgment, approvals, exceptions, and management; agents handle repeatable specialist work within defined scopes.

This is not a claim that indii.music already has that staff. The technical foundation exists today in department routing, Boardroom collaboration rules, approval gates, scheduled workflows, Inngest background workers, CI, and continuous evidence collection.

## What is your business model?

Current Founding Artist Beta packaging:

- Free: $0
- Start: $22/month
- Build: $55/month
- Scale: $110/month
- Founding Owner License: $2,500 one time

Current savings direction is approximately 5% quarterly, 10% for six months, and 20% annually. Pricing is beta packaging and remains subject to operating-cost validation.

## Who is the customer?

Self-managed independent artists and artist-producers who are responsible for more than making music: releases, rights, collaborators, marketing, finances, audience activity, merchandise, and career operations. The strongest initial customer is an independent artist with recurring releases and enough complexity that fragmented tools already cost time, money, or missed administrative steps.

## How will you get customers?

The immediate go-to-market is founder-led and evidence-driven: onboard a small number of independent artists directly, observe activation and repeat usage, use real product demonstrations and case evidence, leverage Detroit and the founder's music-industry network for early introductions, and refine the acquisition motion before scaling paid marketing.

## Why Detroit?

indii.music is being built in Detroit, a city with globally significant music history and a growing technology/startup ecosystem. The founder has deep Detroit music and hospitality roots. Building the company here creates an opportunity to validate the product with working artists, hire or contract local talent as funding allows, and build sophisticated music-business technology from Detroit.

## What is the biggest gap?

Market validation. The product is no longer at the idea stage. The next major proof is independent artists using important workflows, returning, identifying measurable value, and paying.

## What have you raised and who owns the company?

$0 outside capital reported. The company has been bootstrapped by the founder. William Roberts reports 100% ownership, with no co-founder or outside investor ownership reported.

## What would $15K do?

A $15K seed grant would preserve development continuity and create market evidence. It would fund targeted production hardening, cloud/AI/testing infrastructure, beta onboarding and customer discovery, essential legal/accounting/security work, and operating continuity long enough to move real artists through the product and measure what happens.

## What would $50K do?

A roughly $50K local bridge would move indii.music from intensive founder-led product building into structured beta commercialization. It would fund senior technical/contractor support, founder operating runway, artist onboarding and customer discovery, cloud/AI infrastructure, bookkeeping/operations, and legal/security/compliance work.

## What would a $350K–$500K pre-seed do?

A pre-seed round would fund 12–18 months of focused commercialization: senior engineering and technical support, founder compensation, operations/customer support, artist acquisition, cloud/AI/CI infrastructure, security/legal/compliance, and contingency.

## What is your SOC 2 status?

indii.music is not SOC 2 certified. The repository has a proactive SOC 2 readiness and continuous-evidence framework: policies, a machine-readable control registry, risk/vendor/incident/continuity materials, daily and change-triggered evidence collection, security-boundary checks, dependency scanning, and git-SHA-bound evidence artifacts.

## How do you ensure AI-assisted code is reliable?

AI output is not accepted because the AI says it is done. The development system requires bounded objectives, tests, code review, security checks, CI gates, exact-SHA remote validation, and rerunning affected checks after post-gate edits. Exact arithmetic, identity, authorization, identifiers, and security policy remain deterministic.

## What is Jev/TypeSafe doing?

Jev/TypeSafe supplies typed semantic judgments for ambiguity that is poorly served by brittle string parsing. Production calls route through a server-side gateway, questions and thresholds are centralized, confidence gates are used, and deterministic fallbacks remain available. The current registry contains 70 exported typed judge functions plus a Jev guardrail service.

## Are you already distributing directly to DSPs?

No external application should claim that yet. indii.music has DDEX generation, preflight, packaging, migration, and delivery-readiness infrastructure, but direct commercial DSP delivery requires genuine partner onboarding, credentials, transmission, acknowledgement, and reporting proof.

## What should never be copied into an application without new proof?

- old test-fixture revenue or streams;
- thousands of artists;
- active-user counts not checked at submission time;
- direct DSP commercial delivery;
- first-of-its-kind claims;
- old acquisition-workbook valuation;
- testimonials or social proof that do not exist;
- exact legal facts not checked in current records;
- planned features presented as shipped;
- paid tooling presented as active when only free/access-tier setup exists.


## What is indiiREMOTE for?

indiiREMOTE is a mobile operating surface for indii.music, not merely a desktop remote. It lets the user carry business context into the field and send work back to the Studio through an authenticated cloud relay.

Current mobile capture surfaces include voice, photo, document, receipt, video, location, and text. One implemented Field Encounter use case is contact capture: captured media can be transcribed, contact details such as name, phone, email, organization, and role can be extracted, headshot/business-card imagery can be classified, and the result can create or link a structured contact and synced note.

The larger product idea is that music-business work should not stop when the artist, founder, or staff member leaves the desk.

Some of these mobile paths are still being hardened, so the safe claim is implemented workflow architecture with active debugging/live verification—not production-perfect execution.
