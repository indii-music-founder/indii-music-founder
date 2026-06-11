# Agent Bridge Note
**Written:** 2026-05-31 15:20 EDT
**From:** Claude Opus (CI/e2e root-cause session)
**Re:** e2e-staging failure — root cause found + code fix shipped; needs 2 secrets from you

---

## TL;DR
e2e-staging could NEVER pass as built. I found the real root cause, shipped the
code + workflow fix (commit `3dbe5ec3f` on `main`), and it now needs **two GitHub
Actions secrets** that only someone with Firebase Console access can create. That
handoff is yours. Do NOT revert the code/workflow changes — they are the fix.

## Root cause (confirmed from CI logs of run 26721625434)
- e2e-staging runs against the **deployed staging site**, which is a **PROD build**.
- `e2eMode.ts` line ~11 correctly strips ALL test mocks from PROD builds
  (`if (import.meta.env.PROD && MODE !== 'test') return false`). So the auth-mock
  approach can never activate on deployed staging. (Leave that guard alone.)
- The deployed app therefore hit REAL Firebase. But the build shipped with **no
  App Check key** (the `VITE_FIREBASE_APP_CHECK_KEY` secret referenced in deploy.yml
  does not exist), so App Check never initialized → backend returned **403** on
  every request → app never finished init → dashboard never rendered → every smoke
  test timed out waiting for buttons (`Dashboard`/`Agent Workspace`/CommandBar).
- Log smoking gun: `SECURITY WARNING: App Check key missing in production.` + repeated 403s.
- Separately: e2e-staging had `continue-on-error: true`, so its result stayed
  'success' even when tests failed → broken builds STILL deployed to production.

## What I already fixed and pushed (commit 3dbe5ec3f) — do not redo/revert
1. `packages/renderer/src/services/firebase.ts`: apply an explicit App Check debug
   token in ANY build (not just DEV) when `env.appCheckDebugToken` is set. A headless
   CI browser can't solve reCAPTCHA, so the deployed staging build needs the debug
   token to pass App Check. Security preserved: token only grants App Check passage;
   Firestore/Storage Rules still enforce authz. The `=true` auto-generate fallback
   stays DEV-only.
2. `.github/workflows/deploy.yml` build job: now passes
   `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` into `build:studio` so the staging artifact
   actually carries the token (Vite inlines import.meta.env at build time).
3. `.github/workflows/deploy.yml` e2e-staging: removed `continue-on-error` so a real
   failure sets result='failure' and the deploy-production gate truly blocks. The gate
   is `needs.e2e-staging.result == 'success'` — verified intact.

## YOUR ACTION — create 2 GitHub Actions repo secrets (Firebase Console + GitHub)
Project: `indii-music-founder`. Settings → Secrets and variables → Actions.

1. **VITE_FIREBASE_APP_CHECK_KEY** (public reCAPTCHA site key, starts `6L...`)
   - Firebase Console → App Check → Apps tab → the **Web app** → copy its reCAPTCHA
     v3 / Enterprise **site key**. If no web app is registered for App Check, register
     one first.
2. **VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN** (secret UUID)
   - Firebase Console → App Check → **Manage debug tokens** → Add debug token →
     name it `GitHub Actions CI` → copy the UUID → also keep it registered there.

Once BOTH secrets exist, push any commit (or re-run the workflow). Expected: staging
build carries the App Check key+token → headless CI passes App Check → no 403s → app
loads → smoke tests pass → e2e-staging green → deploy-production gate opens.

## Lane boundaries (so we don't collide)
- I am NOT touching Firebase Console, secrets, or the e2e/App Check code further.
- I'm on the **Stripe** integration thread with the user (test-mode keys for the new
  `wiil@indii.music` sandbox account). If you touch `packages/firebase/src/config/secrets.ts`
  or Stripe wiring, ping here first.

---
*This note overwrites on next bridge update.*
