# indiiOS: The 300-Point Production Readiness Checklist (Part 5)

This document contains **Part 5** of the master production readiness checklist (Items 201–315). These items represent **real, identified gaps** discovered through a systematic audit of the existing codebase — not aspirational features. Each item references the specific file, service, or architectural concern it addresses.

> **Audit Methodology:** Static analysis of mock patterns (`Math.random`, `setTimeout`, `TODO`, `stub`), dead imports, disabled services, missing API implementations, zero accessibility attributes, and structural security gaps across the full `src/`, `functions/`, `electron/`, and `e2e/` directories.

---

## Part 5A: Commerce & Payment Hardening (201–210)

- [x] **201. Enable PaymentService for Real Billing:** `PaymentService.ts:57` has `enabled: false` hardcoded. Wire real Stripe Checkout sessions for subscription billing — Free / Pro / Label tiers must accept real cards before public launch.
- [x] **202. Stripe Connect Real Payout Routing:** `SplitSheetEscrow.tsx` escrows funds in UI, but `functions/src/stripe/connect.ts` has no actual transfer trigger. Implement `stripe.transfers.create()` when all split signatories confirm.
- [x] **203. Webhook Signature Verification:** Verify Stripe webhook events with `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`. Currently missing signature check allows forged webhook events.
- [x] **204. Failed Payment Dunning Flow:** Implement retry + dunning email sequence via SendGrid when a subscription renewal fails — prevents silent churn without user notification.
- [x] **205. PDF Invoice Generation:** Generate and email PDF invoices for enterprise/label plan subscribers using `pdfkit` or Firebase Extensions PDF generator.
- [x] **206. Promotional Code System:** Implement Stripe coupon/promo code flow for artist beta onboarding discounts — surface a promo code input in the checkout UI.
- [x] **207. Stripe Tax Integration:** Enable `automatic_tax: { enabled: true }` in Stripe Checkout to auto-collect VAT/GST for EU/AU/CA subscribers and avoid tax liability.
- [x] **208. Revenue Share Ledger Real-Time Sync:** When a Stripe payout fires, write the split breakdown to Firestore `users/{uid}/ledger` in real time so the Finance dashboard reflects accurate balances.
- [x] **209. Metered Billing for Distribution Fees:** Implement Stripe metered billing for per-track distribution fees — artists on lower tiers pay per release, not flat subscription.
- [x] **210. LemonSqueezy Fallback Payment Provider:** `PaymentService.ts` references LemonSqueezy but provides no implementation. Either wire it as a Stripe fallback or remove the dead reference to reduce confusion.

---

## Part 5B: Distributor Adapter Completion (211–220)

- [x] **211. TuneCore Adapter Real API Calls:** `src/services/distribution/adapters/TuneCorAdapter.ts` is a skeleton — no actual HTTP requests. Implement OAuth token exchange and metadata upload endpoint calls against the TuneCore API.
- [x] **212. CD Baby Adapter Real API Calls:** Same as TuneCore — skeleton with no live API calls. Implement the CD Baby album creation and audio delivery endpoints.
- [x] **213. Symphonic SFTP Delivery Fix:** `SymphonicAdapter.ts` throws "Real delivery not implemented or SFTP unavailable." Complete the SFTP connection using `electron/main.ts`'s existing SSH2 client.
- [x] **214. DistroKid Credential Onboarding UI:** Add a Settings panel for artists to securely enter their DistroKid SFTP credentials — currently no UI path exists to configure this.
- [x] **215. Onerpm Distributor Adapter:** Add a new `OnerpmAdapter.ts` — Onerpm is a top-5 indie distributor with a documented API and is conspicuously absent from the adapter registry.
- [x] **216. Believe Digital Adapter:** Add `BelieveAdapter.ts` — Believe is the #1 independent distributor globally by market share and has no adapter.
- [x] **217. UnitedMasters Adapter:** Add `UnitedMastersAdapter.ts` for the UnitedMasters direct deal flow — popular with hip-hop and R&B artists who are the core indiiOS demographic.
- [x] **218. Delivery Status Polling & Webhooks:** After SFTP/API delivery, currently there is no status polling. Add a background Cloud Function that checks delivery status every hour and updates the release's `deliveryStatus` field.
- [x] **219. DDEX ERN XSD Schema Validation:** Run the generated ERN XML through an XSD validator before SFTP upload to catch schema violations before distributors reject the delivery.
- [x] **220. Multi-Territory Rights Splits:** The current split sheet system applies one set of splits globally. Add territory-scoped splits so EU publishing rights can go to one entity and US rights to another.

