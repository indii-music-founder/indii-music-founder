# Platinum Quality Standards

> Code-review and diff-discipline standard for every agent (Claude, Gemini, Droid, Jules, Codex) and every human contributor.

**Version:** 1.0
**Established:** 2026-04-18
**Source incident:** Branch `claude/stupefied-faraday-aa0be2` review — seven categories of regression in a single branch.

Related docs:

- [`PLATINUM_POLISH_REPORT.md`](./PLATINUM_POLISH_REPORT.md) — retrospective codebase audit (type safety, log hygiene, error handling).
- [`DATABASE_PLATINUM_PROTOCOL.md`](./DATABASE_PLATINUM_PROTOCOL.md) — database-layer platinum protocol.
- [`TOP_50_PLATINUM_RELEASE.md`](./TOP_50_PLATINUM_RELEASE.md) — release-readiness checklist.
- [`.agent/skills/error_memory/ERROR_LEDGER.md`](../.agent/skills/error_memory/ERROR_LEDGER.md) — living log of past regressions (MANDATORY check before any debug).

---

## Purpose

"Platinum" at the diff / review level means:

1. **Zero silent reverts of recently-merged fixes.**
2. **Zero silent capability drops** (removed routes, removed tools, removed recovery paths, removed progress callbacks) without an explicit commit-message explanation.
3. **Zero runtime artifacts** (`.lock`, `.tsbuildinfo`, auto-generated state) committed to version control.
4. **Zero speculative TODO comments** left behind (`// Optional: do X someday`).
5. **Zero whitespace-bloat** in prompts, templates, or strings that travel to an LLM.
6. **Zero duplicate comment / JSDoc blocks** from copy-paste accidents.
7. **Zero file-mode regressions** (exec bit lost on shell scripts).

Meet all seven and the branch is platinum. Miss one and it is not, regardless of how clean the rest looks.

---

## The Seven Anti-Patterns

Each has a **detect** rule (how to catch it) and a **prevent** rule (what to do before editing).

### 1. Reverting a recently-merged fix

**Example:** Branch replaced `/^\`\`\`(?:json)?\s*\n?/i` with `/^\`\`\`json?\n?/i` — `json?` means "jso + optional n", not optional "json". Undid PR #1497, commit `228d47875`, which shipped two commits earlier.

**Detect:** `git log -p <file> --since="2 weeks ago"` — if a recent commit subject contains `fix`, `improve`, or a PR number, read the diff before editing those lines.

**Prevent:** Before rewriting any parser, regex, schema, or error-handler, confirm you are not about to undo a recently-merged fix. If you are, your commit message must explain why.

### 2. Removing recovery code without a replacement

**Example:** Branch removed the `"Failed to fetch dynamically imported module"` → `window.location.reload()` branch in `ModuleErrorBoundary.tsx` and replaced it with a plain state reset. Result: stale-chunk errors after deploy would re-fire the same failing import forever.

**Detect:** Any diff that shrinks an `if/else`, `try/catch`, or `switch` block in error-handling code. Any deletion of `reload()`, `retry()`, `rollback()`, `fallback()`, or similar.

**Prevent:** If the path you are deleting handles a real failure mode, do not delete it. If you believe it is dead, prove it with a grep and explain why in the commit. `// Optional: Force reload or specialized recovery` is NOT a replacement — it is an admission.

### 3. Agent-routing typos or silent route deletions in `agents/*/prompt.md`

**Example:** `Creative Director` → `director` (lowercase, no such agent). Plus a silent deletion of the `Analytics` route.

**Detect:** Any diff on a file under `agents/*/prompt.md`. Capitalization matters — agent names resolve case-sensitively to directory names under `agents/`.

**Prevent:** When touching a hub prompt, `ls agents/` to confirm every name you write matches an actual directory. Any route you delete must be paired with either (a) an explanation of why the spoke was retired or (b) proof the spoke no longer exists (`ls agents/<spoke>` returns empty).

### 4. Duplicate comment / JSDoc blocks (copy-paste residue)

