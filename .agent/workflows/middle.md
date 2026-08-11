---
description: Flagship execution workflow for implementing an active objective in coherent verification units. Runs the certified toolchain selected by /skill-skill, preserves contract and authenticity boundaries, and uses /go as its recursive motor.
---

# /middle — Execution

Use `/middle` during active implementation. The current user objective and acceptance contract take precedence over stale task artifacts.

## 1. Confirm the unit and toolchain

- restate the active objective, current acceptance criterion, and bounded files;
- read [`branch-safety.md`](branch-safety.md) before code, git, CI, or push actions;
- load the `/skill-skill` route or produce one when specialized tools are needed;
- verify that every selected capability is Certified, or Conditional with prerequisites satisfied;
- preserve unrelated dirty files and do not run periodic git workflows that commit or push intermediate state.

## 2. Execute through `/go`

Use [`/go`](go.md) on one coherent, independently verifiable work unit. A unit may include several tightly coupled files when they implement one contract.

For each unit:

1. state the expected behavior and failure signal;
2. reproduce or add a meaningful test where objective behavior is testable;
3. implement the complete mechanism without placeholders or adjacent cleanup;
4. verify schema, API, state, literal, identifier, and ownership boundaries across callers;
5. run affected tests for renamed/re-valued shared values—typecheck alone is not proof;
6. preserve exact decisive output in tool logs and summarize it accurately;
7. apply `/better` only to the unit's bounded files and only when it does not change the acceptance contract.

## 3. Proof selection

- Local logic: targeted tests and relevant typecheck/lint.
- Shared contract: dependents' tests, build, and integration checks.
- UI: approved available browser capability plus DOM/screenshot evidence when the real state is reachable.
- Live-user/production: `.agent/REAL_USER_AUTHENTICITY.md`, genuine credentials, real path, and honest environment/account labels.
- Paid, destructive, external communication, publishing, or deployment: pause for the missing named authority.

Mocks and fixtures never prove a customer path.

## 4. Strike and reroute

After two failed attempts with the same mechanism, stop repeating it. Add instrumentation or a deterministic reproducer, inspect the contract at the next abstraction layer, and select a certified alternative. Do not weaken tests, authentication, or acceptance criteria.

## 5. Durable artifacts

Update a flowchart only when state, sequence, or ownership is genuinely difficult to verify linearly. Update issue/error ledgers only with verified, uniquely identified, reusable facts that belong to the active task.

## Exit

Continue until all acceptance criteria have decisive evidence, then run `/end`. Keep the task's related changes together for one coherent delivery; no checkpoint or micro-fix commits.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
