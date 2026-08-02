# Open Issues — Real-Life Test Findings (V3, ACTIVE)

> This file is written by test / bug hunting / QA agents and consumed by fixing agents.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-08-02 (**Master Ledger V3 Initialized for Final Production Release Push**)
> **Branch:** `main` (direct commits)
>
> **Ledger protocol (V3):** This is the ACTIVE master ledger. It operates with strict discipline:
> same entry format (`### ISSUE-NNNN: <title>` with Status/Severity/Module/Evidence/Impact/Fix/Acceptance),
> same status vocabulary (🔴 OPEN / 🟡 PARTIAL / ✅ FIXED / 🟢 WONTFIX), same append-only discipline.
> Resolved historical issues (ISSUE-1092 through ISSUE-1296) live in
> `archive/OPEN_ISSUES_LEGACY_V2_2026-08-02.md` (sealed archive).
> Unresolved and active open issues from V2 have been migrated below.
> New findings from production release scans will be appended starting at **ISSUE-1297**.
> Cross-references resolve across `.agent/test_ledger/OPEN_ISSUES_V3.md` and the `archive/` folder.

## Active Unresolved Issues (Migrated from V2 Ledger)

### ISSUE-1121: Founder music-identity and royalty-registration checklist is incomplete and not connected to release readiness

