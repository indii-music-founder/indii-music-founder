---
name: health-check
description: Focused preventative pattern health check for comparing the hidden-bug detector before and after a bounded change. Use for a quick baseline, regression delta, or “did this patch make known patterns worse?” question. Do not use for a repository-wide ship-readiness audit (use health-audit), and do not block unrelated work solely because the pre-existing absolute score is high.
---

# Health Check

Measure the repository's known heuristic bug patterns without treating heuristic counts as confirmed defects.

## Contract

- Default authority is read-only.
- The active task's baseline is the comparison point.
- A detector hit is a lead, not proof that the matching line is wrong.
- Do not write permanent ledgers, fix unrelated findings, commit, or push unless the user separately authorizes that scope.

## Workflow

1. Record `HEAD`, the bounded file set, and whether this is a baseline or post-change run.
2. Run:

   ```bash
   npm run detect:bugs
   ```

3. Preserve the command exit code and category counts. The script may use a nonzero exit to communicate risk; distinguish that policy result from a crash.
4. On a post-change run, compare category deltas to the recorded baseline.
5. Attribute increases to changed lines before claiming the task introduced them.
6. For a new high-severity candidate, reproduce it or route to `diagnose`. For a broad requested sweep, route to `hunter`.

## Decision rule

| Result | Meaning | Action |
| --- | --- | --- |
| No task-attributable increase | Known heuristic risk did not worsen | Continue with task-specific verification. |
| Increase explained by safe code/test fixture | Detector false positive or expected signal | Document locally; improve the detector only if in scope. |
| Confirmed task-attributable regression | The change introduced a real defect pattern | Fix the cause and rerun. |
| High pre-existing score | Repository has historical heuristic debt | Report separately; do not hijack a bounded task. |

## Report

```text
HEALTH CHECK: BASELINE | DELTA
HEAD / FILE SCOPE: <sha and files>
COMMAND / EXIT: <command and code>
CATEGORY COUNTS: <counts>
TASK-ATTRIBUTABLE DELTA: <delta>
CONFIRMED DEFECTS: <none or evidence>
VERDICT: STABLE | REGRESSION | PARTIAL
```
