# indii.music — AI-Native Operating Model

**As of:** 2026-09-26  
**Purpose:** Durable founder/product record for funding, diligence, hiring, and future operating documentation.

This document captures an important part of indii.music that is easy to miss in a standard feature list: the system is being built not only as software for artists, but as an operating environment that can help run and improve itself under human direction.

## 1. The founder can issue durable operating directives

Repository evidence supports persistent directive infrastructure rather than ephemeral chat-only instructions.

### General execution directives

`DirectiveService` stores directives under:

`users/{userId}/directives`

A directive contains:

- title;
- status;
- assigned agent;
- goal ancestry;
- compute allocation;
- context files;
- conversation thread;
- digital-handshake requirement;
- timestamps.

The service supports creation, retrieval, status changes, and fetching active directives for an assigned agent.

### Living Artist Master Directive

The Artist Master Directive is stored under:

`users/{uid}/skills/artist_master_directive`

The current implementation provides:

- Firestore persistence;
- schema validation;
- real-time synchronization;
- agent and user modification attribution;
- section-level rule refinement;
- direct agent tools for reading and refining the directive;
- prompt formatting with high-priority override semantics.

The implementation explicitly describes the directive as a living, co-authored operational playbook that can supersede default platform behavior inside its intended scope.

A live-browser verification spec exercises:

1. adding a new rule;
2. saving it;
3. verifying it persists;
4. changing Visual DNA data and verifying the cascade;
5. having an agent add another rule;
6. confirming the updated rule appears in the live UI.

### Current truthful claim

Safe:

> indii.music has persistent user/founder directive infrastructure that can carry durable operating, business, creative, and policy rules across later agent work.

Do not automatically claim that every Boardroom sentence becomes a permanent directive. The exact capture/routing path depends on which directive surface and tool were invoked.

## 2. Boardroom is an operating surface, not just a chat room

Current Boardroom architecture is unified with the durable conversation-session spine rather than using a disposable parallel message store.

The founder uses the Boardroom to:

- coordinate specialist agents;
- inspect operating status;
- issue directives;
- route engineering/product work;
- challenge incorrect claims;
- create or trigger corrective work;
- continue business operations from the phone/remote surface.

The company intends authorized employees to use the same operating system for indii.music's own marketing, creative, administrative, and operational work.

## 3. The system is beginning to help debug itself

This is not a claim of full autonomous software repair.

The current evidence does support a real feedback loop:

**use product → encounter defect → report conversationally → durable evidence → GitHub engineering issue → bounded repair work → tests/CI → verification**

### Verified case: issue #319

Issue #319 is a genuine indii-originated bug report for image-generation resolution failure.

Evidence in the issue states:

- reporter: `wiil@indii.music (agent, automated)`;
- the reports originated inside indii;
- multiple reports were preserved in Firestore;
- the GitHub forwarding leg initially failed because required runtime configuration was missing;
- the preserved reports were later backfilled to GitHub after the pipeline was repaired.

The failure therefore proved both a weakness and a strength: the forwarding path was broken, but the underlying product-originated evidence survived and could be recovered.

### Reporting hardening

Follow-up engineering added:

- a single server-side durable write path through `reportBugFn`;
- an honesty gate that refuses to claim a bug was filed unless persistence succeeds;
- visible failure signaling when GitHub sync fails;
- server-side deduplication;
- readiness-overclaim detection;
- a Jev/TypeSafe judgment for unsupported production-readiness claims;
- automatic routing of detected overclaims into the bug-report path.

Issue #317 itself was not emitted by the current `reportBugFn` issue format. It was created through the connected founder/engineering workflow. Its defect then directly motivated the app-originated auto-reporting guard now present in code.

### Current truthful claim

Safe:

> indii.music has product-native bug reporting and an increasingly closed feedback loop in which the product can detect/report certain classes of its own incorrect behavior into the engineering system. Human-directed agents then diagnose, repair, test, and verify the change.

Still gated:

> Fully autonomous self-repair without human oversight is not the current claim.

## 4. The harness makes new capabilities modular

The current runtime uses bounded specialist departments/agents, explicit routing, tool permissions, approval boundaries, deterministic execution layers, and shared engineering procedures.

The practical result is that many new capabilities can be added by:

1. defining the new bounded capability;
2. assigning it to the correct specialist/department;
3. adding the required tool/API/data contract;
4. wiring permissions and approval boundaries;
5. adding tests/security/CI checks;
6. exposing it through existing orchestration surfaces.

This does not make software engineering free or instantaneous. UI, backend, data, security, live integration, and testing work still apply.

The founder's shorthand analogy is useful:

> The workshop already exists. Adding a capability can be more like building a new specialized tool for the carpenter than constructing an entirely new shop.

## 5. Founder-defined creative policy can become persistent system behavior

On 2026-09-26, the founder issued a Boardroom creative directive concerning synthetic human imagery:

- when an AI-generated person's face would otherwise appear clearly, use a camera-shutter / motion-blur treatment timed to natural head movement;
- reserve clean, clearly visible human faces for real people.

The intent is both aesthetic and provenance-oriented: synthetic people should carry a subtle visual cue rather than being presented with the same clean facial treatment as real people.

### Evidence status

- **Founder directive:** confirmed.
- **Persistent directive architecture:** repository-proven.
- **Exact shutter/head-motion implementation:** currently in development / not yet located as committed implementation at this audit point.

Therefore the current safe description is:

> indii.music can carry durable creative policy through its directive system; the founder is currently using that capability to establish a synthetic-human visual convention, with implementation still being completed.

## 6. Remote work extends the operating system into the field

The founder reports routinely working from both desktop and phone throughout the day.

indiiREMOTE is intended to make business activity occurring away from the workstation immediately useful to the system.

Examples include:

- Boardroom status and direction;
- approvals;
- field capture;
- contacts and notes;
- receipts/documents;
- mileage/business context;
- audio/photo/video/location capture;
- Field Encounter records.

The contact-capture use case is a representative target:

1. meet someone while doing music-business work;
2. capture the encounter on the phone;
3. extract supported identity/contact information;
4. create/link the contact;
5. preserve an encounter note and context;
6. return to Studio with the information already structured.

The durable encounter/contact infrastructure exists. Media analysis is still being wired/verified and should not be overstated until audio/photo/video evidence is actually passed through and proven end to end.

## 7. Human-plus-agent company model

The intended company model is not "no humans."

The likely structure is a small human team supervising and operating bounded agent teams and scheduled/background workers.

Humans remain responsible for:

- relationships;
- judgment;
- approvals;
- strategy;
- hiring/management;
- legal and financial responsibility;
- exceptions;
- escalation.

Agents/workers handle scoped repeatable work inside explicit authority.

This model is already partially reflected in department routing, Boardroom collaboration, approval gates, scheduled workflows, remote execution, bug reporting, CI, and compliance evidence collection.

## 8. Why this matters for the founder story

The founder's technical contribution is not accurately summarized as "using AI to write an app."

The stronger evidence-backed description is:

> William Roberts designed an AI-assisted development and operating system: bounded specialist agents, durable directives, deterministic business rules, human approval boundaries, product-native feedback, remote execution, continuous testing, exact-SHA CI, and compliance evidence. He uses that same system to continue building and operating indii.music.

That is a technical-founder and operating-model claim, not customer traction.

**Last updated:** 2026-09-26
