---
description: Effect-TS v4 workflow for Antigravity, Claude Code, and Codex teams. Syncs local reference source, loads v4 idioms, enforces accountability lint rules, and verifies with Effect Language Service diagnostics.
---

# /effect — Effect-TS v4 Implementation & Verification

Use `/effect` when building, refactoring, or debugging typed async pipelines, schemas, or services using `effect` (`^4.1.4`). Skip this workflow for React UI components or tasks that do not use Effect.

## 1. Check Workspace Setup

Effect v4 comes from the workspace dependencies. Check that the installed package resolves with `node -p "require('effect/package.json').version"`. If it is missing, follow the repo's normal dependency setup.

Check that `repos/effect/LLMS.md` exists on disk. If missing or stale:

```bash
npm run effect:sync-repo
```

Treat `repos/effect/` as **read-only reference material** — never edit files under `repos/` and never import from `repos/` in application code.

## 2. Ground in Effect v4 Patterns Before Coding

Read in order:
1. The [project Effect guide](../../docs/guides/effect-guide.md) and [reference repository guide](../../docs/guides/reference-repos.md) for local conventions and source layout
2. `repos/effect/LLMS.md` — Effect v4 entry points and `ai-docs` index
3. Relevant runnable examples in `repos/effect/ai-docs/src/` (e.g. `01_basics/`, `02_schema/`, `03_services/`, `04_errors/`, `05_resources/`)

Key Effect v4 conventions in this repo:
- Use `Effect.gen` for inline effects and `Effect.fn('Service.method')` / `Effect.fnUntraced` for reusable functions.
- Model domain entities with `Schema.Class`, nominal IDs with `Schema.brand`, optional JSON fields with `Schema.OptionFromNullishOr`, and errors with `Schema.TaggedError`.
- Model optional values with `Option.fromNullishOr` (not v3's `Option.fromNullable`).
- Define services with `Context.Service` + `Layer.effect` (using `Effect.acquireRelease` for resource cleanup).
- Never use `Effect.ignore`, `Effect.catchAllCause`, `Effect.catchCause`, `() => Effect.void`, `{ disableValidation: true }`, `Effect.serviceOption`, `Effect.asVoid`, or nested `Layer.provide`.

## 3. Verify Deterministically (CLI-First for All Agents)

Run in the target package(s):

```bash
npx effect-language-service diagnostics --project packages/shared/tsconfig.json
npx vitest run <targeted-test-files>
npm run lint
npm run typecheck
```

If another package uses Effect, pass its `tsconfig.json` to `effect-language-service diagnostics --project <pkg>/tsconfig.json`.

> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.
