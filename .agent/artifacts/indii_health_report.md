# indii Engineering Health Report

**Audit date:** 2026-07-17  
**Branch:** `main`  
**Audited HEAD:** `73bdc26b42`  
**Version:** `1.64.6`  
**Runtime:** Node `v25.9.0`, npm `11.12.1`

## Executive Summary

| Dimension | Grade | Evidence |
| --- | --- | --- |
| Build health | A | Studio/Electron, Firebase, landing, and both MCP servers build successfully. |
| Type safety | A | Repository project-reference typecheck passes. |
| Lint health | C+ | 0 errors, 241 warnings; 4 warnings are auto-fixable. |
| Unit tests | A- | 764 files and 4,828 tests pass; 24 files and 59 tests skip. |
| Integration health | D | `npm run health:check` discovers 13 files/64 tests but executes 0 and still exits 0. |
| Modules/services | B+ | No placeholder code detected; low-file-count heuristic flags five substantial modules, not confirmed stubs. |
| Agent fleet | B | All 23 agent directories have a prompt; three training datasets contain only two examples. |
| Security posture | A- | Frontend API-boundary guard passes; no production secret literal was found. Infra-ID hits are confined to the approved generated registry. |
| Dependencies | B- | 0 critical/high, 2 moderate dev-test advisories, and 5 extraneous transitive packages. |
| CI/CD | B | Recent deploy and health-check runs succeeded; the audit-time deploy run was still in progress. |
| Tech debt | C+ | 30 TODO/FIXME/HACK/XXX markers, 8 commented-code candidates, 31 production console calls, and 241 lint warnings. |

## Detailed Results

### Build and repository gates

- `npm run typecheck`: pass.
- `npm run build:ci`: pass.
- `npm run build:firebase`: pass.
- `npm run build:landing`: pass, with a 1,016.72 kB minified entry-chunk warning.
- `npm run build:mcp`: pass.
- `npm run security:frontend-api-boundary`: pass.
- `npm run check:dep-drift`: pass.
- `node scripts/check-test-quality.js`: pass for the clean baseline.

### Tests

- Full Vitest suite: 764 files passed, 24 skipped; 4,828 tests passed, 59 skipped.
- The integration health command reports 13 skipped files and 40 explicitly skipped tests out of 64 discovered tests, with no test execution time.
- The relevant Error Ledger entry already states that integration tests must not blindly skip when environment setup is absent.
- Repeated `--localstorage-file` warnings add noise across the suite but do not currently fail tests.

### Static completeness

- 42 renderer module directories scanned.
- The file-count heuristic labels `crm`, `devops`, `memory`, `notes`, and `select-org` as stubs, but each contains 235-1,149 lines; these are not confirmed stubs.
- 2,005 service exports found.
- No `... rest of code`, `... implementations here`, `TODO implement`, or AI boilerplate patterns found.
- 30 TODO-family markers and 8 commented-code candidates require contextual review before removal.

### Security

- Candidate secret hits are regex definitions/placeholders in `ModelArmor.ts` and `ConnectDistributorModal.tsx`, not credential literals.
- Vertex endpoint literals exist only in `fine-tuned-endpoints.generated.ts`, whose header identifies the regeneration command and approved single-source-of-truth role.
- No non-test hardcoded secret literal was confirmed.
- Two non-test localhost references remain and require contextual review rather than automatic removal.

### Dependencies

- `npm audit`: 0 critical, 0 high, 2 moderate, 0 low.
- The moderate advisory is `ts-deepmerge` prototype-method override/DoS via the direct dev-test dependency `firebase-functions-test`; npm proposes a semver-major downgrade, so no blind automatic fix is appropriate.
- `npm ls --depth=0` reports five extraneous WASM-related transitive packages.
- Dependency version-drift guard passes; outdated packages include major-version upgrades that require deliberate migration work.

### CI/CD and deployment

- Seven GitHub workflows are present.
- Recent deploy history includes successful deploys and a successful scheduled health monitor.
- One prior deploy was cancelled; the latest deploy was in progress at audit time and is not counted as proof of readiness.

## Prioritized Action Items

### P0 — Must fix before an unconditional ship-readiness claim

1. Make `npm run health:check` fail when it discovers integration tests but executes none, then convert or gate the unconditional `describe.skip` suites so the command proves real behavior.
2. Continue resolving the repository's active open/partial issue ledger; the current task artifact explicitly records critical architectural and workflow defects.

### P1 — Should fix

1. Reduce the 241-warning lint baseline, starting with unused imports/constants and the missing React hook dependency.
2. Assess or replace the vulnerable `firebase-functions-test` dependency without accepting npm's unsafe downgrade suggestion.
3. Remove or explain the five extraneous packages through a clean, isolated install workflow when no concurrent build is active.
4. Split the landing entry chunk and review the largest studio chunks where lazy boundaries are missing.
5. Replace the integration suite's repeated local-storage warning source with a valid temporary path or remove the invalid flag.

### P2 — Improve over time

1. Review 30 TODO-family markers, 8 commented-code candidates, and 31 production console calls individually.
2. Expand the `curriculum`, `screenwriter`, and `social` training datasets beyond two examples if those agents remain active production surfaces.
3. Add explicit rationale/status metadata for intentionally compact modules so file-count heuristics do not misclassify them.

## Ship Readiness Verdict

**Conditional / not yet unconditional.** The codebase compiles, builds, passes its repository guards, and passes a large unit suite. It cannot be described as fully ship-ready while the integration-health command produces a false-green all-skipped result and the active master ledger still contains unresolved critical issues. This report is a point-in-time audit, not a completion claim.
