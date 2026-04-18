# /plat — Platinum Finishing Touches

Run this **immediately before `git push`**. It enforces `PLATINUM_QUALITY_STANDARDS.md` and `ERROR_LEDGER.md`.

---

## Workflow (Strict Execution)

Do not skip any phase. Execute, then report.

### Phase 1: Context & State
Read `PLATINUM_QUALITY_STANDARDS.md` and `ERROR_LEDGER.md`.
Gather state:
```bash
git status && git diff --stat HEAD && git diff HEAD --summary && git log --oneline main..HEAD
```

### Phase 2: Hygiene Gate
1. **Artifacts:** `git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'`
   - *Fix:* Un-stage and `.gitignore`.
2. **Exec Bits:** `for f in $(git diff --name-only main..HEAD | grep -E '\.(sh|py|mjs)$'); do git ls-files --stage "$f"; done`
   - *Fix:* `git update-index --chmod=+x <path>` if not `100755`.

### Phase 3: Revert Gate
Check recent history of changed files:
```bash
for f in $(git diff --name-only main..HEAD); do echo "=== $f ==="; git log --oneline -5 -- "$f"; done
```
- *Fix:* If you revert lines from a recent `fix` or PR, STOP. Justify in the commit or undo the revert.

### Phase 4: Anti-Pattern Scan
Check the branch diff against the Seven Anti-Patterns:
1. **Duplicate Comments:** Scan `.ts`/`.tsx` for adjacent identical lines.
2. **Prompt Bloat:** Check LLM template literals for excessive indentation.
3. **Routing Typos:** Cross-check `agents/*/prompt.md` changes against `ls agents/`.
4. **Recovery Deletion:** Justify any removed `try/catch`, `reload()`, or `fallback`.
5. **Speculative TODOs:** Remove or implement `+ // TODO` additions.

### Phase 5: Build Gate
Run sequentially. Stop on first failure.
```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

### Phase 6: Ledger Cross-Reference
Check changed files against `ERROR_LEDGER.md`. Ensure no known rules are violated. If a new regression pattern was solved in this branch, add it to the Ledger.

### Phase 7: The Enforcement Loop (GO / NO-GO)
Generate the final report (see format below).
- **If GO:** Push the branch (`git push origin <branch>`).
- **If NO-GO:** YOU MUST HALT. Do not push. Do not apologize. Immediately fix the root cause, commit the fix, and restart `/plat` from Phase 1.

---

## Final Report Format

```
## /plat report for branch <branch_name>
**State:** <Commits> commits, <Files> files changed. Divergence: <None | Details>
**Hygiene:** <PASS | Fixed X artifacts/exec bits>
**Reverts:** <PASS | Justified X intentional reverts>
**Anti-Patterns:** <PASS | Fixed X duplicate comments/whitespace/routing typos>
**Build Gate:** typecheck: <PASS|FAIL> | lint: <PASS|FAIL> | test: <PASS|FAIL> | build: <PASS|FAIL>
**Ledger:** <PASS | Violated X (FIXED) | Added new pattern>

### Verdict
<GO | NO-GO: reason>
```