---

## Part 5C: Social Media Real API Integrations (221–228)

- [x] **221. Twitter/X API v2 Real Posting:** `SocialAutoPosterService.ts` writes scheduled posts to Firestore but does NOT call the Twitter API. Implement `POST /2/tweets` using the stored OAuth tokens.
- [x] **222. Instagram Graph API Real Posting:** Same issue — posts are stored in Firestore, never delivered. Implement the Instagram Content Publishing API (`POST /{ig-user-id}/media` + `/{ig-user-id}/media_publish`).
- [x] **223. TikTok Content Posting API:** Implement TikTok's Content Posting API (v2) for direct video upload to TikTok — the service currently has no TikTok delivery logic.
- [x] **224. YouTube Data API v3 Upload:** Wire `YouTube.videos.insert()` for direct video uploads to the artist's connected YouTube channel — bypasses the current Firestore-only approach.
- [x] **225. Spotify for Artists Real Stats Sync:** `DSPAnalyticsService` reads from mock data. Implement real Spotify for Artists API polling (or webhook) to pull genuine stream counts and listener geography.
- [x] **226. Scheduled Post Background Delivery:** The pre-save campaign and social scheduling system stores posts with a `scheduledAt` timestamp but has no background job that fires the post at the right time. Implement a Cloud Scheduler + Cloud Function to execute the delivery.
- [x] **227. Social Analytics Aggregation Dashboard:** Unify real social platform analytics (X follower growth, IG impressions, TikTok plays) into a single normalized dashboard panel instead of mock data arrays.
- [x] **228. Social OAuth Token Refresh:** Social API access tokens expire. Implement automatic token refresh using stored refresh tokens before they expire, and surface a re-auth prompt when refresh fails.

---

## Part 5D: PRO & Rights Management Real Integrations (229–235)

- [ ] **229. ASCAP Work Registration API:** `PublishingService` acknowledges ASCAP but makes no API calls. Implement ASCAP Work Registration API to auto-register new compositions when a release is submitted.
- [ ] **230. BMI Songwriting Registration:** Same gap — add BMI work registration API flow alongside ASCAP registration, triggered on release creation.
- [ ] **231. SoundExchange Digital Performance Enrollment:** Add a one-time setup flow to enroll the artist's Sound Recordings with SoundExchange for digital performance royalties (satellite, internet radio).
- [ ] **232. Harry Fox / Music Reports Cover Song Verification:** `MechanicalLicensingService` shows an acknowledgment checkbox but does not call the HFA API to verify license issuance before cover song delivery.
- [ ] **233. YouTube Content ID Real Delivery Parameters:** The Content ID opt-in toggle in the distribution UI stores a flag but never sends the actual content policy to YouTube CMS during delivery. Wire this into the DDEX metadata blob.
- [ ] **234. Loudness Compliance Validation (LUFS):** Add server-side LUFS measurement in the QC pipeline — Spotify requires -14 LUFS-I, Apple requires -16 LUFS-I. Block delivery if track fails loudness check.
- [ ] **235. Apple Digital Masters Badge Qualification:** Add a QC gate that verifies the master is 24-bit/96kHz or higher before tagging the release as "Apple Digital Masters" eligible and delivering to Apple Music.

---

## Part 5E: Blockchain / Web3 Real Implementation (236–240)

- [ ] **236. WalletConnect v2 Real Integration:** `WalletConnectPanel.tsx` renders a mock QR code. Replace with `@walletconnect/web3modal` or `wagmi` to enable real wallet connections.
- [ ] **237. Ethers.js Smart Contract Deployment:** `SmartContractService.ts` generates random fake addresses (`0x${Math.random().toString(16)...}`). Integrate `ethers.js` + Alchemy/Infura to deploy real ERC-1155 contracts on a testnet first, then mainnet.
- [ ] **238. IPFS Real Pinning via Pinata:** `BlockchainLedger.tsx` shows a "Sync to IPFS" button that sets a pending state forever. Implement `@pinata/sdk` calls to pin release metadata CIDs to IPFS.
- [ ] **239. OpenSea API Integration:** After NFT minting, submit the token to OpenSea's API to create a marketplace listing — currently there is no post-mint delivery step.
- [ ] **240. ENS / Unstoppable Domains Artist Identity:** Allow artists to claim a `.eth` or `.nft` domain as their verified on-chain identity, displayed in their profile and EPK.

