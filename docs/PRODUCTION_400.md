# indiiOS: The 400-Point Production Readiness Checklist (Part 6)

This document contains **Part 6** of the master production readiness checklist (Items 316–415). These items represent **real, identified gaps** discovered through a systematic static audit of the existing codebase — not aspirational features. Each item references the specific file, line number, or architectural concern it addresses.

> **Audit Methodology:** Runtime pattern analysis (`eval()`, `as any`, empty catch blocks, missing cleanup), Firestore rule ownership gaps, CI/CD pipeline coverage, rate-limiting inventory, Zod validation coverage, lazy-load error boundary audit, dangerouslySetInnerHTML XSS scan, and onSnapshot lifecycle audit across `src/`, `functions/`, `electron/`, and `.github/`.

---

## Part 6A: Critical Security Fixes (316–325)

- [x] **316. XSS: DOMPurify in InboxTab HTML Renderer:** `src/modules/agent/components/InboxTab.tsx:286` uses `dangerouslySetInnerHTML={{ __html: fullMessage.bodyHtml }}` with no visible sanitization. Install `dompurify` + `@types/dompurify` and wrap: `__html: DOMPurify.sanitize(fullMessage.bodyHtml, { ALLOWED_TAGS: [...], FORBID_SCRIPTS: true })`.
- [x] **317. Firestore Rule: Posts Ownership Check Missing:** `firestore.rules` social posts collection allows `update, delete` for any `isAuthenticated()` user — not scoped to `resource.data.userId == request.auth.uid`. Any authenticated user can delete or overwrite another user's posts.
- [x] **318. Firestore Rule: Venues Ownership Gap:** `firestore.rules` venues collection allows `create, update` for `isAuthenticated()` — no ownership check. Any user can spam or overwrite any venue document.
- [x] **319. Eval() in WorkflowEngine:** `src/services/workflow/services/WorkflowEngine.ts` contains `eval()` calls. Replace with a safe AST-based expression evaluator (e.g. `expr-eval`, `mathjs`) or a sandboxed `Function()` constructor with explicit scope injection.
- [x] **320. Eval() in Marketing Services:** `src/services/marketing/InfluencerBountyService.ts` and `src/services/marketing/SocialAutoPosterService.ts` contain `eval()` calls. Replace with deterministic template interpolation (`Handlebars`, `mustache`, or string.replace with whitelist).
- [x] **321. Eval() in Agent Test Harness:** `src/services/agent/sdk/test/AgentTestHarness.ts` uses `eval()`. Replace with a test-safe dynamic import or explicit handler registry pattern.
- [x] **322. Electron: Missing Content-Security-Policy Header:** `electron/main.ts` sets COEP/COOP headers but no `Content-Security-Policy`. Add via `session.defaultSession.webRequest.onHeadersReceived` or `BrowserWindow.webContents.session`: `script-src 'self'; object-src 'none'; base-uri 'self'`.
- [x] **323. Electron: Deep Link URL Validation:** `electron/main.ts` passes raw `indii-os://` protocol URLs to `handleDeepLink()` without validation. Add URL parsing and whitelist of allowed paths before processing — prevents open-redirect and command injection via crafted protocol URLs.
- [x] **324. Electron: Auto-Updater Code Signing Verification:** Verify `electron/updater.ts` enforces `allowPrerelease: false`, verifies update signatures, and has a rollback handler on install failure. Confirm Windows NSIS installer is code-signed.
- [x] **325. Electron: webSecurity Production Guard:** `electron/main.ts:64` sets `webSecurity: !isDev`. Add a hard assertion: `if (app.isPackaged && !webPreferences.webSecurity) throw new Error('webSecurity must be enabled in production')`.

---

## Part 6B: Firebase Functions Hardening (326–335)

