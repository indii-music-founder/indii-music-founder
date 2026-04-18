# Platinum Quality Standards

> Code-review and diff-discipline standard for every agent and human contributor.

**Version:** 1.1
**Established:** 2026-04-18

Related docs:
- [`PLATINUM_POLISH_REPORT.md`](./PLATINUM_POLISH_REPORT.md)
- [`DATABASE_PLATINUM_PROTOCOL.md`](./DATABASE_PLATINUM_PROTOCOL.md)
- [`TOP_50_PLATINUM_RELEASE.md`](./TOP_50_PLATINUM_RELEASE.md)
- [`.agent/skills/error_memory/ERROR_LEDGER.md`](../.agent/skills/error_memory/ERROR_LEDGER.md) — MANDATORY check before debug.

---

## The Seven Anti-Patterns

Meet all seven: **Platinum**. Miss one: **NO-GO**.

### 1. Silent Reverts
**Rule:** Zero silent reverts of recently-merged fixes.
**Detect:** `git log -p <file> --since="2 weeks ago"`
**Enforce:** Modifying recently fixed lines requires explicit justification in the commit message.

### 2. Dropped Recovery Paths
**Rule:** Zero silent capability drops (e.g., removing `try/catch`, `reload()`, or fallbacks).
**Detect:** Diffs that shrink error-handling blocks.
**Enforce:** Never delete a valid recovery path. If truly dead code, prove it in the commit. `// TODO: add recovery` is a failure.

### 3. Routing Black Holes
**Rule:** Zero agent-routing typos or silent route deletions (`agents/*/prompt.md`).
**Detect:** Any diff under `agents/*/prompt.md`.
**Enforce:** Cross-reference spoke names against `ls agents/`. Case matters.

### 4. Copy-Paste Residue
**Rule:** Zero duplicate comment or JSDoc blocks.
**Detect:** `grep -n "^[[:space:]]*//" <file>` for adjacent identical lines.
**Enforce:** Read the final file top-to-bottom after refactoring, not just the diff.

### 5. Prompt Whitespace Bloat
**Rule:** Zero whitespace-bloat in LLM prompts.
**Detect:** `                 <text>` in template literals sent to LLMs.
**Enforce:** `.replace(/^\s+/gm, '')` before sending, or manually align.

### 6. Lost Exec Bits
**Rule:** Zero file-mode regressions.
**Detect:** `git diff HEAD --summary`
**Enforce:** Scripts (`.sh`, `.py`, `.mjs`) must retain `100755`. Force with `git update-index --chmod=+x <path>`.

### 7. Staged Runtime Junk
**Rule:** Zero runtime artifacts committed to version control.
**Detect:** `git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'`
**Enforce:** Add to `.gitignore` before committing.

---

## Pre-commit Checklist

Run this exact block before every `git commit`. If ANY step fails, fix it immediately.

```bash
# 1. State & Exec bits
git status
git diff HEAD --summary

# 2. Artifact Gate (Must return empty)
git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'

# 3. Script Exec Gate (Must show 100755)
for f in $(git diff --cached --name-only | grep -E '\.(sh|py|mjs)$'); do git ls-files --stage "$f" | awk '{print $1, $4}'; done

# 4. Revert Gate (Check last 5 commits for "fix"/PR#)
for f in $(git diff --cached --name-only); do echo "=== $f ==="; git log --oneline -5 -- "$f"; done

# 5. Build Gate (Must pass)
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

*(Note: The `/plat` command automates this. See `.claude/commands/plat.md`)*

---

## Pitfall Library (Pragmatic Rules)

- **Regex:** Prefer `(?:foo)?` (optional literal) over `foo?` (optional last char).
- **Stale Chunks:** `window.location.reload()` is the ONLY valid recovery for dynamic import failures.
- **Vitest:** `vi.stubGlobal('crypto', undefined)` leaves the property existing. `Reflect.deleteProperty(globalThis, 'crypto')` removes it entirely. Know the difference.
- **Git Chmod:** Use `git update-index --chmod=+x` to force exec bits on cross-platform setups.

---

## Enforcement

All agents (Claude, Gemini, Droid, Jules, Codex) are bound by this document.
**Violations:** Fix at the root. If novel, append to `ERROR_LEDGER.md` AND this document.
