# Repository Seal Audit Report: indii v1.64.0

**Timestamp:** 2026-05-28
**Target Release:** v1.64.0
**Auditor:** Codex
**Protocol:** `/1percent`

## Executive Summary

The v1.64.0 seal pass tightened repository hygiene, removed tracked sensitive
material from the current tree, restored readable README rendering, and verified
the production build gate. The tracked repository is improved and ready to push,
with two repository-owner follow-ups remaining outside the scope of this commit:
credential rotation/history cleanup for the removed SSH key material, and release
tag/GitHub settings reconciliation.

## Audit Checklist

### Phase 1: Repository Metadata & Hygiene

- **[PASS] Code Ownership:** Added `.github/CODEOWNERS` with repository-wide
  and critical-surface ownership.
- **[PASS] Security Policy:** Added `SECURITY.md` with private disclosure,
  supported versions, and secret-handling guidance.
- **[PASS] License:** Root proprietary license remains present.
- **[PASS] README Hygiene:** Repaired mojibake in headings, arrows, diagrams,
  and release notes; updated the project structure note to reflect 20 agents.
- **[PASS] Generated Artifacts:** Removed tracked `eslint_output.json` and
  `scratch/diff.txt`; added ignore coverage for those artifacts.
- **[PASS] Secret Guardrails:** Added ignore coverage for private key formats
  and removed the gitleaks allowlist entry for `models/id_ed25519`.
- **[WARN] Historical Secret Exposure:** Removed the tracked SSH keypair from
  the current tree. Because the private key material existed in Git history,
  rotate/revoke the corresponding credential and decide whether to rewrite
  history with a coordinated BFG/git-filter-repo cleanup.

### Phase 2: Branch & Tag Hygiene

- **[PASS] Working Branch:** `main` was clean before the seal edits.
- **[PASS] Remote Tracking Cleanup:** Pruned stale `origin/*` tracking refs.
- **[WARN] Release Tags:** Local semantic tags extend through `v1.64.0`, while
  `origin` currently advertises tags only through `v1.50.0`. Publishing the
  missing historical tags should be an explicit release-owner decision.

### Phase 3: GitHub Repository Settings

- **[WARN] GitHub Settings Audit:** The configured SSH remote is usable for Git,
  but GitHub REST metadata/protection checks returned 404 with the available
  `gh` authentication context. No branch protection, topics, visibility, or
  release settings were mutated during this seal pass.

### Phase 4: CI/CD & Build Verification

- **[PASS] Diff Check:** `git diff --check`
- **[PASS] Build Gate:** `npm run build:ci`
  - TypeScript project references passed.
  - ESLint completed with existing warnings only.
  - `electron-vite build` completed successfully.
- **[PASS] Full Test Suite:** `npm test -- --run`
  - 607 test files passed.
  - 3843 tests passed, 7 skipped, 9 todo.
- **[PASS] Test Harness Repairs:** Updated the legacy Firebase image callable
  test to use the current v2 callable request shape, and updated the
  MarketingTools campaign-brief assertion to match the richer persisted payload.
- **[PASS] Staged Secret Scan:** `gitleaks git --staged --redact --config .gitleaks.toml --no-banner`
  scanned the staged commit and found no leaks.

## Verdict

The tracked repository seal changes are ready for final staged secret scan,
commit, and push. The current tree no longer contains the removed SSH key files,
but the credential itself must be treated as exposed until rotated or revoked.
