# /plat — Platinum Finishing Touches

Run this at the very end of any unit of work — after a rebase, after a feature, after a bug fix, after doc updates, after anything — and before you `git push`. It is the last gate between your work and a branch push.

This command codifies the standards in [`docs/PLATINUM_QUALITY_STANDARDS.md`](../../docs/PLATINUM_QUALITY_STANDARDS.md) and cross-references [`.agent/skills/error_memory/ERROR_LEDGER.md`](../../.agent/skills/error_memory/ERROR_LEDGER.md).

---

## When to invoke

- Finishing a feature → run `/plat` before opening the PR.
- Finishing a rebase → run `/plat` to confirm nothing got mangled by the rebase.
- Finishing a bug fix → run `/plat` to confirm the fix doesn't undo a prior fix.
- Finishing a docs update → run `/plat` to confirm no stray build artifacts.
- General cleanup session → run `/plat` as the last action.

Common thread: **the last thing before push**.

---

## Workflow

Execute every phase. Do not skip. Report results at the end.

### Phase 0 — Read the standards

Read these two files in full (not just headings):

1. `docs/PLATINUM_QUALITY_STANDARDS.md` — the Seven Anti-Patterns, pre-commit checklist, pitfall library.
2. `.agent/skills/error_memory/ERROR_LEDGER.md` — dated regressions and their RULEs.

You will apply both during review.

### Phase 1 — State survey

Gather (all read-only):

```bash
git status
git diff --stat HEAD
git diff HEAD --summary
git log --oneline -10
git rev-parse --abbrev-ref HEAD
git log --oneline main..HEAD
```

Note the current branch, the base branch (default `main`), commit count on the branch, and any divergence from origin.

### Phase 2 — Hygiene gate

Confirm zero runtime / build artifacts are staged:

```bash
git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'
```

If this returns anything, for each offender:

1. Un-stage: `git restore --staged <path>` (or `git rm --cached <path>` if already tracked).
2. Add to `.gitignore` if not already present.
3. Continue.

Then confirm exec bits preserved on every shell / python / MJS script touched in the branch:

```bash
for f in $(git diff --name-only main..HEAD | grep -E '\.(sh|py|mjs)$'); do
  git ls-files --stage "$f" | awk '{print $1, $4}'
done
```

Every line must show `100755`. If any shows `100644`, fix with `git update-index --chmod=+x <path>`.

### Phase 3 — Revert-check

For each file in the branch diff, confirm you are not undoing a recent fix:

```bash
for f in $(git diff --name-only main..HEAD); do
  echo "=== $f ==="
  git log --oneline -5 -- "$f"
done
```

For any file whose recent history contains commits with `fix`, `improve`, or a PR number, read the branch's diff on that file carefully. If the diff reverts any of those lines, STOP — either the reversion is intentional and the commit message must say so, or the reversion is accidental and must be undone.

### Phase 4 — Anti-pattern grep

Scan the branch diff for each of the Seven Anti-Patterns from the standards doc:

**4a. Duplicate comment / JSDoc lines.** On every changed `.ts`/`.tsx`/`.js` file, look for adjacent identical comment lines. If any found, dedupe.

**4b. Prompt whitespace bloat.** On any changed file that contains an LLM call (search for `analyzeFileURI`, `generateContent`, `genkit`, `firebaseAI.`, `prompt:` literals), inspect template literals. If you see 8+ spaces of leading indentation inside a backtick block, flag it — either dedent the string or `.replace(/^\s+/gm, '')` before sending.

**4c. Agent-routing typos.** If any file under `agents/*/prompt.md` changed, confirm every spoke name (e.g., "Creative Director", "Brand", "Marketing") matches an actual directory under `agents/`. Run `ls agents/` and cross-check.

**4d. Recovery-code deletion.** `git diff main..HEAD -- '*.tsx' '*.ts' | grep -E '^-.*(reload|retry|fallback|rollback|catch|recover)'`. For each hit, confirm the deletion is justified.

**4e. Speculative TODO comments.** `git diff main..HEAD | grep -E '^\+.*(TODO|Optional:|we could|maybe|should probably)'`. Remove all of them or implement what they describe.

**4f. Mode changes.** `git diff main..HEAD --summary | grep 'mode change'`. Any unexpected mode change (especially `100755` → `100644`) must be reverted.

### Phase 5 — Build & test gate

Run all in order. Stop at the first failure.

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

If any fails, fix it. Do not push a branch that fails any of these.

### Phase 6 — Error ledger cross-reference

Re-read the ledger (Phase 0) with the current branch's diff in mind. For any file the branch touches, grep the ledger for its path or the class of problem. If a matching RULE exists, confirm the branch does not violate it.

If the branch surfaces a genuinely new pattern, add a new entry to the ledger AND to `docs/PLATINUM_QUALITY_STANDARDS.md` under "The Seven Anti-Patterns" (yes, this may grow to eight, nine, etc. — the doc evolves).

### Phase 7 — Final report

Produce a structured report with these sections:

```
## /plat report for branch <name>

### State
- Branch: <name>
- Base: <main|other>
- Commits on branch: <N>
- Files changed: <N>

### Hygiene
- Runtime artifacts staged: <NONE | list with actions taken>
- Exec bits preserved: <YES | list of fixed files>

### Revert-check
- Files whose recent history contains "fix"/PR#: <NONE | list + justification>

### Anti-pattern scan
- Duplicate comments: <NONE | list>
- Prompt whitespace bloat: <NONE | list>
- Agent-routing typos: <NONE | list>
- Recovery-code deletions: <NONE | list + justification>
- Speculative TODOs: <NONE | list>
- Mode changes: <NONE | list>

### Build & test
- typecheck: <PASS | FAIL>
- lint: <PASS | FAIL with count>
- test: <N passed / M failed>
- build: <PASS | FAIL>

### Ledger cross-reference
- Matched rules: <list>
- New patterns: <NONE | description + added to ledger>

### Verdict
- <GO for push | NO-GO: <reason>>
```

### Phase 8 — Push (only on GO verdict)

If and only if Phase 7 reports GO:

```bash
git push origin <branch>
```

If you are expected to open a PR, do so with `gh pr create` and include a link to this `/plat` report in the PR body.

---

## Failure modes to handle explicitly

- **Dirty working tree.** If `git status` shows unstaged / untracked files, STOP. Ask the user whether to include, gitignore, or discard each one. Never guess.
- **Diverged from origin.** If your branch is both ahead and behind its remote, do not auto-resolve. Report the divergence and ask the user how to proceed.
- **Tests fail only in CI, not locally.** This is usually a missing mock for a dynamic import (see ledger Pattern 1 in the "2026-04-14 CI Stabilization Session" entry). Read the ledger section first; do not improvise.
- **Build succeeds but a manual QA is warranted.** For UI changes, state explicitly: *"Build passed but I did not render the UI. Recommend manual verification of X, Y, Z before merging."* Do not claim success you cannot verify.

---

## Scope boundaries

- `/plat` does NOT rewrite code beyond the Seven Anti-Patterns fixes. If a deeper review is needed, use `/review` or `/comprehensive-review`.
- `/plat` does NOT decide whether a feature is correct — it verifies it is clean. Correctness is the author's responsibility.
- `/plat` does NOT merge the PR. It only produces the GO / NO-GO verdict and pushes the branch. Merging is a separate explicit action.

---

## Output voice

- Concise. One sentence per finding.
- No hedging. If something failed, say it failed. If something passed, say it passed.
- No re-narration of what you are about to do. Execute, then report.
- Final verdict line must be exactly `### Verdict: GO` or `### Verdict: NO-GO — <one-line reason>`.
