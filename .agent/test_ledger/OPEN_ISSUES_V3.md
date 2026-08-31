Warning: truncated output (original token count: 103230)
Total output lines: 2972

# Open Issues — Real-Life Test Findings (V3, ACTIVE)

> This file is written by test / bug hunting / QA agents and consumed by fixing agents.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-08-30 (**Founding Artist Beta marketing program added as ISSUE-1418 through ISSUE-1430**)
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
- **Status:** ✅ FIXED (2026-08-11)
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Video editor
- **Evidence:** `useVideoEditor.ts` uses `RenderService` for cloud exports with progress tracking, receipt completion verification, and auto-saving the rendered asset URL to `generatedHistory`. Local exports prompt the user for output directory via `electronAPI.selectDirectory()`, construct unique `video_${timestamp}.mp4` output locations, and save to `generatedHistory`.
- **Impact:** Cloud export can leave the user with no downloadable artifact. Local export can overwrite previous renders and may fail access checks.
- **Fix:** Add render-job lifecycle state, polling/subscription, completed asset persistence, user-selected save destination, and unique filenames.
- **Acceptance:** Cloud render fixture ends with a gallery asset/download URL; local render prompts for or safely creates a unique output path.

---

---

### ISSUE-1124: Waterfall payout UI, TypeScript contract, and Python engine use incompatible payload/report shapes

- **Re-ticketed from:** ISSUE-826 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-14)
- **Severity:** 🟠 HIGH
- **Module:** Distribution / Finance bank layer
- **Evidence:** The request/report shapes are now aligned on `gross`, fractional `splits`, nested distribution entries, `total_distributed`, and `processed_at`, but the remaining binding defect was the subprocess stdout contract: `waterfall_payout.py` pretty-printed the report across 31 lines while `python-bridge.ts` parses only the final stdout line. The final line was `}`, so `PythonBridge` returned raw text and `AgentSupervisor` rejected it as non-JSON. The focused integration regression invokes the real local Python process, proves stdout is exactly one parseable JSON line while calculation diagnostics remain on stderr, and then exercises `AgentSupervisor`/`PythonBridge`; the `$1,000` / 50-30-20 fixture returns `$425`, `$255`, `$170`, `$850` total, and a parseable timestamp. Existing `BankPanel.test.tsx` separately proves the renderer sends the matching request and renders those values plus the fee and timestamp.
- **Impact:** The local payout simulation previously failed between Python stdout and the main-process schema gate even though its arithmetic and renderer contracts were correct.
- **Fix:** Emit the Python report as one compact JSON line on stdout, keep calculation logs on stderr, and lock the contract with a real main-process subprocess regression. Existing nonzero error exits and stderr diagnostics remain unchanged; no general `PythonBridge` rewrite or payment-provider integration is required.
- **Acceptance:** ✅ FIXED (2026-08-14) — `packages/main/src/handlers/distribution.waterfall.integration.test.ts` executes the real `ipcMain.handle('distribution:execute-waterfall')` handler through `AgentSupervisor` and `PythonBridge` into the real `python3 execution/finance/waterfall_payout.py` subprocess. Both $1,000 / 50-30-20 split distribution ($425/$255/$170) and empty split rejection pass in CI.

---

---

### ISSUE-1125: Credential storage falls back to localStorage and raw Firestore fields

- **Re-ticketed from:** ISSUE-840 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-11)
- **Severity:** 🔴 HIGH (secret handling)
- **Module:** Security / Credential storage
- **Evidence:** `UniversalTools.credential_vault` and `PODCredentialService` both fail closed with `CREDENTIAL_STORAGE_UNAVAILABLE` when `window.electronAPI.credentials` is unavailable. No `localStorage` fallback exists in `UniversalTools.ts`, and `PODCredentialService` never writes API keys to Firestore documents.
- **Impact:** Production secrets can be written to browser storage or client-readable Firestore documents instead of OS secure storage / server-side secret management.
- **Fix:** Remove localStorage credential fallback from production builds. Route all provider credentials through Electron safeStorage/keychain or server-side secret storage with encryption, least-privilege access, and redacted reads.
- **Acceptance:** Web/renderer credential save attempts fail closed unless an approved secure credential backend is available; no API key is returned to the renderer after storage.

---

---

### ISSUE-1126: Multiple active user-scoped feature collections are missing Firestore rules

- **Re-ticketed from:** ISSUE-843 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08 — the remaining canonical-path defect was closed in ISSUE-1313 and the complete Firestore rules suite passed against the emulator)
- **Severity:** 🟠 HIGH
- **Module:** Firebase / Firestore rules / Cross-module persistence
- **Re-audit findings (2026-08-07), collection by collection:**
  1. `users/{uid}/analyticsTokens/{platform}` and `users/{uid}/socialTokens/{platform}` — **already fixed**, presumably by ISSUE-1128's server-side-token work: both now have explicit `allow read, write: if false;` (server-owned via Admin SDK, never client-readable — this is more correct than the original ticket's ask for client rules, since these are OAuth tokens).
  2. `users/{uid}/merchandiseMockups` (`CommerceTools.ts` `mockup_merchandise`) — **fixed this pass.** No rule existed at all; every write fell through to the deny-all catch-all. Added a nested `match` under `users/{userId}` with a schema check (`productType`, `designIdea`, `imageUrl` required strings) matching the tool's actual write shape; owner read/create/delete, immutable (no update — regenerate instead).
  3. `users/{uid}/brandKit/current` (`BrandTools.ts` `save_brand_kit`/`load_brand_kit`) — **fixed this pass.** Same situation: no rule existed. Added a nested `match /brandKit/{docId}` requiring `docId == 'current'` plus a minimal shape check (`name` string, `values` list) matching the tool's `setDoc(..., {merge: true})` write.
  4. `users/{uid}/limitedDrops` and `users/{uid}/proprietaryIngestionReleases` (`PublishingTools.ts` `query_pro_database`) — **NOT the same bug as #2/#3, deliberately not fixed here.** `firestore.rules` already has top-level (non-nested) `match /limitedDrops/{dropId}` and `match /proprietaryIngestionReleases/{releaseId}` rules with `userId`/`orgId`-field-based ownership — but those don't match the *nested* subcollection paths these two call sites actually read/write (`users/{uid}/limitedDrops`, `users/{uid}/proprietaryIngestionReleases`), which fall through to the same deny-all catch-all regardless. For `proprietaryIngestionReleases` specifically, the top-level collection is the real, actively-written canonical release store (`useDDEXRelease.ts`, `useReleases.ts`, `DistributionSyncService.ts`, `DistributionService.ts`) — the 3 call sites using the nested path (`PublishingTools.ts:22`, `Web3Tools.ts:102`, `CoreTools.ts:207`) look like a **wrong collection path in the calling code**, not a missing rule. Adding a rule to legitimize the nested path would create a second, empty, never-populated data store instead of fixing the real bug. Re-ticketed as ISSUE-1313 for a proper root-cause fix.
- **Fix:** See per-collection findings above. `merchandiseMockups` and `brandKit` rules added to `packages/firebase/firestore.rules`, following the file's existing `isOwner()`/`isVerifiedUser()` conventions (same pattern as the neighboring `platformStats`/`tax_collaborators` blocks).
- **Verification:** The 2026-08-07 brace/schema review remains valid. On 2026-08-08, `npm run test:rules -w packages/firebase` used the running Firestore emulator and passed all 195 tests. The formerly-misdirected release/drop paths were separately covered by focused renderer service/tool tests (9 passing across the catalog and agent-tool suites) and limited-drop emulator assertions.
- **Acceptance:** Met. `merchandiseMockups` and `brandKit` retain explicit owner-scoped rules; the obsolete nested release/drop paths are denied, canonical top-level paths are the only active stores, and the full rules suite now has emulator evidence.

---

---

### ISSUE-1127: Pre-save builder exposes a shareable campaign URL without publishing a page or storing leads

- **Re-ticketed from:** ISSUE-844 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08 — durable callable-backed publication, hosted public route, consented lead storage, deterministic conversion outbox, and owner-only rules)
- **Severity:** 🟠 HIGH
- **Module:** Marketing / Pre-save campaigns
- **Original evidence:** `PreSaveCampaignBuilder` derived an unresolved `indii.vip/presave/{slug}` URL locally and exposed Copy/Share before publication. `PreSaveCampaignService.createCampaign()` and `recordLead()` only logged while their Firestore persistence was commented out.
- **Impact:** A founder can share a URL that may not resolve to a hosted landing page, and fan email/phone collection can be lost because no published campaign or lead storage is created.
- **Fix:** `PreSaveCampaignBuilder` now requires an explicit successful publish before showing the canonical `https://app.indii.music/presave/{campaignId}` URL, real QR encoding, Copy, or Share. `createPreSaveCampaign` validates official HTTPS DSP domains and writes `presaveCampaigns/{campaignId}`. `App.tsx` hosts the public landing page before the auth gate, including a mobile-remote bypass. `presaveRegister` applies App Check and fail-closed Arcjet protection, validates campaign/contact/consent state, transactionally writes `leads/{leadId}`, deduplicates `leadCount`, and awaits a deterministic conversion-outbox write before allowing the DSP redirect. Firestore Rules deny all client writes and allow only the campaign owner to read campaign and lead records.
- **Acceptance evidence:**
  1. **No fabricated sharing:** builder regression proves Copy, Share, and QR are absent until the callable returns a persisted campaign ID; persistence failure keeps all three locked.
  2. **Routable hosted page:** renderer routing regression covers `/presave/{campaignId}` as a public mobile bypass, and landing-page tests prove public load/unavailable behavior.
  3. **Durable lead and conversion:** backend regressions prove the consented lead shape, new-lead-only counter increment, deterministic retry identity, awaited outbox result, and non-throwing Firestore failure response.
  4. **Protected data:** Firestore emulator suite proves owner reads and rejects public, anonymous, cross-account, forged, schema-polluted, update, and delete attempts.
  5. **Verification:** focused Vitest passed 42/42; Firebase, Firebase-test, and renderer TypeScript checks passed; scoped ESLint passed; Firestore emulator rules passed 190/190. Production deployment remains deferred solely by the known Firebase billing condition, per founder direction; code-completion acceptance is satisfied.

---

---

### ISSUE-1128: Social analytics connection state can be inferred from denied or stale token/cache paths

