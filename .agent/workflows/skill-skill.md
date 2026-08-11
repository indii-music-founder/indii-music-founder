---
description: Canonical intent, authority, and capability router. Selects the smallest healthy ordered toolchain from the generated catalog plus tools actually exposed by the current host, then executes inside existing authority or pauses for one named prerequisite.
---

# /skill-skill — Capability Planner

`/skill-skill` gives the agent the ability to choose the tools it needs. Its first responsibility is therefore tool quality: it may route only to capabilities that satisfy [the capability contract](../capabilities/CONTRACT.md).

## 1. Classify the request

Determine:

- **Mode:** Explain, Review, Diagnose, Modify, Deliver, or Sensitive.
- **Profile:** T0 read-only, T1 localized, T2 cross-cutting, or T3 high-risk/live/external.
- **Authority:** read-only, local writes, repository delivery, or named external writes.
- **Proof:** structural, simulated, local-real, production-real, or external acceptance.
- **Stop conditions:** new authentication, material cost, destructive/irreversible action, external communication, or a goal-changing decision.

Routing never broadens authority.

## 2. Load the capability surface

1. Read `.agent/capabilities/catalog.md` or the relevant entries in `catalog.json`.
2. When repository execution is available, run `npm run validate:capabilities`; a stale catalog fails closed.
3. Overlay only session tools actually exposed by the current host: MCP capabilities, connectors, browser/computer-use tools, apps, and user-global skills.
4. Apply the same contract to dynamic tools. Availability is not certification.
5. Treat `.agents/skills/` as read-only and machine-global registries as optional.

## 3. Build the minimal sufficient toolchain

Choose only what the task needs, in order:

1. optional discovery/orientation capability;
2. domain skill or workflow;
3. execution capability when mutation is authorized;
4. verifier matched to the claimed evidence;
5. delivery gate only when repository delivery is part of the objective.

Prefer Certified capabilities. A Conditional capability is eligible only after every listed prerequisite passes. Never select Quarantined, Deprecated, unavailable, or stale entries.

Resolve important overlaps explicitly:

- `health-check` is a focused detector delta; `health-audit` is repository-wide readiness.
- `diagnose` is one known failure; `hunter` is a broad bounded sweep; `test` selects and runs affected tests.
- `indii-director` builds image prompts; `indii-cinema-worldbuilder` builds video scene prompts.
- `/start` begins a new objective; `/proceed` reconciles a resumed one.
- `/middle` is the human-facing execution phase; `/go` is its recursive motor.
- `/end` reconciles and delivers; `/ci-validate` proves the delivery state observationally.

## 4. Check prerequisites and fallback

Before execution, check required files, binaries, services, credentials, host compatibility, current content hash, and external state. If a prerequisite is missing:

- use a Certified fallback when it provides the same honest outcome;
- otherwise pause once and name the official prerequisite;
- never switch credentials, inject authentication, weaken security, incur cost, or fabricate state;
- after repeated tool failure, mark it unavailable for the current route and re-plan.

## 5. Execute or pause

Execute the selected toolchain automatically when all actions remain inside the active request. Do not ask for repeated confirmation for normal in-scope local work.

Pause only for new authority, official sign-in, destructive or irreversible action, material cost, external communication, or a decision that changes the goal.

## Output contract

```text
=== SKILL-SKILL ROUTE ===
MODE / PROFILE: <mode> / <T0-T3>
AUTHORITY: <read-only | local writes | repository delivery | named external writes>
TOOLCHAIN: <ordered capability IDs and runtime tools>
HEALTH: <certified | conditional + satisfied prerequisites>
REJECTED NEAR MATCHES: <capability: reason>
VERIFICATION: <required evidence>
FALLBACK: <capability or official prerequisite>
NEXT: <execute inside authority | pause for exact requirement>
```

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