- [x] **326. Rate Limit: Image Generation Endpoints:** `functions/src/index.ts` — `generateImageV3Fn` and `editImageFn` have no rate limiting despite being the highest-cost endpoints. Add `rateLimit({ tokensPerInterval: 5, interval: 'minute' })` (same pattern as `triggerVideoJob`).
- [x] **327. Rate Limit: Audio Analysis Endpoint:** `analyzeAudioFn` (functions/src/index.ts) has no rate limiting. Audio analysis invokes Essentia.js and can run for 30s — add per-user rate limit of 10/hour.
- [x] **328. Rate Limit: Token Exchange Endpoints:** All email/social OAuth token refresh and exchange Cloud Functions lack rate limiting. Add 20 req/minute per UID to prevent token-stuffing attacks.
- [x] **329. Zod Validation: Image Generation Input:** `generateImageV3Fn` and `editImageFn` accept raw callable data without Zod schema validation. Add schema: `{ prompt: z.string().max(2000), width: z.number().max(2048), height: z.number().max(2048) }`.
- [x] **330. Zod Validation: Audio Analysis Input:** `analyzeAudioFn` callable accepts raw `data` without schema. Add `{ audioUrl: z.string().url(), features: z.array(z.string()) }` Zod validation.
- [x] **331. App Check Enforcement Default:** `functions/src/index.ts:87` — `ENFORCE_APP_CHECK` defaults to `false`. Flip default to `true` and require opt-out via `SKIP_APP_CHECK=true` in dev; prevents accidental production deploy without App Check.
- [x] **332. Firestore Write Schema Validation in Functions:** `functions/src/index.ts:366` writes `videoJobs` documents with no schema guard. Add a Zod `videoJobSchema` and validate before `admin.firestore().set()` — prevents schema drift corrupting documents.
- [x] **333. Social Post Delivery Error Handling:** `functions/src/social/deliverScheduledPosts.ts:60-108` — fetch calls to Twitter/Instagram/TikTok APIs have no try/catch around `response.json()` or HTTP status checks. Add per-platform error handling with structured failure logging and Firestore status update on failure.
- [ ] **334. Security Handler: Real Key Rotation API Calls:** `electron/handlers/security.ts:38` builds `sk_test_rotated_${suffix}` — simulated rotation only. Wire real Stripe `POST /v1/restricted_keys` and GitHub `PATCH /repos/{owner}/{repo}/actions/secrets/{secret_name}` API calls.
- [ ] **335. Functions Cold Start: Move Heavy Imports Inside Handlers:** Top-level imports of large SDKs (Essentia, DDEX parsers) in `functions/src/index.ts` increase cold start time. Move inside function handlers using dynamic `import()` for functions that aren't invoked frequently.

---

## Part 6C: React Error Boundaries & Resilience (336–342)

- [x] **336. Error Boundaries on All Lazy Modules:** `src/core/App.tsx:52-85` — 30+ lazy-loaded modules are wrapped in `<Suspense>` but only ~3 have `<ModuleErrorBoundary>`. Add `<ModuleErrorBoundary moduleName="X">` to every lazy module render: `CreativeStudio`, `LegalDashboard`, `MarketingDashboard`, `VideoStudio`, `WorkflowLab`, `Dashboard`, and the remaining 25.
- [x] **337. Empty Catch Block Remediation:** `src/modules/merchandise/components/WalletConnectPanel.tsx` and `src/modules/dashboard/components/RecentProjects.tsx` have `.catch(() => {})` — silently swallowing errors. Replace with `catch (err) { logger.error('...', err); }` and surface via toast where appropriate.
- [x] **338. onSnapshot Cleanup Audit:** 236 `onSnapshot` calls across the codebase — audit each `useEffect` containing `onSnapshot` to confirm the cleanup function returns `unsubscribe()`. Fix any missing returns. Priority: `src/services/video/`, `src/services/ai/`, `src/modules/distribution/`.
- [x] **339. Fetch Error Handling: response.json() on Non-200:** Multiple service files call `await res.json()` without first checking `res.ok`. If the server returns HTML error page, JSON parse throws. Add `if (!res.ok) throw new Error(await res.text())` pattern across `src/services/`.
- [x] **340. Service Worker: Push Event Handler:** `src/service-worker.ts` lacks a `push` event listener. Add handler that shows a notification and opens the app — otherwise registered push subscriptions silently fail to display.
- [x] **341. Service Worker: Share Target Input Validation:** `src/service-worker.ts:77-127` — the Share Target handler accepts files from external apps without type, size, or name validation. Add whitelist of MIME types and 50MB size cap before passing to IndexedDB.
- [x] **342. aria-live Regions for Dynamic Content:** Real-time status updates (Agent sidecar health, upload queue progress, delivery status) have no `aria-live` attribute. Add `aria-live="polite"` to the sidecar status indicator and `aria-live="assertive"` to error toasts.