---

## Part 5F: Legal Document Real Integrations (241–245)

- [x] **241. DocuSign API Real Envelope Sending:** `DigitalSignatureService.ts:37` uses `setTimeout(..., 1500)` as a mock. Replace with real DocuSign `envelopes.create()` API calls with actual split sheet PDFs attached.
- [ ] **242. PandaDoc Alternative Provider:** Implement `PandaDocAdapter.ts` as a fallback to DocuSign — some music industry attorneys prefer PandaDoc. Route based on user preference in settings.
- [ ] **243. Contract Template Version Control:** Store contract templates in Firestore with version history so that a change to a split sheet template doesn't retroactively affect previously signed agreements.
- [ ] **244. Immutable Legal Audit Trail:** Legal actions (signature requests, completions, rejections) must write to an append-only Firestore collection with server timestamps — cannot be edited or deleted by any client.
- [ ] **245. Notarization Integration (Notarize.com):** Add an optional notarization step via the Notarize.com API for high-value agreements (publishing deals, sync licensing contracts > $10k).

---

## Part 5G: Security Hardening (246–258)

- [x] **246. Remove Hardcoded Sentry DSN:** `src/lib/sentry.ts:3` contains the production Sentry DSN as a hardcoded string fallback. Move to `VITE_SENTRY_DSN` env var with no fallback — fail loudly in CI if missing.
- [x] **247. Enable Firebase App Check in Production:** Cloud Functions have `ENFORCE_APP_CHECK` toggled via env var but default OFF. Set this to `true` in production to block unauthenticated bots from invoking AI generation functions.
- [x] **248. Content Security Policy Headers:** Add strict CSP headers in `firebase.json` hosting config — currently missing. Block inline scripts and restrict `connect-src` to Firebase, Gemini, and Sentry domains only.
- [x] **249. CORS Origin Restriction:** Cloud Functions currently use permissive CORS. Lock `Access-Control-Allow-Origin` to `https://app.indiios.com` and `https://localhost:4242` only.
- [ ] **250. AI Prompt Injection Sanitization:** User-provided text passed to `GenAI.generateText()` is unsanitized. Add a prompt sanitizer that strips jailbreak patterns before sending to Gemini.
- [x] **251. Secrets Scanner in CI:** Add `truffleHog` or `gitleaks` as a GitHub Actions pre-commit step to automatically block any commit that contains API keys, tokens, or secrets.
- [ ] **252. Dependency Vulnerability Scanning:** Add `npm audit --audit-level=high` and Snyk GitHub Action to the CI pipeline to catch supply chain vulnerabilities in dependencies.
- [ ] **253. Firestore Security Rules Unit Tests:** Add Firebase Emulator-based rules tests (`@firebase/rules-unit-testing`) to CI to prevent security regressions when rules change.
- [ ] **254. Electron contextIsolation Audit:** Verify every `electron/preload.ts` exposure uses `contextBridge.exposeInMainWorld()` — confirm `nodeIntegration: false` and `contextIsolation: true` for all `BrowserWindow` instances.
- [x] **255. HTTP Strict Transport Security:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to Firebase Hosting headers to prevent protocol downgrade attacks.
- [ ] **256. API Key Rotation Runbook:** Document a step-by-step key rotation procedure for Firebase API Key, Gemini API Key, and Stripe Secret Key — including which services need redeployment.
- [x] **257. God Mode Quota Bypass Removal:** `functions/src/index.ts:361–364` grants unlimited AI generation to a hardcoded email list. Replace with a proper enterprise plan entitlement check tied to the subscription system.
- [ ] **258. Audit Log Hash Chain:** Each audit log entry in `users/{uid}/auditLogs` should include a `prevHash` field (SHA-256 of previous entry) to create a tamper-evident chain — without this, entries can be silently deleted.

---

## Part 5H: Performance & Monitoring (259–268)