- **Re-ticketed from:** ISSUE-847 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Social / Analytics / Firestore rules
- **Evidence:** Social tokens are read from `users/{uid}/socialTokens/{platform}` (`SocialPlatformService.ts:66-81`) and stats are cached to `users/{uid}/platformStats/{platform}` (`SocialPlatformService.ts:447-448`, `:518-519`, `:565-566`, `:606-607`, `:653-654`). The dashboard marks a platform connected when live stats exist, a cached `platformStats` doc exists, or a `socialTokens` doc exists (`SocialAnalyticsDashboard.tsx:120-136`). Firestore rules for `users/{userId}` do not include `socialTokens` or `platformStats` in the allowed subcollections (`packages/firebase/firestore.rules:329-346`) and deny unmatched paths (`:1230-1234`).
- **Impact:** Connection status can be wrong in both directions: rules can block token/cache reads while UI shows generic sync errors, or stale cache/token docs can mark a platform connected even when live API sync is failing.
- **Fix:** Move OAuth tokens server-side, expose sanitized connection metadata, add explicit rules for non-secret analytics cache if client-readable, and separate `connected`, `authorized`, `liveSyncOk`, and `cacheOnly` UI states.
- **Acceptance:** A denied token/cache read shows a permission/configuration error; stale cache cannot mark live sync connected; rules tests cover `platformStats` and reject client access to raw OAuth tokens.
- **Resolution (2026-08-08):** `syncPlatformStats` is now exported by the Firebase entry point and is the sole stats-sync authority. It reads OAuth credentials only through Admin SDK server paths, exposes sanitized `connected`/`authorized`/`liveSyncOk`/`cacheOnly`/`error` state, never treats an absent or expired credential as a cache hit, and overwrites cache only after live provider success. Renderer services no longer read token documents or call provider APIs with browser-visible credentials; the dashboard renders live, authorized-error, cached, and disconnected states distinctly. Apple Music fails closed because no live adapter exists.
- **Verification (2026-08-08):** Backend sync regressions, renderer dashboard regression, and analytics-agent tool regressions pass. Firestore rules keep both token collections server-only while owner-scoped `platformStats` remains readable. A stale stats document without current authorization cannot produce a connected/live state.

---

---

### ISSUE-1129: Limited-drop wizard says a drop is live and fans will be notified without persistence or notification backend

- **Re-ticketed from:** ISSUE-849 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Merchandise / Limited drops
- **Evidence:** `DropCampaignWizard.handleSubmit()` waits 1.5 seconds and sets local `submitted` state only (`DropCampaignWizard.tsx:79-82`). The success view says “Drop Scheduled!”, “is live,” and “Fans will be notified when the countdown hits zero” (`:138-151`). The wizard captures pre-sale and superfan-only toggles (`:221-237`) but does not save a drop, publish a landing page, configure gating, or queue notifications before “Launch Drop” (`:269-274`).
- **Impact:** A user can believe a scarcity campaign is live while no drop, audience gate, countdown page, or fan notification exists outside the modal.
- **Fix:** Wire the wizard to a real `limitedDrops` create/publish service, validate selected products and future date/time, and queue/email/SMS notification jobs only after provider credentials and audience segments are verified.
- **Acceptance:** “Launch Drop” returns a persisted drop ID and notification job status; without backend support, the UI shows “draft created” or “setup required,” never “live.”
- **Resolution (2026-08-08):** `DropCampaignWizard` and `CommerceTools.create_limited_drop_campaign` now share `LimitedDropService.createDraft()`. It strictly validates selected product IDs, name, and a future timestamp, writes one owner-scoped document to the canonical top-level `limitedDrops` collection, and returns the real Firestore ID with `notificationStatus: 'setup_required'` and provider `none`. The success UI says “Drop Draft Saved” and explicitly says the drop is not live and no fan notifications were sent. Firestore rules accept only the exact draft schema and deny forged live/notified states, extra fields, updates, deletes, cross-owner reads, and the obsolete nested path.
- **Verification (2026-08-08):** `DropCampaignWizard.test.tsx` 2/2, `LimitedDropService.test.ts` 2/2, and the full Firestore emulator suite 195/195 passed. Source scan finds no “is live” or “Fans will be notified” success copy in the implementation.

---

---

### ISSUE-1130: Storefront deployment creates one fixed-price Stripe link for all items

- **Re-ticketed from:** ISSUE-851 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Commerce / Storefront / Stripe
- **Evidence:** `CommerceTools.deploy_storefront_preview()` tells the user “Storefront deployed ... with N real Stripe Payment Links” after calling `createStripePaymentLinks` (`CommerceTools.ts:53-62`). The Cloud Function creates one Stripe product named `{campaignName} - Storefront Items`, puts all item names into the description, creates a single `$25.00` USD price, creates one payment link with quantity 1, and returns it as both `storefrontUrl` and the only `paymentLinks` entry (`paymentLinks.ts:19-38`).
- **Impact:** Multi-item storefronts have no per-item pricing, quantities, SKUs, tax/shipping configuration, inventory, fulfillment metadata, or split payout routing, yet are presented as deployed real checkout.
- **Fix:** Accept structured items with SKU, title, unit amount, currency, quantity/stock, tax/shipping settings, fulfillment provider, and payout metadata. Return one verified checkout/cart or itemized payment links.
- **Acceptance:** A two-item storefront creates two distinct prices/line items with correct item data and rejects unpriced items; user-facing copy says “checkout preview” unless the public storefront and fulfillment path are complete.
- **Resolution (2026-08-08):** `createStripePaymentLinks` now accepts and strictly validates structured SKU, title, unit amount, currency, quantity, stock, tax behavior/code, shipping requirement, fulfillment provider, and payout metadata. It creates a distinct Stripe product and price for every item and one itemized Checkout preview with idempotency protection. Mixed currencies, duplicate SKUs, invalid prices/stock, missing shipping countries, and oversized metadata fail before Stripe mutation. The result explicitly reports `fulfillmentReady: false` and `inventoryEnforced: false`; Commerce tool copy calls the result a checkout preview, not a deployed storefront.
- **Verification (2026-08-08):** Five focused payment-link tests prove two items produce two prices/line items and invalid catalog data is rejected. Firebase build and renderer typecheck pass.

---

---

### ISSUE-1131: Split escrow UI treats zero collaborators as ready to release

- **Re-ticketed from:** ISSUE-855 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-05)
- **Severity:** 🟡 MEDIUM
- **Module:** Finance / Split escrow UI
- **Evidence:** `SplitSheetEscrow` initializes `collaborators` as an empty array (`SplitSheetEscrow.tsx:24-30`), computes `allSigned = signedCount === totalCount` (`:36-39`), and computes `progressPct` as `signedCount / totalCount` (`:39`). With zero collaborators, `allSigned` is true and `progressPct` is `NaN`, so the escrow banner can show “Ready to Release” (`:162-166`) and the release button path renders as enabled for the all-signed state (`:271-284`).
- **Impact:** Empty setup state looks like a release-ready escrow and can produce invalid progress styles/copy.
- **Fix:** Require `totalCount > 0`, escrow amount > 0, valid splits totaling 100, and connected accounts before `allSigned` or release-ready UI can be true.
- **Acceptance:** With zero collaborators, the UI shows setup-required, progress is 0%, and release controls are disabled with a specific missing-collaborators reason.
- **Resolution (2026-08-05):** Refactored `allSigned` condition to require `totalCount > 0` explicitly. Added guard to `splitsValid` (require collaborators before valid splits). Added “Setup Required” alert when collaborators list is empty. Finance tests: 44/44 passing. Commit: `e7f3e9ad3`.

---

---

### ISSUE-1132: Royalty forecasts use fixed approximate rates and fixed confidence as if they are verified projections

- **Re-ticketed from:** ISSUE-857 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟡 MEDIUM
- **Module:** Finance / Revenue forecasting
- **Evidence:** `forecast_revenue()` uses hard-coded approximate per-stream rates and assumes the same stream count repeats for month 1, month 6, and year 1 (`FinanceTools.ts:92-144`). `predict_daily_royalties()` uses only two fixed rates (`Spotify` = `$0.0035`, all other platforms = `$0.006`) and returns `confidence: 0.88` without source data, territory, subscription mix, distributor fee, currency, or historical variance (`:251-267`).
- **Impact:** Users can treat rough estimates as high-confidence royalty forecasts, which affects budgets, recoupment, and payout planning.
- **Fix:** Mark these as rough calculators unless backed by actual distributor/DSR history. Add source, assumptions, confidence rationale, territory/currency/platform mix, distributor cut, and date of rate table.
- **Acceptance:** No tool returns fixed high confidence without historical data; estimate output includes assumptions and `confidenceSource`, or is labeled `rough_estimate`.
- **Resolution (2026-08-08):** Both revenue tools now identify their output as `rough_estimate`, use low confidence, and return the rate-table source/date, currency, platform mix, distributor-cut assumption, missing territory/subscription data, and explicit limitations. The UI labels the calculator accordingly and renders the source and confidence rationale instead of presenting an intelligence-backed projection.
- **Verification (2026-08-08):** Eight focused Finance tool and UI regressions pass; renderer TypeScript is clean.

---

---

### ISSUE-1133: DDEX readiness treats local metadata fields as delivery authority

- **Re-ticketed from:** ISSUE-858 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Distribution / DDEX readiness
- **Evidence:** `buildDistributionReadiness()` validates identifier formats and checks that `metadata.dpid` plus ISRC/UPC/ISWC/catalog number exist (`ReleaseHarnessAdapters.ts:140-155`). It then exposes `authorityLevel: 'package_ready'` when `ddexPackageReady` and `selectedStores.length > 0` (`:168-176`). The compiler turns that into a 100 score with rationale “Metadata, identifiers, and DPID are present” (`DistributionDdexCompiler.ts:35-41`) and recommends delivery approval (`:60-71`).
- **Impact:** A typed-in DPID and selected store names can make the package look delivery-ready without proof of a registered sender DPID, DSP recipient identities, delivery agreement, SFTP/API credentials, feed profile, or XSD-validation receipt.
- **Fix:** Split `metadataComplete` from `deliveryAuthorityReady`. Require verified sender DPID, verified recipient SystemIdentity per selected store, active delivery credentials, feed profile, and validation receipts before `package_ready`.
- **Acceptance:** A release with local DPID text but no verified DDEX onboarding remains `metadata_only`; selected stores without recipient credentials are listed as blocked.
- **Resolution (2026-08-08):** `DdexDeliveryAuthorityEvidence` now separates local metadata from verified sender/recipient authority. `package_ready` requires a matching verified sender DPID, sender validation receipt/reference, active sender credentials, and—per selected store—a recipient DPID, verified onboarding, active credentials, feed profile, and accepted validation receipt. Missing evidence produces named authority blockers; the compiler score is capped below 100 until those blockers are cleared. The readiness model deliberately never emits `delivery_authorized`, because that requires a downstream delivery receipt rather than preflight metadata.
- **Verification (2026-08-08):** Focused release-harness and compiler suites passed 27 tests across the remediation run. The regression explicitly proves typed metadata plus a DPID string remains `metadata_only`, while complete verified sender/recipient evidence alone reaches `package_ready`.

---

---

### ISSUE-1137: Video grounding preflight uses an image model ID the gateway rejects

