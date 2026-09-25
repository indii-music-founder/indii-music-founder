# Checkpoint C — Computer-Control Security Boundary

- Canonical repository: `github.com/indii-music-founder/indii-music-founder`
- Canonical checkout: `/Volumes/X SSD 2025/Users/narrowchannel/Documents/Codex/2026-09-20/referenced-chatgpt-conversation-this-is-an/work/canonical-main-2`
- Branch: `main`
- Original starting SHA: `b20629161c78f8ba39aed0cc359154611bf07530`
- Reconciled `origin/main` baseline: `12177e3e2f09bd334e73d3a302b3c4269cb2adf8`
- Ending implementation SHA: `518cec8cc4191cc0b9643ce4cd44755f2aaeabaa`
- Commit identity: both unpublished checkpoint commits were rewritten to `285726670+wiil-tech@users.noreply.github.com` before push; no private address is published by this checkpoint

## Approval-boundary remediation (2026-09-24)

- Starting SHA: `84c3f339d3a9fef76af301f70270579bc9cc025f`
- Reconciled pre-commit baseline: `f14b6ff5f736391f51274fd728d2e04c0e173c2f`
- Ending SHA: this remediation commit; the exact immutable SHA is recorded in the final checkpoint report and CI run
- Upstream state at start: clean `main`, fast-forwarded to the then-current `origin/main`

The renderer now creates only a pending computer-control request. The Electron main process displays a native, default-cancel confirmation containing the exact normalized action scope, then asks a trusted Firebase callable to atomically claim the immutable pending record before minting a one-use local capability. The claim transaction binds user, approval, agent, tool, arguments, and creation time; concurrent claims and claims after application restart cannot both succeed. Firestore rules deny all client-side computer approval transitions and prevent mutation of authority-bearing fields for other approval families. Expired, consumed, and revoked in-memory capabilities are pruned.

Jev/TypeSafe's current live guidance was reviewed as an additional design check: model judgments do not participate in this security boundary. Identity, AOP opt-in, confirmation, scope binding, replay prevention, abort, OS permissions, and allowlists remain deterministic code. No TypeSafe credential was present, so no live Jev request was claimed or required.

### Remediation validation

| Command | Exit | Result |
| --- | ---: | --- |
| Focused Vitest security set covering authorization service, IPC handlers, execution, renderer approval bridge, composite driver, and approval UI | 0 | 56 tests passed; a later focused rerun after the renderer transition test passed 27 tests |
| `npx --no-install firebase emulators:exec --only firestore,storage --project indii-music-founder "npm run test:rules"` | 0 | 5 files, 285 tests; client-created pending requests allowed while forged, mutated, approved, claimed, and deleted computer approvals were denied |
| `NODE_OPTIONS='--max-old-space-size=5120' npm test -- --run --reporter=verbose --testTimeout=30000 --bail=3 --shard=16/20 --maxWorkers=1` | 0 | Exact previously failing CI shard: 63 files, 462 tests |
| `npm run typecheck` | 0 | All workspaces and Firebase tests passed |
| Focused ESLint on remediation source and tests | 0 | No errors or warnings |
| `npm run lint` | 0 | Passed |
| `npm run validate:capabilities` | 0 | 199 entries valid |
| `node scripts/validate-flowcharts.js` | 0 | Passed |
| `node scripts/verify-api-system-integrity.js` | 0 | Passed |
| `npm run check:dep-drift` | 0 | Passed |
| `npm run build:electron` | 0 | Main, preload, and renderer production bundles built; existing chunk-size warning only |
| `npm run check:dep-integrity` | 1 | Pre-existing unrelated violation: renderer imports undeclared `@mediapipe/tasks-vision` from `FacePipeline.ts` |
| `npm run ci` | 1 | Security and remaining test coverage passed, but the full gate reproduced unrelated local prerequisites: missing admin-dashboard Firebase env vars, missing `node_modules/ffmpeg-static/ffmpeg`, and an incorrectly installed local Electron binary. Shard 1: 3 failures/597 passes; shard 2: 2 failures/1,882 passes; shard 4: 2,275 passes. The command propagated the non-zero exit. |

