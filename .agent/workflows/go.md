---
description: Recursive motor for the active objective. Reviews progress, selects one coherent verification unit, resolves blockers with bounded retries, and continues to evidence-backed completion without checkpoint or micro-fix commits.
---

# /go — Recursive Motor

## Loop

1. **Reassess:** Current objective, definition of done, diff, evidence, blockers, and unrelated dirty state.
2. **Route:** Use the current `/skill-skill` toolchain; refresh it when a capability is stale, unavailable, quarantined, or repeatedly failing.
3. **Choose a unit:** One coherent contract with one decisive proof surface—not mechanically one micro-task.
4. **Execute:** Reproduce/test, implement the smallest complete mechanism, and verify affected callers and boundaries.
5. **Improve:** Run `/better` only on the bounded unit when a material quality gain remains.
6. **Verify:** Use proportional tests, typecheck/lint, build/integration, or genuine UI/external evidence.
7. **Accumulate:** Keep related work uncommitted while the active objective still has units remaining.
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

`/go` does not create WIP, checkpoint, per-unit, or speculative repair commits. `/end` owns final reconciliation and `/ci-validate`; repository delivery follows one coherent task-branch commit, a reviewed PR, and exact-SHA CI under [`branch-safety.md`](branch-safety.md).

```text
OBJECTIVE: <objective>
UNIT / STATE: <unit> / <active|verified|blocked>
EVIDENCE: <decisive result or missing proof>
STRIKES / ROUTE: <attempt count and capability health>
NEXT: <next in-authority action>
```

> **Protected main delivery gate:** Before any code, git, CI, or push action, read and obey [`branch-safety.md`](branch-safety.md). Deliver through a focused branch and reviewed PR; direct pushes to `main` are prohibited.
