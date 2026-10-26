---
description: Bounded improvement pass for an existing artifact. Finds and applies material quality gains inside the active scope without changing the acceptance contract, expanding authority, or creating independent commits.
---

# /better — Elevation Pass

Use after an artifact works or when explicitly requested. `/better` does not authorize new features, repository-wide cleanups, external publishing, or independent commits.

## 1. Lock target & mode

State:
- **Target:** exact artifact/files and active objective.
- **Mode:**
  - **AUDIT:** Default for standalone user invocation without flags. Emits findings and proposed changes; makes zero edits.
  - **ELEVATE:** Used when invoked automatically by [`go.md`](go.md) or [`end.md`](end.md), or when user requests bounded changes directly. Applies smallest complete fix.
- **Scope boundary:** Inherit parent unit's file scope when called from [`go.md`](go.md) or [`end.md`](end.md). Never search repository for extra work.

## 2. The Anti-Churn Guardrail (Zero-Churn Honor Code)

`/better` targets **material functional and contractual gaps**, NOT cosmetic churn.
**Do NOT touch:**
- Code formatting or import re-ordering if linter already passes.
- Variable or parameter names unless resolving clear ambiguity or naming violations.
- Working loops or routines to make them "fancier" or compressed.
- Redundant JSDoc or comments that restate code.

> **Clean Pass:** If artifact satisfies all standards with zero material gaps, output `VERDICT: NO MATERIAL CHANGE`. Zero edits is a win.

## 3. Inspect by artifact archetype

Select matching archetype and inspect against concrete failure modes:

### A. UI / React Components
- **Render stability:** Selectors use `useShallow` where applicable; fallback arrays/objects are module-level constants (e.g. `EMPTY_ARRAY = []`) to prevent infinite re-render loops (`Maximum update depth exceeded`).
- **State coverage:** Complete loading, error, empty, and edge states rendered.
- **Dialog standards:** Modals use `react-call` exclusively (`ConfirmDialog.call`, `AlertDialog.call`). Zero native `window.alert/confirm/prompt`.
- **Accessibility & layout:** Keyboard interactive, ARIA attributes present, no viewport overflow on mobile.

### B. Backend / Services / Cloud Functions
- **Recovery & resilience:** No dropped `try/catch` or fallback paths (Platinum Anti-Pattern 2).
- **Async execution:** Durable mutations awaited before returning client success (Platinum Anti-Pattern 13).
- **AI model safety:** Zero banned model strings (`gemini-1.5-*`, `gemini-2.0-*`). All imports use `AI_MODELS` from `@/core/config/ai-models`.
- **Security boundaries:** Validated caller auth (`context.auth.uid`), strict input schemas via Zod.

### C. Tests (Vitest / Playwright)
- **Quality scanner:** Passes `node scripts/check-test-quality.js`.
- **Assertion truth:** Zero tautological/fake assertions (`expect(true).toBe(true)`).
- **Locator safety:** Zero unannotated `.first()`, `.last()`, or `.nth()` locator bypasses (requires `// bypass-strict` if legitimate).
- **Mock determinism:** Mocks branch on arguments/endpoints rather than call-order FIFO queues.

### D. Documentation / Prompts / Workflows
- **Truthfulness:** All file paths, symbols, and links exist and resolve.
- **Prompt hygiene:** Zero template literal whitespace bloat (`.replace(/^\s+/gm, '')`).
- **Brand voice:** Lowercase `indii` / `indii.music`, "your 23-piece team", zero tech-spiritualism.

Cross-reference [`PLATINUM_QUALITY_STANDARDS.md`](../../docs/PLATINUM_QUALITY_STANDARDS.md) for full anti-pattern definitions.

## 4. Improve safely (ELEVATE mode)

1. Explain value and regression risk before touching code.
2. Apply smallest complete change using surgical chunk replacements.
3. Preserve existing public contracts.
4. **Two-Strike Rollback:** If a fix fails tests or compilation twice with same mechanism, immediately revert all changes, halt, and report `BLOCKED (REVERTED)`.
5. **The McClear Rule:** Never declare complete victory; report exact status and remaining caveats honestly.

Do not stage, commit, push, publish, deploy, edit secrets, or invoke broad fix sweeps independently.

## 5. Verify proportionally

- Run `node scripts/check-test-quality.js` on touched files.
- Run targeted tests: `npx vitest run <file>` or package test runner.
- Run package typecheck: `npm run typecheck:renderer` (or applicable package).
- Real-user / production claims require [`REAL_USER_AUTHENTICITY.md`](../REAL_USER_AUTHENTICITY.md).
- Any edit invalidates prior test evidence.

## 6. Output

```text
TARGET / MODE: <artifact> / <AUDIT|ELEVATE>
ARCHETYPE: <UI | BACKEND | TEST | DOC>
PLATINUM SCAN: <PASS | FIXED Anti-Pattern X | N/A>
MATERIAL GAPS: <concrete gaps found, or "None (Clean Pass)">
CHANGES: <bounded files and mechanisms | none>
EVIDENCE: <commands and test verdicts>
OUT-OF-SCOPE: <untouched findings>
VERDICT: IMPROVED | NO MATERIAL CHANGE | PARTIAL | BLOCKED (REVERTED)
```

Return changed files to parent workflow's delivery. `/better` never creates its own commit.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
