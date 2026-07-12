# Workflow: ci-validate
**Command:** /ci-validate
**Description:** Check whether recent `main` deploy failures are real regressions or the known CI flake, before merging more work on top

## Why this exists

`Deploy to Firebase Hosting` runs on `main` frequently show ❌ even when every test that ran actually passed — see `.agent/test_ledger/OPEN_ISSUES.md` ISSUE-1046 (unit-test shard 7/8 recurrently OOMs; the per-command `NODE_OPTIONS` override in `.github/workflows/deploy.yml` is 4096MB, lower than the job-level 6144MB default). Never treat a red run as "safe to ignore" or "definitely broken" without checking which one it is.

## Steps

1. `gh run list --branch main --limit 5` — list recent runs. Ignore anything already `completed / success`.
2. For each `completed / failure` run: `gh run view <run-id> --log-failed > /tmp/ci_log.txt`
3. `grep -n "OUT_OF_MEMORY\|Test Files.*failed\|AssertionError" /tmp/ci_log.txt`
   - Only `ERR_WORKER_OUT_OF_MEMORY` / `Serialized Error` present, no `AssertionError` → this is the known shard flake (ISSUE-1046). Safe to proceed with a merge; do not re-run or "fix" it as part of an unrelated change.
   - A real `AssertionError` or a `Test Files ... failed` count with a named failing test → this is a real regression. Do not merge on top of it. Identify which commit introduced it via `git log`/`git show` on the changed files, fix the actual defect (or the test, if the code change was intentional and the test is stale), verify locally, then re-check CI.
4. If several different shards show `AssertionError`s in the same run, treat it as a real regression even if one shard also shows the OOM flake — the two aren't mutually exclusive.
5. Never mark the workflow `continue-on-error` or skip this check to unblock a merge — that hides real failures along with the flake.
