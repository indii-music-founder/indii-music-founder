# Capability Quality Contract

This contract governs every capability that `/skill-skill` may select: slash workflows, owned skills, proprietary skills, vendored skills, package scripts, and session-specific host tools.

## Selection rule

The router may automatically select a **certified** capability, or a **conditional** capability after every named prerequisite passes. It must not select a **quarantined** or **deprecated** capability.

Selection never expands authority. A capability can act only inside the current user request and lifecycle. Pause when it needs a new external write, official sign-in, destructive or irreversible action, material cost, external communication, or a decision that changes the goal.

## Required contract

Every selectable capability records:

1. **Purpose** — one clear job and outcome.
2. **Trigger boundary** — positive intents, exclusions, and nearest overlaps.
3. **Authority** — the maximum read, write, delivery, external, or destructive boundary.
4. **Prerequisites** — required files, tools, credentials, services, hosts, and state.
5. **Outputs** — the artifact, state change, or evidence produced.
6. **Verification** — deterministic or observable proof of success.
7. **Failure behavior** — bounded retries, cleanup, fallback, and escalation.
8. **Idempotency** — whether repeating the capability is safe.
9. **Scope control** — no unrelated fixes, cleanup, ledger writes, commits, publishing, or deployment.
10. **Authenticity** — structural, simulated, local-real, and production-real evidence remain distinct.
11. **Maintenance** — source, owner, hash, review date, compatibility, and state.
12. **Evals** — positive, negative, overlap, failure, and authority cases.

## States

- **Certified:** Contract and checks pass. The router may select it inside active authority.
- **Conditional:** Safe only after its listed prerequisites pass.
- **Quarantined:** Unsafe, stale, contradictory, unavailable, or not yet audited. Never auto-select.
- **Deprecated:** Retained only for migration or history and omitted from normal routing.

## Evidence rules

- A local unit test proves its local contract, not a live customer path.
- A mock or fixture proves structure, not production authenticity.
- A local signed-in browser session proves only the local-real path exercised.
- Production or external acceptance requires genuine credentials, the real endpoint, and observable real state.
- Missing or expired credentials require the official authorization flow. Never harvest tokens from `.env`, switch identities, or infer secret replacements.

## Registry boundaries

- `.agent/skills/` and `skills/` are owned and editable.
- `.agents/skills/` is vendored and read-only; update it only through its installer and lockfile.
- User-global skills and host-native tools are optional session overlays. Check availability before routing.
- Package scripts that deploy, delete, clean broadly, or rebuild credentials are quarantined unless a narrower reviewed contract explicitly certifies them.

## Failure and rerouting

Use bounded retries. After repeated failure, contradictory evidence, missing prerequisites, or a stale content hash, stop selecting that capability for the current task and route to a certified fallback. Do not weaken authentication, tests, or acceptance criteria to make a tool appear healthy.
