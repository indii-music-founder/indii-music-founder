# Workflow: ci-validate
**Command:** /ci-validate
**Description:** Check whether recent `main` / branch CI failures are real regressions or the known CI flake, before merging more work on top

## Why this exists

Two separate GitHub Actions workflows run per push/PR: `Build and Test` (PR-triggered, includes lint/typecheck/unit) and `Deploy to Firebase Hosting` (push-to-main + manual `workflow_dispatch`, includes its own sharded unit-test job before deploying). They can disagree — a PR's `Build and Test` can go ✅ while the same commit's `Deploy to Firebase Hosting` run goes ❌, because the deploy workflow's unit-test job uses a different shard/memory config. Check both, don't assume one covers the other.

`Deploy to Firebase Hosting` runs used to frequently show ❌ even when every test that ran actually passed — see `.agent/test_ledger/OPEN_ISSUES_V2.md` ISSUE-1046, now **✅ FIXED (2026-07-13)**. Root cause was `vitest.config.ts`'s `pool: 'threads'` not reclaiming memory across files in a long run, plus a genuine infinite-loop bug in an `AlwaysOnMemoryEngine.clearAll()` test mock. Fixed by switching to `pool: 'forks'` and fixing that mock, plus 6 other real test bugs the old config had been masking (`SidebarNavigation.test.tsx`, `TheAnarchist.test.tsx`, `TheDirector.test.tsx`, `OnboardingPage.test.tsx`, `DirectGenerationTab.test.tsx`, `KnowledgeChat.test.tsx`, `RouterContext.test.tsx`). Verified: local suite green twice in a row, and a live CI run on `main` (run `29261554934`) went fully green — all 10 unit-test shards, build, staging deploy, e2e smoke, and production deploy all passed. See the ledger entry for the full root-cause writeup.

If a `Deploy to Firebase Hosting` run shows ❌ again, it is no longer safe to assume it's this known flake — treat it as a real regression until proven otherwise (see Steps below).

## Steps

1. `gh run list --limit 15` — list recent runs across all branches (not just `--branch main`; a branch's own `Build and Test` run matters just as much). Ignore anything already `completed / success`.
2. For each `completed / failure` run: `gh run view <run-id> --log-failed > /tmp/ci_log.txt`
3. `grep -n "OUT_OF_MEMORY\|Test Files.*failed\|AssertionError\|Tests.*failed" /tmp/ci_log.txt`
   - `ERR_WORKER_OUT_OF_MEMORY` / `Serialized Error` now that ISSUE-1046 is fixed → do NOT treat this as the known flake anymore. It's a fresh regression (possibly a new infinite loop or a genuinely huge allocation in a new test file, per the same failure class as the original root cause). Bisect it the same way ISSUE-1046 was diagnosed rather than re-tuning shard/heap config.
   - A real `AssertionError`, a `TypeError`/thrown error inside a test file, or a `Test Files ... failed` count with a named failing test → this is a real regression. Do not merge on top of it. Identify which commit introduced it via `git log`/`git show` on the changed files, fix the actual defect (or the test, if the code change was intentional and the test is stale), verify locally, then re-check CI.
4. Never mark the workflow `continue-on-error` or skip this check to unblock a merge — that hides real failures.