- **Re-ticketed from:** ISSUE-880 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ FIXED (2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Licensing / Stripe checkout / License records
- **Evidence:** The license purchase flow sends Stripe metadata containing only `type`, `trackTitle`, `artist`, `connectedAccountId`, and `artistAmount` plus optional caller metadata (`LicensingService.ts:119-146`). The webhook then transfers `artistAmount` and creates an `active` `licenses` document with title, artist, `licenseType: 'sync'`, amount, and session ID (`webhookHandler.ts:69-113`). The app’s `License` type expects usage and optional agreement URL/date bounds (`types.ts:6-18`), but the webhook does not persist licensee, agreement URL, territory, media/use type, term, exclusivity, master/composition rights, contract version, or accepted terms.
- **Impact:** A payment can create an “active sync license” that is not legally scoped enough to prove what was licensed.
- **Fix:** Require a signed/accepted license agreement or immutable license terms object before checkout, store it by ID, and have the webhook activate that exact agreement after payment.
- **Acceptance:** No `status: active` license is created unless it references a versioned agreement, licensee, usage, territory, term, rights covered, and Stripe session/payment ID.
- **Resolution (2026-08-08):** The customer checkout control and hard-coded connected-account destination were removed from the micro-licensing portal; it now produces a clearly labeled draft and keeps checkout disabled until agreement setup exists. The webhook refuses licensing fulfillment unless Stripe metadata references an existing server-owned, versioned, accepted agreement whose immutable terms include licensee, usage, territory, term, exclusivity, master/composition rights, fee, connected account, title, and artist. It verifies the terms hash, payer email, Stripe-account consent, and paid amount, then derives the transfer and active license from the agreement rather than caller metadata. Active license documents are client read-only; strict owner-scoped `license_requests` rules cover request drafts.
- **Verification (2026-08-08):** Licensing component/service tests pass, combined payment/webhook tests pass 19/19, and the full Firestore emulator suite passes 198/198. The changed Firestore surface received a 5/5 rules audit with no findings.

---

---

### ISSUE-1139: “Complete” GDPR data export omits major app data and uses two inconsistent implementations

- **Re-ticketed from:** ISSUE-890 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-08)
- **Severity:** 🟠 HIGH
- **Module:** Screenwriter / Storyboard / Veo prompts
- **Evidence:** `generateNextScene()` is explicitly labeled “Simulate AI generation of next scene” (`ScreenwriterDashboard.tsx:233-234`), waits `setTimeout(..., 1200)` (`:235-250`), and appends the same hard-coded recording-cabin description/camera angle/Veo prompt every time (`:237-247`). The button is wired as an active generation action in the dashboard (`:303`, `:440`).
- **Impact:** Users can believe the Screenwriter generated a scene from their concept when it only inserted canned content, polluting downstream storyboard/Veo planning.
- **Fix:** Route scene generation through the screenwriter agent/model with the current concept, tone, previous scenes, and target duration, or rename the button to “Add template scene.”
- **Acceptance:** A generated scene changes with concept/tone/history and includes model provenance; offline/unavailable mode shows an honest template/manual-add state.
- **Resolution (2026-08-08):** Removed the timer, canned recording-cabin content, random pseudo-result, and active AI claim. The sidebar now adds a visibly blank, editable scene and switches to its editor. The concept panel states that AI expansion is not connected and exposes a disabled `AI Expansion Unavailable` control. Component coverage proves the unavailable state and that manual scene creation persists without generated-content claims.

---

---

### ISSUE-1143: Screenwriter Veo handoff collapses storyboard structure into one prompt string

- **Re-ticketed from:** ISSUE-896 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ CLOSED (FIXED - 2026-08-08)
- **Severity:** 🟡 MEDIUM
- **Module:** Screenwriter → Creative Studio / Veo handoff
- **Evidence:** The Veo prompt tab says output “directly exports to generative pipelines” (`ScreenwriterDashboard.tsx:573-599`), but `handleOpenCreativeStudio()` only joins all scenes into a single text block, calls `setCreativePrompt(handoffPrompt)`, sets generation mode/view, and switches to Creative (`:213-228`). It does not populate `VideoWorkflow` storyboard slots, per-scene duration, camera metadata, seed/aspect controls, or a structured `pendingStageHandoff.veo` payload; `VideoWorkflow` then uses the shared `creativePrompt` as one `localPrompt` (`VideoWorkflow.tsx:213-285`, `:511-539`).
- **Impact:** Multi-scene storyboards lose per-scene timing and generation boundaries; a three-scene music-video plan becomes one prompt for one video job.
- **Fix:** Create a typed Screenwriter→Veo handoff contract that maps each scene to storyboard slots with prompt, duration, camera angle, ordering, and optional reference assets.
- **Acceptance:** Opening Creative from Screenwriter creates a visible storyboard/timeline with one slot per scene and preserves scene duration/camera/prompt metadata.
- **Resolution (2026-08-08):** Added a typed `ScreenwriterStoryboardHandoff` contract and a video-editor receiver that compiles each ordered scene into its own editable `StoryboardProject` slot. Exact start seconds, duration, scene number, heading, description, camera angle, and prompt are retained; the Creative storyboard opens directly and renders the imported timing/scene metadata. Per-slot generation uses the preserved requested duration. The former combined `creativePrompt` write and misleading “storyboard loaded” shortcut are gone.
- **Verification (2026-08-08):** Screenwriter and storyboard schema suites pass 24/24, including a component assertion over the three distinct compiled slots and their timing/camera data; renderer TypeScript is clean.

---

---

### ISSUE-1144: Selecting multiple reference files can retain only the last file that finishes reading

- **Re-ticketed from:** ISSUE-914 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
- **Severity:** 🟠 HIGH (cross-project creative contamination)
- **Module:** Creative Studio / Product Showroom
- **Evidence:** `showroomState` is a single unkeyed Zustand object containing the product asset, prompts, mockup, and in-flight flags; `setShowroomState` merges globally with no project boundary or persistence (`creativeControlsSlice.ts:159-170`, `:343-355`). `ShowroomUI` reads the live `currentProjectId` only when creating an uploaded input and when sending the displayed result to Veo (`ShowroomUI.tsx:29-69`, `:300-315`). The original input’s project ID in the service (`ShowroomService.ts:78-86`, `:131-139`), even if another project is active when the awaited operation completes.
- **Impact:** Switching projects displays another project’s artwork, scene, and result; a generation started in A can finish while B is visible yet file itself into A, and Send to Veo can stamp the same displayed result as B. Users cannot tell which project owns the paid output.
- **Fix:** Key showroom sessions by project or clear/confirm on project switch, capture immutable project/input/prompt snapshots at submission, and route completion/handoff/history consistently to that captured target with a visible project label. Persist recoverable drafts if promised.
- **Acceptance:** A→B switch never exposes or mutates A’s draft without an explicit transfer; completing A while B is active files and labels the result only in A; Send to Veo cannot rewrite ownership to B; switching back restores A only if per-project draft persistence is intentional.

---

---

### ISSUE-1153: Closing or replacing a Publishing release draft abandons uploaded masters and cover art

- **Re-ticketed from:** ISSUE-965 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
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
- **Status:** ✅ CLOSED (FIXED - 2026-08-02)
- **Severity:** 🔴 CRITICAL (paid item cannot be fulfilled)
- **Module:** Marketplace / Product creation and buyer delivery
- **Evidence:** The listing modal exposes six product types but only stem packs collect files; every other type creates a product with `images: []` and empty metadata (`CreateProductModal.tsx:26-39`, `:83-92`, `:167-181`). The `Product` model has only generic images/inventory/metadata and no required asset, SKU/variants, ticket event, service terms, shipping, license, or delivery policy (`marketplace/types.ts:12-25`). Repository-wide marketplace purchase code creates Checkout/purchase/revenue records but has no buyer entitlement, signed-download, ticket issuance, shipping order, service booking, refund, or digital delivery path (`MarketplaceService.ts:165-264`).
- **Impact:** A buyer can be charged for an empty song/album, unshippable merch, nonexistent ticket, or undefined service, with no artifact or entitlement to receive.
- **Fix:** Use discriminated product schemas with required fulfillment data per type and provision verified delivery…73230 tokens truncated…YlGg0LQuVADCFoO2/audio/outputs/1787201179368_1f48d006.wav. Status is ✅ FIXED; the header line is superseded.
---

### ISSUE-1159 evidence (2026-08-20 20:16 ET) — PLP batch suites green

- Ran plpBatch.test.ts (3) + plpBatch.integration.test.ts (7) → 10/10 pass on the current tree. The suite covers the 5 acceptance scenarios (mixed completion order, retry lifecycle, duplicate events, project switch, cleanup).
- Note: despite the name, plpBatch.integration.test.ts is pure in-memory logic (no Firestore emulator dependency) — the ledger's 'emulator-backed' wording is aspirational. The remaining residual — a live provider generation receipt — stays budget-gated (approved fixture/budget required before paid generation).
- VideoGenerationService.integration.test.ts: 3 tests skipped (env-gated) — expected, not a failure.
---

### Emulator rules suite — REAL emulator-backed run (2026-08-20 20:16 ET)

- Command: `FIREBASE_EMULATORS_PATH=/tmp/fb-emulators npx -y firebase-tools@latest emulators:exec --only firestore --project indii-os-rules-test "cd packages/firebase && npm run test:rules"` (firepit standalone binary fails under the sandbox — EPERM on ~/.cache/firebase/runtime/shell; the npm-distributed firebase-tools + redirected emulator path works).
- Result: **235/235 passed** (firestore.rules.test.ts 232 + paint-save-repro.rules.test.ts 3) with the Firestore emulator enforcing rules live (stderr shows real PERMISSION_DENIED rejections for the deny-assertions). This closes the long-standing 'harness skips emulator-backed assertions when localhost:8080 is unavailable' gap — assertions genuinely ran.
- ISSUE-1390's paint-save repro suite re-validated on the current tree: painting-save writes ALLOW for verified users, DENY anonymous — rules remain innocent; the ISSUE-1390 root cause was client session state (already fixed).
---

### Storage rules suite — REAL emulator-backed run (2026-08-20 20:20 ET) — 20/20

- Command: `npx -y firebase-tools@latest emulators:exec --config /tmp/fb-config/firebase.json --only firestore,storage --project indii-music-founder "cd packages/firebase && npx vitest run src/test/security/storage.rules.test.ts"` (scratch config with storage target 'main' mapped in a scratch .firebaserc; the repo firebase.json's storage target can't resolve for emulator projects).
- Result: **20/20 passed** — immutable canonical masters, canonical covers, RAG docs, owner-bound long-recording staging (incl. cross-service firestore.get() reads), private project render outputs, quarantine/client-write denials. First genuine emulator-backed execution of this suite (previous runs skipped emulator assertions when localhost:8080 was unavailable).
- **Invocation lesson:** the suite's initializeTestEnvironment uses projectId 'indii-music-founder' — emulators:exec MUST use the same `--project` or cross-service rules reads (firestore.exists/get in storage rules) evaluate against a different database and legitimate uploads get denied (reproduced 2 false failures with --project indii-os-rules-test; 20/20 with the matching project).
- Combined with the firestore run (235/235), the ENTIRE committed rules surface is now emulator-proven on the current tree.
---

