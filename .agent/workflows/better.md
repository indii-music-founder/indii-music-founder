---
description: Bounded improvement pass for an existing artifact. Finds and applies material quality gains inside the active scope without changing the acceptance contract, expanding authority, or creating independent commits.
---

# /better — Elevation Pass

Use after an artifact works or when the user explicitly asks to improve it. `/better` does not authorize a new feature, repository-wide cleanup, external publishing, or delivery.

## 1. Lock the target

State:

- exact artifact/files and active objective;
- current acceptance contract and proof already obtained;
- improvement dimensions relevant to this target;
- exclusions and unrelated dirty files;
- mode: **AUDIT** for findings only, or **ELEVATE** when bounded changes are requested.

When invoked by `/go` or `/end`, inherit that parent unit's file scope. Do not search the whole repository for extra work.

## 2. Inspect from relevant angles

Choose only applicable dimensions:

- correctness and failure/recovery states;
- security, ownership, privacy, and input boundaries;
- accessibility and responsive interaction;
- performance and resource lifetime;
- clarity, maintainability, and duplication;
- test quality and contract coverage;
- documentation truth and terminology;
- state/sequence/architecture coherence.

Look for a material gap, not a cosmetic excuse to churn code. A pre-existing issue outside the target is reported separately and left untouched.

## 3. Improve safely

For each proposed change:

1. Explain the user/system value and possible regression.
2. Confirm it remains inside the target and existing authority.
3. Apply the smallest complete change.
4. Preserve public contracts unless the active task explicitly changes them.
5. Add or update evidence when behavior changes.
6. Stop after two failed attempts with the same mechanism and reconsider the design.

Do not stage, commit, push, publish, deploy, edit secrets, rewrite ledgers, or invoke broad fix sweeps independently.

## 4. Verify proportionally

- Documentation: re-read structure, validate links/paths, inspect focused diff.
- Logic: targeted tests and relevant typecheck/lint.
- Shared contracts: dependent tests, build, and integration checks.
- UI: approved available browser capability and honest DOM/screenshot evidence when the real state is reachable.
- Live/production: `.agent/REAL_USER_AUTHENTICITY.md` and genuine credentials/real path.

Any edit invalidates earlier evidence it could affect.

## 5. Output

```text
TARGET / MODE: <artifact> / <AUDIT|ELEVATE>
MATERIAL GAPS: <findings>
CHANGES: <bounded files and mechanisms>
EVIDENCE: <commands/observable proof>
OUT-OF-SCOPE: <untouched findings>
VERDICT: IMPROVED | NO MATERIAL CHANGE | PARTIAL | BLOCKED
```

Return changed files to the parent workflow's coherent delivery. `/better` never creates its own commit.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