---

## Part 6D: CI/CD Pipeline Hardening (343–349)

- [x] **343. Add Typecheck Step to CI Before Build:** `.github/workflows/deploy.yml` runs lint and tests but never runs `npm run typecheck`. TypeScript errors currently slip through to production. Add `- run: npm run typecheck` between lint and build steps.
- [ ] **344. Test Sharding for Vitest:** `.github/workflows/deploy.yml:67-69` uses `--no-file-parallelism`. Replace with `--shard=1/4` across 4 parallel matrix jobs to cut CI time from ~30min to ~8min.
- [x] **345. Gate E2E on Unit Test Success:** `.github/workflows/deploy.yml` runs E2E tests unconditionally. Add `needs: unit-tests` and `if: success()` to the E2E job to skip expensive Playwright runs when unit tests already fail.
- [x] **346. Blocking Lighthouse CI Thresholds:** `.github/workflows/deploy.yml:164-167` — Lighthouse failures emit `::warning::` but don't fail the build. Make blocking: performance ≥ 80, accessibility ≥ 90, best-practices ≥ 90. Use `lhci assert` with `--preset=lighthouse:recommended`.
- [x] **347. Blocking Accessibility Audit in CI:** axe-core runs in E2E but failures don't block deployment. Add `failOnViolations: true` to the axe configuration and make the job exit non-zero on any WCAG AA critical violation.
- [x] **348. Preview Channel Deployment Before Production:** `.github/workflows/deploy.yml` deploys directly to the `app` Firebase Hosting target. Add a preview channel step: `firebase hosting:channel:deploy pr-${PR_NUMBER}` and require manual promotion to production.
- [x] **349. Dependency Security Audit in CI:** Add `npm audit --audit-level=high` as a non-blocking warning step in the deploy pipeline. Escalate to blocking after a 2-week grace period for fixing existing vulnerabilities.

---

## Part 6E: TypeScript Quality (350–355)

- [ ] **350. Audit and Fix as-any Casts in Critical Paths:** 626 `as any` casts exist across 177 files. Prioritize eliminating unsafe casts in: `src/services/distribution/DistributionService.ts`, `src/services/finance/`, `src/services/agent/AgentZeroService.ts`. Replace with proper generics or discriminated unions.
- [x] **351. Fix @ts-ignore in Core Files:** `src/core/App.tsx`, `src/core/hooks/usePowerState.ts`, and `src/core/components/UpdaterMonitor.tsx` have `@ts-ignore` comments. Investigate the root type mismatch and fix properly — likely requires updating a type definition or adding an overload.
- [ ] **352. Add Return Type Annotations to Exported CF Functions:** Cloud Functions in `functions/src/` lack explicit return type annotations. Add `Promise<{ result: ... }>` signatures to all `onCall` handlers — improves IDE support and prevents unintentional return shape changes.
- [ ] **353. Non-Null Assertion Audit in Distribution Service:** `src/services/distribution/DistributionService.ts` uses non-null assertions (`!`) on values derived from user data and external APIs. Replace with explicit null checks and early returns.
- [x] **354. Strict Mode for Functions TypeScript:** `functions/tsconfig.json` — verify `"strict": true` is set. If not, enable it and fix the resulting errors to enforce null safety at the Cloud Functions layer.
- [ ] **355. noUncheckedIndexedAccess for Array Safety:** Add `"noUncheckedIndexedAccess": true` to `tsconfig.json`. This catches array index out-of-bounds as a TypeScript error. Fix resulting issues in service layer array processing code.

