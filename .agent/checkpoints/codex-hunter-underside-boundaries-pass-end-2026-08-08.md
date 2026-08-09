# Codex Hunter underside/boundaries pass — 2026-08-08

## Perspective and scope

This pass inspected the application from underneath its visible workflows: account switching, persisted state, OAuth callbacks, background work, browser/Electron policy, device-resource teardown, service workers, external navigation, modal focus, and UI claims that did not have a working backend.

Billing was excluded at the user's direction.

## Findings closed

- Account transitions now reset private Zustand state, listeners, subscriptions, cached services, IndexedDB data, account-owned local/session storage, encryption/signing material, work queues, and background connections before the next account hydrates. Cleanup is serialized across rapid account changes, stale profile or generation completions are discarded, and any cleanup failure keeps the private workspace locked behind a retry screen without advancing the account marker.
- OAuth sessions are bound to provider, Firebase UID, state, and a ten-minute lifetime. Spotify PKCE and Instagram, TikTok, YouTube, and email OAuth state can no longer be consumed by a different signed-in account.
- Email refresh tokens remain server-side. Callback redirects are exact and allowlisted, provider identities are verified before atomic persistence, refresh no longer accepts a client refresh token, and disconnect revokes/deletes server credentials instead of reporting a rules-denied client deletion as success.
- Firebase Hosting and Electron now permit only the device capabilities and direct integration endpoints the Studio actually uses. Landing pages retain a deny-all permissions policy, and arbitrary Electron web contents cannot request Studio device permissions.
- Webcam, photo-source camera, geolocation, and focus timers now stop or invalidate late work on close, retake, capture, or unmount.
- WebSocket, A2A, agent, direct-generation, repository, event, cache, and approval services now respect account boundaries and clear in-flight or persistent state.
- The service worker no longer caches Firebase Storage responses, clears the legacy private cache, bounds and validates shared inputs, and sanitizes notification/share navigation.
- Focus traps, keyboard registrations, and custom modal accessibility now clean up deterministically. The affected modals have dialog semantics and stable labels.
- The fabricated Geo Bounty deployment UI was removed. Marketing search is controlled and filters real campaign fields.
- User- or document-supplied external URLs are normalized to HTTP(S), bounded, and opened with opener isolation.

The detailed issue record is ISSUE-1347 through ISSUE-1353 in `.agent/test_ledger/OPEN_ISSUES_V3.md`. Reusable failure patterns were added to `.agent/skills/error_memory/ERROR_LEDGER.md`.

## Validation completed before delivery

- Focused Vitest regression suite: 16 files, 64 tests passed.
- TypeScript typecheck: passed.
- ESLint: passed with zero errors; 152 pre-existing warnings remain.
- API/system integrity verifier: passed.
- Production dependency audit (`npm audit --omit=dev`): zero vulnerabilities.
- Studio production build: passed; existing chunk/import warnings remain non-fatal.
- API structural suite: 24 tests passed.
- Local mobile-browser structural check at a phone viewport confirmed `/privacy`, `/terms`, `/tax-form-upload`, and `/login` remained on their requested paths and did not render the mobile-remote disconnected screen.
- Canonical `npm run ci`: passed after repairing the App test mocks for the new account-reset export and making shared modal focus initialization deterministic while preserving explicit `autoFocus`.

`npm run detect:bugs` remains red with a heuristic score of 126. Manual triage found a real geolocation lifecycle defect and fixed it; the remaining categories are broad heuristics (base64 use, callable sites, awaits, Firebase coupling, `.then`, and enum comparisons), not a passing quality gate or proof of additional confirmed defects.

## Evidence boundary

The local browser and API suites are structural evidence only. No genuine account was created through the UI, no actual customer plan was observed, and no production authenticated workflow was claimed. Production/authenticated acceptance remains unverified because genuine authorization was unavailable and the known Firebase situation remains external to this pass. No mock, injected session, fabricated entitlement, or alternate credential was used to substitute for real-user evidence.