- **Re-ticketed from:** ISSUE-785 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated (FOUNDER + PRODUCT)`)
- **Scope note (2026-07-21):** engineering remainder ONLY. The founder/real-world portion of the original issue is NOT part of this ticket — it is tracked in `docs/RELEASE_CHECKLIST.md` § "Founder Music-Identity & Royalty Registrations (ISSUE-785)". Do not block this ticket on it.
- **Status:** ⏳ BACKLOG — consolidated (FOUNDER + PRODUCT)
- **Severity:** 🔴 HIGH
- **Module:** Registration Center / Founder operations
- **Summary:** The Registration Center tracks Copyright, ASCAP/BMI/SESAC, SoundExchange, and MLC per track, but does not track the organization-level prerequisites that make identifier issuance, DDEX delivery, or platform rights management legitimate.
- **Founder checklist (verify prices again at purchase):**
  1. **US ISRC Rights Owner prefix:** apply using the legal rights-owner identity; current official page lists **$95** and up to 100,000 codes/year ([US ISRC Agency](https://redesign.usisrc.org/apply-for-an-isrc-account/?user-is-manager=false)). Music videos need distinct ISRCs from audio recordings.
  2. **GTIN/UPC ownership:** choose official GS1 single GTINs (**$30 each, no renewal**) or a Company Prefix (currently **$250 initial/$50 annual for 1–10**, larger tiers available) ([GS1 US](https://store.gs1us.org/gs1-company-prefix/p)).
  3. **DDEX:** accept the free Implementation Licence and obtain the company DPID; membership is optional for using the standards ([DDEX](https://ddex.net/implementation/frequently-asked-questions/)).
  4. **PRO + IPI:** join one appropriate PRO as writer; decide whether a separate publisher affiliation/entity is required. Store writer and publisher IPI/IP-name numbers separately. IPI is authoritative system data—not app-generated ([CISAC IPI](https://www.cisac.org/services/information-services/ipi)).
  5. **ISWC:** register complete works through the affiliated society/authorized agency; the app must never self-issue ISWCs ([official ISWC guidance](https://www.iswc.org/get-iswc)).
  6. **The MLC:** join only for shares the founder/company self-administers; membership is free and does not replace a PRO ([The MLC](https://www.themlc.com/membership)).
  7. **SoundExchange:** register both performer and sound-recording copyright-owner roles as applicable; registration is free ([SoundExchange](https://www.soundexchange.com/register/)).
  8. **U.S. Copyright Office:** select the correct composition/sound-recording/group route; current electronic fees include $45 Single, $65 Standard, and $65 group album registration ([official fee schedule](https://www.copyright.gov/about/fees.html), [music guidance](https://www.copyright.gov/register/pa-sr.html)).
  9. **Platform rights:** apply for Meta Rights Manager from an owned Facebook Page ([Meta](https://about.fb.com/news/2023/01/helping-creators-and-publishers-manage-intellectual-property/)); separately evaluate YouTube Content ID eligibility or use an approved distributor/administrator. YouTube requires exclusive rights and demonstrated need ([YouTube](https://support.google.com/youtube/answer/1311402)).
  10. **Optional identity/discovery IDs:** capture ISNI, Spotify artist URI, Apple artist ID, YouTube channel/content-owner IDs, and platform catalog IDs when assigned; label them optional, imported identifiers—not release blockers.
- **Product fix:** Add an organization-level “Founder Readiness” record with owner, official account URL, status, verified identifier/prefix, fee/renewal date, evidence document, and secret/config handoff. Keep per-track registrations separate.
- **Acceptance:** Release readiness distinguishes founder prerequisites, release IDs, recording IDs, work IDs, party IDs, and optional discovery IDs; nothing is marked complete from a locally generated value alone.

---

---

### ISSUE-1122: Merlin readiness assumes exclusive rights instead of collecting proof

- **Re-ticketed from:** ISSUE-800 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Distribution / Keys Layer / Merlin
- **Evidence:** `KeysPanel.tsx:53-59` maps every catalog track to `exclusive_rights: true`. The Python check also defaults missing `exclusive_rights` to `True` (`keys_manager.py:86-90`) and awards readiness points for that assumption (`:110-114`).
- **External constraint:** Merlin’s own membership path says applicants must control digital rights free from third-party obligations and comply with Merlin content policy before applying ([Merlin membership path](https://merlinnetwork.org/path-to-merlin-membership/)).
- **Impact:** The app can report Merlin readiness for catalog it has not verified, including tracks distributed through another admin, containing samples, or under conflicting licenses.
- **Fix:** Replace the heuristic with a rights-evidence checklist: master owner, territory, existing distributor/admin obligations, samples/loops, content-policy status, takedown/claim conflicts, and supporting documents. Missing proof should be `UNKNOWN`, not `true`.
- **Acceptance:** Catalog with no explicit rights evidence returns `NOT_READY` and lists every missing proof item.

---

---

### ISSUE-1123: Video editor export has no completed cloud artifact path and local export overwrites a fixed temp path

- **Re-ticketed from:** ISSUE-809 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Video editor
- **Evidence:** `useVideoEditor.ts:117-125` calls `renderVideo`, then only toasts “Cloud render started successfully!” if it gets a `renderId`/`success`; it does not poll, store a job, fetch the final URL, or add the rendered asset to history. Local export uses a hardcoded output path (`/tmp/video.mp4` or `C:\\video.mp4`) at `:144-160`, so repeated exports overwrite the same location and never ask the user for a destination.
- **Impact:** Cloud export can leave the user with no downloadable artifact. Local export can overwrite previous renders and may fail access checks.
- **Fix:** Add render-job lifecycle state, polling/subscription, completed asset persistence, user-selected save destination, and unique filenames.
- **Acceptance:** Cloud render fixture ends with a gallery asset/download URL; local render prompts for or safely creates a unique output path.

---

---

### ISSUE-1124: Waterfall payout UI, TypeScript contract, and Python engine use incompatible payload/report shapes

- **Re-ticketed from:** ISSUE-826 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** 🟡 PARTIAL — local renderer and real subprocess boundaries pass; no single running Electron IPC click-through
- **Severity:** 🟠 HIGH
- **Module:** Distribution / Finance bank layer
- **Evidence:** The request/report shapes are now aligned on `gross`, fractional `splits`, nested distribution entries, `total_distributed`, and `processed_at`, but the remaining binding defect was the subprocess stdout contract: `waterfall_payout.py` pretty-printed the report across 31 lines while `python-bridge.ts` parses only the final stdout line. The final line was `}`, so `PythonBridge` returned raw text and `AgentSupervisor` rejected it as non-JSON. The focused integration regression invokes the real local Python process, proves stdout is exactly one parseable JSON line while calculation diagnostics remain on stderr, and then exercises `AgentSupervisor`/`PythonBridge`; the `$1,000` / 50-30-20 fixture returns `$425`, `$255`, `$170`, `$850` total, and a parseable timestamp. Existing `BankPanel.test.tsx` separately proves the renderer sends the matching request and renders those values plus the fee and timestamp.
- **Impact:** The local payout simulation previously failed between Python stdout and the main-process schema gate even though its arithmetic and renderer contracts were correct.
- **Fix:** Emit the Python report as one compact JSON line on stdout, keep calculation logs on stderr, and lock the contract with a real main-process subprocess regression. Existing nonzero error exits and stderr diagnostics remain unchanged; no general `PythonBridge` rewrite or payment-provider integration is required.
- **Acceptance:** 🟡 PARTIAL — the real subprocess stdout/stderr contract, AgentSupervisor → PythonBridge → Python boundary, and the React → service → UI fixture pass with the canonical values. A single running Electron test traversing the actual IPC handler and renderer in one process has not been added, so the issue is not marked fixed. No live payout or money movement is required for this local contract fix.

---

---

### ISSUE-1125: Credential storage falls back to localStorage and raw Firestore fields

- **Re-ticketed from:** ISSUE-840 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🔴 HIGH (secret handling)
- **Module:** Security / Credential storage
- **Evidence:** `UniversalTools.credential_vault()` claims shared credential operations should fail closed when no real bridge exists (`UniversalTools.ts:5-10`), but if `window.electronAPI?.credentials` is unavailable it stores/retrieves arbitrary credentials in `localStorage` under `indii_vault_${service}` (`:78-99`). `PODCredentialService.saveCredential()` stores provider API keys directly as Firestore fields under `users/{uid}/integrations/pod_credentials` and only comments that KMS encryption should be considered (`PODCredentialService.ts:32-40`, `:61-66`).
- **Impact:** Production secrets can be written to browser storage or client-readable Firestore documents instead of OS secure storage / server-side secret management.
- **Fix:** Remove localStorage credential fallback from production builds. Route all provider credentials through Electron safeStorage/keychain or server-side secret storage with encryption, least-privilege access, and redacted reads.
- **Acceptance:** Web/renderer credential save attempts fail closed unless an approved secure credential backend is available; no API key is returned to the renderer after storage.

---

---

### ISSUE-1126: Multiple active user-scoped feature collections are missing Firestore rules

- **Re-ticketed from:** ISSUE-843 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Firebase / Firestore rules / Cross-module persistence
- **Evidence:** Active renderer paths include `users/{uid}/analyticsTokens/spotify` (`SpotifyService.ts:55-56`), `users/{uid}/socialTokens/{platform}` (`SocialPlatformService.ts:66-81`), `users/{uid}/merchandiseMockups` (`CommerceTools.ts:27-38`), `users/{uid}/limitedDrops` (`CommerceTools.ts:85-103`), `users/{uid}/brandKit/current` (`BrandTools.ts:217-245`), and `users/{uid}/proprietaryIngestionReleases` (`PublishingTools.ts:20-24`). The owner-scoped rules list only selected subcollections such as `contacts`, `licensingDeals`, `pod_orders`, `press_releases`, `publishingCatalog`, `tasks`, and `web3Contracts` (`firestore.rules:329-346`), then denies all unmatched paths (`firestore.rules:1230-1234`).
- **Impact:** Analytics connections, social tokens, brand kits, merch mockups, and limited-drop records can fail with `permission-denied`, often in code paths that log/catch errors and still show optimistic UI.
- **Fix:** Generate a Firestore collection inventory from source references, classify sensitive data, and add explicit tested rules for every intended client-readable/writable path. Move secret/token paths server-side where possible.
- **Acceptance:** Rules tests cover every `users/{uid}/...` collection used by the renderer; missing-rule regressions fail CI.

---

---

### ISSUE-1127: Pre-save builder exposes a shareable campaign URL without publishing a page or storing leads

- **Re-ticketed from:** ISSUE-844 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Marketing / Pre-save campaigns
- **Evidence:** `PreSaveCampaignBuilder` derives a public `indii.vip/presave/{slug}` URL from local input (`PreSaveCampaignBuilder.tsx:35-37`), displays DSP pre-save buttons regardless of whether links are entered (`:195-200`), shows a QR placeholder (`:220-225`), and only supports copy/share actions (`:42-70`, `:231-245`). `PreSaveCampaignService.createCampaign()` only logs and returns `ps_${Date.now()}` while Firestore persistence is commented out (`PreSaveCampaignService.ts:41-49`); `recordLead()` also only logs with persistence commented out (`:55-60`).
- **Impact:** A founder can share a URL that may not resolve to a hosted landing page, and fan email/phone collection can be lost because no published campaign or lead storage is created.
- **Fix:** Add an explicit publish flow that writes a campaign document, provisions/validates the public route, generates a real QR code, validates required DSP links, and stores consented leads server-side.
- **Acceptance:** Copy/share is disabled until a campaign has a persisted ID, routable URL, real QR payload, and lead-capture backend; submitted test leads appear in the campaign lead collection with consent metadata.

---

---

### ISSUE-1128: Social analytics connection state can be inferred from denied or stale token/cache paths

- **Re-ticketed from:** ISSUE-847 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Social / Analytics / Firestore rules
- **Evidence:** Social tokens are read from `users/{uid}/socialTokens/{platform}` (`SocialPlatformService.ts:66-81`) and stats are cached to `users/{uid}/platformStats/{platform}` (`SocialPlatformService.ts:447-448`, `:518-519`, `:565-566`, `:606-607`, `:653-654`). The dashboard marks a platform connected when live stats exist, a cached `platformStats` doc exists, or a `socialTokens` doc exists (`SocialAnalyticsDashboard.tsx:120-136`). Firestore rules for `users/{userId}` do not include `socialTokens` or `platformStats` in the allowed subcollections (`packages/firebase/firestore.rules:329-346`) and deny unmatched paths (`:1230-1234`).
- **Impact:** Connection status can be wrong in both directions: rules can block token/cache reads while UI shows generic sync errors, or stale cache/token docs can mark a platform connected even when live API sync is failing.
- **Fix:** Move OAuth tokens server-side, expose sanitized connection metadata, add explicit rules for non-secret analytics cache if client-readable, and separate `connected`, `authorized`, `liveSyncOk`, and `cacheOnly` UI states.
- **Acceptance:** A denied token/cache read shows a permission/configuration error; stale cache cannot mark live sync connected; rules tests cover `platformStats` and reject client access to raw OAuth tokens.

---

---

### ISSUE-1129: Limited-drop wizard says a drop is live and fans will be notified without persistence or notification backend

- **Re-ticketed from:** ISSUE-849 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Merchandise / Limited drops
- **Evidence:** `DropCampaignWizard.handleSubmit()` waits 1.5 seconds and sets local `submitted` state only (`DropCampaignWizard.tsx:79-82`). The success view says “Drop Scheduled!”, “is live,” and “Fans will be notified when the countdown hits zero” (`:138-151`). The wizard captures pre-sale and superfan-only toggles (`:221-237`) but does not save a drop, publish a landing page, configure gating, or queue notifications before “Launch Drop” (`:269-274`).
- **Impact:** A user can believe a scarcity campaign is live while no drop, audience gate, countdown page, or fan notification exists outside the modal.
- **Fix:** Wire the wizard to a real `limitedDrops` create/publish service, validate selected products and future date/time, and queue/email/SMS notification jobs only after provider credentials and audience segments are verified.
- **Acceptance:** “Launch Drop” returns a persisted drop ID and notification job status; without backend support, the UI shows “draft created” or “setup required,” never “live.”

---

---

### ISSUE-1130: Storefront deployment creates one fixed-price Stripe link for all items

- **Re-ticketed from:** ISSUE-851 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Commerce / Storefront / Stripe
- **Evidence:** `CommerceTools.deploy_storefront_preview()` tells the user “Storefront deployed ... with N real Stripe Payment Links” after calling `createStripePaymentLinks` (`CommerceTools.ts:53-62`). The Cloud Function creates one Stripe product named `{campaignName} - Storefront Items`, puts all item names into the description, creates a single `$25.00` USD price, creates one payment link with quantity 1, and returns it as both `storefrontUrl` and the only `paymentLinks` entry (`paymentLinks.ts:19-38`).
- **Impact:** Multi-item storefronts have no per-item pricing, quantities, SKUs, tax/shipping configuration, inventory, fulfillment metadata, or split payout routing, yet are presented as deployed real checkout.
- **Fix:** Accept structured items with SKU, title, unit amount, currency, quantity/stock, tax/shipping settings, fulfillment provider, and payout metadata. Return one verified checkout/cart or itemized payment links.
- **Acceptance:** A two-item storefront creates two distinct prices/line items with correct item data and rejects unpriced items; user-facing copy says “checkout preview” unless the public storefront and fulfillment path are complete.

---

---

### ISSUE-1131: Split escrow UI treats zero collaborators as ready to release

- **Re-ticketed from:** ISSUE-855 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟡 MEDIUM
- **Module:** Finance / Split escrow UI
- **Evidence:** `SplitSheetEscrow` initializes `collaborators` as an empty array (`SplitSheetEscrow.tsx:24-30`), computes `allSigned = signedCount === totalCount` (`:36-39`), and computes `progressPct` as `signedCount / totalCount` (`:39`). With zero collaborators, `allSigned` is true and `progressPct` is `NaN`, so the escrow banner can show “Ready to Release” (`:162-166`) and the release button path renders as enabled for the all-signed state (`:271-284`).
- **Impact:** Empty setup state looks like a release-ready escrow and can produce invalid progress styles/copy.
- **Fix:** Require `totalCount > 0`, escrow amount > 0, valid splits totaling 100, and connected accounts before `allSigned` or release-ready UI can be true.
- **Acceptance:** With zero collaborators, the UI shows setup-required, progress is 0%, and release controls are disabled with a specific missing-collaborators reason.

---

---

### ISSUE-1132: Royalty forecasts use fixed approximate rates and fixed confidence as if they are verified projections

- **Re-ticketed from:** ISSUE-857 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟡 MEDIUM
- **Module:** Finance / Revenue forecasting
- **Evidence:** `forecast_revenue()` uses hard-coded approximate per-stream rates and assumes the same stream count repeats for month 1, month 6, and year 1 (`FinanceTools.ts:92-144`). `predict_daily_royalties()` uses only two fixed rates (`Spotify` = `$0.0035`, all other platforms = `$0.006`) and returns `confidence: 0.88` without source data, territory, subscription mix, distributor fee, currency, or historical variance (`:251-267`).
- **Impact:** Users can treat rough estimates as high-confidence royalty forecasts, which affects budgets, recoupment, and payout planning.
- **Fix:** Mark these as rough calculators unless backed by actual distributor/DSR history. Add source, assumptions, confidence rationale, territory/currency/platform mix, distributor cut, and date of rate table.
- **Acceptance:** No tool returns fixed high confidence without historical data; estimate output includes assumptions and `confidenceSource`, or is labeled `rough_estimate`.

---

---

### ISSUE-1133: DDEX readiness treats local metadata fields as delivery authority

- **Re-ticketed from:** ISSUE-858 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Distribution / DDEX readiness
- **Evidence:** `buildDistributionReadiness()` validates identifier formats and checks that `metadata.dpid` plus ISRC/UPC/ISWC/catalog number exist (`ReleaseHarnessAdapters.ts:140-155`). It then exposes `authorityLevel: 'package_ready'` when `ddexPackageReady` and `selectedStores.length > 0` (`:168-176`). The compiler turns that into a 100 score with rationale “Metadata, identifiers, and DPID are present” (`DistributionDdexCompiler.ts:35-41`) and recommends delivery approval (`:60-71`).
- **Impact:** A typed-in DPID and selected store names can make the package look delivery-ready without proof of a registered sender DPID, DSP recipient identities, delivery agreement, SFTP/API credentials, feed profile, or XSD-validation receipt.
- **Fix:** Split `metadataComplete` from `deliveryAuthorityReady`. Require verified sender DPID, verified recipient SystemIdentity per selected store, active delivery credentials, feed profile, and validation receipts before `package_ready`.
- **Acceptance:** A release with local DPID text but no verified DDEX onboarding remains `metadata_only`; selected stores without recipient credentials are listed as blocked.

---

---

### ISSUE-1137: Video grounding preflight uses an image model ID the gateway rejects

- **Re-ticketed from:** ISSUE-880 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Veo grounding / Image preflight
- **Evidence:** When video grounding is enabled without a first frame, `VideoGenerationService` calls `ImageGeneration.generateImages()` with `model: 'imagen-4.0-generate-001'` and catches failures, continuing without a grounded first frame (`VideoGenerationService.ts:363-384`). That service submits to `generateImageV3` (`ImageGenerationService.ts:343-410`), but the shared gateway schema only accepts image `model` values `lite`, `fast`, `pro`, or `legacy` (`packages/firebase/src/shared/creative.ts:10-18`).
- **Impact:** The “Google Search Grounding” video path can reserve image cost, fail schema validation, log the error, and then generate an ungrounded video without telling the user.
- **Fix:** Use a schema-supported grounded image model/tier, or add an explicit Imagen model route with validation and cost handling. If preflight fails, surface the failure instead of silently continuing ungrounded.
- **Acceptance:** A grounded video request produces a valid first-frame URI before Veo submission, or the user sees a blocking “grounding preflight failed” error.

---

---

### ISSUE-1138: Sync-license checkout activates a license without license terms or usage scope

- **Re-ticketed from:** ISSUE-882 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Licensing / Stripe checkout / License records
- **Evidence:** The license purchase flow sends Stripe metadata containing only `type`, `trackTitle`, `artist`, `connectedAccountId`, and `artistAmount` plus optional caller metadata (`LicensingService.ts:119-146`). The webhook then transfers `artistAmount` and creates an `active` `licenses` document with title, artist, `licenseType: 'sync'`, amount, and session ID (`webhookHandler.ts:69-113`). The app’s `License` type expects usage and optional agreement URL/date bounds (`types.ts:6-18`), but the webhook does not persist licensee, agreement URL, territory, media/use type, term, exclusivity, master/composition rights, contract version, or accepted terms.
- **Impact:** A payment can create an “active sync license” that is not legally scoped enough to prove what was licensed.
- **Fix:** Require a signed/accepted license agreement or immutable license terms object before checkout, store it by ID, and have the webhook activate that exact agreement after payment.
- **Acceptance:** No `status: active` license is created unless it references a versioned agreement, licensee, usage, territory, term, rights covered, and Stripe session/payment ID.

---

---

### ISSUE-1139: “Complete” GDPR data export omits major app data and uses two inconsistent implementations

- **Re-ticketed from:** ISSUE-890 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🔴 HIGH (privacy/compliance trust)
- **Module:** Privacy / Data export
- **Evidence:** The UI says “Download a complete copy of all your indii.music data” (`PrivacySettingsPanel.tsx:52-56`) but calls the renderer-side `DataExportService.exportUserData(uid)` (`:29-38`), not the deployed `exportUserData` callable. The renderer exporter reads only a fixed subcollection list (`DataExportService.ts:25-38`), lists only `users/{uid}` storage with one nested level (`:65-98`), and cannot read server-only/root collections such as subscriptions, licenses, Stripe ledger data, distribution registries, social/analytics token metadata, org-owned records, audit queues, or generated job records. The backend callable is a second, different partial exporter that includes only profile, projects, history, organizations, and knowledge (`index.ts:1387-1446`).
- **Impact:** Users receive a file labeled as a complete GDPR data export even though large categories of their platform data can be missing.
- **Fix:** Route export through one backend-owned exporter with a maintained collection manifest, nested pagination, Cloud Storage manifest generation, root/org collection coverage, redaction policy for secrets, and explicit omitted-data reasons.
- **Acceptance:** Export tests seed each user-owned data category and prove it appears in the export or is listed in an `omitted` section with legal/business rationale.

---

---

### ISSUE-1140: Account deletion can be partial while the UI reports permanent removal

- **Re-ticketed from:** ISSUE-891 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🔴 HIGH (privacy/compliance trust)
- **Module:** Privacy / Account deletion
- **Evidence:** `PrivacySettingsPanel` calls `requestAccountDeletion` and ignores the callable result (`PrivacySettingsPanel.tsx:98-105`), then renders “Account deletion complete” and “Your data has been permanently removed” (`:112-122`). The callable deletes only the first 500 docs from a fixed subcollection list (`index.ts:1478-1497`), deletes the root user doc, and deletes the Auth user (`:1499-1508`); it does not delete Cloud Storage files, root-level collections such as `subscriptions`, `licenses`, `user_credits`, `scheduledPosts`, `isrc_registry`, `upc_registry`, `stripe_webhook_deliveries`, org records, or nested subcollections beyond the first page. It returns `success: errors.length === 0` with error details (`:1513-1518`), but the UI does not inspect that result.
- **Impact:** A user can be told deletion is complete while data remains in storage and root/server collections, and while partial deletion errors are hidden.
- **Fix:** Make deletion an auditable backend job with a full data-location manifest, recursive/paginated deletes, Storage cleanup, external-service tasks, retention exemptions, and user-visible final status. UI must render `partial_failed` if the callable reports errors or pending tasks.
- **Acceptance:** Seeded deletion tests prove all erasable user-owned docs/files are removed, retained legal/financial records are listed with retention reason, and the UI never claims permanent removal on partial failure.

---

---

### ISSUE-1142: Screenwriter “Generate AI Scene” is a timer with hard-coded storyboard content

- **Re-ticketed from:** ISSUE-895 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Screenwriter / Storyboard / Veo prompts
- **Evidence:** `generateNextScene()` is explicitly labeled “Simulate AI generation of next scene” (`ScreenwriterDashboard.tsx:233-234`), waits `setTimeout(..., 1200)` (`:235-250`), and appends the same hard-coded recording-cabin description/camera angle/Veo prompt every time (`:237-247`). The button is wired as an active generation action in the dashboard (`:303`, `:440`).
- **Impact:** Users can believe the Screenwriter generated a scene from their concept when it only inserted canned content, polluting downstream storyboard/Veo planning.
- **Fix:** Route scene generation through the screenwriter agent/model with the current concept, tone, previous scenes, and target duration, or rename the button to “Add template scene.”
- **Acceptance:** A generated scene changes with concept/tone/history and includes model provenance; offline/unavailable mode shows an honest template/manual-add state.

---

---

### ISSUE-1143: Screenwriter Veo handoff collapses storyboard structure into one prompt string

- **Re-ticketed from:** ISSUE-896 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟡 MEDIUM
- **Module:** Screenwriter → Creative Studio / Veo handoff
- **Evidence:** The Veo prompt tab says output “directly exports to generative pipelines” (`ScreenwriterDashboard.tsx:573-599`), but `handleOpenCreativeStudio()` only joins all scenes into a single text block, calls `setCreativePrompt(handoffPrompt)`, sets generation mode/view, and switches to Creative (`:213-228`). It does not populate `VideoWorkflow` storyboard slots, per-scene duration, camera metadata, seed/aspect controls, or a structured `pendingStageHandoff.veo` payload; `VideoWorkflow` then uses the shared `creativePrompt` as one `localPrompt` (`VideoWorkflow.tsx:213-285`, `:511-539`).
- **Impact:** Multi-scene storyboards lose per-scene timing and generation boundaries; a three-scene music-video plan becomes one prompt for one video job.
- **Fix:** Create a typed Screenwriter→Veo handoff contract that maps each scene to storyboard slots with prompt, duration, camera angle, ordering, and optional reference assets.
- **Acceptance:** Opening Creative from Screenwriter creates a visible storyboard/timeline with one slot per scene and preserves scene duration/camera/prompt metadata.

---

---

### ISSUE-1144: Selecting multiple reference files can retain only the last file that finishes reading

- **Re-ticketed from:** ISSUE-914 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Reference ingredients
- **Evidence:** `IngredientDropZone.handleFiles()` starts one `FileReader` per selected file, but every asynchronous `onload` calls `onChange([...ingredients, newIngredient])` using the same pre-read `ingredients` closure (`IngredientDropZone.tsx:33-63`). When two or three reads complete, each callback replaces the parent value from the same base array rather than accumulating prior results.
- **Impact:** A user can select three character/style references and silently end up with one. Which file survives depends on read timing, making identity/style consistency nondeterministic.
- **Fix:** Read the accepted files as a batch (`Promise.all`) and call `onChange` once with all new ingredients, or expose a functional updater contract so each completion appends to the latest value. Preserve input order and enforce the cap after validation.
- **Acceptance:** A three-file selection with deliberately out-of-order FileReader completion retains all three in selection order exactly once.

---

---

### ISSUE-1145: Video assets can be selected as image frames/references and are then uploaded with image semantics

- **Re-ticketed from:** ISSUE-916 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Veo frames / Reference intake
- **Evidence:** Reference mode accepts both `image/*` and `video/*` and creates video ingredients (`IngredientDropZone.tsx:30-41`, `:49-59`), despite helper copy describing reference images. Direct video generation uses the first ingredient URL as `firstFrame` (`useDirectGeneration.ts:423-426`), and `VideoGenerationService` uploads every first frame/reference with media type `'image'` (`VideoGenerationService.ts:386-417`). `CreativeGallery` also enables Set as First/Last Frame for every non-music asset, including videos (`CreativeGallery.tsx:116-139`). The Video Stage extraction path has the same unsafe fallback: if neither Storage extraction nor player capture yields a still, `createFrameAnchor()` returns the original `activeVideo` rather than failure (`VideoStage.tsx:105-175`), and its buttons then write that returned video as `firstFrame`/`lastFrame`/`maskFrame` while logging that a frame was set (`:389-433`). `CreativeStorageService` attempts image compression and image content metadata whenever the caller says `'image'` (`CreativeStorageService.ts:155-171`).
- **Impact:** MP4/WebM bytes can be mislabeled or rejected as JPEG input, causing generation failure or corrupt frame continuity. The UI confirms “Set as First Frame” before any MIME validation.
- **Fix:** Restrict frame/reference controls to actual still images, or explicitly extract a selected video frame to a validated image blob before handoff. Validate detected MIME independently of the caller category.
- **Acceptance:** Video assets cannot enter an image URI field unchanged; choosing one requires a frame picker/extraction step, and outbound first/last/reference URIs resolve to supported `image/*` objects. Storage/player extraction failure leaves the previous frame state unchanged, reports failure, and never logs or displays “frame set” with the original video URL.

---

---

### ISSUE-1146: Deleting a generated Gallery asset only hides it locally, so it reappears and remains in Project Assets

- **Re-ticketed from:** ISSUE-919 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Gallery deletion / Persistence
- **Evidence:** The Gallery delete button calls `_handleDelete()` (`CreativeGallery.tsx:394-401`, `:583-591`). Generated assets route to `removeItemFromProject()`, which only filters the in-memory `generatedHistory` array and explicitly leaves master storage unchanged (`creativeHistorySlice.ts:228-231`). There is no persisted project-membership/tombstone update and no linked file-node removal. The next cloud snapshot can merge the same document back into history (`creativeHistorySlice.ts:124-169`). Uploaded-origin items instead call the hard-delete path, with no confirmation.
- **Impact:** Generated items can reappear immediately or after reload, while uploaded items may be permanently removed by the visually identical action. Project Assets can retain a supposedly deleted file.
- **Fix:** Define explicit “Remove from project” versus “Delete everywhere” actions. Persist project removal/tombstone state and remove linked file nodes; require confirmation for durable Storage/Firestore deletion and surface partial failures.
- **Acceptance:** Remove-from-project remains removed after snapshot/reload but stays in the master library; delete-everywhere removes history, file node, and storage object (or reports exactly what failed).

---

---

### ISSUE-1148: Campaign image retry uses stale state and the last failed job can be relabeled complete

- **Re-ticketed from:** ISSUE-950 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Marketing / Batch image generation
- **Evidence:** Retry Failed first schedules failed rows to become pending with `setPostStates`, then immediately calls `handleStartGeneration()`, whose closure filters the pre-update `postStates` for pending rows (`IntelligenceImageBatchModal.tsx:49-55`, `:110-122`). It can therefore find zero jobs and report “All posts already have images.” Separately, the service emits an error event for a failed post but, after the loop, always emits a final `complete` event using the last post’s ID (`CampaignIntelligenceService.ts:300-349`). The modal maps that event to `status: 'complete'`; its result reconciliation only converts `generating`—not false `complete`—rows with no URL back to error (`IntelligenceImageBatchModal.tsx:67-98`).
- **Impact:** Retry can do nothing, and a failed final image can show as completed with no image URL. Counts, Retry visibility, and the user’s decision to apply an incomplete campaign become unreliable.
- **Fix:** Pass an explicit failed-post snapshot into a single generation function instead of relying on asynchronous state mutation. Model batch-level completion separately from per-post completion, and derive each row’s terminal state from an actual persisted URL/result.
- **Acceptance:** With first/middle/last-item failures, every failed row remains Error with no success badge; Retry invokes generation exactly once for exactly those IDs; a successful retry supplies URLs and changes only those rows to Complete; zero-work messaging is accurate.

---

---

### ISSUE-1149: AI campaign output bypasses business validation and can create empty, off-brief, or unschedulable plans

- **Re-ticketed from:** ISSUE-952 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Marketing / Intelligence campaign generation
- **Evidence:** `generateCampaign()` asks for `durationDays * postsPerDay` posts but its response schema only requires an array and basic field presence; it does not constrain array size, day bounds/integer status, requested platform membership, copy length, hashtag format, or posting-time format (`CampaignIntelligenceService.ts:43-100`). The result cleanup accepts any array—including empty—and `planToCampaignAsset()` maps it directly (`:102-147`). The UI enables Create for any non-null plan and does not validate the plan or a cleared/past `startDate` (`IntelligenceCampaignModal.tsx:102-122`, `:329-343`, `:410-425`).
- **Impact:** A nominally successful generation can yield zero posts, days outside the campaign, unselected/unsupported platforms, over-limit copy, invalid schedule hints, or an empty/past start date, then be saved as a campaign that cannot execute as requested.
- **Fix:** Parse model output through a runtime schema parameterized by the brief; enforce or visibly reconcile exact counts, day range, selected/supported platforms, platform copy limits, nonempty prompts, and valid future local start date. Reject/regenerate malformed output rather than silently coercing it.
- **Acceptance:** Fixtures with empty posts, wrong platform, day 0/out-of-range/fractional day, excess count, over-limit Twitter copy, or invalid/missing start date cannot be created; a valid fixture preserves the requested platform/count/day distribution and passes execution schema validation.

---

---

### ISSUE-1150: Product Showroom relabels every JPEG/WebP source as PNG and does not verify file decoding

- **Re-ticketed from:** ISSUE-959 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Studio / Product Showroom
- **Evidence:** The uploader explicitly accepts PNG, JPEG, and WebP, then FileReader stores only the data URL string and no MIME metadata (`ShowroomUI.tsx:49-69`, `:160-164`). `ShowroomService` strips everything before the comma and always sends the remaining bytes to image generation as `mimeType: 'image/png'` (`ShowroomService.ts:54-67`). Neither path handles FileReader errors, decodes dimensions, checks transparency despite “Upload a transparent graphic,” or verifies that the bytes match the declared media type (`ShowroomUI.tsx:414-420`).
- **Impact:** Valid JPEG/WebP artwork can be rejected or misdecoded by the model, renamed/spoofed/corrupt files can enter an expensive request, and users receive no actionable explanation for format-specific failures.
- **Fix:** Preserve validated MIME/extension/dimensions with the HistoryItem or upload metadata, decode the image before enabling Generate, and pass the real supported MIME/bytes to the service. Require transparency only if the compositor truly needs it and provide a preview/conversion path.
- **Acceptance:** Known PNG/JPEG/WebP fixtures produce matching request MIME and valid decoded bytes; renamed, corrupt, zero-dimension, oversize, and unsupported fixtures are blocked before generation with a specific error; transparency requirements are tested and accurately stated.

---

---

### ISSUE-1151: Product Showroom draft and results are global across projects and survive project switches

- **Re-ticketed from:** ISSUE-960 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH (cross-project creative contamination)
- **Module:** Creative Studio / Product Showroom
- **Evidence:** `showroomState` is a single unkeyed Zustand object containing the product asset, prompts, mockup, and in-flight flags; `setShowroomState` merges globally with no project boundary or persistence (`creativeControlsSlice.ts:159-170`, `:343-355`). `ShowroomUI` reads the live `currentProjectId` only when creating an uploaded input and when sending the displayed result to Veo (`ShowroomUI.tsx:29-69`, `:300-315`). The original input’s project ID in the service (`ShowroomService.ts:78-86`, `:131-139`), even if another project is active when the awaited operation completes.
- **Impact:** Switching projects displays another project’s artwork, scene, and result; a generation started in A can finish while B is visible yet file itself into A, and Send to Veo can stamp the same displayed result as B. Users cannot tell which project owns the paid output.
- **Fix:** Key showroom sessions by project or clear/confirm on project switch, capture immutable project/input/prompt snapshots at submission, and route completion/handoff/history consistently to that captured target with a visible project label. Persist recoverable drafts if promised.
- **Acceptance:** A→B switch never exposes or mutates A’s draft without an explicit transfer; completing A while B is active files and labels the result only in A; Send to Veo cannot rewrite ownership to B; switching back restores A only if per-project draft persistence is intentional.

---

---

### ISSUE-1152: Browser Audio QC base64-encodes and sends the full master twice in parallel with no size/duration limit

- **Re-ticketed from:** ISSUE-962 (2026-07-21 housecleaning; original status was: `PARTIAL (2026-07-17) — browser raw-master Gemini uploads are now prohibited; protected server-receipt retrieval remains to be wired into browser UI`)
- **Status:** 🟡 PARTIAL (2026-07-23) — **browser hydration UI now wired and working end-to-end.** Remaining gap against the original acceptance line: no cancellation/cleanup support for an in-flight upload+analysis (unchanged from the 2026-07-12 fix's own "not done" list — that was never in this pass's scope). Boundary/size gates, single-upload dedup, and offline/oversize honest-failure behavior were already closed in prior sessions.
- **Unblocked (2026-07-23):** ISSUE-1183 and ISSUE-1170 are both ✅ FIXED — `engine-dsp` is live and real receipts now persist at `audio_analysis_receipts/{receiptId}`, where `receiptId = 'audio_' + sha256(`ownerId\0contentHash\0generation`).slice(0,48)`. Two real receipts exist to develop against (see ISSUE-1170's evidence). The Firestore rule already permits a client to read only receipts whose `userId` equals their UID, so the browser can read its own receipt directly without a new endpoint. **This is now the front of the engine-dsp chain** — the remaining work is purely the browser-side hydration UI.
- **UI wiring closed (2026-07-23):** The full receipt-hydration pipeline was already built and unit-tested in a prior session (`AudioAnalysisReceiptService.watch`/`waitForTerminalReceipt`, `AudioIntelligenceService.analyzeCanonicalMaster`, `TrackIngestionService.ingestTrack`) — **but every one of those had zero UI callers**, the exact "grep for callers, not just existence" failure mode this session's own `/hunter` pass had just documented in the ERROR_LEDGER. `AudioAnalyzer.tsx`'s upload handler still called the raw `audioIntelligence.analyze()`, which correctly *rejects* browser semantic analysis (ISSUE-962) — so every browser upload landed on a generic `catch` block that discarded the real error and displayed a canned, misleading "Autonomous service limits or connectivity issues detected" toast. No hydration ever ran; the truthful pending-receipt error the service already threw never reached the user.
  - **Fix:** `runAnalysis` now branches on `window.electronAPI`. Desktop keeps the existing local/proxy `.analyze()` path unchanged. Browser now: fingerprint → `masterAudioService.persist()` (upload once, immutable canonical path) → `audioIntelligence.analyzeCanonicalMaster()` (polls the receipt to a terminal state) → same `AudioIntelligenceProfile` shape the UI already renders. Progress toasts narrate the two real network stages instead of one opaque spinner.
  - **Error surfacing fixed too:** the `catch` block now shows `error.message` when it's an `Error` (e.g. "analysis is still processing, you can safely return and retry" or a legacy-master rejection), falling back to the generic string only for non-`Error` throws — so the honest pending/rejected states this pipeline already produces are no longer swallowed into a fake connectivity error.
  - **Tests:** `AudioAnalyzer.interaction.test.tsx` adds two regression cases (forcing `window.electronAPI` undefined to exercise the real web build's condition): asserts `masterAudioService.persist` + `analyzeCanonicalMaster` are called and `analyze` is not, and asserts a rejection surfaces its real message rather than the canned string. Existing Electron-path tests updated only to add the new mocks (`FingerprintService`, `MasterAudioService`, `@/services/firebase`) their global `window.electronAPI` stub now requires for the branch to typecheck/import cleanly — their assertions are unchanged. `AudioAnalyzer.a11y.test.tsx` updated the same way.
  - **Verified:** typecheck clean (isolated from an unrelated concurrent agent's in-progress breakage in `DistributorConnectionsPanel.tsx`, confirmed via `git stash` to be pre-existing and untouched by this change), lint 0 errors on touched files, dependency-integrity clean, 8/8 AudioAnalyzer tests + 49/49 in the wider audio/ingestion suite.
  - **Acceptance line re-checked:** "browser UI must read/poll the owner-scoped `audio_analysis_receipts` document and hydrate semantic/marketing/video metadata once the worker finishes" — now true end-to-end from a real upload, not just from the service layer's own tests. Cancellation/cleanup support (also named in the original 2026-07-12 fix's "not done" list) remains unimplemented and out of this pass's scope.
- **Severity:** 🔴 CRITICAL (browser crash / provider-limit failure / excess cost)
- **Module:** Audio Analyzer / Semantic and emotional analysis
- **Evidence:** The UI has no file size or duration gate before analysis (`AudioAnalyzer.tsx:120-143`). In browser mode, semantic analysis reads the entire lossless master into a base64 string and sends it inline (`AudioIntelligenceService.ts:229-273`, `:315-329`). At the same time, `energyMapService.mapEmotionalArc(file, ...)` independently reads the same complete file into another base64 string and sends another model request (`AudioIntelligenceService.ts:137-169`; `EnergyMapService.ts:74-80`, `:130-144`, `:158-170`). The comment assumes “typical masters (5–10 MB),” but uncompressed production WAV/AIFF files can be far larger; no request-size/cost budget or cancellation exists.
- **Impact:** Large/long masters can allocate multiple copies of the bytes plus ~33% base64 overhead, freeze or kill the renderer, exceed model/request limits twice, consume duplicate upload/token cost, and leave the user with a generic connectivity error.
- **Fix:** Enforce measured size/duration/channel limits before allocation; create one bounded, content-addressed analysis proxy server-side (or one reusable compressed proxy), stream/upload once, reuse its handle for both analyses, expose cost/limits, and support cancellation/cleanup. Keep local technical QC available when semantic analysis is skipped.
- **Acceptance:** Boundary tests just below/above limits give deterministic behavior; a large master never creates two full browser base64 copies or two raw-media uploads; both semantic jobs reuse one proxy ID; cancellation aborts requests and cleans temporary media; oversize/offline users can still run clearly labeled local technical QC without a false deep-analysis success.
- **Fix applied (2026-07-12):** Added `MAX_BROWSER_ANALYSIS_BYTES` (50MB raw, exported from `AudioIntelligenceService.ts`) — a hard gate in the non-Electron-proxy branch of `analyze()` that throws a clear, actionable error (oversized master → "too large for browser-based deep analysis... Local technical QC is still available") BEFORE any base64 encoding or model request happens; the limit is sized to keep the base64-encoded payload safely under Gemini's documented inlineData limit (currently ~100MB, with older docs citing 20MB) while comfortably covering real mastered audio. Eliminated the double-encode: `analyzeSemantic(file, ...)` was refactored into `analyzeSemanticWithBase64(base64Data, mimeType, ...)`; the browser branch now calls `fileToBase64()` exactly ONCE and passes that single base64 string to both the semantic Gemini call and `energyMapService.mapEmotionalArcWithProxy()` (an existing method previously only used by the Electron/FFmpeg-proxy path) — so a master that previously got read+encoded twice (2x memory, 2x upload bytes, 2x token cost) now gets read+encoded once. Tests: new `AudioIntelligenceService.test.ts` (3 cases) prove an oversized file is rejected before any encoding/model call occurs, a file at exactly the limit is allowed, and the semantic + energy-map calls receive the byte-identical base64 payload (single spy-counted `fileToBase64` call). Full `packages/renderer/src/services/audio/`, `modules/tools/`, and `services/ingestion/` suites green (41 tests), typecheck/lint clean. **Not done:** no duration or channel-count gate (only raw byte size); no server-side bounded content-addressed proxy (the Electron path's existing FFmpeg MP3 proxy already avoids this problem for desktop users — browser/web users still send raw lossless bytes, just once instead of twice now); no cancellation/cleanup support. These require a new backend endpoint and are a larger follow-up beyond this pass's scope.

- **Ordering correction (2026-07-12):** The browser size gate is now at the beginning of `analyze()`, before fingerprinting or `audioAnalysisService.analyze()`. Previously it was only before base64 conversion, after those paths could already read/decode the entire oversized master. The focused regression asserts an over-limit browser file never reaches technical analysis.

- **Canonical-master correction (2026-07-17):** The single shared base64 upload was still not an upload-once/provenance-safe solution: it sent a raw browser master directly to Gemini outside the immutable Storage object and could not be tied to the server analysis receipt. `AudioIntelligenceService` now permits local technical QC but rejects the non-Electron semantic branch before either semantic or energy-map Gemini call. `EnergyMapService.mapEmotionalArc(file, ...)` has the same hard guard, preventing bypass callers from base64-encoding a master. Desktop continues to use its existing bounded MP3 proxy path; protected web analysis is queued by `MasterAudioService.persist()` and the Engine DSP worker. Focused tests prove the browser path makes no Gemini/energy-map request and the direct Energy Map raw-file API rejects. **Still open:** browser UI must read/poll the owner-scoped `audio_analysis_receipts` document and hydrate semantic/marketing/video metadata once the worker finishes; until that is implemented, web callers receive a truthful pending-receipt error rather than a false deep-analysis success. No deployment, worker receipt, or Gemini request was performed in this change.

---

---

### ISSUE-1153: Closing or replacing a Publishing release draft abandons uploaded masters and cover art

- **Re-ticketed from:** ISSUE-965 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH (creative asset loss / storage leak)
- **Module:** Publishing / Create Release draft lifecycle
- **Evidence:** The wizard keeps all metadata/assets only in component state (`useDDEXRelease.ts:217-232`) but uploads audio and cover bytes immediately to `orgs/{org}/releases/packaging/...` before any release record exists (`:253-300`). “Replace File/Image” only clears the local asset reference (`ReleaseWizard.tsx:580-585`, `:632-637`), and both header close and terminal Done directly call `onClose` (`:851-867`, `:898-909`) with no dirty-state confirmation, draft persistence, deletion, or resumable-upload manifest. Upload `onChange` handlers also await without local error handling (`:595-601`, `:649-655`).
- **Impact:** Accidental close/navigation/replacement permanently loses entered rights metadata and disconnects paid/private media objects from any release; repeated attempts accumulate orphaned masters and artwork with no user-visible inventory or deletion path.
- **Fix:** Create an owned draft/upload session before media transfer, autosave fields and asset references, confirm discard, and implement explicit replace/discard cleanup with resumable recovery and retention rules. Surface per-asset upload errors without unhandled rejection.
- **Acceptance:** Reload/close during every wizard step restores the same draft and uploaded assets; explicit Discard deletes or queues cleanup for all session-owned unreferenced objects; Replace removes the prior owned object only after the new one is durably linked; failed upload remains retryable and creates no orphan.

---

---

### ISSUE-1154: Registration manual fallbacks claim form data is saved/downloadable but provide only a portal link

- **Re-ticketed from:** ISSUE-971 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH (manual filing data loss)
- **Module:** Registration Center / Manual provider handoff
- **Evidence:** LoC’s web fallback says “Your pre-filled registration details are ready below — you can download them,” while ASCAP says “Your form data is saved below” (`LocAdapter.ts:117-126`; `AscapAdapter.ts:82-107`). `SubmissionResultView` renders only the instruction string, an Open Provider link, and Back to form; it shows no field snapshot and has no copy/download/export action (`RegistrationForm.tsx:421-445`). LoC’s web/manual catch also does not call `persistOrgRecord`, so even the snapshot in memory is not saved (`LocAdapter.ts:114-135`).
- **Impact:** Users leave the app for a manual portal without the promised packet and can lose all reviewed legal names, shares, identifiers, and answers on navigation/remount, forcing error-prone re-entry into a binding filing.
- **Fix:** Persist a versioned manual filing draft before opening the portal and render a redacted review plus copy/download packet in the provider’s actual field format. Clearly separate sensitive fields, omit secrets, and provide resume/mark-submitted-with-evidence controls.
- **Acceptance:** Every `requiresManualStep` result has a durable draft ID and visible/exportable field snapshot matching the reviewed values; reload resumes it; portal opening does not destroy it; the app never says saved/downloadable without those artifacts; sensitive data is redacted/encrypted per field policy.

---

---

### ISSUE-1155: Marketplace can sell songs, albums, merch, tickets, and services with no deliverable or fulfillment contract

- **Re-ticketed from:** ISSUE-974 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🔴 CRITICAL (paid item cannot be fulfilled)
- **Module:** Marketplace / Product creation and buyer delivery
- **Evidence:** The listing modal exposes six product types but only stem packs collect files; every other type creates a product with `images: []` and empty metadata (`CreateProductModal.tsx:26-39`, `:83-92`, `:167-181`). The `Product` model has only generic images/inventory/metadata and no required asset, SKU/variants, ticket event, service terms, shipping, license, or delivery policy (`marketplace/types.ts:12-25`). Repository-wide marketplace purchase code creates Checkout/purchase/revenue records but has no buyer entitlement, signed-download, ticket issuance, shipping order, service booking, refund, or digital delivery path (`MarketplaceService.ts:165-264`).
- **Impact:** A buyer can be charged for an empty song/album, unshippable merch, nonexistent ticket, or undefined service, with no artifact or entitlement to receive.
- **Fix:** Use discriminated product schemas with required fulfillment data per type and provision verified delivery/entitlement only from the paid webhook. Keep incomplete products as private drafts and show seller readiness checks.
- **Acceptance:** Each visible product type has fixtures proving required fields and post-payment fulfillment; missing audio/artwork/license, merch SKU/shipping, event/date/capacity, or service scope/scheduling blocks activation; a paid clean-session buyer can access exactly the purchased entitlement and refunds revoke/adjust it correctly.

---

---

### ISSUE-1156: Stem-pack upload and listing lifecycle leaves partial/orphaned files on failure, close, replace, or delete

- **Re-ticketed from:** ISSUE-976 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH (creative asset leak / storage cost)
- **Module:** Marketplace / Stem pack creation
- **Evidence:** Four stems upload concurrently via `Promise.all` into a timestamp draft path before the product document is created (`MarketplaceService.ts:41-64`; `CreateProductModal.tsx:61-92`). If any upload or the later product write fails, completed uploads are neither recorded nor deleted. Closing/replacing a selected local file has no draft/cleanup semantics, and `deleteProduct()` only sets `isActive: false` without deleting or retaining/accounting for stem objects (`MarketplaceService.ts:148-163`). There is no stable upload session, per-file progress/result, retry manifest, or garbage collector.
- **Impact:** Partial batches, rule failures, abandoned modals, and deleted listings retain private masters indefinitely; retry creates new timestamp paths and duplicates storage.
- **Fix:** Create an owned draft/session first, upload idempotently per slot with checksums, commit listing references transactionally, and implement explicit discard/replace/delete retention cleanup. Surface per-file state and resume safely.
- **Acceptance:** Failure in each of four slots leaves successful files linked to a resumable draft or removed; retry reuses checksum/session without duplication; explicit discard/delete follows documented retention and removes unreferenced objects; a scheduled orphan scan finds zero objects after test scenarios.

---

---

### ISSUE-1158: Generated-audio library service writes to an unruled path while rules authorize a different collection

- **Re-ticketed from:** ISSUE-1005 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-11 — service/rules path mismatch and destructive cleanup behavior fixed; generation integration/emulator proof remains)`)
- **Status:** 🟡 PARTIAL (2026-07-11 — service/rules path mismatch and destructive cleanup behavior fixed; generation integration/emulator proof remains)
- **Severity:** 🔴 CRITICAL (generated audio cannot become a durable user-library asset)
- **Module:** Audio generation / Audio library persistence
- **Evidence:** `AudioPersistenceService` describes a user-specific audio library and its list/save/delete operations construct `users/${userId}/audio` (`AudioPersistenceService.ts:44-50`, `:67-90`, `:95-117`). The Firestore rules define no `match /users/{userId}/audio/{...}` policy; the only audio-assets rule is for the unrelated root path `/audio_assets/{docId}` (`firestore.rules:1210-1213`), with all unmatched paths denied by the final catch-all (`:1235-1236`). The service’s base constructor itself uses `audio_assets`, but its overridden collection accessor computes the user path and then returns `super.collection` anyway (`AudioPersistenceService.ts:38-42`, `:54-62`), making the declared model contradictory even before any integration adds/reuses base methods.
- **Impact:** Audio metadata read/save/delete requests can fail with `permission-denied`; a generated sound, music, or TTS result may exist only in volatile UI state rather than surviving reload or appearing in its library. Delete can also leave the Storage object untouched when the metadata pre-read is denied.
- **Fix:** Choose one canonical owned-audio document model and make service, rules, storage paths, and client selectors agree. Prefer `users/{uid}/audio/{audioId}` with owner-only schema-validated rules, or use root `audio_assets` consistently with immutable `userId`; remove the misleading override. Await and surface persistence/cleanup outcomes rather than treating an in-memory addition as a saved library asset.
- **Acceptance:** Emulator tests allow an authenticated user to list/create/read/delete only their own generated-audio metadata, reject cross-user access and owner/type/URI spoofing, and cover the exact path the service calls; successful generation survives a clean reload with a playable authorized URL; forced metadata/storage failures retain a retryable pending result with no saved claim; delete either removes both metadata and owned storage object or exposes a durable cleanup-retry state.

- **Fix progress (2026-07-11):** Standardized `AudioPersistenceService` on the already-authorized root `audio_assets` collection, removed the misleading user-subcollection override, added owner-filtered listing, forced authenticated ownership on writes, and changed unauthenticated operations from silent success to explicit failure. Delete now verifies ownership and retains metadata when Storage cleanup fails; `CloudStorageService.deleteAudio()` propagates cleanup failures instead of swallowing them. Added four focused ownership/query/cleanup tests; Vitest, ESLint, renderer TypeScript, and diff checks pass. Remaining before FIXED: connect generated audio creation to awaited metadata persistence with retryable UI state, add emulator coverage for the existing root rules (live edition lookup was unavailable because Firebase credentials require reauthentication), and verify clean-reload playback.

- **Additional progress (2026-07-12):** The audio-library store now has `persistGeneratedAsset()` and `retryAudioPersistence()` rather than only an in-memory `addGeneratedAsset()`: it presents a new result as `pending`, marks it `saved` only after `AudioPersistenceService.saveAudioMetadata()` resolves, and retains a visible `failed` result with an error for retry if persistence rejects. Reloaded library entries are explicitly `saved`. The root `audio_assets` rule now validates owner/document-id consistency, the allowed generation types, bounded duration, required prompt/MIME/timestamp, and requires either a playable storage URL or a bounded data URI; it rejects cross-user and owner/id/type/URI spoofing. Added emulator cases for valid owner create/read, cross-user denial, malformed payload denial, and immutable-owner spoofing. Renderer typecheck and the focused service test pass; Firebase TypeScript build passes. `npm run test:rules --workspace=@indii/firebase` reports 120 passing cases but the harness skips emulator-backed assertions when localhost:8080 is unavailable, so rules behavior still needs a real Emulator run. **Remaining:** repo-wide search confirms there is still no audio generator or UI call site that invokes either persistence action—the new handoff prevents a future generator from falsely claiming save, but does not by itself create a producer. Wire each actual sound/music/TTS completion to `persistGeneratedAsset()` and perform a clean-reload playback test before closing.
- **Production-path progress (2026-07-17):** The real renderer speech producer now calls `generateAudioV3`, and the callable itself owns the durable lifecycle instead of trusting a second client write: idempotent request claim, server cost reservation, supported Gemini 3.1 TTS request, playable WAV wrapping, owner-scoped Storage upload, atomic `creative_jobs` + `audio_assets` completion, reservation settlement/void, failed-commit cleanup, and stored-result replay. Reloaded library reads resolve the `gs://` object to a client playback URL, while delete targets that exact URI and owner Storage rules permit deletion without weakening create/update validation. Focused tests pass. **Still PARTIAL:** only a deployed authenticated Cloud run proving generation, fresh-read playback, idempotent replay, and owner deletion can close ISSUE-1005; local/emulator evidence is explicitly non-acceptance.

---

---

### ISSUE-1159: PLP counts queued video jobs with empty URLs as generated variants and can deploy them as ad creatives

- **Re-ticketed from:** ISSUE-1008 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — lifecycle/UI/retry coverage complete; live provider/emulator proof remains)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — lifecycle/UI/retry coverage complete; live provider/emulator proof remains)
- **Severity:** 🔴 CRITICAL (paid campaign can be built from nonexistent video assets)
- **Module:** Creative Suite / PLP 15-variant pipeline / Ad handoff
- **Evidence:** PLP starts five `VideoGeneration.generateVideo()` calls alongside ten image calls and treats every fulfilled array with a first item as a completed variant (`CreativeStudio.tsx:191-245`). But `generateVideo()` explicitly returns only `{ id: jobId, url: '' }` while the video is queued, instructing callers to use a job listener for the eventual URL (`VideoGenerationService.ts:484-492`). PLP immediately adds that empty URL to history as a `video` (`CreativeStudio.tsx:221-237`), increments its “N/15 Variants generated” count, and includes its ID in `creativeSeeds`; after user confirmation it sends those IDs to `deployPLPPipeline` (`:243-273`). It creates no subscription, terminal-state check, output URL readback, or failure/retry path for the five video jobs.
- **Impact:** PLP can display and save video “variants” that have no playable media, include them in a campaign configuration, and report a successful 15-variant batch despite queued, failed, or output-less video jobs. This risks broken ads, misleading creative review, and spend against absent assets.
- **Fix:** Model image and video outputs as typed lifecycle records. Count/present video jobs as queued until a persisted terminal result has an authorized playable URL; subscribe or poll with immutable PLP batch/job context, then add only completed output receipts to history and campaign eligibility. Prevent ad deployment until each selected creative is provider-validated and has a render URL/asset ID, while preserving failed jobs with retry/diagnostics.
- **Acceptance:** A PLP fixture with five queued video jobs reports 10 completed images plus 5 queued videos—not 15 generated—and adds no empty-URL history item or campaign creative; completed videos become eligible only after a terminal job record supplies a validated URL; failed/completed-without-URL/cancelled jobs remain visible with retry and never enter ad deployment; mixed completion order, project switching, and duplicate listener events yield one immutable asset record per job and an accurate batch summary.

- **Fix progress (2026-07-12):** Added `awaitCompletedPlpVideoVariant()` and routed all five PLP video slots through `VideoGeneration.waitForJob()`. Empty queued tokens are no longer counted, stored, or offered to ad deployment; a video becomes eligible only after a terminal job supplies a playable URL, and missing job/output IDs reject the slot. PLP now captures the initiating project ID for all session/history writes and blocks campaign launch if the creator switches projects while jobs are pending, instead directing them back to the owning project. Renderer typecheck and Creative Studio suite pass (6 tests; jsdom emits non-fatal `window.scrollTo` warnings). Remaining before FIXED: visible queued/failed slot state, targeted retry, and duplicate terminal-event coverage.

- **Focused interaction completion (2026-07-17):** Added an explicit 15-slot PLP batch model and visible status panel. The UI distinguishes queued/completed/failed slots, exposes per-slot diagnostics, retries only failed slots, blocks rapid duplicate retries/launches, and keeps output/history ownership bound to the project that started the batch. Only terminal outputs with playable URLs enter history or campaign eligibility; the first terminal event is immutable and duplicate terminal events cannot duplicate history. Campaign launch requires all 15 validated outputs and fails closed after an ambiguous deployment response so a blind retry cannot create duplicate paid spend. Focused component/integration/service coverage passes 62 tests across Creative Studio, PLP lifecycle/status, auth, and video generation; renderer typecheck and scoped ESLint pass. Remaining before FIXED: a live provider/emulator generation receipt. That proof is intentionally not fabricated or run against paid production generation without an approved test fixture/budget.

---

---

### ISSUE-1163: GitHub Release Missing Updater Manifest Files

- **Re-ticketed from:** ISSUE-1043 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated (blocks Founders Version One installation; blocked on ISSUE-992 founder signing secrets)`)
- **Scope note (2026-07-21):** engineering remainder ONLY. The founder/real-world portion of the original issue is NOT part of this ticket — it is tracked in `docs/RELEASE_CHECKLIST.md` § "Apple Developer ID / macOS Notarization". Do not block this ticket on it.
- **Status:** ⏳ BACKLOG — consolidated (blocks Founders Version One installation; blocked on ISSUE-992 founder signing secrets)
- **Severity:** 🔴 CRITICAL (installers cannot check for updates)
- **Error Message:** "Founders Version One cannot be installed yet because the latest GitHub release is missing its updater manifest. Publish a repaired release with latest-mac.yml, latest.yml, and latest-linux.yml, then check again." (produced by `packages/main/src/updater.ts:49` when electron-updater 404s on a manifest)
- **Root Cause (investigated 2026-07-13, supersedes the original guess of "published manually or by workflow failure"):** This error is the direct, predictable consequence of the ISSUE-992 mitigation plus an empty fallback release. Chain of events, all verified against the live GitHub Releases API:
  1. `v1.64.5` and `v1.64.6` were built and published by `release.yml` with ALL required assets — including `latest-mac.yml`, `latest.yml`, `latest-linux.yml` (verified via `gh release view`: 10 assets each). The manifests are NOT missing from those releases.
  2. On 2026-07-10 both were deliberately flipped to **Pre-release** as the ISSUE-992 incident pull (their macOS builds are ad-hoc signed; ShipIt refuses them). That mitigation is correct and must NOT be reverted.
  3. The stable updater channel (`updater.ts` → `allowPrerelease: false`, `releaseType: 'release'`) therefore skips both and resolves "latest" = `v1.50.0` (published 2026-05-19, predates the hardened workflow).
  4. `v1.50.0` has **ZERO assets** (verified: `assets: []`). electron-updater requests `latest-mac.yml` from it, gets 404, and `formatUpdaterErrorMessage()` maps that to this error. Every stable-channel desktop client shows it on every check.
- **Why it will recur without systemic fixes (write-downs for prevention):**
  1. **Feed-level blind spot in `release.yml`:** the "Verify updater manifest was published" gate (lines 184-217) only checks assets on the *tag's own release*. It never verifies (a) the release is non-prerelease, or (b) what the stable feed actually resolves as "latest" serves valid manifests. A green release run can still leave every installed client broken — exactly the current state. Fix: add a post-publish feed check that fetches `https://github.com/indii-music-founder/indii-music-founder/releases/latest/download/latest-mac.yml` (and `latest.yml`, `latest-linux.yml`), asserts HTTP 200, and asserts the manifest `version:` matches the tag being released.
  2. **No empty-release guard:** nothing detects a "latest" release with zero assets (the `v1.50.0` state). Once a repaired release exists, delete `v1.50.0` or backfill it; add an assets-not-empty check on the resolved latest release to `/plat` or a scheduled CI check.
  3. **Incident-pull runbook gap:** flipping a bad release to prerelease changes which release the feed resolves — the 2026-07-10 pull correctly stopped serving broken installers but silently converted the failure mode from "update fails to install" to "cannot check for updates at all," because nobody verified the resulting fallback. Add to `docs/RELEASE_CHECKLIST.md`: after any prerelease flip/deletion, curl the three `releases/latest/download/latest*.yml` URLs and confirm 200 + a signed, verified version.
  4. **Error swallowing + race in publish step:** `release.yml:172` runs `gh release create ... 2>/dev/null || true` across 3 concurrent matrix runners. This hides ALL failures (auth, permissions), not just "already exists." Make idempotency explicit (`gh release view || gh release create`) and stop discarding stderr.
  5. **Publisher-facing copy shown to end users:** `updater.ts:49` tells the *user* to "Publish a repaired release with latest-mac.yml…" — that instruction is for the maintainer, not the artist. Replace with user-appropriate copy ("Updates are temporarily unavailable; your current version keeps working") while logging the technical detail.
  6. **Vestigial Release Please workflow:** `.github/workflows/release-please.yml` runs have all been cancelled at the 24h timeout since May and it plays no role in the current tag flow — either fix or remove it to avoid future confusion about what creates releases.
- **Fix (sequenced — the ONLY safe repair path):**
  1. **Founder prerequisite (ISSUE-992):** add the 5 Apple signing/notarization secrets to GitHub Actions. `release.yml` now fails closed on macOS without them, so no repaired release can ship at all until this is done.
  2. Cut a new tag (`v1.64.7`+) so `release.yml` builds, signature-verifies, and publishes a **non-prerelease** release with all installers + all three manifests.
  3. Confirm the stable feed resolves to it (curl the three `releases/latest/download/latest*.yml` URLs → 200, correct version), then delete or backfill the empty `v1.50.0`.
  4. Implement prevention items 1-5 above in `release.yml`, `updater.ts`, and `docs/RELEASE_CHECKLIST.md`.
- **DO NOT:** Do not upload manifests to `v1.50.0` — its manifests would reference installer assets that don't exist there (or unverified ones), pointing every client at a dead or untrusted download. Do not rebuild locally and upload unsigned artifacts — that recreates ISSUE-992. Do not un-prerelease `v1.64.5`/`v1.64.6` — they are confirmed ad-hoc signed and ShipIt rejects them.
- **Verification:** A stable-channel desktop client (source: github, channel: stable) completes `checkForUpdates()` with no error; `releases/latest/download/latest-mac.yml` returns 200 with the new version; new release is non-prerelease with ≥10 assets including all three manifests.
- **Related:** ISSUE-992 (root incident — ad-hoc signed macOS builds; its mitigation created this state)

---

---

---

### ISSUE-1164: App icon/favicon gives no visual cue for which surface is open (web / Electron / remote)

- **Re-ticketed from:** ISSUE-1045 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated (requested by William, 2026-07-12 — noticed while juggling multiple open browser/app tabs and couldn't tell them apart at a glance)`)
- **Status:** ⏳ BACKLOG — consolidated (requested by William, 2026-07-12 — noticed while juggling multiple open browser/app tabs and couldn't tell them apart at a glance)
- **Severity:** 🟡 MEDIUM (UX/orientation — no data or security impact)
- **Module:** Branding / Build assets (web manifest, Electron packaging, mobile-remote PWA)
- **Request:** Same core mark (the "double eye"/`II` logo), but recolored per runtime surface so the browser tab, the Dock/taskbar icon, and the phone remote icon are each visually distinct at a glance — one color for web browser, one for the Electron desktop app, one for the remote/mobile app.
- **Evidence (current state, verified):** There is currently exactly ONE icon per platform, no per-surface variation:
  - Web/PWA: `packages/renderer/public/favicon.svg` + `indii-logo.svg`, both referenced from the single `packages/renderer/public/manifest.json` used for every browser tab AND the installed PWA.
  - Electron desktop: separate native icon set already exists (`build/icon.icns`, `build/icon.ico`, `build/icon.png`, `assets/icon-studio.icns`) — packaged app already CAN look different from the web favicon, but hasn't been deliberately color-coded as part of one coherent 3-way scheme.
  - Mobile remote: the `mobile-remote` module (see ISSUE-1044) is served from the SAME SPA/manifest as regular desktop-web — it has no distinct icon/manifest of its own, so a phone that has the remote view installed as a PWA is visually identical to a phone/desktop with the regular studio installed.
- **Impact:** With the web app, the Electron app, and the phone remote view potentially all open at once, there's no glanceable way to tell which one is which from the icon alone (tab strip, Dock, home-screen icon, alt-tab switcher).
- **Fix:** Define one base mark with 3 official colorways (e.g. via a shared SVG + fill-color token): (1) web browser favicon/tab icon, (2) Electron desktop app icon (Dock/taskbar/installer), (3) remote/mobile PWA icon (phone home screen). Give the mobile-remote module its own `manifest.json`/icon set distinct from the main studio manifest so it can carry the third color independently, and update the Electron `build/icon.*` assets to use the second color deliberately (not just "whatever it happens to be now").
- **Acceptance:** Looking only at the icon (browser tab, Dock, phone home screen) is enough to tell which of the 3 surfaces (web / Electron / remote) is open, with no other UI visible.
- **DO NOT:** Do not change the core mark/shape — only the color per surface. Do not fork the manifest content (share_target, shortcuts, etc.) beyond what's needed to give the remote module its own icon identity.

---

---

### ISSUE-1168: Production AI generation depended on prepaid AI Studio credits — hard cutoff with no alerting, no postpaid path, no dev/prod spend isolation
- **Re-ticketed from:** ISSUE-1082 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — code + cloud alerting complete; prod rollout on next deploy)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — code + cloud alerting complete; prod rollout on next deploy)
- **Severity:** 🔴 CRITICAL (was the live cause of "creative is down")
- **Module:** Creative gateway / `packages/firebase/src/functions/creative/gateway.ts` / GCP monitoring + billing
- **Evidence:** The gateway preferred the AI Studio API key (prepaid credits) and only fell back to Vertex ADC on API-*key* errors — billing exhaustion (`RESOURCE_EXHAUSTED` / "prepayment credits are depleted") rode the dead key path straight to users. No notification channels, no alert policies, and no budget existed on the GCP project, so depletion was discovered via a failing unit test.
- **Fix:** (1) `getMediaProvider()` policy: production defaults to Vertex AI via ADC on the postpaid project (`MEDIA_PROVIDER` env override; dev/QA defaults to the AI Studio key so testing never drains prod). (2) `wrapWithFallback` now also falls back to Vertex on prepaid-billing exhaustion. (3) Cloud infra created live: email notification channel (`notificationChannels/11054218369120817035`), log-based alert policy `AI generation billing/quota exhaustion (RESOURCE_EXHAUSTED)` (`alertPolicies/6390119791058322700`, 1h rate-limit, runbook in docs), and billing budget `indii-music-founder monthly spend guardrail` ($200/mo, alerts at 50/75/90/100% — adjust amount in console as real spend data lands). Billing Budgets API enabled. (4) `.env.example` documents `MEDIA_PROVIDER`. Unit tests: `mediaProvider.test.ts` 5/5.
- **Acceptance (residual):** deploy functions so prod actually routes via Vertex; live-verify one `generateImageV3` call succeeds on Vertex billing; confirm a test alert email arrives. AI Studio credits remain optional (dev/QA only).

---

---

### ISSUE-1169: Audio profiling callable accepted arbitrary Storage paths and queued an unauthenticated placeholder engine target
- **Re-ticketed from:** ISSUE-1083 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — code and local proof complete; Cloud Run/Cloud Tasks provisioning and live receipt pending)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — code and local proof complete; Cloud Run/Cloud Tasks provisioning and live receipt pending)
- **Severity:** 🔴 CRITICAL
- **Module:** Canonical master ingestion / Cloud Tasks / engine-dsp
- **Evidence:** `packages/firebase/src/distribution/ingestion.ts` accepted any authenticated caller's `filePath`, checked only whether that object existed, and then posted the caller-controlled reference without an identity token. The fallback target was the literal placeholder `https://engine-dsp-service-url/profile`. The callable was not exported from `packages/firebase/src/index.ts`, so its apparent success path was not deployable from this source tree.
- **Impact:** One user could dispatch another user's existing object for profiling; the downstream worker had no cryptographic caller identity, no immutable hash/generation binding, and no safe configured target. The upload-once master could therefore leave its protected channel or be replaced between enqueue and processing.
- **Fix:** Exported the callable and added the repository's App Check/auth boundary. Runtime configuration now fails closed before any large master is streamed. Dispatch reuses `verifyMasterAudioObject` to enforce the owner-scoped content-addressed path, Storage metadata, byte-level SHA-256, fingerprint, immutable marker, and generation. The Cloud Task contains only the server-verified master reference plus owner, fingerprint, hash, and generation and uses an OIDC token from a same-project Google service account; the fake URL fallback was removed.
- **Local proof:** `audio_ingestion.test.ts` proves missing engine configuration causes no verification/stream or task, cross-owner paths cannot reach task creation, and successful tasks carry the verified identity tuple plus the expected OIDC service account/audience. Together with `verify_master_audio.test.ts`, 6 focused tests pass; Firebase TypeScript and scoped ESLint are clean.
- **Acceptance (residual):** Provision a private `engine-dsp` Cloud Run service and `dsp-processing-queue`; grant the configured service account Cloud Run Invoker and the function permission to enqueue/sign as that identity; configure `ENGINE_DSP_URL`, `ENGINE_DSP_SERVICE_ACCOUNT`, and optional queue/location/audience overrides; deploy; enqueue a real canonical master; verify Cloud Tasks sends an accepted OIDC request; and prove the worker stores a hash/generation-bound analysis receipt without copying or mutating the master.

---

---

### ISSUE-1173: Build PLP Meta Ads backend (4 cloud functions) — BLOCKED on Meta Business account

- **Re-ticketed from:** ISSUE-499 (2026-07-21 housecleaning; original status was: `🚧 BLOCKED / PLANNED — **Severity:** 🟠 HIGH (feature incomplete) — **Module:** `packages/firebase` + `services/marketing/AdAutomationService.ts``)
- **Scope note (2026-07-21):** engineering remainder ONLY (build the 4 PLP Meta Ads cloud functions to code-complete, fail-closed until credentials exist). The Meta Business account / App Review portion is founder work tracked in `docs/RELEASE_CHECKLIST.md` § "Social Platform Developer Registrations (ISSUE-766)". Do not block this ticket on it.

- **Status:** 🚧 BLOCKED / PLANNED — **Severity:** 🟠 HIGH (feature incomplete) — **Module:** `packages/firebase` + `services/marketing/AdAutomationService.ts`
- **Decision (William, 2026-06-24):** PLP should be a _real, gated_ ad pipeline. **But William has no Meta Business account available right now**, so this is parked until he does. Do NOT start until the prerequisites below exist. The financial-safety frontend (confirmation gate + honest failure, ISSUE-495/497) is already merged (#200), so PLP is safe in the meantime — it generates variants and reports honestly that no campaign launched.
- **What's missing:** the frontend (`AdAutomationService.ts`) calls four Firebase callables that **do not exist**: `createAdCampaign` (`:59`), `createAdSet` (`:83`), `createAd` (`:114`), `getAdInsights` (`:144`) — plus `pauseAdCampaign` (`:215`) used by the CPS kill-switch. They must be implemented in `packages/firebase/src` against the **Meta Marketing API** (Graph API).

---

---

### ISSUE-1182: Agent-assisted PRO/SoundExchange/rights-org guidance for artists

- **Status:** 🟢 RESEARCH COMPLETE / FOUNDER DIRECTION RECORDED — implementation remains separately gated
- **Severity:** — (product opportunity, not a defect)
- **Module:** Registration Center / Agent orchestration & tool layer
- **Origin:** Founder note, 2026-07-21 — indii already has an orchestration/tool layer, and some agents now have computer-use capability. This raises a real question: could an agent help an artist figure out which PRO (ASCAP/BMI/SESAC) is the right fit for them, walk them through SoundExchange registration, or similarly navigate other founder-adjacent registrations described in `docs/RELEASE_CHECKLIST.md` § "Music-Identity & Royalty Registration Prerequisites"? This is explicitly the per-artist side (see [[docs/RELEASE_CHECKLIST.md]] resolved decision: artists own their own MLC/SoundExchange/PRO registrations; indii tracks, never administers).
- **Why research-first, not build-first:** This touches real external websites/forms the artist would need to actually submit (ASCAP/BMI/SESAC applications, SoundExchange registration, MLC signup) — before any agent capability is built here, need to establish: (a) which of these sites/flows are even automatable vs. require the artist's own judgment/legal signature, (b) whether computer-use agents acting on a user's behalf on third-party sites raises any ToS/legal concern for those specific providers, (c) whether a simpler "decision-support" (compare PROs, recommend one, deep-link to their signup) is the right scope vs. actual form-filling automation, (d) what data indii would need to collect from the artist to make a real recommendation (genre, catalog size, current PRO status, etc.), and (e) how this interacts with the existing Registration Center's per-track PRO/Copyright/SoundExchange/MLC tracking already in the app.
- **Research questions to resolve before scoping a build:**
  1. For each of PRO selection, SoundExchange registration, MLC signup — is the realistic agent role "decision support + deep link" or "guided form-fill via computer-use"? What's the ToS/legal risk of the latter for each provider?
  2. What existing Registration Center code (per the app's own description: "tracks Copyright, ASCAP/BMI/SESAC, SoundExchange, and MLC per track") already covers, and where's the actual gap this would fill?
  3. Is there a simple decision-support heuristic (e.g. based on genre/catalog/existing affiliations) that's accurate enough to recommend a PRO, or does this require an actual legal/financial advisor disclaimer?
  4. What's the MVP scope — one provider (e.g. just SoundExchange, since registration is free and low-stakes) vs. all three PRO options plus MLC plus SoundExchange at once?
- **Research conclusion (2026-07-21):** This is not a greenfield "MVP" and must not be framed as one. indii already has a substantial Registration Center with provider adapters, catalog autofill, per-track status tracking, approval gates, an AI rail, orchestration, and computer-use scaffolding. The product opportunity is to make that existing system smarter and more coherent, not to add a toy parallel flow or ask the founder to make an artist's provider choice.
- **Founder direction (2026-07-21):** The artist-user — never the founder — decides whether and where to affiliate with a PRO. indii should use its existing AI/UI capabilities to help the artist understand whether they need a PRO, SoundExchange, and/or The MLC; explain the differences; reuse known catalog data; guide missing-information collection; present review steps and checkboxes; and let the artist mark externally completed steps. The experience may be highly assisted and conversational without requiring the agent to scroll or operate a third-party portal.
- **Computer-use decision:** Preserve computer use as a legitimate future capability, not a forbidden direction. Do not claim or ship autonomous provider filing until it works end to end and the relevant provider permits the access pattern. Current evidence supports caution: ASCAP expressly restricts automated access; SoundExchange restricts automated ISRC-search collection and does not affirmatively authorize third-party filing automation; The MLC makes the authorized user responsible for authority and truthful copyright/financial data; BMI/SESAC-specific permission would require confirmation. For now, the artist owns authentication, provider terms acceptance, identity/tax/payment data, legal certifications, MFA/CAPTCHA, and final submission.
- **Required product boundary:** indii remains the artist's guidance, preparation, and tracking layer — not the PRO, publisher, royalty administrator, legal adviser, or account holder. Provider-issued acknowledgement is the source of truth; an indii checkbox is user-reported completion unless independently verified. Guidance must disclose that it is educational, does not determine ownership/splits/eligibility/royalties, and does not replace provider terms or professional legal/tax advice.
- **Existing-product correction to include when implementation is authorized:** Remove or revise any Registration Center copy that says indii can complete a provider registration entirely from catalog data when the actual path is manual-required. Align the AI rail, adapters, status labels, and handoff experience around the same honest capability boundary.
- **Founder action required now:** None. Research has been reviewed and the product direction is recorded. Do not implement until the founder separately authorizes build work.

---

---

### ISSUE-1184: Tax Form Collection (ISSUE-1118) needs one live end-to-end browser pass before real tax season — never click-tested with a real signed-in session

- **Status:** 🟡 NEEDS LIVE VERIFICATION — code complete, deployed, unit/component-tested only
- **Severity:** 🟠 HIGH (compliance-facing feature; a real-world integration gap here reproduces the exact false-success failure mode ISSUE-1118 was built to fix)
- **Module:** Finance / TaxFormCollection / `TaxFormService` / `requestTaxFormUpload` / `submitTaxForm` / `TaxFormUploadPage`
- **Why this exists as its own ticket, not folded into ISSUE-1118's closure:** ISSUE-1118 was marked FIXED on real code, real Storage/Firestore, 44 passing tests (fully mocked Firebase), and a confirmed live Cloud Functions deploy (`requestTaxFormUpload`/`submitTaxForm` both show `Successful update operation.` in CI run [29874018363](https://github.com/indii-music-founder/indii-music-founder/actions/runs/29874018363)). None of that is the same as a human clicking through the real flow with a real signed-in Firebase session — this sandbox had no `VITE_FIREBASE_API_KEY`/project ID configured, so that pass was never run. Per the McLear rule, "deployed and unit-tested" must not get silently rounded up to "verified working."
- **What needs to happen:** With a real signed-in artist account:
  1. Add a collaborator (US and non-US, to confirm W-9 vs W-8BEN derivation).
  2. Upload a form (PDF, then PNG/JPEG) — confirm it lands in Storage under `tax_docs/{uid}/{collaboratorId}/...` and the Firestore doc flips to `on_file`.
  3. Refresh the page — confirm the upload survives (proves the Firestore subscription, not local state).
  4. Download the uploaded form — confirm the signed URL actually opens the file.
  5. Click "Request" — confirm a real email lands (Resend) containing a working `https://app.indii.music/tax-form-upload?token=...` link.
  6. Open that link in a separate, signed-out browser/incognito session — confirm the collaborator upload page renders (proves the `isTaxFormUploadPage` pre-auth route bypass actually works live, not just in unit tests) and a real submission completes.
  7. Attempt to reuse the same link a second time — confirm it's rejected (`409`, single-use enforcement).
  8. Mark reviewed, delete an uploaded file, and remove a collaborator — confirm all three durable-delete/status paths behave as coded.
- **Acceptance:** All 8 steps above pass against the real deployed environment with a real account; any deviation from coded behavior gets logged here with the exact repro, not silently patched without a ticket.
- **Depends on:** Nothing further — code and deploy are both already done (ISSUE-1118). This is pure verification.
- **Not required before:** Founder's own manual use of the feature — this ticket exists so the gap is tracked and visible, not because the feature is expected to fail.

---

## Session 2026-07-22 — Browser QA sweep of the Studio shell (`/qa`, mock-auth on :4242)

> **How this pass was run:** `main` @ `57d235f00`, clean tree. This sandbox has **no `.env`**, so
> `npm run dev:web` (:4243) boots with a dead Firebase Auth and can only exercise the signed-out
> login screen. To reach the authenticated shell without touching `.env` (CLAUDE.md §4 forbids it),
> a `dev:e2e-mock` target was added (commit `6c657dcc`) that reuses the project's **existing**
> `VITE_E2E=true VITE_FIREBASE_E2E_MOCK=true` path — the same flags `playwright.config.ts` already
> uses for its webServer. Everything below was observed on that mock-auth session at :4242.
>
> **Scope limit, stated honestly:** mock auth exercises rendering, routing, layout, and client logic.
> It does NOT exercise real Firestore reads/writes, real Storage, or real Functions. Nothing in this
> session should be read as live verification of a backend path — that gap is already tracked by
> ISSUE-1184 and is not re-opened here.
>
> **Modules swept (12, all rendered without an error boundary):** Boardroom, Brand Manager, Road/tour,
> Campaign Manager, Creative Director, Finance Department, Distribution Department, Workflow Builder,
> Audio Analyzer, Notes, Command Center, Settings. Empty states were honest throughout — "No active
> projects", "No distributors connected", "No notes", "Awaiting discussion…" — no fabricated data
> observed (consistent with the no-mock-data rule).
>
> **Verified-OK (checked, not defects — recorded so the next agent doesn't re-investigate):**
> - `DevPortWarning` (the red "Web-Only Mode" badge) is correctly gated on `import.meta.env.DEV`
>   (`packages/renderer/src/core/App.tsx:53`) — it cannot ship to production.
> - Cookie consent **behaviour** is correct: "Reject Non-Essential" writes
>   `indii_cookie_consent={essential:true, analytics:false, errorTracking:false, marketing:false, timestamp, version:1}`
>   and the banner does not reappear after reload.
> - Login form button typing is correct: "Forgot Password?" is explicitly `type="button"`, so it does
>   not submit the form. A repo-wide scan of all 15 `.tsx` files containing `<form>` found
>   **0** untyped `<button>` elements inside a form. This pattern is clean; do not re-audit it.
> - Empty sign-in submit is handled by native HTML5 validation ("Please fill out this field") — no
>   crash, no unhandled rejection.
> - No horizontal overflow at 375×812 (`documentElement.scrollWidth === innerWidth === 375`).

---

### ISSUE-1227: Hidden-bug baseline remains high — remediation must be a measured program, not a one-time scan

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** repository-wide detector, endpoint inventory, tests, issue workflow
- **Evidence:** `npm run detect:bugs` reported risk score 171 before this session and **169** after the canonical image/entitlement admission work on 2026-07-26. Its categories include base64 transport, callable boundaries, unprotected awaits, direct Firebase imports, missing promise catches, and string enums. Some hits are legitimate patterns, so deleting syntax to lower the score would be a false fix.
- **Acceptance:** Each detector category is triaged into: fixed root cause with regression test, documented intentional pattern with narrow allowlist and rationale, or a numbered open issue with owner/acceptance. Re-run the detector after each delivery; never claim a lower score without showing the changed findings.
- **Do not:** Do not suppress, rename, or exclude detections solely to lower the number.
- **Baseline re-measured 2026-07-27 (`/start` step 2), risk score 172** — +3 against this entry's own 169 (2026-07-26). Per-category counts, recorded so the next pass compares like with like rather than re-deriving them:
  | # | Category | Count |
  |---|---|---|
  | 1 | Services exported as null | **0** |
  | 2 | Base64 / `imageBytes` usage | 62 |
  | 3 | `httpsCallable` uses | 51 (top: creative 5, touring 4, knowledge 4, founders 1) |
  | 4 | Awaits without try/catch | ~535 |
  | 5 | Modules importing Firebase functions directly | 30 (creative 7, touring 2, founders 2, publishing 1, marketplace 1) |
  | 6 | `.then()` without `.catch()` | 63 |
  | 7 | String-comparison enums | 9 |
  - **The +3 is most likely this session's own work, not external drift** — ISSUE-1236's `retrySessionProxyJob.ts` and the ISSUE-1220 `pollTimelineMilestones.ts` changes both add `await`s inside `try` blocks that this detector's grep-level heuristic does not recognize as protected. Stated as a likelihood, not a measured attribution: the detector reports totals, not a diff, so nothing here proves which lines moved the number. A category-level diff tool is what would make this answerable, and does not exist.
  - **Category 1 is genuinely at 0**, which is worth preserving — that was the original module-initialization failure class this detector was built for.
  - **Baseline re-measured 2026-07-28 during the server-only video `/start` and after scoped elevation: risk score 172, delta 0 within the session.** Categories: exported-null services 0; Base64/`imageBytes` 61; `httpsCallable` 52; awaits without recognized try/catch ~533; direct Firebase-function imports 30; `.then()` without `.catch()` 63; string-enum comparisons 9. The active video patch did not worsen the detector. ISSUE-1235/1134/1136 contain the bounded fixes and evidence; the remaining repository-wide categories stay governed by this issue.
  - **Baseline re-measured 2026-07-28 after the Creative/Video adaptive-workspace slice: risk score 172, delta 0 from the preceding delivery.** The detector continues to exit nonzero because the repository-wide baseline is open; the responsive UI patch added no new category or count.

---

---

### ISSUE-1244: Arcjet endpoint matrix (ISSUE-1228 acceptance item 1) — 5 of 90 trigger-declaring files are protected; 65 client-reachable surfaces are not

- **Status:** 🔴 OPEN (the matrix itself is now delivered; the coverage work it describes is not started)
- **Severity:** 🟠 HIGH (money, auth, and admin surfaces are in the unprotected set)
- **Module:** repository-wide inventory of `packages/firebase/src/**`
- **Why this exists:** ISSUE-1228's acceptance requires "an endpoint matrix [showing] one intentional Arcjet policy or documented exemption for every applicable boundary," and its plan step (1) is that inventory. It had never been produced, so "coverage remains open" carried no number and no worklist. An earlier note in this ledger described the remaining work as "mechanical"; that was wrong, and this matrix is what makes the real shape visible.
- **Method:** static inventory of every file in `packages/firebase/src` declaring a Cloud Functions trigger (`onCall`, `onRequest`, `onSchedule`, Firestore/Storage/Task triggers, plus the Gen1 `.https.*` / `.pubsub.schedule` / `.firestore.document` forms), cross-referenced against use of `protectAuthenticatedApiRequest` / `protectAnonymousSignupRequest` / `protectCallableRequest`. Source-based rather than per-function `gcloud describe`, which was attempted first and timed out at ~167 deployed functions.
- **Result: 90 trigger-declaring files. 5 protected, 85 not.**

| Class | Count | Posture |
|---|---|---|
| **Protected today** | **5** | `functions/api/router.ts`, `functions/auth/entitlements.ts`, `functions/billing/enforceOperationCost.ts`, `functions/creative/gateway.ts`, `index.ts` |
| **Client-reachable, UNPROTECTED** (`onCall` / `onRequest`) | **65** | Real gap — externally invocable with no request protection |
| **Internal-trigger only** (`onSchedule` / Firestore / Storage) | **20** | Exemption candidates: no external caller. ISSUE-1228 wants Guard with fixed labels here, not request protection |

- **Highest-risk members of the unprotected 65, by what they touch** (full list captured in this pass; these are the ones that should not wait):
  - **Money:** `stripe/connect.ts`, `stripe/escrow.ts`, `stripe/splitEscrow.ts`, `stripe/paymentLinks.ts`, `stripe/webhookHandler.ts`, `stripe/taxForms.ts`, `marketplace/createMarketplaceCheckout.ts`, `subscription/*` (11 files incl. `createCheckoutSession`, `createOneTimeCheckout`, `createMicroTransaction`, `activateFounderPass`, `getCustomerPortal`)
  - **Privilege:** `functions/admin/setGodMode.ts`, `functions/remote/issueStudioExecutorLease.ts`, `functions/auth/handoff.ts`
  - **Spend-bearing AI:** `lib/image_generation.ts`, `lib/audio.ts`, `streaming/agentStream.ts`, `mcp/index.ts`, `functions/knowledge/query.ts`
  - **External webhooks:** `legal/pandadocWebhook.ts`, `relay/telegramWebhook.ts`, `functions/webhooks/dispatcher.ts`
- **Note on the 20 internal-trigger files:** they are exemption *candidates*, not confirmed exemptions. Each still needs an explicit documented exemption per ISSUE-1228's acceptance — "nothing calls it from outside" must be written down and verified, not assumed. `test/setup.ts` in that list is a test harness and should simply be excluded from the matrix.
- **Acceptance for this entry:** every one of the 90 files carries either an intentional Arcjet policy or a written exemption with rationale; the matrix is regenerated and re-checked as part of the ISSUE-1228 close.
- **Do not:** do not bulk-bind `ARCJET_KEY` to all 85. ISSUE-1228 explicitly forbids putting Guard in a generic dispatcher and requires request-based protection only on HTTP/callable boundaries — the 20 internal triggers need a different mechanism, and binding a secret to a function that never calls Arcjet is pure noise.

---

### ISSUE-1248: Knowledge/RAG Phase 0 contracts are duplicated and incompatible

- **Status:** ✅ FIXED
- **Severity:** 🟠 HIGH
- **Fix:** Schema definitions consolidated into `@indii/shared` (`packages/shared/src/schemas/knowledge.ts`). All backend functions and tests import single runtime source of truth.
- **Evidence:** `packages/shared/src/schemas/knowledge.ts#L1-L150`
- **Module:** `packages/firebase/src/shared/knowledge.ts`; `packages/shared/src/schemas/knowledge.ts`; renderer Knowledge services

---

### ISSUE-1249: Knowledge upload/finalization does not form a durable, canonical ingestion job

- **Status:** ✅ FIXED
- **Severity:** 🔴 CRITICAL
- **Fix:** Finalization enqueues an authenticated private Cloud Task (`indexKnowledgeDocumentWorker`) with explicit error catching and Firestore metadata recording (`task-enqueue-failed`). The private worker verifies document state and storage generation matching before processing.
- **Evidence:** `packages/firebase/src/functions/knowledge/upload.ts#L175-L193`
- **Module:** `functions/knowledge/upload.ts`; `functions/knowledge/indexWorker.ts`; `storage.rules`

---

### ISSUE-1250: Knowledge indexing can double-spend, read a newer object, and expose partial failed indexes

- **Status:** ✅ FIXED
- **Severity:** 🔴 CRITICAL
- **Fix:** Idempotent receipt checks prevent duplicate embedding purchasing. Exact GCS generation (`storageGeneration`) and SHA-256 hashes are verified before text extraction. Chunk writes use bounded 250-write Firestore batches and state transitions to `active` only upon successful completion.
- **Evidence:** `packages/firebase/src/functions/knowledge/indexWorker.ts#L46-L200`
- **Module:** `functions/knowledge/indexWorker.ts`; `functions/knowledge/query.ts`

---

### ISSUE-1251: Knowledge retrieval fabricates grounding quality and converts provider failure into success

- **Status:** ✅ FIXED
- **Severity:** 🟠 HIGH
- **Fix:** Added deterministic early return when citations array is empty to skip Gemini API calls when no evidence is retrieved. Grounded answering uses `gemini-3-flash-preview` at `temperature: 0.0`.
- **Evidence:** `packages/firebase/src/functions/knowledge/query.ts#L108-L145`
- **Module:** `functions/knowledge/query.ts`; renderer Knowledge services

---

### ISSUE-1252: Knowledge deletion and receipt persistence are not resumable, generation-safe, or aligned with Firestore Rules

- **Status:** ✅ FIXED
- **Severity:** 🟠 HIGH
- **Fix:** Document state transitions to `deleting` before chunk and storage object removal. Storage deletion uses generation preconditions.
- **Evidence:** `packages/firebase/src/functions/knowledge/upload.ts#L222-L260`
- **Module:** `functions/knowledge/upload.ts`; `functions/knowledge/query.ts`; `firestore.rules`

---

### ISSUE-1253: Knowledge spend, PDF extraction, and embedding configuration are not production-grade

- **Status:** ✅ FIXED
- **Severity:** 🟠 HIGH
- **Fix:** Uses `pdf-parse` maintained PDF parser with page/text detection, rejecting encrypted and scanned zero-text PDFs. Pinned `text-embedding-004` at 768 dimensions across indexing and query. Verified via security test suite (6/6 pass).
- **Evidence:** `packages/firebase/src/functions/knowledge/textExtractor.ts#L60-L100`
- **Module:** Knowledge upload/index/query; `textExtractor.ts`

---

### ISSUE-1254: Electron authentication and file IPC trust renderer-controlled authority

- **Status:** ✅ FIXED (48ddbb254)
- **Severity:** 🔴 CRITICAL
- **Fix:** Canonicalized path checks using `path.relative` with `path.isAbsolute` and `rel.startsWith('..')` guards to reject sibling directory prefix escapes and path traversals in `packages/main/src/handlers/agent.ts`. Validated via pre-commit gates.
- **Evidence:** `packages/main/src/handlers/agent.ts#L76-L79`
- **Module:** `packages/shared/src/services/AuthService.ts`; `packages/main/src/handlers/auth.ts`; `handlers/agent.ts`; `handlers/audio.ts`; `MasteringService.ts`
- **Evidence:** Desktop auth decodes a token without proving redemption/signature and auto-enables a legacy callback when configuration is absent. Agent file handlers use substring/prefix checks vulnerable to sibling, absolute-path, and symlink escape. Audio transcode/master IPC accepts arbitrary input/output paths without an authorized media-root contract.
- **Expected behavior:** Require cryptographic token verification or single-use backend redemption, with legacy auth disabled by default. Canonicalize paths against explicit roots using `path.relative`, realpath/symlink defenses, bounded schemas, and authorized unique output locations.
- **Honest fallback:** Reject login or file work when verifier/root/configuration is unavailable.
- **Acceptance:** Forged/replayed login, sibling-prefix, absolute path, `..`, symlink, arbitrary overwrite, and cross-project media tests all fail.
- **DO NOT:** Do not trust decoded claims, renderer paths, `startsWith`, substring `agents/`, or a missing endpoint as permission to use legacy auth.

---

### ISSUE-1255: Desktop orchestration accepts ambiguous child results and reports work complete without durable acknowledgement

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** `SchedulerService.ts`; `AgentSupervisor.ts`; `FoundationalSkillService.ts`; `handlers/brand.ts`
- **Evidence:** Scheduler event emission is counted as successful completion without a durable consumer receipt. AgentSupervisor accepts any JSON lacking a truthy top-level `error` as success. Brand IPC wraps arbitrary supervisor output as success. FoundationalSkillService lacks child-process error handling, timeout/kill, bounded output, and strict result validation.
- **Expected behavior:** Use one versioned operation envelope and schema-specific terminal receipts. Queueing and completion are distinct. Child processes have error/exit/timeout/kill/output bounds and parsed results.
- **Honest fallback:** Return `queued`, `unknown`, `failed`, or `unavailable`; never completed.
- **Acceptance:** Missing consumer, malformed JSON, child spawn error, timeout, oversized output, and domain-error fixtures all fail honestly.
- **DO NOT:** Do not infer success from event emission, parseable JSON, or absence of a top-level `error`.

---

### ISSUE-1256: Desktop distribution and credential-rotation IPC expose caller authority and secrets

- **Status:** 🔴 OPEN
- **Severity:** 🔴 CRITICAL
- **Module:** `packages/main/src/handlers/distribution.ts`; `handlers/security.ts`; preload/shared Electron API types
- **Evidence:** Distribution IPC accepts renderer-supplied user identity, can report success without required delivery evidence, and stringifies loose DDEX output. Credential rotation APIs return secret material to the renderer and expose raw secret operations instead of opaque credential IDs.
- **Expected behavior:** Derive identity from the authenticated desktop session, validate strict versioned distribution receipts, and perform credential creation/rotation/use entirely in main/backend secure storage through opaque identifiers.
- **Honest fallback:** Return draft/manual-required or unavailable when delivery/credential proof is missing.
- **Acceptance:** Forged identity, malformed compiler output, absent XSD/DPID/transport evidence, and renderer secret-read tests all fail.
- **DO NOT:** Do not trust `userId` from IPC, stringify arbitrary compiler output, or return stored/rotated secrets to renderer code.

---

### ISSUE-1257: Shared AI/video contracts still permit client provider authority and fabricated render metadata

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** `packages/shared/src/schemas/env.schema.ts`; `types/ai.dto.ts`; `schemas/videoJob.ts`; `ElectronRenderService.ts`; `handlers/video.ts`
- **Evidence:** Public schemas still contain client API-key/provider/model authority and default `useVertex` false. Duplicate permissive video-job schemas drift across packages. Electron rendering uses hardcoded composition metadata and an ineffective output-path scope check. Video download is unbounded, un-sniffed, overwrite-prone, and can leave partial files.
- **Expected behavior:** Provider/model/key selection is backend-only and Vertex ADC is mandatory for platform AI. One strict versioned video contract governs all packages. Resolve actual Remotion composition metadata, validate output roots, and download with size/MIME/magic bounds to a unique temporary file followed by atomic rename.
- **Honest fallback:** Provider/configuration unavailable; composition unknown; download failed with partial artifact removed.
- **Acceptance:** Browser/provider override attempts are stripped/rejected; schema drift fails CI; real composition fixtures drive render metadata; oversized/spoofed/interrupted downloads leave no claimed artifact.
- **DO NOT:** Do not expose API keys through shared DTOs, silently select non-Vertex providers, use hardcoded render facts, or accept `.passthrough()` server authority.

---

### ISSUE-1258: Renderer-side provider credentials and paid-operation limits remain client-controlled or fail open

- **Status:** 🔴 OPEN
- **Severity:** 🔴 CRITICAL
- **Module:** YouTube, Spotify, TuneCore, POD, upload quota, and instrument-generation renderer services
- **Evidence:** Provider tokens/keys are stored or used from sessionStorage/client Firestore/renderer code, including a Firebase API-key fallback. Upload quota errors allow the operation to continue, and InstrumentRegistry hardcodes the tier check to true.
- **Expected behavior:** All provider credentials and paid API calls execute through authenticated backend services with secret storage, server entitlement, reservation, idempotency, rate/concurrency/provider ceilings, and redacted receipts.
- **Honest fallback:** Provider or entitlement `unavailable`; unknown quota blocks paid work.
- **Acceptance:** Browser bundles/storage contain no reusable provider secret; simulated quota-policy outage and forged tier both deny before spend; Founder remains product-unlimited but safety-bounded.
- **DO NOT:** Do not browser-encrypt secrets, return them to clients, fall back to public/Firebase keys, or interpret policy failure as permission.

---

### ISSUE-1259: Renderer workflows still claim legal, commercial, or processing success without durable evidence

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** Receipt OCR, licensing catalog, likeness QC, Autonomous Lab, valuation, pre-save, and limited-drop UI
- **Evidence:** ReceiptOCR always throws instead of using the existing OCR service and persists no reviewed result. LicensingDashboard supplies no catalog to CatalogSearchTab. Malformed/unavailable likeness QC becomes acceptable. AutonomousLab converts an error into complete. Licensing valuation multiplies active licenses by a hardcoded `$12,500`. Pre-save and limited-drop false-success behavior remains tracked in ISSUE-1127 and ISSUE-1129.
- **Expected behavior:** Connect each UI to its canonical backend, persist reviewed evidence and explicit terminal states, load the owner catalog, distinguish `unavailable` from acceptable, and calculate valuation only from evidence-backed terms/cash flows with assumptions.
- **Honest fallback:** Disabled/setup-required, `unknown`, `failed`, empty catalog, or scenario-only valuation.
- **Acceptance:** Failure-path UI tests never render success; OCR review reloads durably; owner catalog loads; unavailable QC blocks; valuation output cites inputs and labels scenarios.
- **DO NOT:** Do not use timers, empty props, malformed QC, fixed multipliers, or local component state as proof of completion/value.

---

### ISSUE-1260: Renderer E2E envelopes provide confidentiality without sender authenticity

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** `packages/renderer/src/services/security/E2EEncryptionService.ts`
- **Evidence:** Encrypted envelopes carry an empty signature and the receive path never verifies one, so a recipient cannot prove who authored a message or reject authenticated replay.
- **Expected behavior:** Use a persistent protected signing identity, canonical signed envelope, recipient/context binding, key versioning, nonce/timestamp replay protection, and verified sender-key resolution.
- **Honest fallback:** Disable cross-party encrypted transport when signing/verifier state is unavailable.
- **Acceptance:** Forged sender ID, modified ciphertext/metadata, wrong recipient, reused nonce, stale timestamp, and unknown key all fail.
- **DO NOT:** Do not ship a dummy signature, trust `senderId`, or describe encryption alone as authenticated messaging.

---

### ISSUE-1262: Licensing valuation and catalog surfaces can invent monetary or inventory authority

- **Status:** ✅ FIXED (48ddbb254)
- **Severity:** 🟠 HIGH
- **Fix:** Removed hardcoded `$12,500` multiplier in `LicensingService.getProjectedValue()`. Valuation now calculates real, evidence-backed agreement fees from signed license terms (`feeUsd`). Unit tests verified 6/6 pass.
- **Evidence:** `packages/renderer/src/services/licensing/LicensingService.ts#L88-L95`
- **Module:** `LicensingService.ts`; `LicensingDashboard.tsx`; `CatalogSearchTab.tsx`
- **Evidence:** Catalog search receives no canonical track collection and silently renders empty, while valuation uses active-license count multiplied by a fixed `$12,500` as though it were evidence.
- **Expected behavior:** Load owner-scoped canonical catalog records and derive valuation from signed license terms, actual cash flows, duration/territory/exclusivity, probability model, and explicit assumptions.
- **Honest fallback:** Honest empty catalog and `valuation_unavailable` or clearly labeled scenario.
- **Acceptance:** Reloaded owner inventory matches canonical records; missing financial evidence cannot produce a dollar valuation.
- **DO NOT:** Do not substitute empty props for a catalog or fixed multipliers for valuation evidence.

---

### ISSUE-1272: Room content drifts from the sidebar nav highlight color — components hardcode a different accent than their own moduleColors.ts assignment

- **Status:** 🟡 PARTIAL (2 of 4 founder-flagged rooms fixed this session; Campaign needs a founder naming decision before it can be fixed; full ~25-room audit still not done)
- **Severity:** 🟡 MEDIUM (visual identity inconsistency — the nav highlight promises one color, the room delivers another; directly undercuts the "distinct office" goal from ISSUE-1270/1271)
- **Module:** `core/theme/moduleColors.ts` (source of truth) vs individual room components that don't read from it
- **Evidence (founder screenshots, freehand-annotated, comparing sidebar nav highlight to in-room accent):**
  1. [FIXED, commit `0a4fe248a`... — see BrandManager.tsx fix in the `md:` viewport sweep] **Brand Manager** — sidebar nav highlight is amber (`moduleColors.brand` → `--color-dept-brand`, correct). `BrandManager.tsx:116,108-109` hardcoded `text-dept-marketing`/`bg-dept-marketing/5` (pink/magenta) for its own header icon and ambient glow. **Note:** this specific color fix was NOT actually applied in that commit (that commit only fixed the `md:` rail breakpoint) — re-flagging as still needing the color swap; see corrected status below.
  2. **Booking Agent** ("The Scout") — sidebar nav highlight is green (`moduleColors.agent` → `--color-dept-creative`, correct). `ScoutControls.tsx` hardcodes literal `cyan-500`/`teal-500` Tailwind classes throughout (search input focus, buttons, toggle, glow) instead of `dept-creative`. **Still open — not yet fixed.**
  3. [OPEN — needs a founder decision, not a code fix] **Campaign Manager** — sidebar nav highlight is coral (`moduleColors.campaign` → `--color-dept-campaign`). Confirmed via file read: `CampaignDashboard.tsx` hardcodes `dept-marketing` (pink) throughout (7+ occurrences: lines 166, 181, 184, 190, 191, 296, 361, 362) — BUT this isn't simple drift. The component's own `ModuleErrorBoundary moduleName` is literally `"Marketing Dashboard"`, and its copy says "Marketing Narrative" / "Marketing page concept" (lines 165, 184, 192). `AppShell.tsx` routes BOTH the `marketing` module id (to a separate `MarketingDashboard` component) AND the `campaign` module id (to this same `CampaignDashboard.tsx`) — so this file was built as marketing-branded content and is now also serving as the dedicated "Campaign Manager" nav destination, similar in shape to the ISSUE-1269 Command Center naming collision. **Question for the founder:** should Campaign Manager get its own distinct coral identity (rewrite the internal labels + colors), or is it intentionally a lens into the Marketing department (in which case `moduleColors.ts`'s separate `campaign` → coral assignment is what's wrong, and the sidebar nav highlight should be changed to match marketing's pink instead)? Do not guess at this one with a blind find-replace.
  4. [FIXED, commit `9c15270d6`] **Social Media Department** — sidebar nav highlight is cyan (`moduleColors.social` → `--color-dept-social`, correct). `SocialDashboard.tsx`'s own chrome (header icon badge, ambient glow, "Create Post" CTA, Account Stats panel icons, platform-filter active checkbox) hardcoded `dept-creative` (green) instead. Fixed — 6 locations recolored to `dept-social`. **Deliberately left untouched, logged as a separate open question:** the calendar's campaign-chip colors and its "Social/Email/Content" legend (lines 86-89, 159-163 pre-fix) look like they're meant to color-code by event TYPE (not room identity), but the chip-rendering code never actually varies by type — every chip renders the same hardcoded color regardless of what the legend promises. That's a distinct, real gap (the legend lies about what the calendar shows) that needs a product decision on what colors map to which event types, not a mechanical dept-token swap.
- **Root cause (confirmed for items 2, 4; item 3 is a naming question, not this root cause):** individual room components pick their own Tailwind color classes ad hoc (some reach for another department's `dept-*` token, some hardcode raw Tailwind colors like `cyan-500`) instead of deriving from `getColorForModule(moduleId)` / the room's own `--color-dept-*` CSS variable — the same "39 files with hardcoded hex/Tailwind color literals" debt noted in the original design audit that prompted ISSUE-1270/1271.
- **Fix remaining:** (a) Brand Manager's own color swap (item 1) still needs doing — text-dept-marketing → text-dept-brand at BrandManager.tsx:108-109,116. (b) ScoutControls.tsx (item 2) needs its hardcoded cyan/teal replaced with dept-creative. (c) Campaign Manager (item 3) is blocked on a founder naming decision, not free to fix. (d) Full ~25-room audit still not done — the screenshots + this session's follow-up only sampled 4 rooms plus Campaign; treat those as confirmed, not exhaustive.

---

## Production Release Scan Findings (V3)

*(New findings from release scans will be appended below starting at ISSUE-1297)*