### PROD DEFECT: live storage rules 18 days stale — CI never deployed them (2026-08-20 20:25 ET) — FIXED

- **Discovery (live-vs-committed drift check via Firebase Rules API):** live storage release `firebase.storage/indii-music-founder.firebasestorage.app` pointed at ruleset f735d19d, updateTime **2026-08-02** — while firestore rules were current (ruleset f6e1724d, 2026-08-18). Storage rules changed on main 4+ times since Aug 2 (long-session ingestion 2fdfa9acd, RAG server-authorized uploads 6ba4299b7, storyboard authority 39805c6f4, Trash Quarantine Vault + client-delete denial 93788828b) — NONE reached production storage.
NaN
NaN
NaN
NaN
### ISSUE-1395 audit round 5 (2026-08-21): image-generation pipeline remainder

From the image-generation pipeline audit (3258c8c6): PLP char refs, PLP/cover-art routing, chat_import stamp, and history dedupe were already fixed in rounds 1/3/4. Fixed now:
1. **Stuck activeJobs spinner** — a resolveStorageUrl failure in the direct-tab video job listener left the job in activeJobs forever with a live subscription. The catch now cleans up the job+subscription and toasts honestly.
2. **PLP stranded slots** — completePlpSlot returned the batch unchanged on a missing id/url, leaving the slot 'queued' forever (no retry, launch blocked). It now marks the slot failed with a diagnostic so the retry path is reachable.

Backlogged (need design/gateway work — flag for the firebase swarm):
- **Image jobId reconciliation** — when the image callable rejects after the gateway committed (resultUris persisted), the result is lost and a retry pays again; images have no waitForJob equivalent (videos do). Needs a gateway job-receipt contract + client resume path.
- Dead branches: ImageGenerationService legacy data.images path (gateway returns resultUris only); EditingService.generateStoryChain inlineData skip. Documented, not removed (asset-deletion fail-safe).

### ISSUE-1396: TalkButton cross-talk when two chat inputs are mounted at once

- **Status:** ✅ FIXED 2026-08-22 — session-owner model: VoiceService notifies the previous owner via onSuperseded and rebinds all handlers to the newest session (engine never restarts); TalkButton stands down to idle without touching the input. Tests in both layers (supersede wiring + component stand-down).
- **Severity:** 🟡 HIGH (UX correctness; niche co-existence, guaranteed confusion when hit)
- **Module:** renderer / command-bar (TalkButton + VoiceService)
- **Discovered:** 2026-08-22 full-spectrum anomaly audit (founder-directed sweep)
- **Evidence:** `VoiceService.ts` line ~111: `if (this.isDictating) return true;` — `startDictation` reports success WITHOUT rebinding handlers when a session is already live. `VoiceService` is a singleton; `AppShell.tsx` mounts `RightPanel` (line ~500, `showChrome && isDesktop`) and `ChatOverlay` (line ~543, `isAgentOpen`) independently, and both render `PromptArea` → two TalkButtons can be alive together.
- **Impact:** Click Talk in the overlay, then Talk in the docked panel: the second button shows "listening" but every interim word streams into the FIRST input; releasing either kills the other's session. Old single-shot mic degraded gracefully (stop+steal); dictation mode makes the mismatch visible.
- **Fix (suggested):** session-owner model — either (a) rebind handlers on steal so the newest click owns the mic, or (b) expose `voiceService.isDictatingActive()` and render other TalkButtons disabled with a "Mic in use" tooltip while a session is live.
- **Acceptance:** With RightPanel open and ChatOverlay open, starting talk in one surface shows the other disabled (or steals cleanly), and no transcript ever lands in the wrong input.

### ISSUE-1397: Google Workspace OAuth post-link redirect hardcoded to localhost

- **Status:** ✅ FIXED 2026-08-22 — success redirect is now relative ('/?google_linked=true'), resolving against whichever origin served the dashboard (same-origin static in prod, Vite proxy in dev).
- **Severity:** 🟡 HIGH in production (feature dead-end), LOW locally
- **Module:** admin-dashboard server (`/api/google/oauth/callback`)
- **Discovered:** 2026-08-22 full-spectrum anomaly audit
- **Evidence:** `server.ts` line ~452: `res.redirect('http://localhost:5174/?google_linked=true');` — hardcoded. The callback URI itself honors `GOOGLE_REDIRECT_URI` (lines ~356/395), but the success redirect does not.
- **Impact:** In any deployed environment, completing Google Workspace linking bounces the admin's browser to a dead localhost page. The token save succeeds, but the UX reports failure.
- **Fix (suggested):** derive from an env (`ADMIN_WEB_ORIGIN`, already partially modeled by `ADMIN_ALLOWED_ORIGINS`) or redirect to the dashboard route relative to the request origin.
- **Acceptance:** Completing OAuth on a deployed origin lands back on the admin UI with linked=true.

### ISSUE-1398: Unauthenticated OAuth callback leaks raw error details

- **Status:** ✅ FIXED 2026-08-22 — detail goes to server logs only; public 500 body is the generic 'Google OAuth authentication failed.'
- **Severity:** 🟢 LOW-MEDIUM (info disclosure)
- **Module:** admin-dashboard server
- **Discovered:** 2026-08-22 full-spectrum anomaly audit
- **Evidence:** `server.ts` ~458: catch path returns `res.status(500).send(error.message ...)` on an un-gated public route.
- **Impact:** Anyone probing the endpoint receives internal error text (token exchange failures, config state) useful for recon.
- **Fix (suggested):** log the detail server-side; return a generic "OAuth authentication failed" page.
- **Acceptance:** Error responses carry no library/internal messages.

### ISSUE-1399: Admin magic-link email delivery unproven

- **Status:** 🟡 PARTIAL — 2026-08-22: admin-API sendOobCode(EMAIL_SIGNIN) returned HTTP 200 GetOobConfirmationCodeResponse for wiil@indii.music — Firebase accepted and dispatched. Remaining unknown is downstream mail filtering (spam/sender reputation), which only an inbox check can close.
- **Severity:** 🟡 MEDIUM (blocks founder access if real)
- **Module:** Firebase Identity Toolkit / admin-dashboard login
- **Discovered:** 2026-08-22 founder reported no email after "link sent"
- **Evidence:** `accounts:lookup` confirms wiil@indii.music exists, verified, god_mode ✓, recent token refresh. The oob-code audit endpoint returns 404 on this project, so dispatch could not be confirmed via API.
- **Impact:** If emails are genuinely not sending (template/sender/quota), the founder is locked out of the secret back end.
- **Fix (suggested):** check spam for noreply@indii-music-founder.firebaseapp.com; then verify via Cloud Logging email-send entries or one successful real sign-in; consider custom SMTP/domain sender if default is filtered.
- **Acceptance:** Founder completes one real magic-link sign-in, or root cause of non-delivery is documented.

### Audit clean-passes (2026-08-22, recorded so they aren't re-flagged)

- Secrets: no live credential-shaped strings in source (only obviously-fake test fixtures).
- XSS: exactly one `dangerouslySetInnerHTML` (AgentCanvasPanel), DOMPurify-sanitized.
- Admin API: every data route behind `requireAdminAuth`; both webhooks behind `requireWebhookSecret`; new access-log route gated.
- console.log: confined to test files (98 hits, zero in production paths).
- recordAccess throttle Map growth bounded by identity count (fine at current scale).

---

### Cloud session 2026-08-23 — ISSUE-1365 root cause confirmed, ISSUE-1168 verified, OAuth consent finding

**ISSUE-1365 follow-up — root cause confirmed from production logs (founder-run console review):**
- Production `generateImageV3` logs show the initial `creative_jobs` set failing because `sessionId` is `undefined`, and the subsequent update failing with `code: 5 / NOT_FOUND` because the document was never created. This is the exact pre-`f5eef5629` failure signature.
- Conclusion: the repo already contains the undefined-strip for `safeDbSet`/`safeDbUpdate` (`f5eef5629`, ISSUE-1368). The deployed `generateImageV3` revision is stale relative to that fix. **This is now a deploy problem, not a re-code problem.**
- Hardening this session: added a `stripUndefined` helper to `gateway.ts` and applied it to the two remaining raw `creative_jobs` writes in `generateOmniRemixV3` — the initial `set(initialJob)` and the completion `update({...})` — both carried optional fields (`parentId`, `previousInteractionId`, `previousJobId`, `providerInputFileName`) that could be `undefined` and would hit the identical failure. These are transaction-boundary writes and must throw on failure, so they are stripped and kept as direct writes (not routed through non-blocking safe helpers).
- Validation: `tsc -b packages/firebase` clean; eslint clean on `gateway.ts`; `gateway.test.ts` 54/54.
- **Remaining:** deploy current `generateImageV3` (and `generateOmniRemixV3`) to production; founder generates one image; confirm `creative_jobs/{jobId}` + usage doc now exist.

**ISSUE-1168 — console verification (founder):** alert policy “AI generation billing/quota exhaustion (RESOURCE_EXHAUSTED)” exists and is attached to notification channel “Founder email (William)”. No test notification was sent; the underlying email address is hidden on the policy page. Residual acceptance item stands: deliver one real test alert email to the founder.

### ISSUE-1400: OAuth consent screen is Testing, not In production, with zero test users configured

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH (YouTube/Gmail OAuth restricted until addressed)
- **Module:** GCP OAuth consent screen / integrations
- **Evidence:** Founder verified 2026-08-23 in GCP Console — publishing status “Testing”; zero test users configured. YouTube upload + Gmail scopes therefore only work for explicitly added test users, and sensitive-scope tokens expire every 7 days for testing users.
- **Impact:** Any founder/customer flow using Google OAuth (YouTube upload, Gmail) is unusable for real users.
- **Fix:** EITHER add the founder as a test user now (fast, keeps Testing status for dev), OR complete OAuth consent-screen verification and publish to production (required before public offer; Google review may be required for sensitive scopes). Then re-test the YouTube upload + Gmail flows.
- **Acceptance:** Founder completes the YouTube upload OAuth flow (or Gmail) as a non-test-user account without Google warning; consent screen shows “In production”.

### G5 founder-seat backfill — VERIFIED CLOSED as data-complete (2026-08-25)

- **Trigger:** founder re-ran `gcloud auth application-default login`; ADC now resolves to `wiil@indii.music` (verified via tokeninfo; cloud-platform scope). Stale/wrong-principal credential issue from 2026-08-11 checkpoint is repaired.
- **Run:** `packages/firebase/scripts/backfill-founder-seat.ts` ABORTED on its idempotency guard — `founders/g2AcFApNZvQKYlGg0LQuVADCFoO2` already exists. No writes performed (guard correct).
- **Live read-back (production, read-only):**
  - `founders/{uid}`: seat **11**, name "William Paul Roberts", joinedAt 2026-06-02, agreementVersion 1.0.0, verificationHash recomputes and matches.
  - `subscriptions/{uid}`: tier founder, status active (period to ~mid-2027).
  - `users/{uid}`: isFounder true, tier founder, subscriptionTier founder.
  - `entitlements/current`: schemaVersion account-entitlement.v1, tier founder, status active, source `founder_registry_migration`.
  - `founders_meta/summary`: count 1, founders[0] = seat 11 entry.
  - No `founder_github_commit_queue` rows (G4 still deferred — mock token).
