---
description: Observational repository delivery gate. Validates the coherent task scope, runs proportional local checks and the unified CI gauntlet, then binds remote acceptance to the exact pushed SHA. It never performs speculative fixes, rewrites secrets, or creates validation commits.
---

# /ci-validate — Delivery Proof Gate

`/ci-validate` is strict because it is a validator. Its first pass is reproducible and non-mutating. Failures return to `/middle`; repairs address only logged in-scope causes and invalidate the checks they affect.

## 0. Preconditions

Read [`branch-safety.md`](branch-safety.md), then record:

```bash
git fetch origin
test "$(git branch --show-current)" = "main"
git rev-list --left-right --count origin/main...HEAD
git status --short
git log origin/main..HEAD --oneline
```

Require:

- current `main` and zero commits behind `origin/main`;
- at most one coherent unpublished task commit;
- a worktree that is clean for this objective;
- unrelated dirty files listed and excluded;
- no unresolved conflict markers;
- the exact tree/SHA being validated identified.

Do not branch, rebase, squash, stash, stage, commit, or push during the local validation phase.

## 1. Policy and artifact integrity

Run:

```bash
git diff --check
npm run validate:capabilities
node scripts/validate-flowcharts.js
node scripts/verify-api-system-integrity.js
```

Use the checks relevant to the changed files. A generated catalog must be current before `/skill-skill` or capability-policy changes can pass.

## 2. Proportional verification matrix

| Change | Required local evidence |
| --- | --- |
| Markdown/instructions | Source re-read, link/path check, focused diff, capability/policy validator when normative rules changed. |
| Localized code logic | Targeted tests plus relevant typecheck/lint. |
| Shared schema/API/state | Targeted tests, dependent typecheck, build/integration checks. |
| Dependency/lock/runtime | Manifest-lock integrity, dependency drift, relevant build/tests, security/runtime review. |
| UI | Structural tests plus approved available browser evidence when the real state is reachable. |
| Live/production claim | Genuine credentials and real path under `.agent/REAL_USER_AUTHENTICITY.md`. |
| Repository delivery | All relevant checks plus the unified `npm run ci` gauntlet. |

For a repository delivery, run at minimum:

```bash
npm run typecheck
npm run lint
npm run ci
```

Add affected builds and integration suites when public contracts, packaging, runtime boundaries, or cross-workspace behavior changed. Record intentional skips and their reasons.

## 3. Failure behavior

On any failure:

1. preserve the command, exit code, and first decisive root-cause output;
2. stop the validation verdict;
3. return to `/middle` or `diagnose` for a bounded repair;
4. do not invoke broad `/auto-fix` or legacy `/hunter` sweeps automatically;
5. do not change unrelated files, create extra commits, weaken tests, or guess at the cause;
6. rerun every check invalidated by the repair.

Known exceptions are evidence, not folklore. An ignored flake or warning needs a signature, owner, reproducer, last-confirmed date, and expiry. Similar-looking historical output does not excuse a current failed job.

## 4. Credential and secret boundary

- Use `gh auth status` to inspect GitHub authentication.
- Missing or expired authorization requires the official `gh auth login` flow.
- Never read a PAT from `.env`, export tokens through shell construction, switch accounts, infer a secret value, or overwrite repository secrets during validation.
- A secret change requires an explicit target, trusted source value, and separate user authority.

## 5. Local verdict and delivery handoff

When local checks pass, emit a local verdict. `/end` owns explicit staging, full staged-diff review, the one coherent commit, and `git push origin HEAD:main`.

Any edit after the local verdict invalidates the affected verdict and requires rerun.

## 6. Exact-SHA remote proof

After the parent workflow pushes:

1. record `git rev-parse HEAD`;
2. locate the GitHub Actions run whose `headSha` exactly matches it;
3. wait for the final conclusion;
4. inspect actual logs/annotations for failed jobs;
5. return logged root causes to `/middle` and repeat the bounded delivery cycle;
6. require the successor exact SHA to be green.

Do not substitute an older green run, local tests, or a deployment URL for exact-SHA CI.

## Evidence manifest

Return this in the task report or CI job summary without modifying the validated tree:

```json
{
  "sha": "<validated sha or tree>",
  "treeState": "<clean|clean-for-objective>",
  "commands": [{"command":"<cmd>","exitCode":0,"summary":"<counts/result>"}],
  "skipped": [{"check":"<name>","reason":"<reason>"}],
  "remoteCiUrl": "<url-or-null>",
  "remoteConclusion": "<success|failure|not-pushed>",
  "verdict": "PASS|FAIL|PARTIAL"
}
```

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
