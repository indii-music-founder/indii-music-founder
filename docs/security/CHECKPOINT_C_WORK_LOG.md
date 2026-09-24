# Checkpoint C — Computer-Control Security Boundary

- Canonical repository: `github.com/indii-music-founder/indii-music-founder`
- Canonical checkout: `/Volumes/X SSD 2025/Users/narrowchannel/Documents/Codex/2026-09-20/referenced-chatgpt-conversation-this-is-an/work/canonical-main-2`
- Branch: `main`
- Original starting SHA: `b20629161c78f8ba39aed0cc359154611bf07530`
- Reconciled `origin/main` baseline: `12177e3e2f09bd334e73d3a302b3c4269cb2adf8`
- Ending implementation SHA: `518cec8cc4191cc0b9643ce4cd44755f2aaeabaa`
- Commit identity: both unpublished checkpoint commits were rewritten to `285726670+wiil-tech@users.noreply.github.com` before push; no private address is published by this checkpoint

## Scope

Moved computer-control authorization to the Electron main process. Main now verifies the Firebase identity token and AOP opt-in, reads the persisted approval through the signed-in user's Firestore boundary, and issues short-lived capabilities bound to user, renderer process, renderer session, agent, tool, action, normalized arguments, expiry, and one-use state. Composite drive grants are scope- and action-count-limited. Abort, OS permission checks, and the application allowlist remain independent gates. Renderer-accessible abort reset, allowlist mutation, and broad session-grant IPC endpoints were removed. Text injection is disabled because the current providers cannot reliably identify password or payment fields.

HyperFrames remains the video engine. No Remotion or Vino path was added.

## Validation evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `npx vitest run packages/main/src/handlers/computer.test.ts packages/main/src/services/computer/ComputerAuthorizationService.test.ts packages/main/src/services/ComputerExecutionService.test.ts packages/renderer/src/core/components/right-panel/ToolApprovalsPanel.test.tsx packages/renderer/src/services/agent/ComputerAgentDriver.test.ts packages/renderer/src/services/agent/governance/ToolApprovalService.test.ts` | 0 | 53 tests passed |
| Focused ESLint on all changed TypeScript/TSX files | 0 | No errors or warnings |
| `npm run typecheck` | 0 | All workspaces and Firebase tests passed |
| `npm run lint` | 0 | Passed; 198 pre-existing repository warnings, zero errors |
| `git diff --check origin/main..HEAD` and `git diff --cached --check` | 0 | Passed |
| `npm run validate:capabilities` | 0 | 199 entries valid |
| `node scripts/validate-flowcharts.js` | 0 | Passed |
| `node scripts/verify-api-system-integrity.js` | 0 | Passed |
| `npm run check:dep-drift` | 0 | Passed |
| `npm run build:electron` | 0 | Main, preload, and renderer production bundles built |
| `npm run check:dep-integrity` | 1 | Pre-existing unrelated violation: renderer imports undeclared `@mediapipe/tasks-vision` from `FacePipeline.ts` |
| `npm run ci` | 1 | Checkpoint tests passed, but shard 1 was blocked by missing admin-dashboard Firebase env vars and missing `node_modules/ffmpeg-static/ffmpeg` (`ENOENT`) in two media tests; remaining reported tests passed |

The CI command propagated its real non-zero status. No failure was hidden by a pipe, skip, mock, or warning suppression.

## Conditional or unverified claims

- Firebase Admin token verification and Firestore REST policy lookup are typechecked, built, and covered through injected boundary mocks; a live Firebase identity/AOP/approval was not exercised because this checkout has no Firebase client configuration.
- macOS/Windows accessibility, Screen Recording, application launch, click, key, and scroll behavior are covered with boundary/provider mocks; no live OS permission dialog or real destructive input was exercised.
- The Electron production bundle was built, but a signed/packaged desktop application was not launched.
- No external computer-control provider was invoked.
- Firestore rules/emulator and live Firebase tests were not run because this change does not modify rules and the required live/emulator prerequisites were not present.

## Files changed

Main-process authorization/backend, computer handlers and execution service, preload/shared IPC contracts, renderer approval bridge and computer tools/driver, focused tests, allowlist UI (read-only at the renderer boundary), and the main package manifest/lockfile for `firebase-admin`.