- [ ] **259. Firebase Performance Monitoring:** The `@firebase/performance` SDK is not initialized anywhere in the app. Add it to `src/services/firebase.ts` and instrument the top 5 user flows (release submission, AI generation, image export, SFTP delivery, chat response).
- [ ] **260. Core Web Vitals Reporting:** Add `web-vitals` library with `onLCP`, `onFID`, `onCLS` callbacks reporting to Firebase Analytics — required for Google Search ranking.
- [ ] **261. Bundle Size Budget Enforcement:** Add `rollup-plugin-visualizer` to `vite.config.ts` and set a CI size budget — the main bundle must stay under 500KB gzipped or the build fails.
- [ ] **262. Three.js WebGL Memory Cleanup:** `ThreeSceneBuilderService.ts` and `3D` components do not call `geometry.dispose()` or `material.dispose()` on unmount. Add cleanup in `useEffect` return functions to prevent GPU memory leaks.
- [ ] **263. Firestore Composite Index Audit:** Run `firebase firestore:indexes` against the production ruleset and add missing composite indexes for common agent query patterns (e.g., `userId + createdAt + assetType`).
- [ ] **264. Virtualized List Components:** `TrackListItem`, `WorkflowNode`, and agent history panels render all items. Replace with `react-virtual` or `@tanstack/react-virtual` for lists exceeding 50 items.
- [ ] **265. Image Lazy Loading with IntersectionObserver:** The generated images grid in `CreativeCanvas.tsx` loads all thumbnails at once. Add `loading="lazy"` and IntersectionObserver-based loading for performance on large catalogs.
- [ ] **266. Firestore `onSnapshot` Cleanup:** Audit all components using `onSnapshot` listeners — verify every listener is unsubscribed in the `useEffect` cleanup return to prevent memory leaks on route change.
- [ ] **267. Firebase Hosting Cache-Control Tuning:** JS chunk files under `dist/assets/` should have `Cache-Control: max-age=31536000, immutable` in `firebase.json`. HTML entry point should have `no-cache`. Currently using defaults.
- [ ] **268. Webpack/Vite Chunk Splitting Audit:** `vite.config.ts` has manual chunk splitting but Three.js (0.182), Fabric.js (6.9), and Remotion (4.0) are likely landing in the main chunk. Move to dynamic `import()` to split these heavy libraries.

---

## Part 5I: Accessibility / WCAG 2.1 (269–276)

- [ ] **269. ARIA Labels on Icon-Only Buttons:** A codebase-wide grep for `<button` and `<IconComponent` shows zero `aria-label` attributes on icon-only controls throughout the modules. Every icon button needs an `aria-label`.
- [ ] **270. Keyboard Navigation Audit:** Tab order must be logical across all 20+ feature modules. Run a keyboard-only walkthrough and fix any focus traps, skipped elements, or unreachable controls.
- [ ] **271. Focus Trap in Modals:** All modal dialogs (`PitchDraftingModal`, `StorefrontPreviewModal`, `DropCampaignWizard`, etc.) must trap focus inside when open using a `useFocusTrap` hook — currently focus escapes into the background DOM.
- [ ] **272. Aria-Live Regions for Async Updates:** Agent responses, sync status changes, and toast notifications must be announced via `aria-live="polite"` regions for screen readers.
- [ ] **273. Color Contrast Audit:** Run `axe-core` against the dark theme — all text must meet WCAG 4.5:1 contrast ratio. The muted gray text on dark backgrounds (`text-gray-400 on gray-800`) is likely failing.
- [x] **274. Skip to Main Content Link:** Add a visually-hidden `<a href="#main-content">Skip to main content</a>` as the first focusable element in `App.tsx` for keyboard and screen reader users.
- [ ] **275. Explicit Form Label Associations:** Every `<input>`, `<textarea>`, and `<select>` across all module forms must have an explicit `<label htmlFor>` or `aria-label` — currently most forms rely on placeholder text only.
- [ ] **276. Prefers-Reduced-Motion Support:** Wrap all Framer Motion `animate` and `transition` props with a `useReducedMotion()` check — users with vestibular disorders should see instant transitions when `prefers-reduced-motion: reduce` is set.

---

## Part 5J: Test Coverage Expansion (277–284)

