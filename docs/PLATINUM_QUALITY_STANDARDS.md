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

## The Thirteen Anti-Patterns

Meet all thirteen: **Platinum**. Miss one: **NO-GO**.

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

### 7. Test Quality & Assertion Safety
**Rule:** Zero commented-out assertions or strict-mode selector workarounds (e.g. `.first()`, `.last()`, `.nth()`) without comment-based justifications (`// bypass-strict`).
**Detect:** `node scripts/check-test-quality.js`
**Enforce:** Fix the selector root cause (e.g. resolve duplicates in markup) rather than silencing the linter or Playwright locator.

### 8. Staged Runtime Junk
**Rule:** Zero runtime artifacts committed to version control.
**Detect:** `git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'`
**Enforce:** Add to `.gitignore` before committing.

### 9. Hardcoded Infrastructure Identifiers (Frontend)
**Rule:** Zero hardcoded infrastructure identifiers in frontend/source code — Vertex endpoint IDs, deployed-model IDs, GCP project numbers, regions/locations, fine-tuned tuning-job IDs, bucket names, or any value that is minted/rotated by infra and is not stable across deploys or re-training. These belong in config/env/runtime discovery, never inline in `packages/renderer/`.
**Why:** Infra-minted IDs go stale silently. Re-tuning agents mints NEW Vertex endpoint IDs (and can change the location), so any hardcoded registry points at dead endpoints the moment a re-train ships — the app keeps compiling and "looks fine" while every agent 404s or silently falls back to a base model. (See ERROR_LEDGER 2026-06-21 "Stale Hardcoded Fine-Tuned Endpoint Registry".)
**Detect:** `grep -rnE "endpoints/[0-9]{6,}|locations/(us|us-central1|global)/|projects/[0-9]{6,}" packages/renderer/src` — any match outside a test fixture is a violation.
**Enforce:** Source infra IDs from a single config surface regenerated from live infra (e.g. a generated file written by a `gcloud ai endpoints list` / tuningJobs sync script, or runtime resolution), not hand-typed into a `.ts` registry. If a value MUST be checked in, it lives in one clearly-marked generated file with the sync command in its header — never scattered across frontend modules. Hardcoded identifier IDs in `packages/renderer/` fail review.

### 10. Tautological & Potemkin Tests ("Fake-Green Assertions")
**Rule:** Zero `expect(true).toBe(true)`, `expect(1).toBe(1)`, or assertions conditionally bypassed (`if (visible) expect...`) that yield false-positive passes without asserting real functional state.
**Why:** Placeholder assertions create ghost test coverage that passes in CI while features are broken or unrendered. Violates the Real-User Authenticity Standard.
**Detect:** `node scripts/check-test-quality.js`
**Enforce:** Assert actual DOM elements, data mutations, or error handling paths. If an end-to-end user path cannot run in CI/emulator, mark it explicitly with `test.skip('Requires live environment')` rather than checking `expect(true).toBe(true)`.

### 11. Call-Order FIFO Mocking ("Order-Dependent Mock Queues")
**Rule:** Zero multi-endpoint mocks keyed purely by global invocation order (`mockResolvedValueOnce().mockResolvedValueOnce()` chains on `httpsCallable`, `fetch`, or IPC).
**Why:** A call-order FIFO queue desynchronizes the moment a poll loop, retry, or component re-render shifts the call sequence, silently serving the wrong response to the wrong endpoint. (See ERROR_LEDGER 2026-08-06).
**Detect:** Audit test files for consecutive `mockResolvedValueOnce` calls on functions taking endpoint names or URLs.
**Enforce:** Branch on the endpoint name or URL parameter inside `mockImplementation((_functions, name) => ...)` so every endpoint deterministically receives its own response regardless of call ordering.

### 12. Banned Model Policy Drift
**Rule:** Zero hardcoded banned model strings (`gemini-1.5-*`, `gemini-2.0-*`, `gemini-pro`).
**Why:** Violations cause immediate runtime crashes via model validation and breach core architecture policy.
**Detect:** `node scripts/check-test-quality.js`
**Enforce:** All AI model references **must** import `AI_MODELS` from `@/core/config/ai-models`.