---

## Part 6F: Performance & Bundle Optimization (356–363)

- [x] **356. Reduce Vite chunkSizeWarningLimit:** `vite.config.ts:164` sets `chunkSizeWarningLimit: 3000` (3MB). Lower to `1000` and fix resulting warnings by splitting large vendor chunks (Three.js, Fabric.js, Remotion) into separate manual chunks.
- [x] **357. Three.js Tree-Shaking:** Three.js (`three@0.182`) is imported as `import * as THREE from 'three'` in several files. Switch to named imports: `import { Scene, Camera, Renderer } from 'three'` to enable tree-shaking and reduce bundle by estimated 300KB.
- [x] **358. Remotion Lazy-Load:** Remotion (`remotion@4.0`) is a large video rendering library. Wrap the Video module's Remotion usage in `dynamic import()` to defer loading until the Video module is actually activated.
- [x] **359. Fabric.js Lazy-Load:** `fabric@6.9` (~500KB gzipped) is used only in the Creative Studio canvas. Ensure it's only loaded when `src/modules/creative/` activates — verify no top-level import in `App.tsx` or shared components.
- [x] **360. Missing React.memo on High-Rerender Components:** `src/core/components/Sidebar.tsx` re-renders on every store update due to shallow subscription to 6 state slices. Wrap `NavItem` in `React.memo` and verify `useShallow` is correctly preventing parent re-renders.
- [x] **361. Wavesurfer.js Deferred Init:** `wavesurfer.js@7.11` initializes on component mount. Move init to first-play event to avoid ~50ms blocking during audio module load.
- [x] **362. Image Optimization Pipeline:** Cover art uploads in the distribution flow store raw user images (potentially 10MB+). Add client-side canvas resize to 3000×3000px max and convert to WebP before Firebase Storage upload.
- [x] **363. Core Web Vitals: LCP Target < 2.5s:** Run Lighthouse against production build. The main dashboard module is eagerly loaded — verify `<Suspense>` fallback shows within 100ms. Add `fetchpriority="high"` to hero image assets.

---

## Part 6G: Test Coverage Expansion (364–372)

- [x] **364. Unit Tests: DistributionService.ts:** `src/services/distribution/DistributionService.ts` orchestrates the entire release delivery pipeline (metadata validation → DDEX generation → SFTP upload) with zero unit tests. Write Vitest tests for the happy path and each error branch.
- [x] **365. Unit Tests: TaxService.ts:** `src/services/distribution/TaxService.ts` has no tests. Tax calculations are legally significant — write tests for all US withholding rate tiers and VATMOSS scenarios.
- [ ] **366. Unit Tests: AIService.ts:** `src/services/ai/AIService.ts` (Gemini wrapper) has no unit tests. Mock `@google/genai` and test prompt construction, streaming handler, token budget enforcement, and error fallback.
- [ ] **367. Unit Tests: AgentOrchestrator.ts:** `src/services/agent/AgentOrchestrator.ts` routes all agent tasks — zero test coverage. Write tests for task routing logic, specialist selection, and fallback when a specialist is unavailable.
- [ ] **368. Unit Tests: CanonicalMapService.ts:** `src/services/distribution/CanonicalMapService.ts` maps internal metadata to distributor-specific formats (DDEX ERN, CD Baby, TuneCore). Write schema compliance tests for each adapter mapping.
- [ ] **369. Unit Tests: RagService.ts:** `src/services/rag/ragService.ts` manages knowledge retrieval — partial tests only. Complete coverage of chunk splitting, embedding, retrieval ranking, and context window management.
- [ ] **370. Component Tests: Finance Module:** `src/modules/finance/` has 10+ components with zero tests. Start with `EarningsDashboard.tsx` and `LabelDealRecoupment.tsx` — render + interaction tests.
- [ ] **371. Component Tests: Legal Module:** `src/modules/legal/components/DMCANoticeGenerator.tsx` and `ContractReviewPanel.tsx` generate legally significant outputs — add tests validating output structure.
- [x] **372. Snapshot Tests for Core Shell:** `Sidebar.tsx`, `CommandBar.tsx`, `RightPanel.tsx` — add Vitest snapshot tests to catch unintended UI regressions in the chrome that every module depends on.

