# Architecture Refactor Roadmap (`indii-music-founder`)

Behavior-preserving, phased structural refactor anchored to `docs/PLATINUM_QUALITY_STANDARDS.md` and `.agent/workflows/branch-safety.md`.

## Phase 0 — Baseline (Complete)

- **Reference commit:** `main` @ `6cbd26ec26` (Node `v25.9.0`)
- **`npm run lint`:** exit 0 (0 errors, 271 warnings)
- **`npm run typecheck`:** exit 0
- **`node scripts/check-test-quality.js`:** exit 0
- **`npx vitest run --project renderer`:** 1,245 passed, 20 skipped, 1 pre-existing failed file (`packages/renderer/src/services/share/milestones.test.ts`, 2 Node 25.9.0 `localStorage` assertions)

## Phase 1 — Hygiene, Guardrails & Path Aliases (Complete)

| Batch | Branch | SHA | Summary |
|---|---|---|---|
| **1A1** Hygiene | `antigravity/refactor-p1-hygiene` | `2e7579bbd9` (merged in `fa707287bb`) | Untracked 2,480 cached files under `packages/renderer/.npm-cache-isolated-1/`; removed 12 zero-ref root artifacts (`lint-*.json`, `scratch.py`, `run_import*.ts`, `run_ci.sh`, `run_audit.sh`, `eslint-temp/`, duplicate `indiiOS_agent_manifest_v2.md`); removed generated `deep-test-*.png` (+ `.gitignore`); deleted dead `functions/src/admin/setGodMode.ts`. |
| **1A2** Orphan tests | `antigravity/refactor-p1-orphan-tests` | `f3951b6827` (merged in `fa707287bb`) | Ported 24 verified unique behavior cases from orphaned `tests/` into 5 live renderer suites (`DevOpsTools.test.ts`, `LegalTools.test.ts`, `ContextManager.test.ts`, new `MerchDashboard.test.tsx`, `MerchDesigner.a11y.test.tsx`) guided by 2-pass Jev triage + Challenger mutation checks; removed dead `tests/` directory (8 files). |
| **1B** Guardrails | `antigravity/refactor-p1-guardrails` | `b5f6826672` (merged in `fa707287bb`) | Added ESLint `no-restricted-imports` (`warn`) for direct Firebase SDK imports in renderer `.tsx` components (42 warnings across 37 files); added 1,000-line source ratchet (`scripts/check-file-size-budget.mjs`, `.test.mjs`, `scripts/file-size-budget.allowlist.json` with 32 entries) wired into `npm run lint` via `check:file-size`. |
| **1C** `@/` Alias Codemod | `antigravity/refactor-p1-alias-codemod` | `04be5c7849` | Added `scripts/codemods/relative-to-alias.mjs` (+ unit tests); rewrote 4,692 relative specifiers across 1,998 renderer files to `@/` and `@shared/`; enabled ESLint `no-restricted-imports` (`error`) banning `./*` and `../*` in `packages/renderer/src/**/*.{ts,tsx}`. |
| **1D** Docs | `antigravity/refactor-p1-docs` | this branch | Recorded roadmap in `docs/refactor/ROADMAP.md` and documented Phase 1 guardrails in `docs/PLATINUM_QUALITY_STANDARDS.md` and `CLAUDE.md` mirrors. |

## Phase 2 — Service vs. UI Layer Enforcement

- Migrate direct `firebase/firestore`, `firebase/storage`, `firebase/functions`, `firebase/auth`, and `firebase/database` imports out of the 37 renderer `.tsx` components into `*Service.ts` modules or hooks.
- Promote the Firebase-in-UI `no-restricted-imports` rule in `eslint.config.js` from `warn` to `error`.

## Phase 3 — Split Oversized Files (> 1,000 Lines)

Work down `scripts/file-size-budget.allowlist.json` (32 files), removing stale allowlist entries as each file drops to `<= 1,000` lines:
1. `packages/renderer/src/config/typesafeJudgments.ts` → split into `config/judgments/<domain>.ts` with a re-export barrel at `typesafeJudgments.ts`.
2. `packages/firebase/src/index.ts` → split into per-domain export modules.
3. `AgentService.ts`, `BaseAgent.ts`, `gateway.ts`, `CanvasOperationsService.ts`, `InfiniteCanvas.tsx`, `OmniWorkflow.tsx`, `VideoWorkflow.tsx`, and remaining allowlisted files.

## Phase 4 — `services/agent` Sub-Domain Structure

- Group the ~538 files under `packages/renderer/src/services/agent/` into cohesive sub-domains with explicit `index.ts` barrels.
- Add circular-dependency detection in CI.

## Phase 5 — Gradual Strict TypeScript

- Enable `strictNullChecks` folder-by-folder in `packages/renderer` using a per-folder allowlist ratchet so strictness only moves forward.

## Explicit Exclusions

- **Effect v4 migration:** Separate track; not bundled into structural refactors.
- **Git history rewriting:** Forbidden by `.agent/workflows/branch-safety.md` (no force-push).
- **`packages/firebase` relative imports:** Plain `tsc` Cloud Functions runtime does not support bundler path aliases without an extra emit-rewrite step; leave relative imports intact.