- [ ] **277. E2E Tests for 25 New Components:** The following components created in PRODUCTION_200 have zero Playwright E2E coverage: `CustomDashboard`, `AnomalyDetector`, `AuditLogsPanel`, `BudgetVsActuals`, `MultiCurrencyLedger`, `ReceiptOCR`, `RoyaltiesPrediction`, `SplitSheetEscrow`, `StripeConnectOnboarding`, `TaxFormCollection`, `MicroLicensingPortal`, `AdBuyingPanel`, `CommunityWebhookPanel`, `EPKGenerator`, `EmailMarketingPanel`, `FanDataEnrichment`, `InfluencerBountyBoard`, `MomentumTracker`, `PreSaveCampaignBuilder`, `SMSMarketingPanel`, `StepStepper`, `SetlistAnalytics`, `VisaChecklist`, and the full legal module components.
- [ ] **278. Payment Flow E2E Tests:** Test the complete subscription checkout journey: plan selection → Stripe Checkout → webhook → subscription activation → feature gating.
- [ ] **279. Distribution Delivery E2E Test:** Mock an SFTP server in CI and test the full release delivery pipeline from metadata entry through SFTP upload to status confirmation.
- [ ] **280. Offline Queue Drain E2E Test:** Test that `MetadataPersistenceService`'s localStorage queue items are correctly drained when `window.online` event fires — critical for offline-first promise.
- [ ] **281. Agent Tool Integration Tests:** Write Vitest integration tests for each agent tool in `src/services/agent/tools/` using mocked Firestore — verify tool inputs/outputs conform to agent schema.
- [ ] **282. Vitest Coverage Threshold Enforcement:** Add `coverage.thresholds` to `vitest.config.ts` with a minimum 75% branch coverage gate — build fails if coverage drops below this.
- [ ] **283. Distributor Adapter Contract Tests:** Write consumer-driven contract tests for each distributor adapter using recorded HTTP fixtures — prevents adapter regressions when distributors change their APIs.
- [ ] **284. Load Testing Baseline:** Run k6 or Artillery load test against Cloud Functions with 100 concurrent users and establish performance baselines for `generateContent`, `createRelease`, and `processPayment` endpoints.

---

## Part 5K: UX Polish & Onboarding (285–292)

- [x] **285. Onboarding Flow Wiring:** `StepStepper.tsx` was created but is not mounted anywhere in `App.tsx` or the onboarding module router. Wire it to the first-run experience for new user accounts.
- [ ] **286. Empty State Illustrations:** All data panels (Tracks, Releases, Campaigns, Tours, Merch) show blank divs when there's no data. Add meaningful empty states with illustration, headline, and a primary CTA.
- [ ] **287. Loading Skeleton Screens:** Replace all `isLoading ? null : <Content/>` patterns with proper skeleton placeholder components — reduces perceived load time and prevents layout shift.
- [x] **288. Per-Module Error Boundaries:** Wrap every lazy-loaded module in `src/core/App.tsx` with a `<ErrorBoundary>` component that shows a friendly fallback instead of a white screen on runtime error.
- [ ] **289. Toast Deduplication & Queue Cap:** `SYSTEM_ALERT` events can fire multiple times simultaneously (e.g., during offline sync). Implement a toast queue that deduplicates identical messages within a 2-second window.
- [ ] **290. Contextual First-Run Tooltips:** Add a Shepherd.js or Intro.js guided tour for first-time users that highlights the Command Bar, module switcher, and AI Chat affordances.
- [x] **291. Destructive Action Confirmation Dialogs:** Actions like "Delete Release," "Remove Collaborator," and "Cancel Subscription" have no confirmation dialog — a single misclick is destructive and non-recoverable.
- [ ] **292. Undo Support for Drag-Drop Widgets:** `CustomDashboard.tsx` allows users to rearrange widgets but there is no undo for accidental drops. Add a single-level undo via a `previousLayout` ref.

---

## Part 5L: Infrastructure & DevOps (293–302)

- [x] **293. Staging Firebase Project:** Create a `indiiOS-staging` Firebase project with its own Firestore, Auth, and Storage — currently there is only one project, so all dev testing hits the production database.
- [ ] **294. Blue/Green Deploy via Firebase Hosting Channels:** Use `firebase hosting:channel:deploy preview-{branch}` in GitHub Actions for PR previews — allows QA sign-off before merging to production.
- [x] **295. Automated Daily Firestore Export:** Set up a Cloud Scheduler job running `gcloud firestore export` to a dedicated backup GCS bucket daily — there is currently no backup strategy.
- [ ] **296. Disaster Recovery Runbook:** Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets and the step-by-step restoration procedure for a full Firestore data loss event.
- [ ] **297. Secrets Migration to Google Secret Manager:** All secrets currently live in GitHub Actions secrets and local `.env` files. Migrate to Google Cloud Secret Manager with fine-grained IAM access control.
- [ ] **298. Cloud Functions Memory & Concurrency Tuning:** Audit function memory allocation — AI generation functions currently run on default 256MB. Video/image generation likely needs 2GB+ and concurrency of 1 to prevent OOM crashes.
- [ ] **299. Feature Flag System:** Implement Firebase Remote Config or LaunchDarkly feature flags to enable gradual rollouts of new features (e.g., Web3, real payment processing) without code deploys.
- [ ] **300. Automated CHANGELOG Generation:** Add `release-please` GitHub Action with conventional commits — auto-generates `CHANGELOG.md` and bumps `package.json` version on merge to main.
- [ ] **301. SLA Uptime Monitoring:** Add Google Cloud Monitoring uptime checks on `https://app.indiios.com`, the Agent Zero sidecar endpoint, and the Gemini proxy function — alert via PagerDuty on downtime.
- [ ] **302. Cost Anomaly Alerts:** Configure GCP budget alerts at 80% and 100% of monthly budget — AI generation functions can spike unexpectedly, currently there is no spend ceiling alerting.

