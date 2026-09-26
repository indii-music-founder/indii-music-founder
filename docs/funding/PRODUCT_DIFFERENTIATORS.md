# indii.music — Product Differentiators for Funding & Diligence

**As of:** 2026-09-26
**Purpose:** Evidence-backed description of product characteristics that are easy to miss in a standard feature list.

## 1. Product-native feedback / repair loop

indii.music is designed so a user can report a problem conversationally rather than leaving the product to find a support portal.

Current repository architecture includes:

- report_error / report_bug tools;
- Firestore persistence of error/bug reports;
- server-side GitHub credential handling;
- search-before-create deduplication;
- forwarding of authenticated bug reports into GitHub Issues;
- founder/internal triage surfaces that expose richer diagnostic detail than subscriber-facing flows.

The important distinction is audience:

- subscriber-facing flows can create durable reports and return a reference/result without exposing internal engineering detail;
- founder/internal users can inspect underlying reports and diagnostics needed to resolve the problem.

This creates a short path:

**use product → encounter defect → report conversationally → preserve evidence → engineering triage → fix → verify**

### Current live-status note

On 2026-09-26, an audit found that the deployed GitHub-forwarding leg had been missing required runtime configuration. Seven reports had persisted in Firestore but had not reached GitHub.

The root code fix is commit 5504361c9, which adds a canonical-repository fallback in reportBugFn. The live secret/environment configuration was also repaired out-of-band according to the commit record.

GitHub issue #319 is a backfill of one group of those real in-product reports.

Do not use #319 as proof that a fresh post-repair report has already completed the entire automatic Firestore-to-GitHub roundtrip. That final live roundtrip should be verified with a new genuine report.

This episode is itself useful process evidence: the report data survived the forwarding failure, the failure mode was diagnosed, the pipeline was repaired, and the stranded reports could be recovered.

## 2. Founder/internal operating surface

indii.music has an internal/founder mode because the company intends to operate itself with the same system it is building for artists.

Authorized internal users can use Boardroom and specialist-agent conversations, campaign/content workflows, remote control, operational status, richer diagnostics, approval queues, and background/scheduled work.

The founder product is not a separate unrelated admin dashboard. It is the same operating architecture with additional authority and visibility appropriate to company operations.

## 3. Modular agent harness / bounded departments

The current runtime department registry contains **23 department heads**.

Communication boundaries are enforced in code:

- Direct mode blocks delegation;
- Department mode blocks cross-department delegation;
- Boardroom mode permits collaboration only among seated department heads.

Agents are expected to stay within their assigned domain and routing contracts rather than acting as one unrestricted general model.

The practical advantage is architectural reuse. When a new capability is needed, it can often be implemented as a bounded tool/capability, assigned to the appropriate specialist/department, wired into existing permissions and approvals, covered by the existing test/security/CI harness, and exposed through existing orchestration surfaces.

This does not mean adding a feature is free or instantaneous. UI, backend implementation, integration tests, security review, data contracts, and live verification still apply.

A useful analogy is a workshop: the operating framework already exists, so adding a new capability is often more like building and adding a new specialized tool to the workshop than constructing a separate shop from scratch.

## 4. Remote control as field-business infrastructure

indiiREMOTE is not merely a remote mouse/desktop controller.

Its purpose is to let business activity continue while the user is physically away from Studio.

Current architecture includes authenticated phone-to-Studio command/response relay, presence/lease/claim semantics, Boardroom/department/direct conversation targets, approvals/status, quick capture, voice/photo/document/receipt/video/location/text capture, Field Encounter records, and mileage/business-field surfaces.

### Field Encounter contact use case

The intended workflow is:

1. meet a new person while doing music-business work;
2. capture the interaction once on the phone;
3. transcribe spoken information;
4. extract supported contact details such as name, phone, email, organization, and role;
5. classify/use a headshot/business-card image where available;
6. create/link a structured contact;
7. create a durable encounter note;
8. return to Studio with the context already organized.

Current repository evidence proves the audio/photo contact-analysis path and the durable encounter/contact/note infrastructure.

Current limitation: video can be captured/stored/attached, but the server analysis path does not yet extract frames from video for contact analysis. GitHub issue #318 tracks that gap.

Therefore the safe claim is **implemented field-capture/contact architecture being actively hardened**, not complete production-perfect video contact extraction.

## 5. Continuous founder operation away from the desk

The founder reports working throughout the day from both desktop and phone, including while physically away from the workstation.

Repository evidence from 2026-09-26 shows active commits and workflow progress from early morning through the afternoon, while remote/founder surfaces were also being used to inspect system status and route engineering work.

This supports the product thesis: business workflows should continue when the artist/founder is not sitting in front of the desktop.

## 6. Truth-enforced operational status

A Boardroom response on 2026-09-26 overstated production readiness. That defect was converted into GitHub issue #317.

The expected contract is now explicit:

- distinguish implemented from tested;
- distinguish tested from live-verified;
- disclose external gates;
- use current registry counts rather than hard-coded numbers;
- do not state all systems verified without evidence.

## 7. Human-plus-agent company operating model

The planned company is not no humans.

The intended model is a small human team managing bounded specialist agents and durable scheduled/background workers.

Humans own relationships, judgment, approvals, exceptions, hiring/management, legal/financial responsibility, and strategic decisions. Agents/workers handle repeatable scoped work inside defined authority.

Technical pieces of this operating model already exist: department routing, Boardroom collaboration, approval gates, scheduled GitHub workflows, Inngest background workers, remote execution, and continuous evidence/CI.

The future human staffing structure remains a plan, not current headcount.

## 8. Continuous compliance evidence

SOC 2 readiness was built into normal engineering operations rather than postponed until diligence.

The repository contains policy/control material plus scheduled evidence collection bound to git SHAs.

The business value is preparation: if/when an independent auditor is engaged, the company intends to have an accumulated history of control evidence instead of attempting to reconstruct months of engineering behavior after the fact.

Do not call this SOC 2 certification.

## 9. Semantic judgment as a bounded tool, not system authority

Jev/TypeSafe is integrated as a typed semantic judgment layer.

The central registry currently contains 70 exported typed judge functions plus a separate Jev guardrail service.

Semantic judgment is bounded by server-side credentials, centrally reviewable questions/thresholds, confidence gates, and deterministic fallbacks.

Exact identifiers, arithmetic, security authorization, ownership, and legal/financial truth remain deterministic or human-authoritative.

## 10. Development operating system around AI agents

The company does not rely on AI saying it is done.

Founder-created engineering procedures include /start, /middle, /end, /ci-validate, acceptance criteria, bounded scopes, targeted tests, exact-SHA CI, no-post-gate-edit rules, handoffs/checkpoints, security/deploy guards, and continuous compliance evidence.

That development harness is a product-development asset in its own right because it lets the founder coordinate many AI-assisted workstreams without accepting unverified output as truth.

## External summary

> indii.music is AI-native not because it adds a chatbot to legacy software, but because the product and the way it is built share the same architecture: bounded specialist agents, deterministic business rules, human approvals, durable workflows, remote execution, product-native feedback, and continuous verification. The result is a system that can be extended and operated without rebuilding a separate stack for every new workflow.
