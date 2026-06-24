# Platinum Roadmap: v1.64.4 → v1.66.0

**Status:** ACTIVE EXECUTION | Started 2026-06-24 07:50 EDT  
**Owner:** Claude Code + Agent Swarm  
**Timeline:** 2-3 weeks | 3 ship events

---

## Quick Links for All Agents

- **Current Commit:** `5ec4a62e9` (Phase 0: confirmation dialog + test fixes)
- **Branch:** `main`
- **Node Version:** >= 22.0.0
- **Test Command:** `npm test -- --run` (should show 4242 passing)

---

## V1.64.4 Hardening Release (Days 1-3)

### Workstream 1A: CORS/Auth Fix ⚡ **IN PROGRESS**
- [ ] Identify auth blocker in Firebase config
- [ ] Fix CORS headers on Cloud Functions
- [ ] E2E auth flow test passes
- **Owner:** Claude Code | **ETA:** Day 1 (2h)
- **Commit:** `fix: add CORS headers to auth endpoints`

### Workstream 1B: Test Coverage → 75% (Parallel)
- [ ] AI Service unit tests
- [ ] Distribution Service tests
- [ ] Image/Video Generation tests
- [ ] Agent Graph tests
- **Owner:** Available agent | **ETA:** Day 2 (4h)
- **Commit:** `test: add core service unit tests`

### Workstream 1C: Pre-commit Hooks (Parallel)
- [ ] Run `/setup-pre-commit` skill
- [ ] Verify lint + typecheck + test gates
- **Owner:** Available agent | **ETA:** Day 2 (30m)
- **Commit:** `chore: add pre-commit hooks`

### v1.64.4 Ship
```
npm version patch
git push
# CI deploys automatically
```

---

## V1.65.0 Creative Polish (Days 2-4 | Parallel)

### Workstream 2A: Dialog UX ✅ **DONE**
- ✓ Confirmation dialog restored
- ✓ Test isolation fixed
- **Commit:** `5ec4a62e9`

### Workstream 2B: Error Handling
- [ ] Improve `useDirectGeneration` error messages
- [ ] Add retry logic with exponential backoff
- **Owner:** Available agent | **ETA:** Day 3 (2h)
- **Commit:** `feat: improve error handling in creative generation`

### Workstream 2C: Storage Fetch Hardening
- [ ] Restore Electron fallback (safe version)
- [ ] Add timeout logic
- [ ] Unit tests both paths
- **Owner:** Available agent | **ETA:** Day 3 (1.5h)
- **Commit:** `fix: harden safeStorageFetch with timeout + fallback`

### Workstream 2D: Arcjet Lazy Init
- [ ] Complete lazy initialization
- [ ] Add ARCJET_KEY missing fallback test
- **Owner:** Available agent | **ETA:** Day 3 (1h)
- **Commit:** `feat: complete Arcjet lazy initialization`

### v1.65.0 Ship
```
npm version minor
git push
```

---

## V1.66.0 Feature Release (Days 4-7 | Sequential)

### Workstream 3A: Electron Auto-Update
- [ ] Enable `electron-updater`
- [ ] Test auto-check cycle (4h interval)
- **Owner:** Available agent | **ETA:** Day 4 (2h)
- **Commit:** `feat: enable Electron auto-update`

### Workstream 3B: Dark Mode
- [ ] Add CSS variables (TailwindCSS)
- [ ] Settings toggle
- [ ] Update all modules
- [ ] WCAG AA contrast test
- **Owner:** Available agent | **ETA:** Day 4-5 (4h)
- **Commit:** `feat: add dark mode toggle`

### Workstream 3C: Genkit Hardening
- [ ] Add timeouts to all flows
- [ ] Add retry logic
- [ ] Structured error types
- [ ] Token consumption logging
- **Owner:** Available agent | **ETA:** Day 5 (3h)
- **Commit:** `fix: harden Genkit flows with timeout + retry`

### Workstream 3D: Direct Distribution V2
- [ ] Progress tracking UI
- [ ] Earnings dashboard
- [ ] Retry queue
- [ ] Real-time status
- **Owner:** Available agent | **ETA:** Day 6 (3h)
- **Commit:** `feat: enhance direct distribution UX`

### Workstream 3E: BigQuery Analytics
- [ ] Daily batch ingest
- [ ] Public dashboard queries
- [ ] Cost-per-user trending
- **Owner:** Available agent | **ETA:** Day 7 (2h)
- **Commit:** `feat: add BigQuery analytics pipeline`

### v1.66.0 Ship
```
npm version minor
git push
```

---

## Quality Gates (Before Every Ship)

```bash
npm run typecheck      # ✓ Zero errors
npm run lint           # ✓ Zero critical
npm test -- --run      # ✓ All pass
npm run build          # ✓ Production build
```

---

## Agent Routing

| Workstream | Priority | Best Agent | Notes |
|-----------|----------|-----------|-------|
| **1A** CORS/Auth | 🔴 CRITICAL | Claude Code | Blocking onboarding; requires Firebase config expertise |
| **1B** Test Coverage | 🟡 HIGH | Gemini / DROID | Parallel work; can start immediately |
| **1C** Pre-commit | 🟢 MEDIUM | JULES | Skill-based; straightforward |
| **2B-2D** Creative Polish | 🟢 MEDIUM | Any agent | Well-defined specs; parallel-safe |
| **3A-3E** Features | 🟡 HIGH | Codex / Gemini | Complex flows; needs architecture context |

---

## How to Pick Up a Workstream

1. Check the workstream status above
2. If `[ ]` (unchecked), it's available
3. Run: `git pull origin main`
4. Read the specification for your workstream (see original platinum plan)
5. Create a feature branch: `git checkout -b <workstream-name>`
6. Execute the checklist
7. Commit with the specified message
8. Push: `git push origin <workstream-name>`
9. Update this document: mark task as ✓ or ✅
10. Notify team

---

## Communication

- All commits must pass: `npm run typecheck && npm run lint && npm test -- --run`
- All PRs must reference this roadmap
- Parallel workstreams: coordinate via git (no conflicts expected)
- Blocking issues: raise in `.agent/test_ledger/OPEN_ISSUES.md`

---

## Last Updated

2026-06-24 07:50 EDT | Claude Code | Phase 0 complete → Executing Workstream 1A
