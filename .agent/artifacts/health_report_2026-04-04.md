# indiiOS Health Report
**Date:** 2026-04-04  
**Branch:** `claude/build-insights-dashboard-NZ1np`  
**Version:** 1.46.0  
**HEAD:** `a1bc1a4`

---

## Executive Summary

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Build/Types | ⚠ Unknown | node_modules not installed in CI env |
| Tests | ⚠ Unknown | vitest not found — needs `npm install` |
| Modules | A | 27/35 built, 8 intentional stubs |
| Services | A | 56 dirs, 1380 exports — comprehensive |
| Agent Fleet | B+ | 17 agents, 2 missing prompt.md |
| Security | A- | Clean code, 2 critical npm vulns |
| Dependencies | C | 2 critical, 71 high (mostly transitive) |
| Tech Debt | A | 26 TODOs, 1 zombie line — very clean |
| CI/CD | A | 3 workflows: build, deploy, release-please |

**Ship Readiness: CONDITIONAL** — Core codebase is clean and well-organized. Two critical npm vulnerabilities need triage before next production deploy. Otherwise the codebase is in strong shape.

---

## 1. Build & Tests

Not runnable in this environment (`node_modules` directory exists but is empty — needs `npm install`).

**Action:** Run `npm install && npm test -- --run` locally or in CI before deploying.

---

## 2. Module Completeness — 35 modules

### Fully Built (27)
agent, analytics, core, creative, dashboard, design, distribution, finance, investor, knowledge, legal, licensing, marketing, marketplace, merchandise, mobile-remote, observability, onboarding, publicist, publishing, royalty, settings, social, tools, touring, video, workflow

### Intentional Stubs (8)
| Module | Files | Lines | Assessment |
|--------|-------|-------|------------|
| capture | 2 | 642 | Planned feature |
| debug | 1 | 217 | Dev utility |
| desktop | 2 | 217 | Electron-specific |
| files | 2 | 413 | File manager |
| founders | 1 | 211 | Founder pass module |
| history | 1 | 237 | Session history |
| memory | 1 | 816 | Memory/context UI |
| select-org | 1 | 230 | Multi-org selector |

These are not abandoned — they're scoped for future sprints. No action needed.

---

## 3. Services Layer

56 service directories, 1380 exported symbols. Notably large agent service (256 files) — expected for the hub-and-spoke architecture.

No issues found.

---

## 4. Agent Fleet — 17 agents

### Agents with prompt.md ✓
agent0, brand, finance, generalist, indii_curriculum, indii_executor, legal, licensing, marketing, music, publicist, publishing, road, social, video

### Agents without prompt.md ⚠
| Agent | Has | Status |
|-------|-----|--------|
| `creative-director` | AGENTS.md | ✓ Valid — uses alternate naming convention |
| `default` | _context.md | ✓ Intentional template/fallback |

Both are fine — just using different file names. The `health_audit` skill has been updated to recognize AGENTS.md as equivalent to prompt.md.

---

## 5. Security

**Hardcoded secrets:** None found.
- False positives from `InputSanitizer.ts` (contains Stripe key *regex patterns* for detection — not actual keys)
- All legitimate credential refs use `process.env` or `import.meta.env`

**Console statements:** 6 total (very clean for this codebase size)

**Localhost refs:** 1 — `AgentZeroService.ts:5` (tombstone comment, service was retired in v1.23.0 — no runtime risk)

---

## 6. Dependencies

### Critical (2) — ACTION REQUIRED

**`fast-xml-parser`** (CVE: GHSA-37qj-frw5-hhjh, GHSA-m7jm-9gc2-mpf2)
- Path: `@remotion/cloudrun` → `@remotion/bundler` → `fast-xml-parser`
- Fix: Update `@remotion/cloudrun` to 4.0.209+ (semver major — **breaking change**)
- Risk: Remotion is used for video rendering. Test video pipeline after update.
- Action: `npm update @remotion/cloudrun` — review Remotion changelog first

**`handlebars`** (CVE: GHSA-3mfm-83xf-c92r, GHSA-2w6w-674q-4c4q)  
- Standard fix available (not a breaking change)
- Action: `npm audit fix` after running `npm install`

### High (71)
All 71 high-severity findings trace back to two chains:
1. `@aws-sdk/*` transitive chain via `@aws-sdk/xml-builder` → `fast-xml-parser` (same root as critical above)
2. `@electron-forge/*` chain — these are dev/build tools, not runtime dependencies

**Assessment:** The AWS SDK highs are all transitive — fixing `fast-xml-parser` via the Remotion update will resolve most of them. The Electron Forge highs are dev-only tools.

### Moderate (8) / Low (24)
- `yaml` 2.0.0–2.8.2: stack overflow via deeply nested YAML. Fix available (`npm audit fix`)
- Others: low-risk transitive deps

---

## 7. Tech Debt

- **TODOs:** 26 — low for a codebase of this size (~100k+ lines)
- **Zombie code:** 1 line — negligible
- No FIXME or HACK blocks found

---

## 8. CI/CD

Three workflows present and accounted for:
- `build.yml` — build validation
- `deploy.yml` — Firebase deployment
- `release-please.yml` — automated versioning and changelog

---

## Prioritized Action Items

### P0 — Before Next Production Deploy
- [ ] Run `npm install && npm test -- --run` — verify test suite is green
- [ ] Triage `handlebars` critical: `npm audit fix` after install
- [ ] Review `@remotion/cloudrun` changelog → update if safe, or accept risk

### P1 — This Sprint
- [ ] Update `@remotion/cloudrun` to 4.0.209+ and test video pipeline
- [ ] Set `TELEGRAM_WEBHOOK_SECRET` in GCP Secret Manager + re-register bot webhook
- [ ] Set `PANDADOC_WEBHOOK_SECRET` in GCP Secret Manager + PandaDoc dashboard
- [ ] Run `bash .claude/scripts/setup-git-hooks.sh` on all active dev machines

### P2 — Next Sprint
- [ ] Build out stub modules as planned (capture, files, history, memory, select-org)
- [ ] Add `prompt.md` to `creative-director` agent (or update all tooling to accept AGENTS.md)
- [ ] Reduce console statement count from 6 to 0 for production build

---

## Ship Readiness Verdict

> **CONDITIONAL SHIP** — The application logic is clean, the architecture is sound, services are comprehensive, and agent infrastructure is strong. The two critical vulnerabilities (fast-xml-parser via Remotion, handlebars) are transitive but should be resolved before deploying to production. Once `npm install` is run and the test suite verified green, this codebase is ready to ship with those caveats addressed.