---

## Part 6H: Electron Desktop Hardening (373–379)

- [x] **373. Electron: preload.ts IPC Allowlist Audit:** Audit `electron/preload.ts` for all exposed `ipcRenderer.invoke()` channels. Ensure every channel is explicitly allowlisted in `main.ts`'s `ipcMain.handle()` and rejects unknown channel names.
- [x] **374. Electron: Crash Reporter Integration:** Add `crashReporter.start({ submitURL: 'https://sentry.io/api/...' })` in `electron/main.ts` main process and renderer. Surface crash info to the engineering team without exposing PII.
- [x] **375. Electron: Secure Session Cookie Flags:** Verify Electron session cookies set `HttpOnly`, `Secure`, and `SameSite=Strict` flags. Add `session.defaultSession.cookies` audit on startup.
- [x] **376. Electron: Windows NSIS Code Signing in CI:** Verify `.github/workflows/build.yml` includes the Windows code-signing step using `WINDOWS_CERTIFICATE` secret and `signtool.exe`. Missing signature causes SmartScreen warnings on install.
- [x] **377. Electron: App Quit Cleanup for WebSocket/SSH Connections:** `electron/handlers/` may hold open SSH2 SFTP connections after SFTP delivery. Add `app.on('before-quit')` handler to close all active connections.
- [ ] **378. Electron: Memory Profiling for Long Sessions:** Add a developer-only memory snapshot tool (accessible via `--inspect` flag) to track heap growth over 4+ hour sessions — desktop apps are prone to long-session memory leaks.
- [x] **379. Electron: Protocol Registration Hardening:** `electron/main.ts:279-319` registers `indii-os://` protocol. Add SSRF protection: reject URLs that resolve to localhost, 169.254.x.x (link-local), or RFC1918 private ranges in deep link payloads.

---

## Part 6I: Real-Time & Offline Resilience (380–386)

- [x] **380. onSnapshot Cleanup: Video Services:** `src/services/video/` — audit all `onSnapshot` subscriptions for missing `return () => unsubscribe()` in `useEffect`. Long video job polls that never clean up accumulate open connections.
- [x] **381. onSnapshot Cleanup: AI Context Management:** `src/services/ai/` context management files subscribe to Firestore for conversation history. Verify all subscriptions have proper teardown in `useEffect` return.
- [x] **382. onSnapshot Cleanup: Distribution Status Polling:** `src/modules/distribution/components/TransmissionMonitor.tsx` polls delivery status via `onSnapshot`. Confirm subscription is cancelled when component unmounts and when job reaches terminal state.
- [ ] **383. Offline: Firestore Pending Write Conflict Resolution:** When the app comes back online after a period of edits, Firestore offline persistence may surface write conflicts. Add a conflict resolution strategy (last-write-wins with timestamp, or merge logic) in `MetadataPersistenceService`.
- [x] **384. Background Sync for Failed Social Posts:** Scheduled posts that fail delivery are marked failed in Firestore but not retried. Add exponential backoff retry logic in `deliverScheduledPosts.ts` — retry failed delivery up to 3× before final failure notification.
- [x] **385. Workbox: Offline Fallback for Navigation Requests:** `src/service-worker.ts` caches assets but has no offline fallback HTML page for navigation requests when the shell can't load. Add `offlineFallback: '/offline.html'` with a minimal informational page.
- [x] **386. IndexedDB Quota Management:** The offline queue and RAG cache write to IndexedDB without quota checks. Add `navigator.storage.estimate()` before writes and warn when remaining quota < 50MB.

---

## Part 6J: Observability & Monitoring (387–393)

