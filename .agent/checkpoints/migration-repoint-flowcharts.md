# Checkpoint — Island Migration Repoint + Flowchart Refresh

**Agent:** Claude (Opus 4.8)
**Date:** 2026-05-31
**Branch:** main

## What was done

### 1. Health audit (origin of session)
Re-ran the full CI pipeline locally: typecheck ✅, lint ✅ (0 errors), **3961 unit tests ✅**, landing + studio builds ✅, bundle 22 MB < 25 MB. Live sites serve byte-identical current code. The React 18/19 bleed that broke CI ~2 weeks ago is closed. Core app is genuinely healthy.

### 2. Migration repoint (the real breakage)
The migration to `indii-music-founder/indii-music-founder` fixed deploy/runtime config but left **GitHub-integration code pointing at 4 dead repos**. Repointed all of them (see ERROR_LEDGER 2026-05-31 entry):
- `updater.ts`, `electron-builder.json`, `package.json` (publish + repository.url)
- `reportBugFn.ts`, `activateFounderPass.ts` (paid path), `DownloadHub.tsx`, `FounderBadge.tsx`
- `.github/CODEOWNERS` → `@the-walking-agency-det` (valid org member)
- Docs/agent mirrors (README, CLAUDE/CODEX/GEMINI/JULES/DROID), `.env.example`
- Untracked 2,402 generated/ephemeral files + **`gh_cookies.json` (live session-cookie leak)**
Commits: `312b1b956` (repoint), `6bb6e9a27` (untrack, hook), `5af9b7eaf` (react pin).

### 3. Flowcharts (/flowchart)
- Rebuilt `entire-app-architecture.md` against live code (indii Conductor / AgentGraphService, 15-agent swarm, current model IDs).
- Fixed stale orchestrator refs in `file-search-rag.md`, `audio-intelligence-flow.md`.
- All 43 flowcharts pass `scripts/validate-flowcharts.js`.
Commit: `f68113c45`.

## State
- Local `main` is 4 commits ahead of `origin/main` (not yet pushed at checkpoint time).
- `npm run ci` gauntlet: run to validate before push.

## REQUIRED user actions (agent cannot do — credentials policy)
1. **Revoke GitHub sessions** at github.com/settings/security — `gh_cookies.json` (17 live cookies for `the-walking-agency-det`) was committed and remains in git history.
2. **Fix `gh` CLI visibility:** `gh auth login` as `the-walking-agency-det` (the SSH identity that HAS org access) + clear the junk 15-char `GITHUB_TOKEN`. Current keyring account `thewalkeragency` is not an org member → `gh` 404s.
3. **Rotate secrets for the island repo:** founder-pass fine-grained PAT (`contents:write`) + bug-report GitHub token must be reissued for `indii-music-founder/indii-music-founder`, else those features 403 even with the code fixed.

## Next session (deferred flowcharts)
Phase 3 Tier A charts not yet built: merch-studio, founders-checkout-portal, mobile-remote, publishing-rights, screenwriter; Tier B infra: CI/CD, Zustand, Electron IPC, auth, analytics.
