---
description: Recursive motor for the active objective. Reviews progress, selects one coherent verification unit, resolves blockers with bounded retries, and continues to evidence-backed completion without checkpoint or micro-fix commits.
---

# /go — Recursive Motor

## Loop

1. **Reassess:** Current objective, definition of done, diff, evidence, blockers, and unrelated dirty state. When the instructions, handoff, or plan driving the loop disagree with the diff or look old, run [`/sweep`](sweep.md) (report-only, scoped to those artifacts) before acting on them.
2. **Route:** Use the current `/skill-skill` toolchain; refresh it when a capability is stale, unavailable, quarantined, or repeatedly failing.
3. **Choose a unit:** One coherent contract with one decisive proof surface—not mechanically one micro-task.
4. **Execute:** For units that use or are considering Effect, follow the setup and source guidance in [`/effect`](effect.md) before implementation. Reproduce/test, implement the smallest complete mechanism, and verify affected callers and boundaries.
5. **Improve:** Run `/better` only on the bounded unit when a material quality gain remains.
6. **Verify:** Use proportional tests, typecheck/lint, build/integration, or genuine UI/external evidence. For changed Effect code, include the affected-package diagnostics in [`/effect`](effect.md).
7. **Accumulate:** Keep related work uncommitted while the active objective still has units remaining. If the unit changed documented behavior, note it for the `/sweep` pass in `/middle` or `/end`; do not sweep per unit.
8. **Repeat or close:** Continue with the next unit, or invoke `/end` when every acceptance criterion is proved.

## Blockers

- Two failed attempts with the same mechanism trigger instrumentation and an architectural pivot.
- Missing credentials trigger the official authorization flow.
- Missing external/destructive/paid authority pauses only that action.
- Unavailable tools trigger a Certified fallback.
- Unrelated dirty files are preserved and reported, never staged or overwritten.

## Evidence

Do not claim completion from intent, code appearance, a queued state, or a test that exercises a different contract. Label structural, simulated, local-real, and production-real evidence honestly.

## Delivery boundary

`/go` does not create WIP, checkpoint, per-unit, or speculative repair commits. `/end` owns final reconciliation and `/ci-validate`; deliver one coherent commit using the route in [`branch-safety.md`](branch-safety.md) and verify exact-SHA CI on `main`.

```text
OBJECTIVE: <objective>
UNIT / STATE: <unit> / <active|verified|blocked>
EVIDENCE: <decisive result or missing proof>
STRIKES / ROUTE: <attempt count and capability health>
NEXT: <next in-authority action>
```

> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.