- [x] **387. Structured Error Logging in Cloud Functions:** Cloud Functions use `logger.error()` but log unstructured strings. Switch to structured logging: `logger.error({ message: '...', userId, releaseId, errorCode })` — enables BigQuery log analysis and alerting on specific error types.
- [ ] **388. Client-Side Error Tracking (Sentry):** Add `@sentry/react` and `@sentry/electron` for production error capture. Configure `Sentry.init({ dsn, environment, tracesSampleRate: 0.1 })` in `App.tsx` and Electron main process.
- [x] **389. Firebase Performance Monitoring:** Add `firebase/performance` and instrument the 3 most critical user flows: (1) Release creation → distribution submit, (2) AI image generation end-to-end, (3) Agent chat first response time.
- [ ] **390. Custom BigQuery Dashboard for Revenue Metrics:** Analytics events fire to Firebase Analytics but no BigQuery dashboard visualizes revenue funnel: free → trial → pro → label plan. Build a Looker Studio report on top of the existing `analytics` Cloud Function data.
- [x] **391. Health Check Endpoint for Agent Zero Sidecar:** `localhost:50080` sidecar has no documented health endpoint. Add `GET /health` returning `{ status: 'ok', version, uptime }` — enables Electron to surface sidecar status and GCP uptime checks to monitor it.
- [ ] **392. Alert on High Agent Error Rate:** Add a Cloud Monitoring metric that alerts when agent task failures exceed 10% of requests in a 5-minute window. Route to PagerDuty or Slack `#incidents` channel.
- [x] **393. Release Delivery Audit Log:** Every SFTP upload, DDEX submission, and delivery status change should write an immutable audit record to `distribution_audit/{releaseId}/events/{eventId}`. Currently only Firestore document state is tracked, not event history.

---

## Part 6K: PWA & Mobile (394–399)

- [x] **394. Push Notification Permission Flow:** The app registers a FCM token in `firebase-messaging-sw.js` but there is no user-facing UI that requests `Notification.requestPermission()` and explains the value proposition before the browser prompt appears.
- [x] **395. App Install Prompt Analytics:** `src/components/PWAInstallPrompt.tsx` shows the install prompt but does not track `prompt shown`, `prompt accepted`, `prompt dismissed` events to Firebase Analytics. Add events to measure PWA install conversion.
- [x] **396. iOS PWA Splash Screen and Status Bar:** `index.html` is missing `<meta name="apple-mobile-web-app-status-bar-style">` and platform-specific splash screen meta tags. iOS PWA installs show a white flash on launch.
- [x] **397. Viewport Lock for Mobile Modals:** Several modals use `position: fixed` without `touch-action: none` on the scroll container. On iOS Safari, background content scrolls behind an open modal. Add `overscroll-behavior: contain` to modal overlays.
- [x] **398. Web Share API for Release Links:** Add a Share button on the Release Detail page that calls `navigator.share({ title, url })` on supported browsers — enables artists to share release links directly from the app to social platforms.
- [ ] **399. Biometric Auth on Mobile PWA:** `BiometricGate.tsx` targets Electron's `keytar`. Extend with `PublicKeyCredential` / WebAuthn for mobile PWA biometric auth (Face ID / Touch ID via browser API) as a fallback when Electron APIs are unavailable.

---

## Part 6L: Advanced Agent Features (400–407)

