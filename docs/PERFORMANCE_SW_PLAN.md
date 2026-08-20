# Service Worker / Offline Caching Plan (Follow-up)

**Status:** Proposed — no code changes yet. Scope approved as a follow-up task
separate from the performance pass. This document defines the what/why/risks so
the implementation can proceed as its own scoped task.

## 1. Goal

Make repeat visits to the Studio app (and the landing page) faster and usable
offline, without changing product behavior when online:

- **Repeat-visit speed:** precache the app shell (index.html, bootstrap.js,
  vendor react/ui/firebase/motion chunks, CSS) so navigation starts from cache
  while the network revalidates.
- **Resilience:** graceful degradation on flaky networks (the app already has
  Firestore offline persistence via `persistentLocalCache` + an IndexedDB
  media cache, so the data layer is already offline-capable).
- **Safety:** never serve stale HTML/JS that breaks the SPA (cache-first with
  network-first revalidation for the shell; immutable caching for hashed assets).

## 2. Existing State

- `packages/renderer/package.json` already lists the workbox modules needed
  (workbox-core, routing, strategies, precaching, cacheable-response,
  expiration) — the infrastructure was anticipated but no SW is registered.
- `packages/renderer/public/firebase-messaging-sw.js` exists for FCM web push.
  Firebase requires the messaging SW at `/firebase-messaging-sw.js` — the app
  SW must NOT claim that path (or must forward to it).
- Firebase Hosting already sends `Cache-Control: max-age=31536000, immutable`
  for hashed `/assets/*` and `no-cache` for HTML — the SW builds on this.
- `MediaCacheManager` (IndexedDB media cache) already caches Firestore-bound
  media — the SW should not duplicate that storage.

## 3. Design

### 3.1 Studio app SW (`public/sw.js` or Vite-generated)

1. **Precache (install):**
   - `/` (index.html), `/manifest.json`, `/favicon.svg`,
     `/apple-touch-icon.png`, `/icon-web-512.png`
   - The "core" asset set for the login/startup path:
     `index-*.js`, `vendor-react-*`, `vendor-ui-*`, `vendor-motion-*`,
     `vendor-lucide-*`, `vendor-firebase-*`, `vendor-i18n-*`,
     `vendor-preload-helper-*`, CSS files, `bootstrap.js`,
     `firebase-messaging-sw.js`.
   - Generated at build time (Vite `generateSW` or a small manifest script)
     so the precache list always matches the deployed hashes.
2. **Runtime strategies:**
   - `/assets/*` (hashed) → `CacheFirst` with 30-day expiration — never
     revalidated (immutable by contract).
   - Navigation requests (`GET` document mode) → `NetworkFirst` with a
     cache fallback to the precached index.html; timeout ~3s so slow networks
     fall back to cache instead of blank screens.
   - Same-origin API/Firestore calls → network only (never cache responses).
   - Cross-origin (Firestore REST, Storage, functions) → network only.
3. **Update flow:** `skipWaiting` + `clientsClaim`; a lightweight "update
   available" event so the app can show a non-blocking refresh prompt (the
   PWAInstallPrompt component already exists for install UX).
4. **FCM coexistence:** the app SW handles fetch events for everything except
   `/firebase-messaging-sw.js` scope; the messaging SW stays untouched.
5. **Registration:** in `main.tsx` after load (deferred, like Sentry init),
   guarded by `'serviceWorker' in navigator` and HTTPS.

### 3.2 Landing page

- Lighter scope: precache index.html + assets; NetworkFirst for navigations.
- Landing is marketing content — prefer always-fresh HTML (no-store today),
  so use NetworkFirst with short timeout and no offline-first claims.

## 4. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Stale shell after deploy | Hashed assets are immutable; HTML revalidates (NetworkFirst); new SW activates on next load with skipWaiting |
| SW caching auth'd Firestore data | Firestore already persists via IndexedDB (SDK-managed); SW never intercepts `firestore.googleapis.com` |
| CSP `worker-src` | Current CSP allows `worker-src 'self' blob: 'unsafe-eval'` — same-origin SW OK; verify `script-src` for the SW file itself (same-origin allowed) |
| FCM SW conflict | Separate scope/file; messaging SW untouched |
| Dev-mode confusion | Register SW only in production builds (`import.meta.env.PROD`) |
| Test flakiness | SW registration excluded from jsdom tests (guarded); Playwright e2e gets a dedicated SW test with a clean context |

## 5. Phases

1. **P1 (studio shell):** build-time precache manifest + SW with NetworkFirst
   navigations + CacheFirst assets; register in prod only. Verify: offline
   login page loads; online behavior unchanged; FCM push still works.
2. **P2 (update UX):** update-available event + refresh prompt; storage
   cleanup (old precaches); expiration tuning.
3. **P3 (landing):** same pattern for the marketing site.
4. **P4 (measure):** repeat-visit timings (TTFB from cache), offline smoke,
   Lighthouse PWA checks; compare against the numbers in the perf report.

## 6. Acceptance Criteria

- Cold load: unchanged or faster (no SW overhead).
- Repeat load with network blocked: app shell renders (login page usable;
  Firestore offline persistence already covers data).
- After a deploy: users on old SW get the new shell on their next navigation
  without manual cache clearing.
- FCM web push continues to work; messaging SW file untouched.
- No new console errors; e2e + unit suites stay green.

## 7. Out of Scope

- Push-notification delivery (existing FCM flow).
- Background sync / offline mutations queue (would need auth + rules review).
- Electron (has its own update/offline model).