- **Conclusion:** badge/seat/hash receipt path is data-complete. The Aug-20 audit's "no founders doc" reading was superseded by the registry migration.
- **OPEN decision (founder):** seat is 11 with display name "William Paul Roberts", not the planned seat-1/"wiil" shape. Cosmetic/data-hygiene only (G6 notes seat 11 renders as "ii" — possibly intentional i-i internal-seat styling). If founder wants seat 1/"wiil", the backfill script needs its guard relaxed to a migrate-in-place mode — requires explicit founder approval before any overwrite.

### ISSUE-1401: Talk-over (voice-to-text) system instability — escalated audit (2026-08-25)

- **Status:** ✅ FIXED 2026-08-25 — five defect classes found and fixed at the root in the voice-to-text + UI synchronization layers (founder escalation: "technical instability within the voice-to-text and UI synchronization layers").
- **Severity:** 🟠 HIGH (reproduces on the most common gesture: release the TalkButton, click Talk again → dead mic)
- **Module:** renderer / VoiceService + TalkButton (Web Speech API engine, no backend STT — dictation is browser-native)
- **Defects fixed:**
  1. **Stop-in-flight rebind race (root cause):** release→quick re-engage rebinded handlers over a stopping engine; the old session's `onend` fired into the new session → natural-end for a session that never started. Fixed with a pending-start queue + engineRunning tracking; `onend` promotes the queued session.
  2. **Word fusion:** final fragments concatenated without separator when Chrome omitted trailing spaces ("helloworld"). Whitespace-aware join.
  3. **Unmount cross-kill:** an idle TalkButton unmounting called unconditional `stopDictation()` and killed another surface's live session. Owner-scoped `stopDictationIfOwner(handlers)`.
  4. **Legacy clobber:** onboarding `startListening` could detach a live dictation session (UI stuck "listening") and never reset continuous mode. Now supersedes the owner + resets single-shot config.
  5. **Busy hot mic:** agent busy mid-listen left a live mic with no visible owner. Busy stand-down + onEnd always resets UI state.