- [x] **400. Agent Memory Persistence Across Sessions:** Agent conversation history is held in React state and lost on page reload. Persist the last N=50 messages to Firestore `users/{uid}/agent_sessions/{sessionId}/messages` and hydrate on load.
- [ ] **401. Agent Tool Result Streaming:** Agent tool calls (image gen, video gen, audio analysis) return results in a single response after completion. Add streaming progress updates via Firestore `agent_tasks/{taskId}/progress` that the UI subscribes to.
- [ ] **402. Multi-Agent Parallel Task Execution:** AgentZero currently executes specialist tasks sequentially. Implement parallel task fan-out for independent subtasks (e.g. generate press release + generate social posts + create campaign brief simultaneously).
- [x] **403. Agent Cost Circuit Breaker Production Wiring:** `CostCircuitBreaker.ts` exists but verify it is actually called before every AI generation invocation in production code paths — grep for all Gemini API calls and confirm each passes through the circuit breaker.
- [x] **404. Agent Zero Sidecar Health Auto-Restart:** When the sidecar becomes unreachable, `AgentZeroService` marks it offline but Electron has no auto-restart logic. Add `app.on('renderer-process-crashed')` + Docker restart policy and surface a "Restarting AI service…" overlay.
- [x] **405. Agent Conversation Export:** Add a "Export Chat" button to the agent panel that generates a timestamped JSON or Markdown transcript of the full session — useful for artists reviewing AI-generated strategies.
- [x] **406. Agent Tool Use Audit Log:** Every tool invocation (image gen, distribution submit, legal contract review) should write a structured record to `users/{uid}/agent_audit/{id}` — gives artists visibility into what the AI did on their behalf.
- [ ] **407. Agent Task Queue Persistence:** If the app closes mid-task, queued agent work is lost. Persist the task queue to Firestore `users/{uid}/agent_queue` and resume on next launch.

---

## Part 6M: Advanced Distribution (408–415)

- [ ] **408. Automated ISRC Assignment:** When a new release is created without an ISRC, auto-assign one using the user's registered registrant code prefix (stored in their profile). Currently ISRC is manually entered — blocking distribution for non-technical users.
- [ ] **409. UPC Barcode Generation:** Releases require a UPC barcode for physical/digital distribution. Add a UPC generation service that draws from a pre-purchased block of UPCs (stored in Firestore) and assigns one on release creation.
- [ ] **410. Distributor Delivery Receipt Storage:** After SFTP upload, save the raw delivery receipt (SFTP confirmation log, API response) to Firebase Storage at `distribution/receipts/{releaseId}/{distributor}_{timestamp}.txt`. Currently delivery proof is not persisted.
- [x] **411. Release Takedown Flow:** There is no UI for requesting a release takedown (DMCA counter-notice, voluntary withdrawal). Add a "Request Takedown" action in Release Detail that writes to `distribution_takedowns/{releaseId}` and notifies relevant adapters.
- [ ] **412. Split Sheet PDF Export:** `SplitSheetEscrow.tsx` manages royalty splits but there is no PDF export for legal documentation. Generate a signed split sheet PDF using `pdfkit` or a Cloud Function and deliver via email + Firebase Storage.
- [ ] **413. Distributor API Version Pinning:** Distributor adapters hit live API endpoints without version pinning. If TuneCore or CD Baby releases a breaking API change, all deliveries fail. Add explicit API version headers and a version-check startup probe.
- [x] **414. Release Metadata Versioning:** When metadata is edited post-distribution, there is no history of what was sent to each distributor. Add a `metadata_history` subcollection under each release that snapshots metadata at every distribution event.
- [ ] **415. DDEX DSP Acknowledgement Processing:** After delivery, DSPs send back acknowledgement ERN messages confirming ingestion. Add a Cloud Function (`processDDEXAck`) that parses inbound ACK messages (stored in a Storage bucket) and updates the release delivery status.

---

## Summary

| Category | Items | Priority |
|----------|-------|----------|
| Critical Security (XSS, Firestore rules, eval) | 316–325 | **P0** |
| Firebase Functions Hardening | 326–335 | **P0** |
| React Error Boundaries & Resilience | 336–342 | **P0** |
| CI/CD Pipeline Hardening | 343–349 | **P1** |
| TypeScript Quality | 350–355 | **P1** |
| Performance & Bundle | 356–363 | **P1** |
| Test Coverage Expansion | 364–372 | **P2** |
| Electron Desktop Hardening | 373–379 | **P1** |
| Real-Time & Offline Resilience | 380–386 | **P2** |
| Observability & Monitoring | 387–393 | **P2** |
| PWA & Mobile | 394–399 | **P2** |
| Advanced Agent Features | 400–407 | **P3** |
| Advanced Distribution | 408–415 | **P3** |

**Total: 100 items (316–415)**