### 13. Dangling Async & Swallowed Queue Failures
**Rule:** Zero unawaited client mutations before user success feedback; zero swallowed top-level failures in Cloud Scheduler or background workers without persisting durable terminal failure state.
**Why:** Swallowed worker errors cause ghost jobs where UI displays "Pending" or "Success" while backend tasks are permanently dead. (See ERROR_LEDGER 2026-08-09).
**Detect:** Static analysis via `bash scripts/detect-hidden-bugs.sh`.
**Enforce:** Await all durable mutations before toasting success. Scheduled background functions must rethrow unrecoverable errors to Cloud Scheduler and record failure state in durable storage.

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

# 5. Test Quality & Anti-Pattern Scan (Must pass)
node scripts/check-test-quality.js

# 6. Build Gate (Must pass)
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

*(Note: The `/plat` command automates this. See `.claude/commands/plat.md`)*

---

## Pitfall Library (Pragmatic Rules)

- **Terminology & IP Protection (CRITICAL):** Never refer to the central orchestrator as "Agent Zero" or "AgentZero". It is 100% proprietary IP owned by New Detroit Music LLC, officially branded as the **indii Conductor** (or **Conductor**). Block any external/competitor framework terminology from prompt generation, comments, and documentation.
- **Regex:** Prefer `(?:foo)?` (optional literal) over `foo?` (optional last char).
- **Stale Chunks:** `window.location.reload()` is the ONLY valid recovery for dynamic import failures.
- **Vitest:** `vi.stubGlobal('crypto', undefined)` leaves the property existing. `Reflect.deleteProperty(globalThis, 'crypto')` removes it entirely. Know the difference.
- **Git Chmod:** Use `git update-index --chmod=+x` to force exec bits on cross-platform setups.
- **No Hardcoded Infra IDs (Frontend):** Vertex endpoint IDs, model IDs, project numbers, regions, and tuning-job IDs are infra-minted and rotate on every re-train/redeploy. Never hand-type them into `packages/renderer/`. They go in one generated/synced config surface or are resolved at runtime. A re-tune that changes endpoint IDs or location must NOT require editing scattered frontend `.ts` files. (See Anti-Pattern #9.)
- **`packages/firebase` Typecheck Coverage Gap:** Neither root `tsc --noEmit` (root `tsconfig.json` has `include: []`, project-references only) nor `npm run typecheck` (`tsc -b packages/shared packages/main packages/renderer` — note the omission) ever checks `packages/firebase`. Both report "clean" unconditionally for that package regardless of real errors. The actual gate is `cd packages/firebase && npm run build` (plain `tsc`, `strict: true`). Never cite root typecheck as evidence for a Cloud Functions change. (See ERROR_LEDGER 2026-07-21.)
- **Cloud Functions SSE/Streaming Endpoints:** Must be Gen2 (`firebase-functions/v2/https`) — Gen1 hard-kills any connection at its execution ceiling (60s default/540s max) regardless of `timeoutSeconds`, which breaks anything meant to stay open (SSE, long-poll). Gen1→Gen2 is not an in-place upgrade (`firebase deploy` rejects it) — run `firebase functions:delete <name> --region=<region>` first. Also required for any such endpoint: `app.set('trust proxy', true)` (Cloud Functions/Cloud Run terminates TLS upstream; `req.protocol` reports `http` without this), and reconstructing any client-facing callback URL from the `Host` header rather than `req.originalUrl`/`req.baseUrl` (the function-name path segment is stripped before Express sees the request). (See ERROR_LEDGER 2026-07-21.)

---

## Enforcement

All agents (Claude, Gemini, Droid, Jules, Codex) are bound by this document.
**Violations:** Fix at the root. If novel, append to `ERROR_LEDGER.md` AND this document.

---

## The Ponytail Protocol (Lazy, Not Negligent)

**Established:** 2026-06-20 (Enforced for all agents)

**Rule:** Before writing or accepting any code, stop at the first rung that holds:
1. Does this need to exist? → no: skip it (YAGNI)
2. Stdlib does it? → use it
3. Native platform feature? → use it
4. Installed dependency? → use it
5. One line? → one line
6. Only then: the minimum that works

*Lazy, not negligent: trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block.*

---

## The Challenger Protocol

**Established:** 2026-05-29 (Enforced for all agents)

**Rule:** "Done" is never accepted at face value.
Whenever an agent (including yourself) or a human declares a task "done" or a repository "ready", you MUST immediately adopt the **Challenger Persona**.
1. **Scrutinize:** Do not just run tests; verify what the tests actually cover.
2. **Poke Holes:** Look for masked failures, mocked APIs that don't match reality, or incomplete edge cases.
3. **Reject:** Actively look for a reason to reject the "done" state. We stop at bulletproof, not done.
