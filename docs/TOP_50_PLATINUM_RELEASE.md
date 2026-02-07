# Top 50: Platinum-Standard Production Release Priorities

> **indiiOS-Alpha-Electron v0.1.0-beta.2**
> Generated from production-readiness audit. Track progress here.

---

## CRITICAL BLOCKERS (P0) — Must fix before any release

| # | Item | File/Area | Status |
|---|------|-----------|--------|
| 1 | **Resolve npm peer dependency conflicts** (React 19 vs Radix UI - 100+ unmet deps) | `package.json` | DONE - Downgraded drei/fiber for React 18 |
| 2 | **Fix ESLint** (missing `@eslint/js`, linting completely broken) | `eslint.config.js` | DONE - 10 errors → 0 |
| 3 | **Fix Vitest resolution** (test runner not found, tests cannot execute) | `package.json` devDeps | DONE - Tests run |
| 4 | **Harden CI/CD quality gates** - remove all `\|\| echo` soft failures on lint/test/e2e steps | `.github/workflows/deploy.yml` | DONE - All soft failures removed |
| 5 | **Require BOTH builds to pass** in CI (currently only fails if both break) | `.github/workflows/deploy.yml` | DONE - Part of CI hardening |

---

## HIGH PRIORITY (P1) — Required for production release

| # | Item | File/Area | Status |
|---|------|-----------|--------|
| 6 | **Add `npm run typecheck` step to CI/CD** (type errors don't block deployment) | `.github/workflows/deploy.yml` | DONE - Part of build command |
| 7 | **Add Content Security Policy headers** for production builds | `vite.config.ts`, `firebase.json` | TODO |
| 8 | **Harden env var validation** - throw on missing critical vars instead of warning | `src/config/env.ts` | TODO |
| 9 | **Fix TypeScript type errors** (`google.maps` and `vitest/globals` type definitions missing) | `tsconfig.json` | DONE - 7 → 0 errors |
| 10 | **Pin all dependency versions** - stop using `--legacy-peer-deps` as workaround | `package.json` | TODO |
| 11 | **Verify `.env.production` is in `.gitignore`** | `.gitignore` | TODO |
| 12 | **Add rate limiting to Firebase Cloud Functions** | `functions/src/` | TODO |
| 13 | **Audit admin token bypass** in Firestore rules (`request.auth.token.admin == true`) | `firestore.rules` | TODO |
| 14 | **Add error boundary fallback UI** with recovery action (currently shows generic text) | `src/core/components/ErrorBoundary` | TODO |
| 15 | **Standardize error types** - convert remaining `throw new Error('string')` to `AppException` | All services | TODO |

---

## MEDIUM PRIORITY (P2) — Quality & completeness

| # | Item | File/Area | Status |
|---|------|-----------|--------|
| 16 | **Add automated axe-core a11y scans to CI pipeline** | `.github/workflows/deploy.yml` | TODO |
| 17 | **Create READMEs for 17 missing modules** (agent, distribution, finance, licensing, etc.) | `src/modules/*/` | TODO |
| 18 | **Reduce 737 `any` type declarations** - focus on public API surfaces first | Codebase-wide | TODO |
| 19 | **Add Node.js version runtime check** (enforce >= 22.0.0 in app startup) | `src/core/App.tsx` or `vite.config.ts` | TODO |
| 20 | **Add Sentry error tracking configuration for production** (imported but verify DSN) | `src/services/` | TODO |
| 21 | **Create OpenAPI/Swagger specs for Cloud Functions** | `functions/src/` | TODO |
| 22 | **Add color contrast testing** (WCAG 2.1 AA compliance) | `e2e/` | TODO |
| 23 | **Set up Storybook** for shared UI component documentation | `src/components/ui/` | TODO |
| 24 | **Add bundle size monitoring** (track regressions with size-limit or bundlesize) | CI/CD | TODO |
| 25 | **Add Firebase App Check enforcement** for production (currently optional) | `src/config/firebase.ts` | TODO |
| 26 | **Add HTTP caching headers** for static assets beyond JS/CSS (images, fonts, WASM) | `firebase.json` | TODO |
| 27 | **Add loading skeleton screens** instead of generic spinner for modules | `src/core/App.tsx` | TODO |
| 28 | **Add offline-first data sync** for Firestore (beyond PWA cache) | `src/services/` | TODO |
| 29 | **Fix the HACK comment** - add proper mode field to creative panel state | `src/core/components/right-panel/CreativePanel.tsx` | TODO |
| 30 | **Add request deduplication** for concurrent API calls | `src/services/ai/AIService.ts` | TODO |

---

## STANDARD PRIORITY (P3) — Polish & hardening

| # | Item | File/Area | Status |
|---|------|-----------|--------|
| 31 | **Add Lighthouse CI** to deployment pipeline (performance regression alerts) | `.github/workflows/deploy.yml` | TODO |
| 32 | **Add source maps upload to Sentry** for production error debugging | Build pipeline | TODO |
| 33 | **Add feature flag system** for gradual rollouts (LaunchDarkly, Firebase Remote Config) | `src/config/` | TODO |
| 34 | **Add API response caching layer** (reduce Gemini API token consumption) | `src/services/cache/` | TODO |
| 35 | **Add health check endpoint** for monitoring | `functions/src/` | TODO |
| 36 | **Add structured logging** (JSON format for production log aggregation) | `src/core/logger/` | TODO |
| 37 | **Add user session timeout/refresh** for long-running sessions | `src/core/store/slices/authSlice.ts` | TODO |
| 38 | **Add database migration strategy** for Firestore schema changes | `docs/` | TODO |
| 39 | **Add uptime monitoring** (Firebase status, Gemini API availability) | External service | TODO |
| 40 | **Add privacy policy and terms of service** pages | `landing-page/` | TODO |
| 41 | **Add GDPR/data export** capability for user data | `functions/src/` | TODO |
| 42 | **Add deployment rollback strategy** (Firebase hosting rollback, Functions versioning) | `docs/` | TODO |
| 43 | **Add end-to-end encryption** for sensitive agent-to-agent communication | `python/tools/` | TODO |
| 44 | **Add load testing** validation (k6/Artillery scripts exist in `load-tests/`) | `load-tests/` | TODO |
| 45 | **Add changelog automation** (conventional commits -> CHANGELOG.md generation) | CI/CD | TODO |
| 46 | **Add code signing** for Electron desktop builds (macOS notarization, Windows signing) | `electron-builder.json` | TODO |
| 47 | **Add auto-update mechanism** for Electron desktop app | `electron/main.ts` | TODO |
| 48 | **Add internationalization (i18n)** framework for multi-language support | `src/` | TODO |
| 49 | **Add comprehensive keyboard shortcuts** documentation | `src/core/components/CommandBar.tsx` | TODO |
| 50 | **Add onboarding analytics** (track funnel drop-off, completion rates) | `src/modules/onboarding/` | TODO |

---

## Progress Summary

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| P0 Critical | 5 | 5 | 0 |
| P1 High | 10 | 3 | 7 |
| P2 Medium | 15 | 0 | 15 |
| P3 Standard | 20 | 0 | 20 |
| **Total** | **50** | **8** | **42** |

**Current Grade: C+ → B-** (all blockers resolved, build passes)