### Remediation test coverage and limits

Tests cover renderer bypass attempts, direct IPC without authorization, missing/invalid identity, AOP opt-out, expired/revoked/wrong-user/wrong-renderer/wrong-session/wrong-tool/wrong-action/modified-argument grants, exact one-use execution, concurrent persistent claim attempts across separate authorization-service instances, native cancellation, trusted-claim failure, abort precedence, mocked OS permission denial, application allowlisting, and composite-tool scope enforcement.

The Firestore rules were exercised against the local emulator. Firebase callable transaction behavior is typechecked and boundary-tested with injected backends, but no deployed callable or live Firebase approval transaction was exercised. The native Electron dialog is covered with Electron boundary mocks, not a signed packaged application. Real macOS/Windows permission prompts and destructive OS input remain unverified. No screenshots, entered text, credentials, or sensitive argument payloads are added to audit logs; text injection remains disabled.

After the pre-commit fetch, `origin/main` advanced to `467b22272a9ff965c6f711dc152690de49a682a7`. It was fast-forwarded without conflict. That upstream Jev test commit initially failed typecheck because it injected a mock client into a zero-argument constructor; the exact root cause was fixed by adding an optional typed client constructor to `JevGuardrailService`. Its focused test passed (2 tests) and the full typecheck then exited 0.

## Scope

Moved computer-control authorization to the Electron main process. Main now verifies the Firebase identity token and AOP opt-in, reads the persisted approval through the signed-in user's Firestore boundary, and issues short-lived capabilities bound to user, renderer process, renderer session, agent, tool, action, normalized arguments, expiry, and one-use state. Composite drive grants are scope- and action-count-limited. Abort, OS permission checks, and the application allowlist remain independent gates. Renderer-accessible abort reset, allowlist mutation, and broad session-grant IPC endpoints were removed. Text injection is disabled because the current providers cannot reliably identify password or payment fields.

HyperFrames remains the video engine. No Remotion or Vino path was added.

## Validation evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `npx vitest run packages/main/src/handlers/computer.test.ts packages/main/src/services/computer/ComputerAuthorizationService.test.ts packages/main/src/services/ComputerExecutionService.test.ts packages/renderer/src/core/components/right-panel/ToolApprovalsPanel.test.tsx packages/renderer/src/services/agent/ComputerAgentDriver.test.ts packages/renderer/src/services/agent/governance/ToolApprovalService.test.ts` | 0 | 53 tests passed |
| `NODE_OPTIONS='--max-old-space-size=5120' npm test -- --run --reporter=verbose --testTimeout=30000 --bail=3 --shard=16/20 --maxWorkers=1` | 0 | Exact previously failing CI shard passed: 63 files, 462 tests |
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

The first exact-SHA push (`d7af001217e8e99d4e072a4ba62452b2f847e3a1`, run `36047171375`) exposed one CI-only test portability defect: the kill-switch reset assertion inherited the host platform, so Linux reported accessibility as unsupported. The follow-up pins that test's mocked platform to macOS with granted permissions; production permission enforcement is unchanged.

## Conditional or unverified claims

- Firebase Admin token verification and Firestore REST policy lookup are typechecked, built, and covered through injected boundary mocks; a live Firebase identity/AOP/approval was not exercised because this checkout has no Firebase client configuration.
- macOS/Windows accessibility, Screen Recording, application launch, click, key, and scroll behavior are covered with boundary/provider mocks; no live OS permission dialog or real destructive input was exercised.
- The Electron production bundle was built, but a signed/packaged desktop application was not launched.
- No external computer-control provider was invoked.
- Firestore rules/emulator and live Firebase tests were not run because this change does not modify rules and the required live/emulator prerequisites were not present.

## Files changed

Main-process authorization/backend, computer handlers and execution service, preload/shared IPC contracts, renderer approval bridge and computer tools/driver, focused tests, allowlist UI (read-only at the renderer boundary), and the main package manifest/lockfile for `firebase-admin`.
