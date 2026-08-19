# Session Checkpoint — First-Customer Readiness: Live Bug Hunt & Fixes (2026-08-18)

**Updated:** 2026-08-19 20:55 UTC
**Branch:** `main` — pushed through `63a93d22b` (ISSUE-1377 memory embeddings); CI #291 deploying. Variation fix (ISSUE-1382) LIVE (generateimagev3 rev 00301-hek 20:24).
**ISSUE-1382 (variations — founder-live 18:46):** 'All variation requests failed' — reference parts built as {type:'image', mime_type, data} which the @google/genai SDK does NOT recognize as a Part (needs inlineData/text/fileData) → malformed request → Vertex 400. References NEVER worked on the generateContent fallback. Fixed to {inlineData:{mimeType,data}} (Omni path unchanged — its own Step schema). Reference upload PROVEN healthy (22,761-byte PNG @ 18:46:10) — part shape was the sole defect.
**ISSUE-1377 (memory embeddings):** client memory pipeline used browser embeddings that fail-closed by design → semantic recall silently empty. New batchEmbedText callable + both client call sites wired; 60/60 tests.
**Previous round state:** video E2E proven (job SUjgH7P8GLPBT1YEQpkn, mp4 in storage); video metering added (ISSUE-1381, committed aeb1dadc7).
**Founder real-world list unchanged:** Stripe mock key + prices (1372), 30/39 mock secrets (1373), Founder seat #1 commit (1374), e2e App Check CI token, Meta/desktop/registrations.
**Open:** guided-chat 'Create Video' widget 400 observed once during the 14:53 network-flaky window — recheck on next repro; probe profile session restore degraded (auth timeout loop) — the debug token + recovery (clear app-check db) works intermittently.
**Branch:** `main` — pushed through `5209ad436` (ISSUE-1375 navigation); CI #284 deploying (carries: ISSUE-1369 durable index + ISSUE-1375 nav). ISSUE-1371 Export LIVE; ISSUE-1370 aspect LIVE.
**ISSUE-1369 saga CLOSED:** index listed in `packages/firebase/firestore.indexes.json` (97 entries, `3b0fc1a48`) — the deploy-managed file is the single source of truth (`firebase deploy --only firestore:indexes --force` deletes anything unlisted; it ate the REST-created index twice). Live check 02:45: capability query 200 + docs.
**ISSUE-1375 nav LIVE in #284:** view-mode history (studio↔canvas back/forward, cap 30, undo semantics) + `goBackModule` + CreativeNavbar cluster (ArrowLeft=page back; chevrons=view back/forward; disabled at bounds). openImageInStudio routes through setViewMode('canvas') so Boardroom imports get Back for free. 24/24 touched tests.
**Founder real-world tasks (documented, proof in ledger):** ISSUE-1372 Stripe mock key + missing price IDs; ISSUE-1373 30/39 mock secrets; ISSUE-1374 founder seat #1 never committed (FOUNDERS array empty, program shows 10 seats). e2e App Check debug token (console task).
**NEW FINDINGS this round:**
1. **Index-vanish root cause (ISSUE-1369 re-opened then durably fixed):** CI's `firebase deploy --only firestore:indexes --force` reads `packages/firebase/firestore.indexes.json` (EXISTS — my earlier 'no file' claim was wrong, checked repo root) and DELETES live indexes not listed ("Deleting 1 indexes" deleted the REST-created creative_jobs index in CI #281 at 01:27). Capability query broke again (~01:50); index recreated via REST (02:00) and the FILE now lists it (97) so every deploy keeps it. Verify query after next deploy.
2. **Composite-index audit (server):** all 11 where+orderBy chains + multi-where chains checked against the file/live lists — ONLY creative_jobs was missing (now added). Single-field orderBy auto-served. Audit method + result documented in ledger.
3. **ISSUE-1372 (founder task):** STRIPE_SECRET_KEY = `MOCK_KEY_DO_NOT_USE`; no STRIPE_PRICE_* env → PRO/STUDIO checkout disabled, one-time checkout would 401. Founder tier=founder has no subscription doc (granted via GitHub/admin flow, not Stripe).
4. **ISSUE-1373 (founder task):** 30/39 secrets are mock/placeholder (Stripe, Resend, Meta, Spotify, TikTok, Twitter, Microsoft, PandaDoc, Telegram, Inngest, ClickHouse, Apollo, Clearbit, Google OAuth, Shopify webhook). REAL: Arcjet, Gemini, GitHub token, Maps, MCP, Printful, RESEND_FROM_EMAIL. Full table in ledger.
5. **e2e flake root:** staging e2e has no App Check debug token → headless browsers throttle App Check → boot hangs → the /tax-form-upload 15s flake. Hardened to 30s (CI #278/281 passed). Deeper fix (register CI debug token in console + inject) is a founder console task — documented.
**FIX CONFIRMED LIVE (prior rounds):** rate limit (276), 120s timeout (277), undefined-strip (279), capability index (recreated 02:00 — verify after #282 deploy), aspect-ratio (281), Export (282 deploying).
**Branch:** `main` — pushed through `f3c9060bb`; CI #281 SUCCESS. ISSUE-1370 aspect-ratio fix LIVE (entry `index-CPpmyS15.js`, `naturalWidth` ×6 in bundle). All prior fixes live: rate limit (276), 120s timeout (277), undefined-strip (279), capability index (REST, no code).
**FOUNDER STATUS:** green light to hard-refresh and test the Boardroom→Studio transfer with a 16:9 image — should keep its shape on the work mat now.
**BACKFILL DONE (founder-approved):** 14 creative_jobs docs restored for Aug 18 generations 01:15–23:20Z (real prompts from history records; verified 200s). Earlier session claim "0 history docs for 23:16–23:20" was WRONG (query flaw) — all 16 history docs always existed; the strip had the images.
**ISSUE-1369 (no code change, live fix):** `creative_jobs` composite index (userId ASC, createdAt DESC) did NOT exist → getCapabilitySnapshot query threw FAILED_PRECONDITION → caught → capability evidence = `unverified` (1359 fix was incomplete). Index `CICAgITsmpEK` created via REST, READY 00:47Z; query verified returning backfilled + new jobs. DO NOT introduce firestore.indexes.json without enumerating all 96 existing indexes (CI `--force` deletes unlisted ones).
**ISSUE-1370 (CI #281):** Boardroom→Studio imports preserve source aspect (readNaturalDimensions; 512×512 fallback only when undecodable).
**OPEN BACKLOG:** ISSUE-1158/1159/1168/1169/1354 need live-proof; Stripe tier price IDs missing (`[Stripe] Missing price ID for STRIPE_PRICE_*` logged at every function boot — checkout for those tiers disabled).

## ISSUE-1368 — ROOT CAUSE CLOSED (log-proven from founder's 23:16Z request)
- **Bug:** `Cannot use "undefined" as a Firestore value (found in field "sessionId")` — agent-driven generations omit `sessionId`; Firestore rejects the whole creative_jobs doc; completion update fails `5 NOT_FOUND`. Video record had the same class (`cameraPhysics: undefined`).
- **Fix:** `safeDbSet`/`safeDbUpdate` JSON-strip undefined (no sentinels in gateway — audited). Exported + 2 regressions; gateway 48/48; firebase typecheck clean. Committed `f5eef5629`, CI #278 deploying.
- **Evening evidence:** 5 usage records 23:16-23:20Z (recordUsage LIVE — meters now populate) + 6 outputs in GCS (`1787094984890`…`1787095257563`) + 0 creative_jobs docs + 0 history docs for those jobs. The 20:20Z generation DID persist history (jobId 4KEwfcXApA2NgmuNiZZg, https download URL with token) — client-side path works when the stream survives.
- **Why images were invisible:** the 25s client stream cap aborted agent turns mid-tool; server finished the image (usage recorded) but the tool result never reached the client (no addToHistory → no strip). 120s fix (CI #277) is LIVE — a refresh + retry should now display the image in the strip even before CI #278.
- **Boardroom strip data source:** `generatedHistory` store ← `addToHistory` (client) + `StorageService.subscribeToHistory` (history collection, orgId+userId+timestamp desc, limit 50). NOT creative_jobs. creative_jobs feeds AssetObserver + getCapabilitySnapshot (agent evidence).
- **Backfill option (un-started, needs founder OK):** write history docs for tonight's 6 orphaned outputs (id=jobId from completion logs, https download URL via Storage API token, prompt='Boardroom Asset' placeholder, timestamp from filename).
**FOUNDER DIRECTIVE (memorized, applies to ALL work):** NEVER GUESS. Every claim, fix, probe, or report must be proven from actual state (real logs, real storage, real responses, real code) or be provable on demand. "I assumed" is a defect. Recorded in `.agent/skills/error_memory/ERROR_LEDGER.md` (2026-08-18 entry).

## Round 2026-08-18 (17:27-21:40 UTC): founder blocked in Boardroom — image never made

### ISSUE-1366 (committed `5aedeaa17`, deployed in-flight)
- **Proven from logs:** 6 swarm stream calls in 32s (20:27:13-45Z) tripped `RATE_LIMITS.generation` 10/min; 429 at 20:27:45 described as "temporarily at capacity"; LoopDetector killed the retry.
- **Fix:** generation limit 10→30 req/min; 429 message now honest ("Too many AI requests in the last minute… wait ~60s"); client fallback + image_gen test updated.

### ISSUE-1365 silent-swallow sweep (committed `5d8169069`, deployed in-flight)
- `AgentExecutor` trace-progress write, `DistributionService` metadata snapshot, `BaseAgent` audit events, `activateFounderPass` GitHub retry-queue write — all `.catch(() => {})` now log code+reason.

### creative_jobs root-cause hunt — NEW EVIDENCE (still open)
- **10 image completions today; only 1 (00:36Z `EtdSxNXSf8EH6cRT3TMd`) has a creative_jobs doc.** Jobs 01:15-01:40Z (5×) and 20:20-20:27Z (4×, incl. founder's blocked `ipE7Lvx8X7FUm00MrbeX`) are 404.
- **Excluded:** IAM (compute SA probe-write to creative_jobs succeeded 21:17Z, probe doc deleted), region (all 195 fns us-central1), billing (enabled), code regression (break happened MID-revision 00287-hud between 00:36 and 01:15 — no deploy), named-DB drift (getDb = plain admin.firestore()).
- **Signature:** Vertex ✓, Storage upload ✓, Firestore reads ✓, Firestore WRITES ✗ from function runtime. Root cause still unproven — **the 961cfac28 gateway (live since 20:28:41Z) now logs safeDbSet/safeDbUpdate code+reason; the NEXT generation will reveal it.** Verify immediately after founder's next Boardroom image request.

### Google APIs/Maps audit — COMPLETE, all proven
- Image/video: `aiplatform.googleapis.com` + `firebasevertexai` + `generativelanguage` enabled; deployed `generateImageV3` env `MEDIA_PROVIDER=vertex`; live completion logs show `provider: 'vertex'` + outputCount; model `gemini-3.1-flash-image` runs (via generateContent fallback; interactions.create unsupported for this model — expected).
- Maps: live bundle contains key **`AIzaSyA-Cf95…` = "Google Maps Desktop Key" (8bff1ea7)**, restricted to exactly the APIs the app uses (`maps-backend`, `places`, `geocoding-backend`). Live tests: JS API load HTTP 200, Geocoding returns real data, Static Maps 403 by design (not whitelisted, app doesn't use it). TourMap loads `maps/api/js?key=…&libraries=places`. CI injects key from `secrets.VITE_GOOGLE_MAPS_API_KEY` + `VITE_ENABLE_GOOGLE_MAPS=true`.

### Region consolidation — COMPLETE, all proven
- 195 deployed functions, ALL us-central1; 0 in us-west1/europe-west1/us-east1/asia-east1. Client: single `getFunctions(app)` client; `functionsWest1` is a pure alias (`functionsWest1 = functions`, firebase.ts:276) — west1 imports are NOT a bug.

### Flowchart re-sync — COMPLETE (committed `c68386ba9`, un-pushed)
- `docs/flowcharts/api_endpoints.md` now covers 195/195 deployed functions (verified by diff): 56 previously undocumented endpoints added (55 client + 2 internal), `processISWCMapping` → deployed alias `processISWCMappingV2`. Client-reachable 116→171, internal 23→24.

### Headless probe limitation discovered
- Headless Chromium on the probe profile cannot pass App Check (403 → 24h throttle persisted in profile's firebase-app-check-database). **The recon runs throttled App Check in `/tmp/pw-indii-probe` for ~24h** (initial-throttle). Session data intact on disk (uid + refresh token in leveldb) but the app falls through to login without a valid App Check token. Do NOT relaunch headless against the profile today; the founder's real browser is the only valid live-test vehicle now.

## Still pending (founder-gated — needs real accounts/credentials)
1. **Desktop signing secrets** (ISSUE-1163/992): Apple Developer ID + notarization, Windows cert — no signed DMG/EXE until then. Web app NOT blocked.
2. **Meta Business account + App Review** (ISSUE-1173): PLP ad delivery fail-closed until credentials exist.
3. **Founder registrations** (ISSUE-1121): ISRC prefix ($95), GS1/UPC, PRO+IPI, ISWC, MLC, SoundExchange, Copyright Office.

### ISSUE-1367 (committed `010f84620`, CI #277 deploying) — 25s client stream timeout kills agent turns
- **Founder-live evidence:** CD "AI Request timed out after 25000ms… I have cancelled the pending generation"; **generateImageV3 received ZERO requests in that window** (log-proven) — the reasoning stream aborted before the image tool fired.
- **Code proof:** the 25s `setTimeout` wraps the WHOLE stream (rate-limiter queue wait + pre-flight + tokens; `cleanupRequestLifecycle` runs only after the response settles) while `generateContentStream` allows 300s server-side (index.ts:1084). Mismatch.
- **Fix:** default client timeout 25s → 120s at both call sites (generateContent + stream paths); `options.timeout` overrides intact. Tests 153/153, typecheck clean.
- **Founder's transcript also shows the OLD "at capacity" 429** — from before CI #276 landed; the honest message is now live.

## Next steps (ordered)
1. CI #277 (timeout fix) to land ~30 min → then founder hard-refreshes + retries the Dii wordmark request.
2. IMMEDIATELY pull `generateimagev3` runtime logs: either `[creativeGateway] Firestore set/update failed` with code+reason (creative_jobs root cause at last) or a successful doc write.
3. Check `creative_jobs/{jobId}` + `usage` collection after the generation (recordUsage should populate; baseline was 33 docs, newest 2026-05-22).
4. Confirm the founder's image renders in the Boardroom asset strip with no misleading errors.

---

## Checkpoint 2026-08-19 ~23:35 UTC — ISSUE-1390 commit in flight

- **Founder:** "Failed to create file/folder" after painting + no way back to canvas from creative editor. TWO defects fixed + ONE pipeline defect fixed:
  1. Rules suspicion **ruled out with proof** — emulator repro against live ruleset: painting-save write ALLOWS for verified user, DENIES only for anonymous. Founder's failure = client session state; now `describeFileSystemError` gives session-aware messages instead of a dead-end alert; guest/demo sessions skip doomed file-sync writes (ISSUE-1194 pattern).
  2. Editor overlay had NO exit on mobile (rail X is desktop-only) — added "← Canvas" button in CanvasHeader (all breakpoints) + Escape handler.
  3. **Deploy integrity:** CI #293 exited 0 while 7 functions failed with HTTP 429 — generateImageV3 STILL rev 00301-hek (20:24), per-API variation fix NOT live. deploy.yml now retries 429s (2×, 90s) and exits 1 if any function fails to update.
- Tests: rules repro wired into `test:rules`; renderer +10 tests; all green. Committing next.
- **After push:** watch #294 → verify generateImageV3 revision rotates past 00301-hek → tell founder to retest Variations (fast + pro), painting save, and the new Canvas back button.