---

## Part 5M: Data, Privacy & Legal Compliance (303–312)

- [x] **303. GDPR Cookie Consent Banner:** EU users must see an explicit consent banner before any analytics or Sentry tracking fires. Currently Sentry and Firebase Analytics initialize unconditionally on page load.
- [x] **304. CCPA "Do Not Sell" Opt-Out:** Add a "Do Not Sell My Data" link in the Privacy settings page for California residents — required for any app serving US users.
- [x] **305. COPPA Age Gate:** Enforce a date-of-birth check during signup — users under 13 must be blocked from creating an account per COPPA.
- [ ] **306. Right to Erasure (GDPR Article 17):** Implement a "Delete My Account" flow that removes all user data from Firestore, Storage, and any third-party services (Stripe customer, Sentry user) within 30 days.
- [ ] **307. Data Export (GDPR Article 20):** Allow users to export all their data (tracks, releases, analytics, contracts) as a ZIP file — the portability right must be fulfilled within 30 days of request.
- [x] **308. DMCA Agent Registration:** Register a DMCA designated agent with the US Copyright Office (required under 17 U.S.C. § 512(c)(2)) and display the agent's contact information in the Terms of Service.
- [x] **309. Terms of Service & Privacy Policy Pages:** Add real, attorney-reviewed ToS and Privacy Policy documents — currently the app links to placeholder pages.
- [ ] **310. Sync Licensing Usage Clearance Docs:** Before a sync brief match is delivered, require the artist to upload proof of clearance for any sampled elements — add a document upload step to the sync licensing workflow.
- [ ] **311. Mechanical Royalty Accounting Integration:** Connect to Harry Fox Agency (Songfile) or Music Reports API to automatically generate and pay mechanical licenses for cover songs before distribution.
- [ ] **312. Label Deal Recoupment Tracking:** Add a Finance module section that tracks label advance amounts, recoupment thresholds, and royalty rate escalators — critical for artists on label deals who use indiiOS.

---

## Part 5N: Internationalization & Localization (313–315)

- [ ] **313. i18n Framework Integration:** Add `react-i18next` and extract all hardcoded UI strings into translation JSON files — the app currently has zero i18n support, blocking non-English markets.
- [ ] **314. Spanish Language Localization:** Spanish is the largest non-English music creator language. Translate all UI strings to `es-419` (Latin American Spanish) as the first non-English locale.
- [ ] **315. Locale-Aware Number & Date Formatting:** Replace all raw `toFixed()`, `new Date().toLocaleDateString()`, and manual currency formatting with `Intl.NumberFormat` and `Intl.DateTimeFormat` — currently formatting is hardcoded to US English conventions.

---

## Summary by Severity

| Severity | Count | Items |
|----------|-------|-------|
| **Critical** (launch blocker) | 18 | 201, 203, 241, 246, 247, 248, 251, 257, 285, 288, 291, 293, 295, 303, 304, 305, 308, 309 |
| **High** (required for real use) | 42 | 202, 204, 211–224, 229–233, 236, 237, 253, 258–260, 263, 269–275, 277–280, 294, 296, 297, 306–308 |
| **Medium** (quality & scale) | 35 | 205–210, 225–228, 234, 235, 238–240, 242–245, 249–252, 254–256, 261–268, 281–284 |
| **Low** (polish & future) | 20 | 286, 287, 289, 290, 292, 298–302, 310–315 |

**Total: 115 items (201–315)**

---

*Audit conducted 2026-03-08. Owner: Antigravity. All items verified against live source files — no aspirational entries.*
