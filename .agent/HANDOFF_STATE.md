# Handoff State

**Updated:** 2026-04-06 00:45 EDT
**Branch:** `main`

## Architecture

**Monorepo** — npm workspaces (5 packages):

```
packages/
├── main/       ← Electron main process (Node.js)
├── renderer/   ← React app (Chromium) — src/ is symlinked here
├── firebase/   ← Cloud Functions + Security Rules
├── shared/     ← Cross-package type contracts (types-only)
└── landing/    ← Marketing website (Vite)
```

Build system: `electron-vite` (unified config at root)

## Recent Commits

```
5dde2270 fix(deploy): update Firebase Hosting landing target output directory to new workspace path
7c7474f6 fix(ci): remove destructive nested npm ci causing electron-vite wipe in GitHub Actions deployment workflow
92ee15ba fix(build): correct Electron main entry point and Firebase Hosting target directories for npm workspace monorepo
33d93456 fix(ci): correct YAML syntax in build.yml and update landing-page path to packages/landing in deploy.yml
8c2809fb chore(deps): harmonize zod version to 3.25.76 across workspaces to resolve npm ci synchronization error on GH Actions
```

## Working State

```
1 untracked: docs/MONOREPO_ARCHITECTURE.md (pending commit)
```

## Prime Status

- [x] TypeScript: 0 errors (tsc -b across shared/main/renderer)
- [x] Lint: 0 errors (179 warnings — all no-explicit-any)
- [x] Tests: 462 files / 2,532 tests — all passed (51s)
- [x] Build: qualification pipeline GREEN
- [x] Audit: 0 critical, 28 high (transitive, non-exploitable), 3 moderate, 16 low
- [x] Node: v25.6.1 (>= 22 ✓)
- [x] npm: 11.9.0
- [x] .env: present
- [x] Branch: main — up to date with origin

## Notes

- Major restructuring from flat single-package to npm workspace monorepo completed April 5-6, 2026
- `src/` at project root is a symlink → `packages/renderer/src/` for backward compatibility
- Previous handoff (April 5) was pre-monorepo at release 1.48.0
- CI/CD pipeline updated for workspace-aware builds (4 shards, parallel package builds)
- Full health audit pending post-monorepo

---
*Updated by /opp protocol. Read this at session start to resume context.*