- **Backend scope:** the loop's backend is TTS (`generateSpeech` → Gemini AUDIO, ISSUE-1392 fixed 2026-08-20) and the agent stream (`isStreaming` settled on every execution path since `8d03f5444`) — both audited, no new defects.
- **Evidence:** 5 new VoiceService regression tests (15 total) + 3 new TalkButton tests; 55/55 voice suites; 334/334 intelligence+components; typecheck green; lint 0 errors. ERROR_LEDGER entry 2026-08-25.
- **Honest limit:** Web Speech API itself is Chrome-owned — network/service-side instability (rare 'network' errors) still surfaces as a toast and clean session end rather than a stuck UI; no auto-restart added (deliberate: don't re-arm a mic without user intent).

### ISSUE-1402: Founder hit a video "cost reservation" denial on a clip-stitch request — fixed at root (2026-08-25)

- **Status:** ✅ FIXED (code) 2026-08-25 — founder escalation: "I'm the founder. I'm signed into my account. I should never see this."
- **Severity:** 🔴 CRITICAL for founder UX (flagship video path hard-blocked; founder premise broken)
- **Module:** firebase billing/entitlements + renderer video/agent + conductor skills
- **Root causes (stacked):**
  1. Founder-tier budget had NO confirmation exemption: `USER_CONFIRMATION_THRESHOLD` ($20/op) fired for founder/enterprise, and the video client hard-blocks on `requiresConfirmation` (no prompt UI exists for video). A multi-clip movie stitch estimates >$20 → denied.
  2. Flat `RUNAWAY_LIMIT` ($500/month) fired BELOW the founder tier's own $10k/month ceiling — the kill-switch killed founders before their own budget did.
  3. Entitlement provisioning read ONLY `founders/{uid}`; paid `subscriptions/{uid}` (Stripe-materialized) was never consulted, so any lag between payment records and the founder registry resolved FREE (the "paying customers budgeted as FREE" P1 class).
  4. Conductor routing gap: the `video_producer` skill sent stitch/join/sequence jobs through Veo (`generate_video`) — the cost-controlled generation path — even though the local IndiiVideoProject pipeline (`add_video_clip` → `queue_video_render`, HyperFrames behind the renderer contract) exists in-app and renders stitch jobs with no cost reservation at all.
- **Fix:** founder/enterprise exempt from the per-op confirmation threshold; runaway cap = `max($500, tier monthly ceiling)`; entitlement provisioning resolves from `founders/{uid}` + non-canceled paid `subscriptions/{uid}` with `subscription_migration` grants and one-directional in-place upgrades (tierRank guard); video confirmation blocks get an actionable message; `GeneralistAgent.isHardStopError` stops on cost-reservation/budget language; conductor `video_producer` skill now hard-routes edit jobs to the local pipeline (Veo = new footage only).
- **Evidence:** 14 entitlements tests (new: founder self-heal, subscription materialization, provenance); 27 enforceOperationCost tests (new: founder/enterprise confirmation bypass, tier-aware runaway); full firebase suite 1011 pass (3 rules suites fail-closed without emulator, documented, green in CI); root typecheck green; lint 0 errors. ERROR_LEDGER entry 2026-08-25.
- **Deployment follow-up:** no prod data change needed — G5 (2026-08-25) already verified `founders/{uid}`, `subscriptions/{uid}`, and the FOUNDER entitlement in production. The budget-guard fixes take effect on the next functions deploy.
- **Left open (separate track):** `render_stitch` reliability (long-form stitch pipeline) remains P1 work; this fix guarantees a founder never sees a reservation denial, not that every long stitch succeeds on the first poll.

### MIG-010: In-app cinematic video treatments — user instruction → treated movie (2026-08-25)

- **Status:** 🟢 IMPLEMENTED (code) 2026-08-25 — founder: "I need my app to make that same video, but the user's own version, from their instructions."
- **Severity:** 🟡 Feature (T2 — shared schema + main compiler + renderer tooling + agent skill)
- **Delivered:** IndiiVideoProject schema vocabulary (`background`, `seam`, `entrance`, `countUp`, `audioFade`); compiler emission (background layers + ambient tweens, cut-the-curve seams at adjacent boundaries, waterfall word arrivals, seek-safe counters, inverse-zoom arrivals, absolute-gain audio fades); three named presets with direction-word resolution; Conductor tool `apply_video_treatment`; editor toolbar `TreatmentPicker` sharing the same resolver; `video_producer` skill routing table mapping mood words → presets.
- **Evidence:** main compiler suite 17 pass (incl. real-hyperframes-lint + end-to-end render); renderer treatment suites 25 pass (tool, presets, picker, editor interaction); shared 108 pass; full typecheck green; lint 0 errors. Full renderer suite pending at close (reported separately). ERROR_LEDGER 2026-08-25.
- **Follow-ups (not in this unit):** editor per-clip entrance/count-up controls beyond the preset picker; ghost-text/glow position UI; cloud render transport for web-only users (local render remains desktop); treatment presets for more moods on request.

### MIG-010 cloud: every user renders HyperFrames (2026-08-26)

- **Status:** 🟢 CODE COMPLETE on main — GCP activation pending founder/browser agent
- **Delivered:** @indii/video-compiler extraction (shared by desktop/web/worker); durable cloud render queue protocol + rules; cloud render worker package (stage/compile/render/upload, Dockerfile, real e2e render test); dispatcher function; renderer web fallback; `docs/CLOUD_HYPERFRAMES_RUNBOOK.md` with exact gcloud steps for the browser-control agent.
- **Evidence:** video-compiler 9/9 (real lint); render-worker 7/7 (incl. real CLI+Chrome e2e render probed via ffprobe); firebase video functions 151/151; renderer video services 175/175; dispatcher 4/4; typecheck green; lint clean; pre-commit gates green per commit. Full suites at close in session logs.
- **Remaining (out of agent authority):** GCP resource minting per the runbook — APIs, service account + IAM, secrets, Cloud Build, Cloud Run deploy, function deploy (CI), end-to-end verification.
- **Honest limits:** web guests cannot render (queue requires a verified account; guests had no desktop path either); jobs stay `queued` until the worker is deployed (visible, not fake); Cloud Run v1 auth is Bearer-secret (allow-unauthenticated ingress) with an OIDC upgrade noted in the runbook.

### MIG-010 GCP activation attempt — BLOCKED on Google reauth (2026-08-26)

- **Status:** 🔴 BLOCKED — founder authorized the runbook execution; every step up to the credential wall was attempted live.
- **Attempted:** APIs enable, service account + IAM, secrets, Cloud Build, Cloud Run deploy — via `gcloud` (user auth `wiil@indii.music`), then via the machine's only other live credential surface (firebase CLI refresh token + the embedded firebase-tools OAuth client).
- **Observed blocker:** Google revoked the stored refresh tokens — `invalid_grant / invalid_rapt` ("reauth related error"). This is Google demanding interactive sign-in (password + MFA); no offline refresh path exists and none should be manufactured.
- **Exact remaining action (documented in `docs/CLOUD_HYPERFRAMES_RUNBOOK.md` Step 0):** with the founder at the keyboard — `gcloud auth login`, `gcloud auth application-default login`, `firebase login:reauth` — then resume the runbook at Step 3.
- **State guarantee while blocked:** code is complete and on main (CI green); web render requests queue durably in `videoRenderJobs` and show as queued in the editor; the dispatcher logs "RENDER_WORKER_URL not provisioned" without faking a terminal state.

### MIG-010b: professional editor round (2026-08-26)

- **Status:** 🟢 SHIPPED on main, CI green (c17fc2d72, run 33021943171)
- **Delivered:** text styling + speed · split/duplicate/delete · undo/redo · snapping + source-aware trimming · aspect presets · 9 treatment presets
- **Evidence:** full root suite 6966 passed (25 new this round); editor module 103/103; typecheck clean; lint 0 errors.
- **Remaining candidates (not requested this round):** ripple delete / multi-select, timeline zoom UI, loop-region playback, more preset looks on request.

### MIG-010c: professional editor round 2 (2026-08-27)

- **Status:** 🟢 SHIPPED on main, CI green (42cd45df4, run 33030426026)
- **Delivered:** ripple delete (⌘⌫) · timeline zoom 25–400% · loop-region playback · desktop render relay (the queue's second executor: claim/complete callables + scoped artifact IPC + storage upload)
- **Evidence:** full root suite 6983 passed; firebase video 157/157; relay callables 6 + relay service 3; editor module 111/111; typecheck clean; lint 0 errors.
- **Remaining:** GCP activation (founder reauth, runbook Step 0) — everything else from the founder's lists is closed.

### ISSUE-1403: Agent browser bridge (browser_tool) missing in packaged desktop builds

- **Status:** ✅ FIXED locally (5f0f97f19) — push pending
- **Severity:** 🔴 HIGH
- **Module:** packages/main/src/handlers/agent.ts, packages/renderer/src/services/agent/tools/BrowserTools.ts
- **Summary:** `agent:navigate-and-extract` / `agent:perform-action` were registered only under `if (!app.isPackaged)`; every shipped desktop build failed all browser_tool calls (ISSUE-972 cause #2, unlabelled). `agent:capture-state` was registered in prod but no session could exist outside dev. Matches ERROR_LEDGER pattern "IPC handlers not registered → renderer hangs" (env-gated registration).
- **Fix:** handlers registered unconditionally (google.com test harness stays dev-only); hidden-window session persists across navigate→act→snapshot with a 10-minute idle reaper; browser_action writes best-effort audit docs to `users/{uid}/browserHistory` (action+selector only, typed text never persisted).

### ISSUE-1404: execute_code advertised as live but was a dead stub

- **Status:** ✅ FIXED locally (a6f33cdeb) — push pending
- **Severity:** 🟡 MEDIUM
- **Module:** packages/renderer/src/services/agent/tools/CodeExecutionTools.ts (deleted), tools/index.ts, ToolRiskRegistry.ts
- **Summary:** stub always returned CODE_EXECUTION_DISABLED since the sidecar removal (74bca6fbb) while tool help text + risk registry still advertised it. No agent declared it.
- **Fix:** tool, spread, help entry, registry entry removed; ISSUE-1116 gate fixture retargeted to computer_click; ToolRiskRegistry note warns against phantom entries (gate keys on explicit entries only). ExecApprovalService header now states Docker isolation is gone and high-risk categories fail closed.

### ISSUE-1405: Client-controlled trialDays — arbitrary free trials

- **Status:** ✅ FIXED locally (31788705e) — push pending
- **Severity:** 🔴 HIGH
- **Module:** packages/firebase/src/subscription/createCheckoutSession.ts
- **Summary:** `trialDays` came straight from `request.data` with only a `> 0` check — any caller could mint a years-long trial.
- **Fix:** server-side clamp `Math.min(floor(trialDays), 14)`; test pins a 3650-day request to 14.

### ISSUE-1406: No refund/dispute webhook handling

- **Status:** 🟡 PARTIAL (31788705e) — credit packs closed; marketplace/licensing refund flows open
- **Severity:** 🟡 MEDIUM
- **Module:** packages/firebase/src/stripe/webhookHandler.ts
- **Summary:** switch had no `charge.refunded` / `charge.dispute.created` cases — refunded credit packs kept spendable credits; disputes landed in the unhandled-event log.
- **Fix shipped:** `charge.refunded` reverses fully-refunded credit-pack purchases idempotently (deterministic `refund_{chargeId}` log, shortfall recorded when balance already spent); partial refunds logged without clawback; `charge.dispute.created` writes `payment_disputes/{disputeId}` for finance.
- **Resolved remainder (2026-08-28, founder decision: claw back from seller balance / reverse the transfer):** `handleMarketplaceRefund` claws the sale amount out of the seller's `user_credits` balance (shortfall debt on the deterministic refund log when already spent) and flips reservation/purchase/revenue to refunded in one transaction, idempotent per charge, with the same session-binding + amount guards as fulfillment. `handleLicensingRefund` reverses the payout via `stripe.transfers.createReversal` (idempotency key `reversal_{chargeId}`), deactivates license + agreement, and writes a negative ledger row; reversal failure parks the license in `refund_pending_reversal` plus a `finance_reversal_failures/{chargeId}` doc instead of marking refunded. Partial refunds claw nothing back on either flow. Disputes on these flows remain finance-review records only (premature clawback would need a `charge.dispute.closed` re-credit path — deliberately not built). Tests: `webhookHandler.refunds.test.ts` 13/13.

### ISSUE-1407: pod_printfulCreateOrder has no payment gate

- **Status:** 🟡 PARTIAL (31788705e) — containment shipped; paid binding open
- **Severity:** 🟡 MEDIUM
- **Module:** packages/firebase/src/pod/printful.ts
- **Summary:** any authed user could create Printful orders with no payment binding. Orders were already drafts by omission (no `confirm` field), so no direct money loss — but nothing prevented it explicitly and accidental confirmation charges indii's account.
- **Fix shipped:** body pins `confirm: false` with a comment that orders must stay drafts until a paid-checkout binding exists.
- **Resolved remainder (2026-08-28, founder decision: Stripe Checkout per order):** new `pod_createOrderCheckout` (`packages/firebase/src/pod/checkout.ts`) binds a Stripe Checkout session to a caller-owned Printful DRAFT order, priced server-side from Printful's own cost estimate plus a clamped platform markup (`config/podCheckout.markupPercent`, env fallback, default 25%, ceiling 500%) — never client input; redirects restricted to approved indii.music origins. Webhook `handlePodOrderPaid` (`webhookHandler.ts`, metadata `type: 'pod_order'`) re-verifies the doc binding AND the live Stripe amount before `confirmPrintfulOrder`; confirm failure parks the order in `payment_received_confirm_failed` and throws so Stripe retries. Orders remain drafts unless this exact paid path completes. Renderer callables are reached through the generic `pod_{name}` wrapper; UI checkout redirect wiring is a follow-up. Printful API helpers extracted to onCall-free `pod/printfulApi.ts`. Tests: `pod/checkout.test.ts` 6/6, `stripe/webhookHandler.pod.test.ts` 6/6.
- **UI slice landed (2026-08-28, commit `6e6bcd347`) — follow-up complete, POD loop closed end-to-end:** `PrintfulProvider.createOrderCheckout` binds Stripe Checkout to the draft via `pod_createOrderCheckout`; `ManufacturingPanel` redirects with success/cancel return URLs and reads real order state on return (Printful order status is the confirmation authority — the URL param never is). The false "POD Order Created!"/delivery toasts are replaced with honest "Draft saved — payment required" copy; checkout failure leaves the draft saved-and-unpaid with no success claim. Tests: ManufacturingPanel 6/6 (honest-copy, failed-binding, cancelled-return), merchandise+pod suites 97/97.

### ISSUE-1408: processWebhookQueue is claim-less — overlapping runs double-deliver

- **Status:** ✅ FIXED on origin/main (45ca95800 — the fix rode in that commit's staging sweep; message there covers the shared-harness work, this entry is the authoritative description of the dispatcher changes in it)
- **Severity:** 🟡 MEDIUM
- **Module:** packages/firebase/src/functions/webhooks/dispatcher.ts
- **Summary:** 30s schedule + 300s timeout + no claim: two overlapping invocations delivered the same pending webhook. Top-level catch also aborted the whole batch on one bad delivery.
- **Fix:** transactional 2-minute claim lease (expired leases reclaimable after a crash) + per-delivery fault isolation; claim predicate extracted (`isQueueItemClaimable`) and unit-tested.

### ISSUE-1409: Audit claim "paid tiers never materialized as server entitlements" — NOT REPRODUCIBLE

- **Status:** 🟢 WONTFIX (claim does not match current code; recorded so it stops being re-raised without evidence)
- **Severity:** n/a
- **Module:** packages/firebase/src/stripe/webhookHandler.ts, packages/firebase/src/subscription/getUsageStats.ts, packages/renderer/src/services/intelligence/billing/TokenUsageService.ts
- **Evidence:** `handleCheckoutCompleted`/`handleSubscription*` write `subscriptions/{userId}` with tier+status; `getUsageStats` reads `subscription.tier` → `TIER_CONFIGS[tier]`; renderer `TokenUsageService` quota checks read the same doc via `subscriptionService.getSubscription`. The chain is connected. (Adjacent real gap: on subscription-fetch *error* TokenUsageService defaults to FREE — soft degradation, not an entitlement hole.)

### ISSUE-1410: Subscription webhook out-of-order regression window

- **Status:** ✅ FIXED (2026-08-28, commit `1172ce430`) — `handleInvoicePaid` now derives status/period bounds/`cancelAtPeriodEnd` from the LIVE Stripe subscription object (retrieved via the invoice's `subscription` id) instead of hardcoding `'active'`; a late invoice.paid after cancellation can no longer resurrect the subscription. One-time invoices never touch subscription status but still write their ledger entry. Tests: `webhookHandler.invoice-paid.test.ts` 4/4 (canceled not resurrected, unpaid mapping, active no-regression, one-time guard).
- **Severity:** 🟡 MEDIUM
- **Module:** packages/firebase/src/stripe/webhookHandler.ts
- **Summary:** `handleInvoicePaid` sets `status: 'active'` unconditionally; a late-arriving invoice.paid after a cancellation can resurrect a canceled subscription's status until the next authoritative subscription event. Events are not ordered by Stripe.
- **Fix direction:** compare `currentPeriodEnd`/event timestamp before downgrading-away or reactivating, or always re-derive status from the live Stripe subscription object instead of trusting the event payload.

---

### Autonomous hygiene & P1 sweep (2026-08-27, DSH agent)

- **Status:** 🟡 IN PROGRESS — 3 commits landed locally, push pending on concurrent-session stillness
- **Landed on origin/main:** 5f0f97f19 (browser bridge packaged builds + audit trail), a6f33cdeb (execute_code retirement + truthful docs + case study `docs/AGENT_SANDBOX_BROWSER_TOOLS_CASE_STUDY.md`), 31788705e (trialDays clamp, refund/dispute webhooks, POD draft containment; also carries the 44 root-scratch archive renames via a staged-area sweep), 45ca95800 (shared harness unbundling from the concurrent session, which also carried the ISSUE-1408 webhook lease fix).
- **Repo hygiene done:** 45 unreferenced root scratch scripts/dumps archived to `archive/root-scratch-2026-08-27/` (reference-checked first; the 4 deep-test PNGs used by e2e/deep-test.spec.ts and package.json-referenced test.js were kept in place).
- **Remaining P1 backlog (from the 2026-08-22 backend audit, details lost with that session's transcript — re-derive from source before fixing):**
  - Scheduled workers swallowing top-level errors (audit said six; candidates seen: storageMaintenance, retention-daemon, pollDeliveryStatus, deliverScheduledPosts, pulseTick, flushConversionEvents, cleanupVideoSessions, reclaimStuckVideoJobs, agentLoopCron, enforceOperationCost)
  - Firestore batches that can exceed the 500-op limit (14 untested writeBatch/batch() sites)
  - Video under-reservation warn-only (billable providers can run without full credit reservation)
  - Video reaper resubmitting possibly-already-billed jobs; cleanupOrphanedVideos staleness heuristic vs live outputs
  - BigQuery revenue export cursor starvation; knowledge task queue dead retries; timeline milestone duplicate window; ISRC query-then-write uniqueness race
  - Rules: revenue collection client-mutable; `/users/{uid}/tmp` storage unbounded
- **Concurrent-session note:** a Codex session is actively refactoring shared video-contract exports (videoRendererSuite → renderer test tree) in this same worktree; commits/pushes deferred until its state is stable to avoid bundling foreign work.

### ISSUE-1411: Audit claim "video reaper resubmits billable jobs" — NOT REPRODUCIBLE

- **Status:** 🟢 WONTFIX (already fixed by earlier waves; recorded with evidence)
- **Module:** packages/firebase/src/functions/video/reclaimStuckVideoJobs.ts
- **Evidence:** the reaper requeues ONLY jobs with `providerSubmissionState === 'not_submitted'` under a MAX_REQUEUES=2 budget. Ambiguous-submission jobs are terminalized with the cost hold SETTLED (fail-closed financially); only provably un-submitted holds are VOIDED. The audit's concern is structurally impossible in current code.

### ISSUE-1412: Audit claim "video under-reservation warn-only" — NOT REPRODUCIBLE

- **Status:** 🟢 WONTFIX (already fixed; recorded with evidence)
- **Module:** packages/firebase/src/functions/video/createVideoSession.ts
- **Evidence:** `reserveCost` calls `checkOperationBudget` and THROWS `resource-exhausted` when `!reservation.allowed` — denial blocks the session, it does not warn-and-proceed. Matches ISSUE-1402 (founder-visible reservation denial fixed at root 2026-08-25).

### ISSUE-1413: cleanupOrphanedVideos deletion safety — rails present, live-fire probe still required before enabling

- **Status:** 🟡 PARTIAL (safe by configuration today; unresolved if the config flag is ever switched on)
- **Module:** packages/firebase/src/devops/storageMaintenance.ts
- **Evidence:** DRY RUN by default; deletion gated behind `config/storageMaintenance.enableDeletion`; writes audit runs; weekly schedule; cross-references the `history` collection.
- **Remaining:** before anyone enables deletion, add a targeted probe test that a freshly-rendered output with a missing/slow `history` doc is NOT matched as orphan (age heuristic + doc-coverage check), and log the enablement in this ledger.
- **Rails shipped (2026-08-28, founder decision: rails only, keep DRY RUN):** `storageMaintenance.ts` now has a 7-day freshness rail (`isOlderThanOrphanGrace`): with deletion enabled, an orphan-matched file younger than 7 days is reported but NOT deleted (`recentOrphansPreserved` in the audit run), and a file with UNKNOWN age fails closed (never auto-deleted). Probe test `storageMaintenance.orphan-probe.test.ts` 5/5 pins: fresh output with slow docs never deleted, unknown age never deleted, only stale+uncovered files deleted, doc-covered files untouched, DRY RUN deletes nothing. `enableDeletion` remains false; enablement still requires a ledger log entry.

### ISSUE-1414: Audit claim "six scheduled workers swallow top-level errors" — LARGELY NOT REPRODUCIBLE

- **Status:** 🟢 WONTFIX for the surveyed sites (recorded with survey evidence); 🟡 the unsurveyed remainder stays on the backlog until a concrete silent failure is observed
- **Module:** packages/firebase/src/{devops/storageMaintenance,social/deliverScheduledPosts,marketing/flushConversionEvents,distribution/pollDeliveryStatus}.ts
- **Survey evidence (2026-08-28):** deliverScheduledPosts propagates (`async () => handler()` — uncaught errors hit Cloud Logging/Error Reporting); flushConversionEvents catches but logs via `logger.error` (Error Reporting-visible) and the next tick retries; storageMaintenance has an unguarded top-level config read (errors propagate) plus per-item errorCount accounting; pollDeliveryStatus has no top-level swallow catch. Scheduled-tick catch-and-log with a retrying next tick is the correct topology here — "fixing" it by rethrowing adds nothing.
- **Unsurveyed remainder:** retention-daemon, pulseTick, cleanupVideoSessions, agentLoopCron, enforceOperationCost.

### ISSUE-1415: CI red on main @ 8dab863b3 — Arcjet retry test + Firestore owner-rewrite rules test (soundtrack delivery awaiting green containing c7fbcce39)

- **Status:** ✅ FIXED (2026-08-28) — run `33196608685` (success, 1h47m, head `dd3d72ed2`, tree contains `8edc335cb`'s Arcjet/rules fixes) passed ALL 20 unit-test shards including the Arcjet retry test and the `rules-tests` job including the owner-rewrite test, plus build, e2e-staging, and production deploy. The original failures do not reproduce on current main.
- **Module:** `packages/firebase/src/functions/security/arcjet.test.ts`, `packages/firebase/src/test/security/firestore.rules.test.ts`
- **Evidence (run 33170199615, 2026-08-28T12:13Z, workflow_dispatch on 8dab863b3):**
  1. `unit-tests (4/20)`: `arcjet.test.ts > Arcjet request protection > retries an errored timeout decision and allows the request when the retry succeeds` — AssertionError `expected { allowed: false, status: 503, … } to deeply equal { allowed: true }`; 54/56 files in shard passed.
  2. `rules-tests`: `firestore.rules.test.ts > root owner-scoped collections pin every authority field > allows ordinary owner updates but rejects ownership rewrites for every migrated collection`.
- **Attribution:** failing files last touched by `541505b88`/`8dab863b3` (Arcjet transient-timeout retry) and `b39dc932a` (rules revenue server-origin); run was manually dispatched, i.e. the owning session is actively iterating. Not caused by `c7fbcce39` (landing-only soundtrack change: all landing tests green in-shard; full local /plat build gate green; live browser verification passed).
- **Delivery note:** first green `Deploy to Firebase Hosting` run whose headSha contains `c7fbcce39` closes the soundtrack delivery cycle; earlier runs for that SHA were cancelled by push concurrency (33169864911, 33170062345), not failed.
- **Detection:** `gh run list --branch main --limit 5`; failing jobs `rules-tests` + one `unit-tests` shard; grep `--log-failed` for `arcjet.test.ts|firestore.rules.test.ts`.

### ISSUE-1416: Conductor agents cannot assemble finished films from existing rendered assets (CD agent has no editor tools)

- **Status:** 🔴 OPEN — spec of record written, implementation not started
- **Severity:** 🟡 MEDIUM (capability gap, no money/parity risk)
- **Module:** packages/renderer/src/services/agent/tools/ (new EditorTools.ts), packages/renderer/src/services/video/PerformanceVideoService.ts
- **Evidence (2026-08-28):** In-app Creative Director refused "mix these clips together" and proposed headless browser automation of external editors. The platform already owns the full pipeline: `renderVideo` callable → Inngest stitch → `videoJobs/{renderId}` (ISSUE-994 contract: `{compositionId, inputProps:{project}}`, returns renderId never a URL), `waitForJob` polling, `VideoTools` agent-tool precedent for billable video jobs, server cost reservation that fail-closes (ISSUE-1412). The missing layer is agent tools between "assets exist" and "stitch submitted": discover, plan, execute, report.
- **Spec of record:** `docs/AGENT_VIDEO_EDITOR_BRIDGE.md` — four tools: `video_list_renderable_assets` (read-only, duration-unknown fails closed), `video_plan_sequence` (validated plan, no cost), `video_render_stitch` (HIGH-RISK billable: user-owned URIs only, reservation before callable, ExecApprovalService approval, honest terminal-state-only URL reporting), `video_get_render_status` (read-only). Headless external editors and ParallelRenderOrchestrator are explicit non-goals.
- **Fix direction:** Implement per spec §4 in three slices (tools+risk registry+tests → tool-pool wiring + capability-accurate CD copy → optional UI↔agent plan interop via ScreenwriterStoryboardHandoff-style contract).
- **Acceptance:** Agent conversation lists real assets, produces a validated plan, and after approval + reservation receives a real stitched URL; every failure mode yields an honest specific message (no fabricated success, ISSUE-950/952 lineage); all tools explicitly registered in ToolRiskRegistry (ISSUE-1404 rule: no phantom entries).

---

### ISSUE-1417: Phantom ProdigiProvider called pod_prodigi* callables with no backend

- **Status:** ✅ FIXED (2026-08-28, commit `f5116c6ff`)
- **Severity:** 🟡 MEDIUM (runtime failure if selected; a naive future backend would have shipped with no payment gate — the exact hole ISSUE-1407 closed for Printful)
- **Module:** packages/renderer/src/services/pod/PrintOnDemandService.ts
- **Evidence:** `ProdigiProvider` (line ~674 pre-removal) called `pod_prodigiCreateOrder`/`prodigiGetOrder`/etc.; `grep -rn prodigi packages/firebase/src` finds no Prodigi backend — every call would fail at runtime, and ManufacturingPanel could route orders to it programmatically.
- **Fix:** class + registration removed; `getProvider('prodigi')` fails loudly ("not registered or configured"). Known remainder (deliberate): `PODIntegrationPanel`/`PODCredentialService` still list Prodigi for API-key storage — inert without a backend; remove or gate together with any future Prodigi build.
- **Acceptance:** pod suite 35/35 incl. explicit test that 'prodigi' is not offered and getProvider throws.

---

### ISSUE-1418: Complete the Founding Artist Beta homepage architecture and approved copy

- **Status:** 🟡 PARTIAL — implementation + genuine desktop/mobile browser review done (2026-08-30, deployed `founder.indii.music`); canonical domain alignment (ISSUE-1419) remains
- **Severity:** 🟠 HIGH
- **Module:** `packages/landing`
- **Source of truth:** `docs/business-decisions/07_FOUNDING_ARTIST_BETA_MARKETING.md`
- **Evidence:** Beta banner/hero/waitlist, Founding Owner copy, public Free/Start/Build/Scale pricing, safer workflow claims, illustrative-demo labels, canonical metadata, calculator quarantine, and regression assertions are implemented. Checkout remains deliberately gated. Genuine Playwright review of the deployed landing at 1440/768/390 widths: all 14 `data-system-section` markers render, no horizontal overflow, no page errors/failed requests, axe (WCAG 2.1 A/AA, structural) 0 violations, all `#` anchors + `/privacy` `/terms` routes resolve. One defect found and fixed: the inline custom-domain redirect script was dead (CSP `script-src` blocks inline JS) and pointed at `indii.music` (which serves the studio) — removed.
- **Impact:** The public site otherwise leads with obsolete founder-only framing and unsupported claims.
- **Fix:** Remaining is ISSUE-1419 (make `indii.music`/`www` resolve to the landing so the canonical/OG/JSON-LD URLs agree) — requires Firebase/DNS credentials.
- **Acceptance:** Production matches approved copy, retains Detroit/thesis/comparison, shows no fake scarcity or retired claims, and passes exact-SHA CI plus genuine deployed browser review.

### ISSUE-1419: Canonical domain, aliases, redirects, and metadata are not verified end to end

- **Status:** 🔴 OPEN — confirmed mismatch (2026-08-30); blocked on Firebase/DNS credentials
- **Severity:** 🟠 HIGH
- **Module:** Hosting / DNS / landing metadata
- **Source of truth:** Marketing decision § Website and conversion flow
- **Evidence:** Confirmed live: `indii.music`, `www.indii.music`, and `app.indii.music` all serve the STUDIO app (Geist fonts, `og:title` "music business at the speed of you"), while the LANDING is served at `founder.indii.music` (`og:title` "Run your music career without giving it away."). The landing's committed `canonical`/`og:url`/JSON-LD point to `https://indii.music/`, so the landing canonicalizes to the studio app. `firebase` CLI is unauthenticated in this checkout, so the domain move cannot be performed by an agent without credentials.
- **Impact:** Visitors and crawlers may reach inconsistent offers or broken paths.
- **Fix:** Move the `indii.music` + `www.indii.music` custom domains from the `app` (`indii-music-studio`) site to the `landing` (`indii-music-founder`) site (or otherwise make the root resolve to the landing), then re-add a CSP-compliant custom-domain redirect. Requires Firebase Hosting custom-domain + DNS access.
- **Acceptance:** Every owned alias reaches the intended canonical page without loops while app/auth subdomains remain intact.

### ISSUE-1420: Verified-email account, waitlist, invitation order, and milestone updates are not one authoritative flow

- **Status:** 🟡 PARTIAL — raw submissions are now visible in the authenticated Founders Dashboard; verification and promotion remain open
- **Severity:** 🟠 HIGH
- **Module:** Landing / Firebase Auth / waitlist / communications
- **Source of truth:** Marketing decision §§ Website and Founding Artist Beta operations
- **Evidence:** Current form records an entered email but does not prove ownership or create the decided verified free account; invitation and communication state are separate or absent. The admin backend now reads the otherwise inaccessible `waitlist` collection, deduplicates by normalized email, preserves first-submission order, and returns entries as explicitly unverified. The Founders Dashboard displays that operational queue separately from activated founders.
- **Impact:** Fake emails, duplicate records, and client-controlled priority would undermine beta access.
- **Fix:** Verify email before activation; preserve immutable join order and waitlisted/invited/accepted states; record milestone consent and delivery; prevent client-assigned priority.
- **Acceptance:** A genuine user verifies once, receives one account and ordered waitlist record, cannot forge invitation priority, and can receive an auditable invite/update.

### ISSUE-1421: Guided free mini-campaign using the artist's music and image is not implemented end to end

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** Landing demo / Creative Suite / export / privacy
- **Source of truth:** Marketing decision § Verified free experience
- **Evidence:** Existing tools do not yet form verified email → owned music/image → guided creation → no-watermark pack → enforced save/delete.
- **Impact:** The main product demonstration cannot yet prove value with the visitor's own work.
- **Fix:** Audit and connect existing upload, generation, video, export, history/version, and deletion systems before building new paths.
- **Acceptance:** A genuine free user downloads coherent images and short music-backed clips without forced branding, then chooses save or delete and sees that choice enforced for sources and derivatives.

### ISSUE-1422: Start, Build, and Scale subscriptions and multi-period billing are not reconciled with entitlements

- **Status:** 🔴 OPEN
- **Severity:** 🔴 HIGH
- **Module:** Pricing / Stripe / entitlements / usage
- **Source of truth:** Marketing decision § Public pricing and `03_REVENUE_AND_PRICING.md`
- **Evidence:** Founder approved $22/$55/$110 monthly and quarterly/six-month/annual discounts of approximately 5%/10%/20%; existing internal packaging uses older names.
- **Impact:** Publishing prices before server reconciliation could sell the wrong entitlement or unsafe margin.
- **Fix:** Calculate safety floors, define stage-appropriate capacity/capabilities, map internal keys, settle whole-number totals, and provision Stripe only after cost/tax review.
- **Acceptance:** Public pricing, checkout, webhook entitlement, renewal cadence, total charge, monthly equivalent, and beta caveat agree; lifecycle tests cover changes/cancellations; no `.99` pricing appears.

### ISSUE-1423: Non-expiring finish-the-project microtransactions are not modeled

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** Usage wallet / top-ups / packs / checkout
- **Source of truth:** Marketing decision § Extra capacity and microtransactions
- **Evidence:** The decision allows unit purchases, workflow/project packs, and larger reusable packs; purchased capacity never expires and upgrades remain optional.
- **Impact:** Artists may otherwise be forced into unnecessary upgrades or lose purchased capacity.
- **Fix:** Separate recurring allowance from purchased balance; define spend order, eligible work, refunds, failed-job release, plan-change behavior, and honest recommendations.
- **Acceptance:** Purchased capacity survives periods and plan changes, settles only for disclosed successful work, cannot be client-minted, and can finish work without a forced upgrade.

### ISSUE-1424: Founding Owner checkout, permanent entitlement, recognition, usage boundary, and post-beta migration are incomplete

- **Status:** 🟡 PARTIAL
- **Severity:** 🔴 HIGH
- **Module:** Landing / Stripe / founder entitlement / onboarding
- **Source of truth:** Marketing decision § Founding Owner License
- **Evidence:** Public copy is reframed and fake 11-seat scarcity removed; existing checkout/entitlement has not been proven against the new permanent-access promise.
- **Impact:** A $2,500 purchaser could receive ambiguous rights or metered usage terms.
- **Fix:** Make waitlist eligibility server-authoritative; define first-year included usage; persist software access separately from provider capacity; preserve recognition and post-beta rights.
- **Acceptance:** A genuine eligible purchaser pays the disclosed amount once, receives non-forgeable permanent access/recognition, sees accurate usage terms, and keeps rights after renaming.

### ISSUE-1425: Beta participation, bug reporting, invitations, and communications need bounded operations

- **Status:** 🔴 OPEN
- **Severity:** 🟡 MEDIUM
- **Module:** Support / feedback / release operations
- **Source of truth:** Marketing decision § Founding Artist Beta operations
- **Evidence:** Bug-reports-only expectations, first-come invites, milestone-only updates, no payment promise, and no unscheduled deadline are not encoded consistently.
- **Impact:** Beta users could receive contradictory expectations or communications.
- **Fix:** Add consistent onboarding/terms, authenticated bug reporting, invite batching, milestone rules, and an absent-by-default scheduled deadline field.
- **Acceptance:** Users see one bounded expectation, can submit actionable bugs, and receive no fabricated deadline, compensation promise, or unauthorized message.

### ISSUE-1426: Homepage lifecycle timeline needs real capture and deployment proof

- **Status:** 🟡 PARTIAL — lifecycle UI implemented and responsive interaction verified in deployed browser (2026-08-30); real clips (ISSUE-1427) and domain alignment (ISSUE-1419) pending
- **Severity:** 🟠 HIGH
- **Module:** Landing capabilities
- **Source of truth:** Marketing decision § Product explanation
- **Evidence:** The homepage now presents Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat, starts on Delivery Preparation, maps relevant specialists and five approved workflow outcomes, and reserves an honest captioned product-capture slot for every stage. Deployed browser review (1440/768/390 widths): lifecycle stage tabs render and are keyboard-focusable (`aria-pressed` toggles), no overflow, no page errors.
- **Impact:** Visitors still learn internal structure before the artist journey.
- **Fix:** Add eight genuine founder-narrated product captures (ISSUE-1427), then replace each placeholder only when its matching behavior is proven.
- **Acceptance:** A new visitor follows all eight stages, understands the five promises and shared context, and sees no department-count or unproven delivery pitch.

### ISSUE-1427: Eight founder-narrated real-product clips and accessible playback are missing

- **Status:** 🔴 OPEN
- **Severity:** 🟡 MEDIUM
- **Module:** Product capture / video / captions / landing media
- **Source of truth:** Marketing decision § Product video system
- **Evidence:** No approved set of eight 15–30 second lifecycle clips exists.
- **Impact:** The website relies on illustrative UI instead of concise real product evidence.
- **Fix:** Use one demo project; script, capture, narrate, edit, caption, export, version, and integrate one click-to-play clip per stage through indii tools where genuinely available.
- **Acceptance:** Eight clips show matching real behavior, meet duration, include synchronized captions/transcripts, do not autoplay with sound, and preserve source/version/approval records.

### ISSUE-1428: Social account ownership, security, brand, and integration inventory is missing

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** Founder operations / Social / credential vault
- **Source of truth:** Marketing decision § Social channel inventory
- **Evidence:** Dictation suggests `@indie_music` and `@indie.music`-style accounts, but exact platform spellings and ownership are unverified.
- **Impact:** Assets or posts could be prepared for the wrong handle while account recovery/security remains unknown.
- **Fix:** Inventory Instagram, Facebook, TikTok, YouTube/Shorts, X, Threads, LinkedIn, Bluesky, and later channels with handle/URL/admin/recovery/2FA/brand/bio/posting/integration/status fields; keep secrets in the vault only.
- **Acceptance:** Every claimed account is opened and ownership-verified, missing channels are explicitly create/decline, and indii resolves the correct destination without exposing secrets.

### ISSUE-1429: indii does not yet run its own marketing as a first-class internal artist project

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH
- **Module:** Conductor / Marketing / Creative / Social / timeline
- **Source of truth:** Marketing decision § indii as its own first artist/customer
- **Evidence:** No canonical internal project, reusable Conductor instruction, asset map, approval path, campaign timeline, or outcome record exists.
- **Impact:** indii cannot yet prove the product by operating its own marketing through it.
- **Fix:** Create an internal artist-style project and instruction that routes real planning, imagery, video, copy, news, social, approvals, versions, costs, and results; surface unavailable tools honestly.
- **Acceptance:** One approved instruction produces a visible plan, routes genuine work, prepares channel outputs, records approvals/versions, and truthfully reports gaps; resulting work becomes beta evidence.

### ISSUE-1430: Deal comparison and distributor/royalty calculator contain unverified or overbroad claims

- **Status:** 🟡 PARTIAL — unsafe component quarantined from the rendered page
- **Severity:** 🔴 HIGH
- **Module:** `LegacyComparison.tsx` / `FounderRoyaltyCalculator.tsx`
- **Source of truth:** Marketing decision § Comparison and calculator evidence
- **Evidence:** The calculator hard-codes provider prices, commissions, fees, stream rates, rights/training allegations, and an unproven indii direct-pipeline comparison.
- **Impact:** Stale financial or legal claims create material public-trust risk.
- **Fix:** Compare selected deal types; use current authoritative provider sources with URL/date; expose assumptions; separate facts/estimates; hide stale rows; remove unsupported rights/training/delivery/payout claims.
- **Acceptance:** Every named value is current and traceable, calculations are reproducible, stale/unverified rows cannot render, indii uses proven capabilities only, and legal/financial review precedes restoration.
