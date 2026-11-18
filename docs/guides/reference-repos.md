# Reference Repositories (`repos/`)

This repository follows the ["Vendor reference source locally for coding agents"](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/) pattern so AI coding agents can read real library implementations, types, tests, and AI documentation directly instead of guessing APIs from memory or fragmented snippets.

## Setup & Updating

`repos/` is listed in `.gitignore` so upstream repository history does not bloat `main` or slow CI checkouts. Initialize or update the local clone at any time with:

```bash
npm run effect:sync-repo
```

Editor, TypeScript, Vitest, and ESLint configs exclude `repos/**` so it never interferes with app builds, auto-imports, test discovery, or linting:

- `.gitignore` (`/repos/`)
- `.vscode/settings.json` (`files.exclude`, `files.watcherExclude`, `search.exclude`, `typescript.preferences.autoImportFileExcludePatterns`, `javascript.preferences.autoImportFileExcludePatterns`, `vitest.exclude`)
- `tsconfig.json` (`exclude`)
- `vitest.config.ts` (`test.exclude`)
- `eslint.config.js` (`ignores`)

## Rules for Agents & Developers

1. **Read-only reference material** — Never edit files inside `repos/` unless explicitly instructed.
2. **Never import from `repos/`** — Application code must import from installed npm packages (e.g., `import { Effect, Schema } from 'effect'`).
3. **Read source over guessing** — Before writing or debugging Effect code, inspect `repos/effect/LLMS.md`, `repos/effect/ai-docs/src/`, and `repos/effect/packages/effect/src/`.

## Effect (`repos/effect/`)

Pinned to the upstream `Effect-TS/effect` v4 repository matching `effect` (`^4.1.4`) installed in the monorepo.

### Start Here

| Resource | Path | Purpose |
|---|---|---|
| **LLM Guide** | `repos/effect/LLMS.md` | Canonical v4 idioms, entry points, and index of `ai-docs` |
| **Runnable AI Examples** | `repos/effect/ai-docs/src/` | Focused examples for `Effect.gen`, `Effect.fn`, `Schema`, `Context.Service`, `Layer`, errors, resources, schedules, observability, and testing |
| **Schema Deep Dive** | `repos/effect/packages/effect/SCHEMA.md` | Full Schema design guide (read in chunks) |

### Core Modules (`repos/effect/packages/effect/src/`)

| Module | Path | Use For |
|---|---|---|
| **Effect** | `Effect.ts` | Core `Effect` type, `Effect.gen`, `Effect.fn`, concurrency, retries |
| **Schema** | `Schema.ts` | Validation, `Schema.Class`, `Schema.TaggedError`, `Schema.brand`, encoding/decoding |
| **Context** | `Context.ts` | Dependency injection (`Context.Service`, `Context.Reference`) |
| **Layer** | `Layer.ts` | Service composition (`Layer.effect`, `Layer.provide`, `Layer.provideMerge`, `Layer.fresh`) |
| **Option** | `Option.ts` | Optional values (`Option.fromNullishOr`, `Option.fromNullOr`, `Option.some`, `Option.none`) |
| **Result** | `Result.ts` | Synchronous typed success/failure values |
| **Match** | `Match.ts` | Exhaustive pattern matching |
| **Brand** | `Brand.ts` | Nominal branded types |
| **Data** | `Data.ts` | Value objects and structural equality |
| **BigDecimal** | `BigDecimal.ts` | Exact decimal arithmetic (financial/royalty math) |
| **DateTime** | `DateTime.ts` | Testable clocks, ISO formatting, time zones |
| **Duration** | `Duration.ts` | Type-safe durations |
| **Stream** | `Stream.ts` | Pull-based async streams |
| **Fiber** | `Fiber.ts` | Concurrent fiber management |
| **Predicate** | `Predicate.ts` | Reusable runtime type guards (`Predicate.isObject`, `Predicate.isString`, etc.) |

### Useful Search Commands

```bash
# Find service definitions
rg -n "Context\.Service" repos/effect/ai-docs/src/ repos/effect/packages/effect/src/

# Find Schema.Class and Schema.TaggedError patterns
rg -n "Schema\.(Class|TaggedError)" repos/effect/ai-docs/src/

# Find error handling examples
rg -n "Effect\.catch(Tag|Tags)?\b" repos/effect/ai-docs/src/

# Find Layer composition patterns
rg -n "Layer\.(effect|provide|provideMerge|fresh)" repos/effect/ai-docs/src/
```