**Example:** `GeminiFileService.ts` had the same three-line comment block twice consecutively (the first copy had a trailing space, the second didn't — classic merge copy-paste artifact). Same file had `* Polls the file until its state is ACTIVE.` twice in a JSDoc.

**Detect:** `grep -n "^[[:space:]]*//" <file>` or `grep -n "^[[:space:]]*\*" <file>` — scan for adjacent identical lines. A diff viewer collapsing matching lines sometimes hides these.

**Prevent:** After any refactor that moves code blocks, read the final file top-to-bottom (not just the diff) before committing.

### 5. Prompt template whitespace bloat

**Example:** `AudioAnalysisService.ts` reformatted a prompt from clean inline text to a template literal with ~16 spaces of leading whitespace on every line plus leading / trailing blank lines. Those spaces travel to Gemini as literal prompt tokens.

**Detect:** Any diff on a string that ends up in an LLM call. If the diff shows +N lines of `                 <text>`, that indentation is in the prompt.

**Prevent:** For any template-literal prompt, either (a) strip leading whitespace with `.replace(/^\s+/gm, '')` before sending, or (b) hand-align the string so its indentation reads correctly to a human AND is intentional in the prompt. Prefer the first for long prompts, the second for short ones.

### 6. Losing file mode bits (exec bit on shell scripts)

**Example:** `.claude/scripts/checkpoint.sh` mode changed from `100755` to `100644`. Scripts invoked by hooks / cron / git aliases now fail with `Permission denied`, silently.

**Detect:** `git diff --stat` does not show mode changes. Use `git diff --summary` or `git show --stat --summary HEAD` to see mode lines. Also `git log --diff-filter=M --name-only` won't help — use `git log --raw`.

**Prevent:** For any `.sh`, `.py`, `.mjs` CLI script, or any file with a shebang, confirm mode `100755` after editing: `git ls-files --stage <path>`. On filesystems that don't preserve exec bit (exFAT, NTFS, some SSDs), `chmod +x` may not stick — use `git update-index --chmod=+x <path>` to force it.

### 7. Staging runtime lock / state files

**Example:** Branch staged `.claude/scheduled_tasks.lock` (runtime lock from a scheduled task) and `packages/renderer/tsconfig.tsbuildinfo` (build cache artifact).

**Detect:** `git status` before commit. Anything ending in `.lock`, `.tsbuildinfo`, `.log`, `.cache`, `.DS_Store`, or containing `HANDOFF` / `CHECKPOINT` in the filename is suspect.

**Prevent:** Add the path to `.gitignore` BEFORE committing the file. If it is already staged, `git rm --cached <path>` then commit the `.gitignore` update and the removal together. Never `git add .` or `git add -A` blindly — always name files.

---

## Pre-commit checklist

Run these before every `git commit`. Copy-paste the block. If any step fails, fix it before committing — do not commit first and fix later.

```bash
# 1. Inspect what is about to commit
git status
git diff --stat HEAD
git diff HEAD --summary  # shows mode changes

# 2. Confirm no runtime / build artifacts staged
git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'
# ^ Must return nothing. If it does, un-stage and gitignore.

# 3. Confirm exec bit preserved on every shell / python script
for f in $(git diff --cached --name-only | grep -E '\.(sh|py|mjs)$'); do
  git ls-files --stage "$f" | awk '{print $1, $4}'
done
# ^ Must show 100755 for every scripts file.

# 4. Confirm you are not reverting a recent fix
for f in $(git diff --cached --name-only); do
  echo "=== $f ==="
  git log --oneline -5 -- "$f"
done
# ^ Read each file's last 5 commits. If any subject contains "fix" / PR #,
#   and your diff touches those lines, STOP and justify in commit message.

# 5. Lint / typecheck / test
npm run typecheck
npm run lint
npm test -- --run

# 6. Build (mirrors CI)
npm run build
```

The `/plat` slash command (`.claude/commands/plat.md`) runs this entire checklist and reports go/no-go.

---

## Pitfall library

Specific traps from real regressions, with correct answers.

### Regex

| Pattern | Means | Use when |
|---------|-------|----------|
| `json?` | "jso" + optional "n" | Almost never — this is usually wrong |
| `(?:json)?` | Whole word "json", optional | Matching optional literal word |
| `\s*\n?` | Any whitespace + optional newline | Tolerating trailing whitespace before line break |

**Always prefer `(?:foo)?` over `foo?` when you mean "optional literal foo".**

### React.lazy recovery

- `window.location.reload()` — hard reload, re-fetches `index.html`, re-reads current chunk manifest. **Only this works for stale-chunk errors.**
- `router.refresh()` / `navigate(0)` — soft reload, re-mounts routes, does NOT re-fetch `index.html`. Does not fix stale chunks.
- `this.setState({ hasError: false })` — plain retry, re-runs the same failing lazy import. Causes infinite loop on stale chunks.

### Vitest global stubbing

- `vi.stubGlobal('crypto', undefined)` — sets `globalThis.crypto = undefined`. Property exists, value is `undefined`.
- `Reflect.deleteProperty(globalThis, 'crypto')` — removes the property entirely. `'crypto' in globalThis` is now `false`.

**These are different branches in SUT logic.** If your code does `if ('crypto' in globalThis)`, `stubGlobal` does not cover the missing-property case.

### Shell HEREDOC

Whitespace is preserved literally. Indenting a HEREDOC body with `cat <<EOF` (not `cat <<-EOF`) keeps the leading spaces in the output. Use `<<-EOF` with tab indentation if you need to indent.

### `git update-index --chmod`

`chmod +x file` + `git add file` does NOT always record the mode change, especially on filesystems that don't preserve exec bit. `git update-index --chmod=+x <file>` forces the record in git's tree regardless of the filesystem.

---

## Cross-agent enforcement

Every agent instruction file (`CLAUDE.md`, `GEMINI.md`, `DROID.md`, `JULES.md`, `CODEX.md`) contains a pointer to this document under "Operating Principles §6 — Platinum Quality Standards". All five files are mirrored, so this standard is the same across every agent.

If you are an agent reading this: you are responsible for the pre-commit checklist. Violations are treated the same as Error Ledger violations — fix the root cause, and if you hit a novel variant, add a new entry to both the ledger and the anti-pattern list in this document.

---

## Revision policy

- Each new regression pattern caught by review gets appended as an anti-pattern entry here and as a ledger entry.
- Existing entries are not removed even if the class of bug stops happening — history is useful.
- Revisions bump the version at the top and append a dated note at the bottom.

### Revision history

- **1.0 (2026-04-18):** Initial version. Seven anti-patterns from `claude/stupefied-faraday-aa0be2` review.
