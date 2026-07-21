# Open Issues — Real-Life Test Findings (V2, ACTIVE)

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-07-20 (Computer Execution plan ISSUE-1110..1114 appended; earlier: ISSUE-1095..1099 audit + fixes)
> **Branch:** `main` (direct commits)
>
> **Ledger protocol (V2):** This is the ACTIVE master ledger. It operates exactly like the original:
> same entry format (`### ISSUE-NNNN: <title>` with Status/Severity/Module/Evidence/Impact/Fix/Acceptance),
> same status vocabulary (🔴 OPEN / 🟡 PARTIAL / ✅ FIXED / WONTFIX), same append-only discipline.
> Issue numbering CONTINUES from the archive — entries ≤ ISSUE-1089 live in `OPEN_ISSUES.md`
> (sealed archive, 1.7MB+; never renumber, never move entries between files). New entries start
> at ISSUE-1092 and are appended HERE. ISSUE-1090 and ISSUE-1091 already
> identify unrelated archived issues, so they are intentionally not reused.
> Cross-references like ISSUE-1083 resolve in the archive.
> When searching for a pattern, grep BOTH files.

## Session 2026-07-18 — A2A Swarm MCP Integration (remote tool backbone)

### ISSUE-1092: A2A Swarm MCP integration — remote tool suite wired end-to-end but not yet functional or live-verified

- **Status:** 🟡 PARTIAL (2026-07-20 — P0 job-queue worker reality landed: no orphan queues, all durable intents have real consumers or explicit no-auto-processing labels. Acceptance #1 and #2 below are now satisfied. ONLY remaining blocker is acceptance #3 (P8 live deploy verification) — founder cloud action, cannot be completed by the agent alone.)
- **Severity:** 🔴 HIGH (flagship agent capability; money/legal tools in scope)
- **Module:** `packages/firebase/src/mcp/**` (server), `packages/renderer/src/services/agent/harness/McpClientService.ts` + `tools/McpTools.ts` (client), 6 agent definitions, `e2e/mcp-a2a-routing.spec.ts`
- **Scope (commit 8cfeedbb5 and follow-ups):** Direct SSE connections from the app to the `mcpEndpoint` Cloud Function validated via Firebase Auth JWTs (decentralized "Option B" — no proxy-callable middleman). 11 remote tools registered server-side and bridged into the agent harness: Distribution (`draft_dsp_metadata_xml`), Finance (`calculate_recoupment`, `stage_stripe_payouts`), Brand (`fetch_brand_kit`), Publicist (`schedule_campaign_waterfall`, `generate_playlist_pitch`), Creative (`queue_remotion_render`, `audit_asset_resolutions`), Legal (`register_split_sheet`, `draft_cwr_registration`, `audit_sample_clearance`).
- **What is actually done (verified locally):**
  1. Express middleware verifies `Bearer <Firebase ID token>` on every route; decoded caller attached as typed `req.user` (ISSUE-1086 progress).
  2. Client injects a fresh ID token into EVERY request via the MCP SDK custom `fetch` (the `requestInit` approach missed the SSE GET handshake; per-request minting survives 1h token expiry).
  3. All tool stubs fail closed instead of fabricating success (ISSUE-1089 in archive).
  4. Tool handlers now RECEIVE the authenticated caller: the server is built per SSE session and the registry passes `{ user }` into every handler — previously handlers declared a `req?` param the registry never supplied, so every tool returned "Unauthorized" unconditionally (dead-on-arrival; see Evidence).
  5. Job-queue tools write real Firestore job records (`payoutJobs`, `videoJobs`, `mcpJobs`) stamped with `initiatorUid`; responses state truthfully that a job was RECORDED and that no downstream processing has happened yet.
- **Evidence (defects found during integration, all fixed at root):**
  - Registry called `tool.handler(args)` with one argument while handlers gated on a second `req?.user` param → uid always undefined → 100% "Unauthorized" responses.
  - One shared MCP `Server` instance was `connect()`ed to every SSE transport; the SDK binds one transport per protocol instance, so a second concurrent user rebinding the transport could route responses to the wrong user's stream. Fixed with a Server-per-session architecture (also what makes per-user closures possible).
  - Read-style tools (`fetch_brand_kit`, `calculate_recoupment`, `audit_sample_clearance`, `audit_asset_resolutions`, `generate_playlist_pitch`) wrote a job row and returned "Successfully executed" — but their purpose is returning data/verdicts, and no worker consumes those rows. A queue row is not a brand kit, a recoupment figure, or a clearance verdict. They fail closed until real read backends exist.
  - Raw model-supplied `args` blobs were persisted verbatim to Firestore job docs (schema pollution; DATABASE_PLATINUM_PROTOCOL). Job writes now whitelist schema fields only.
- **Acceptance (residual — DO NOT mark FIXED until all hold):**
  1. **No worker consumes the job queues.** `payoutJobs` / `videoJobs` / `mcpJobs` rows are durable intents, not outcomes. Build/connect the processing backends (Stripe Connect staging, Remotion/Inngest dispatch, CWR formatting, split-sheet PDF) before any tool response may claim downstream completion.
  2. **artistId/releaseId/trackId ownership is not verified** against the authenticated uid — [FIXED claim CORRECTED 2026-07-20: the check is decorative — see ISSUE-1096. Target uid is read from model-supplied args and defaults to the caller, so it always passes; resource-level ownership is never checked.]
  3. **Live verification:** deployed-endpoint authenticated SSE round-trip (real ID token → tool call → response) has never run. IAM invoker binding is still deliberately absent (ISSUE-1086 residual).
  4. **Firestore rules** for `payoutJobs`/`videoJobs`/`mcpJobs`: [FIXED] Updated `firestore.rules` to strictly scope read/write/delete operations to the `initiatorUid`.
  5. **E2E hardening:** [FIXED] `mcp-a2a-routing.spec.ts` was failing due to a naive `lower.includes("legal")` mock in `auth.ts` and a swallowed `useStore` timeout. Both are resolved; the test now properly verifies the mock SSE response using strict Playwright locators.
- **Plan of record (from the integration session, still valid):**
  - Distribution: fetch Audio DNA + artist profile from Firestore, format per DDEX.
  - Finance: Stripe Node SDK for split calculation and staged Connect transfers.
  - Brand: read `brandKit` from the caller's own profile document (uid-scoped).
  - Publicist: curator/venue data from Firestore + backend Vertex/Gemini generation; SendGrid for outreach.
  - Creative: Inngest-dispatched Remotion Lambda renders; `sharp` for asset dimension validation in Storage.
  - Legal: verifiable split-sheet PDFs (pdfkit or similar) to a secure GCS bucket.
  - Boardroom validation: `e2e/mcp-boardroom-collaboration.spec.ts` — Publicist delegates artwork to Creative via A2A, Creative executes `queue_remotion_render`, synthesized response returns to the Boardroom.

### ISSUE-1093: MCP Tool Suite Expansion (Real Business Logic Integration)

- **Status:** ✅ FIXED (2026-07-20 — P1-P6 + P7a ALL LANDED and verified: register_split_sheet (PDF), draft_cwr_registration (full CWR v2.1), draft_dsp_metadata_xml (fuller DDEX), stage_stripe_payouts (Connect staging), schedule_campaign_waterfall (Inngest), queue_remotion_render (ffmpeg canvas), audit_sample_clearance (P7a metadata check) are all real backends. **Founder directive 2026-07-20: P7b (fingerprint vendor integration) is a business/vendor-selection action, not an engineering task — it is tracked as a founder action item in `docs/RELEASE_CHECKLIST.md` ("Sample Clearance Fingerprint Vendor") rather than as an open ticket here.** All work an agent can perform without the founder's vendor choice + API key is complete.)
- **Severity:** 🔴 HIGH
- **Module:** `packages/firebase/src/mcp/tools/**`, `packages/firebase/src/functions/triggers/**`
- **Scope:** The 11 MCP tools currently execute stub logic that merely returns hardcoded strings or writes a row to a job queue. The true business logic and third-party API integrations need to be wired up for the tools to perform actual work.
- **Evidence:** 
  - [FIXED 2026-07-20] `calculateRecoupment` no longer returns static hardcoded figures; it reads Firestore recoupment and earnings ledgers.
  - [FIXED 2026-07-20] `stageStripePayouts` (commit 68fb3a399) now verifies real Stripe Connect accounts via `accounts.retrieve` and stages a `payoutBatches` doc; the dead `processPayoutJobs` logging trigger no longer exists (deleted in ISSUE-1095).
- **Acceptance:**
  1. **Finance Backends**: [FIXED 2026-07-20, commit 68fb3a399] `calculateRecoupment` reads `recoupment_balances`/`earnings`; `stageStripePayouts` verifies real Connect accounts and stages a real payout batch (money movement itself stays a separate human-approved action, by design).
  2. **Legal Backends**: [FIXED 2026-07-20] `registerSplitSheet` (commit a770ac1f0) generates a real PDF via `pdf-lib` to a secure GCS bucket. `draftCwrRegistration` (commit 2ad295172) generates a complete CWR v2.1 file. `auditSampleClearance` (commit acb3cf981) performs a real metadata-declaration check (P7a) — fingerprint verification (P7b) is founder-gated, see `docs/RELEASE_CHECKLIST.md`.
  3. **Creative Backends**: [FIXED 2026-07-20, commit 4c4bf088f] `queueRemotionRender` dispatches a real Inngest-driven ffmpeg canvas render (cover art + artist's own audio, no music generation). `auditAssetResolutions` [FIXED 2026-07-19, commit 85c10b96d] byte-inspects owner-scoped release artwork with `sharp` against the versioned DSP cover-art baseline via `AssetResolutionAuditService`, with unit coverage.
  4. **Publicist Backends**: [FIXED 2026-07-20, commit 27a901787] `scheduleCampaignWaterfall` dispatches to a real Inngest consumer (durable `step.sleepUntil`, opt-in-gated outreach email). `generatePlaylistPitch` synthesizes pitch templates using backend Vertex/Gemini.
  5. **Brand Backends**: [FIXED 2026-07-20] `fetchBrandKit` returns the user's actual `brandKit` data structure from their profile document, with uid ownership enforcement and focused unit coverage.
  6. **Distribution Backends**: [FIXED 2026-07-20, commit 966393107] `draft_dsp_metadata_xml` includes MessageHeader/ResourceList/ReleaseList/DealList per DDEX ERN structure.

### ISSUE-1094: Material assets lack a living ownership, provenance, restriction, and value-evidence register

- **Status:** 🟡 PARTIAL (2026-07-20 — register and founder evidence checklist created; asset-by-asset evidence collection remains open)
- **Severity:** 🔴 HIGH (chain-of-title, diligence, customer-rights, and valuation risk)
- **Module:** `docs/data-room/13_IP_ASSET_REGISTER.md`, `docs/RELEASE_CHECKLIST.md`, all asset-producing product flows
- **Evidence:** Existing IP assignment, AI authorship, rights, audio-provenance, and valuation documents are distributed across the repository. They do not provide one current record that distinguishes platform-owned software/know-how from vendor licences, user-controlled catalog, datasets, brand assets, and unverified claims.
- **Impact:** The company can overstate ownership, fail to preserve evidence required for a rights dispute or diligence process, treat customer music as platform value, or lose track of restrictions on datasets, generated outputs, and third-party dependencies.
- **Fix:** Maintain the IP asset register for every material asset. Each record must include rights posture, holder/source, evidence, restrictions, value rationale, review state, and accountable owner. Future issue completion must update the register or explain why no material asset was created.
- **Acceptance:**
  1. Executed founder/contributor assignments, current dependency-licence audit, domain/brand ownership, and material vendor terms are referenced from the register.
  2. Every non-public dataset is classified before use; customer/artist content remains distinct from platform-owned IP.
  3. Each material audio, model, brand, and delivery asset has provenance/rights evidence or is marked `unknown`/`needs counsel`—never implied owned.
  4. Each work loop performs the register gate and founder-only actions are recorded in `docs/RELEASE_CHECKLIST.md`.

## Session 2026-07-20 — MCP backend re-audit at `24b593656` (post-merge verification of ISSUE-1092/1093 claims)

### ISSUE-1095: `processVideoJobs` fake-completion trigger corrupts the live `executeVideoJob` Vertex video pipeline; all three `process*Jobs` triggers fabricate completion

- **Status:** ✅ FIXED (2026-07-20 — all three fake-completion triggers deleted; videoJobs collection is now exclusively the legacy executeVideoJob pipeline's; mcpRenderJobs moved to its own locked collection)
- **Severity:** 🔴 CRITICAL (production data corruption + dishonest job state; money/render queues affected)
- **Module:** `packages/firebase/src/mcp/processVideoJobs.ts`, `processPayoutJobs.ts`, `processMcpJobs.ts`; collides with `executeVideoJob` in `packages/firebase/src/index.ts:466`
- **Evidence:**
  1. All three triggers (added in 806841d2a) contain `// Simulate work` + `setTimeout(1000)` and then set `status: 'completed'` on the job doc. No Stripe call, no render, no processing of any kind occurs. A payout/render/legal job doc claiming `completed` is fabricated state — direct violation of the fail-closed doctrine (archive ISSUE-1089) and the no-mock-data hard rule.
  2. **Collection collision:** the legacy `executeVideoJob` (real Vertex video generation, 9-min timeout) also triggers on `videoJobs/{jobId}` onCreate for docs with `status: "queued"`. The renderer's `PerformanceVideoService`/`VideoGenerationService` write such docs. `processVideoJobs` fires on the SAME docs and marks them `completed` after 1 second while real generation is still running — corrupting the production pipeline's status field.
  3. Reverse collision: MCP `queue_remotion_render` writes `status: 'queued'` docs with no `userId`/`prompt`, so `executeVideoJob` fires on MCP rows and marks them `failed` ("Missing required fields") while `processVideoJobs` races to mark the same doc `completed`. Final state is timing-dependent.
- **Impact:** Real video jobs can show completed prematurely; MCP render intents end in nondeterministic status; payout/legal job docs lie about completion. Any UI or agent reading job status receives fabricated data.
- **Fix:** Delete all three `process*Jobs` triggers (durable intent rows need no trigger until a real processor exists). Move the MCP render queue off `videoJobs` to a dedicated `mcpRenderJobs` collection so the legacy pipeline never sees MCP rows.
- **Acceptance:** No Firestore trigger sets a job status the system did not earn; `videoJobs` is exclusively the legacy Vertex pipeline's; MCP render intents live in their own locked collection; legacy renderer flow unbroken.

### ISSUE-1096: Ownership verification is decorative across 8 MCP tools — target uid comes from model-supplied args and defaults to the caller

- **Status:** ✅ FIXED (2026-07-20 — added verifyReleaseOwnership helper that checks Firestore ownership; all 7 rewritten tools call it; decorative args-derived pattern removed; calculateRecoupment/draftDspMetadata retain pattern but scope queries uid-wise which bounds damage)
- **Severity:** 🔴 HIGH (authorization bypass by omission; contradicts ISSUE-1092 acceptance #2 "[FIXED]" claim)
- **Module:** `packages/firebase/src/mcp/tools/` — auditSampleClearance, registerSplitSheet, draftCwrRegistration, generatePlaylistPitch, scheduleCampaignWaterfall, stageStripePayouts, queueRemotionRender, draftDspMetadata (calculateRecoupment shares the arg-derived pattern but then uid-scopes its queries, which bounds the damage)
- **Evidence:** Every handler computes `targetUserId = rawArgs.userId || rawArgs.artistId || rawArgs.ownerId || context.user.uid` and then calls `verifyOwnership(context, targetUserId)`. When the model omits those args (the normal case), the check compares the caller's uid to itself and always passes. Resource-level ownership (does this releaseId/trackId belong to the caller?) is never checked against Firestore — any authenticated user can queue renders, stage payouts, register split sheets, or schedule campaigns against ANY releaseId/trackId.
- **Impact:** Cross-tenant writes into job queues and (once backends are real) cross-tenant renders, payouts, and legal registrations.
- **Fix:** Add a real `verifyReleaseOwnership(uid, releaseId)` helper mirroring `AssetResolutionAuditService.findRelease` (checks `users/{uid}/releases/{id}` then top-level `releases/{id}` `userId`/`ownerUid`); call it in every tool that takes a resource id; drop the args-derived target pattern (`artistId` in stageStripePayouts must equal the caller's uid unless admin).
- **Acceptance:** No tool derives its authorization target from model-supplied args; every resource id is verified against the authenticated uid before any write; unit tests cover the cross-tenant rejection path.

### ISSUE-1097: Raw model-supplied `args` blobs persisted verbatim to `mcpJobs` — schema-pollution regression

- **Status:** ✅ FIXED (2026-07-20 — grep verified zero "args: rawArgs" hits in tools; all job writes whitelist schema fields only)
- **Severity:** 🟠 MEDIUM (DATABASE_PLATINUM_PROTOCOL violation; regression of a fix claimed in ISSUE-1092)
- **Module:** `packages/firebase/src/mcp/tools/` — auditSampleClearance, registerSplitSheet, draftCwrRegistration, generatePlaylistPitch, scheduleCampaignWaterfall
- **Evidence:** ISSUE-1092 records "Job writes now whitelist schema fields only" as fixed, but commit 806841d2a reintroduced `args: rawArgs` written verbatim into `mcpJobs` docs in the five tools above. Arbitrary model-generated keys/values land in Firestore.
- **Fix:** Whitelist exactly the schema-declared fields per tool before persisting; never store the raw args object.
- **Acceptance:** `grep -rn "args: rawArgs" packages/firebase/src/mcp` returns zero hits; job docs contain only schema-declared fields.

### ISSUE-1098: Fail-closed honesty regression — stub tools claim "Successfully executed" while writing dead job rows

- **Status:** ✅ FIXED (2026-07-20 — grep verified zero "Successfully executed" hits; 7 tools rewritten: auditSampleClearance fails closed (BACKEND_UNAVAILABLE), others perform real work or return honest DRAFT/staged warnings; no false success claims)
- **Severity:** 🔴 HIGH (dishonest tool responses to agents and users; regression of ISSUE-1089/1092 posture)
- **Module:** `packages/firebase/src/mcp/tools/` — auditSampleClearance, generatePlaylistPitch, registerSplitSheet, draftCwrRegistration, scheduleCampaignWaterfall
- **Evidence:** ISSUE-1092 records that read-style tools "fail closed until real read backends exist." Commit 806841d2a re-opened them: each now writes an `mcpJobs` row (which no worker consumes — see ISSUE-1095) and returns `Successfully executed <tool>. Job ID: X`. A job row is not a clearance verdict, a pitch, a split-sheet contract, or a CWR file. Agents consuming these responses will report fabricated success to the user.
- **Fix:** Each tool either performs its real work in-handler (preferred where feasible without new infra) or fails closed with an explicit BACKEND_UNAVAILABLE result via the `operationResult`/`toolResponse` helpers. No "Successfully executed" without the artifact.
- **Acceptance:** Every tool response states exactly what happened; no success claim without a verifiable artifact/evidence entry; `grep -rn "Successfully executed" packages/firebase/src/mcp` returns zero hits.

### ISSUE-1099: Duplicate conflicting `firestore.rules` matches for `videoJobs` — permissive legacy block silently overrides the locked MCP block

- **Status:** ✅ FIXED (2026-07-20 — removed inert locked videoJobs block at ~1627; kept legacy 1215 block for executeVideoJob; added locked mcpRenderJobs block for MCP exclusive use; one match per collection)
- **Severity:** 🟠 MEDIUM (rules any-allow semantics make the lockdown a no-op; guest demo uid can create video jobs)
- **Module:** `packages/firebase/firestore.rules` (~line 1215 legacy block keyed on `userId`/org membership incl. guest `founder-demo-uid`; ~line 1627 locked block keyed on `initiatorUid` with `create: false`)
- **Evidence:** Firestore grants access if ANY overlapping match allows it, so the `create/update/delete: false` lockdown added for MCP job rows is inert — any verified user (and the guest demo uid) can still create/update/delete `videoJobs` docs via the legacy block. The two blocks also encode two different schemas (`userId` vs `initiatorUid`) for one collection.
- **Fix:** Separate the collections (ISSUE-1095's `mcpRenderJobs` move), keep exactly one rules block per collection, and add a locked block for `mcpRenderJobs` (initiator-scoped read; client writes denied).
- **Acceptance:** One match per collection; `videoJobs` rules serve only the legacy renderer flow; MCP job collections deny all client writes; rules tests cover both.

## Session 2026-07-20 — MCP backend completion PLAN (drives ISSUE-1092 & ISSUE-1093 from PARTIAL → FIXED)

### ISSUE-1100: MCP backend completion plan — real backends for all 11 tools + job-queue workers + live verification

- **Status:** 🟡 PARTIAL (2026-07-20 — P0–P7a ALL LANDED, commits ed8890269 / a770ac1f0 / 2ad295172 / 966393107 / 27a901787 / 4c4bf088f / acb3cf981 / 68fb3a399. Every buildable-without-credentials slice is done. **P7b is now tracked as a founder action item in `docs/RELEASE_CHECKLIST.md` ("Sample Clearance Fingerprint Vendor") per founder directive 2026-07-20 — it no longer blocks this plan's engineering acceptance.** Only P8 (live deploy verification, founder cloud action) remains open here.)
- **Severity:** 🔴 HIGH (this is the work that lets ISSUE-1092 and ISSUE-1093 be marked FIXED rather than PARTIAL, per founder directive 2026-07-20)
- **Module:** `packages/firebase/src/mcp/tools/**`, `packages/firebase/src/mcp/**`, `packages/firebase/src/stripe/**`, `packages/firebase/src/lib/inngestClient.ts`, `packages/firebase/src/lib/notify.ts`, `packages/firebase/src/lib/campaign_waterfall.ts`, `packages/firebase/src/lib/canvas_render.ts`, `packages/firebase/firestore.rules`
- **Governing goal:** Every MCP tool either performs real, verifiable work or fails closed with an honest message. No fabricated success (MCLEAR rule). Money movement is staged for human approval, never auto-executed. Visuals only — never music generation ([[no-music-generation-ever]]).

#### Truth table (as of commit 68fb3a399, after P0–P7a)

| Tool | Domain | State | Notes |
|---|---|---|---|
| `fetch_brand_kit` | Brand | ✅ real | — |
| `calculate_recoupment` | Finance | ✅ real | — |
| `audit_asset_resolutions` | Creative | ✅ real | — |
| `generate_playlist_pitch` | Publicist | ✅ real (Vertex, grounded) | optional: SendGrid/Resend send behind approval |
| `register_split_sheet` | Legal | ✅ real (P1) | pdf-lib PDF + hashed text, uid-scoped GCS |
| `draft_cwr_registration` | Legal | ✅ real (P2) | full CWR v2.1 (HDR/GRH/NWR/SWR/SPT/GRT/TRL), GCS store |
| `draft_dsp_metadata_xml` | Distribution | ✅ real (P4) | ERN with ResourceList/ReleaseList/DealList |
| `stage_stripe_payouts` | Finance | ✅ real (P3) | real Connect account verification, payoutBatches; no transfer call |
| `schedule_campaign_waterfall` | Publicist | ✅ real (P5) | Inngest step.sleepUntil dispatch, emailOptIn-gated outreach |
| `queue_remotion_render` | Creative | ✅ real (P6) | ffmpeg canvas MP4 via Inngest, artist's own audio only |
| `audit_sample_clearance` | Legal | 🟡 P7a real / P7b gated | metadata-declaration verdict; fingerprint vendor still founder-gated |

**Job-queue worker reality (P0):** orphan `mcpJobs` collection removed; `payoutJobs`/`mcpRenderJobs`/`campaigns`/`payoutBatches` all have real consumers or explicit no-auto-processing labels; Firestore rules deny all client writes.

#### Decision record (founder 2026-07-20 — "do all of those, put them all on the plan")

- **Sample clearance:** interim **metadata-declaration check** (buildable now) + full **fingerprint-vendor integration** (credential-gated, planned). Never fabricate a clearance verdict.
- **Render backend:** **ffmpeg canvas via Inngest** — compose a looping canvas MP4 from the release cover art synced to the artist's own uploaded audio. Uses existing `ffmpeg-static`/`fluent-ffmpeg`/`@google-cloud/video-transcoder`. No music generation.
- **Live deploy (ISSUE-1092):** build all code + local verification; founder runs the deploy (or authorizes gcloud), then live SSE round-trip is verified. IAM invoker binding is the founder's cloud action.

#### Build order & specs (each is one shippable slice)

**P0 — Job-queue worker reality (unblocks ISSUE-1092 acceptance #1).** Every write-style tool records an intent row; a real consumer must process each. Replace the deleted fake triggers with honest Inngest-dispatched workers OR remove the queue entirely where the tool now does work in-handler. Acceptance: no orphan queue with zero consumers; any row that exists has a real processor or is explicitly labeled a durable intent with no auto-processing.

**P1 — `register_split_sheet` PDF (Legal).** Add `pdf-lib` to `packages/firebase` deps (isolated cache per [[Multi-Agent NPM Concurrency Guardrail]]: `npm install pdf-lib --cache ./.npm-cache-isolated-$$`). Generate a real one-page split-sheet PDF (track, collaborators, percentages, sha256, generated-at, "DRAFT — unsigned" watermark) to `users/{uid}/split_sheets/{docId}.pdf`; keep the existing hashed canonical text as the integrity anchor. Add evidence entry `{type:'storage_object', reference, sha256}`. Acceptance: PDF renders, is byte-stable for identical input, stored uid-scoped; response still states NOT countersigned.

**P2 — `draft_cwr_registration` full file (Legal).** Emit a complete CWR v2.1 transmission: HDR, GRH(NWR), NWR (work title, ISWC when present), SPU/SPT (publisher — or explicit "no publisher" note), SWR/PWR (each writer, IPI, role, ownership share), GRT, TRL with correct group/transaction/record counts and fixed-width fields. Store to `users/{uid}/cwr/{docId}.V21` in GCS. Acceptance: record counts reconcile; unit test parses every record type; response labels it DRAFT (not society-validated, not submitted).

**P3 — `stage_stripe_payouts` real staging (Finance).** Wire to existing `stripe/config.ts` + `stripe/connect.ts` + `stripe/splitEscrow.ts` patterns. For the resolved payout: read split recipients + their Stripe Connect account IDs, call `stripe.accounts.retrieve` to confirm each is `payouts_enabled`/`transfers` capable, compute per-recipient amounts from the real ledger math already present, write a `payoutBatches` doc `status:'staged_pending_approval'` with resolved accounts + amounts + transfer-group id. **Do NOT create/capture transfers** — money movement stays a human-approved action ([[Explicit permission required]]); a separate approver endpoint calls `createTransfer`. Acceptance: real Stripe account status reads; batch reconciles to ledger; no funds move; unaccountable recipient (no/blocked Connect account) surfaces as a blocking warning, not a silent skip.

**P4 — `draft_dsp_metadata_xml` fuller DDEX (Distribution).** Extend the ERN draft to include MessageHeader (sender/recipient placeholders flagged), ResourceList (SoundRecording with ISRC/duration), ReleaseList (Release with UPC/GRid), and a DealList stub with an explicit "commercial terms not set" flag. Keep `mode:'delivery'` hard-requiring real duration/releaseDate. Acceptance: XML is well-formed, escapes all values ([[ISSUE-861]]), `deliveryReady:false` until deal/recipient supplied.

**P5 — `schedule_campaign_waterfall` Inngest execution (Publicist).** Replace `engine:'none'`: dispatch `inngest.send({name:'mcp/campaign.scheduled', data:{campaignId, uid, events}})` and add a consuming Inngest function that, per event date, updates the campaign event status and (for outreach events) sends a Resend email via the existing `sendEmail` helper. Acceptance: campaign doc transitions events planned→scheduled; Inngest function registered + unit-tested; no email fires without the campaign's own opt-in flag.

**P6 — `queue_remotion_render` ffmpeg canvas (Creative).** Dispatch `inngest.send({name:'mcp/render.requested', ...})`; new Inngest/Cloud function pulls the release cover art from Storage, composes a looping (e.g. 3–8s) canvas MP4 at the requested aspect (Spotify 1:1, TikTok/IG 9:16) synced to a clip of the artist's own uploaded audio via `fluent-ffmpeg`, writes to `users/{uid}/canvas/{jobId}.mp4`, updates `mcpRenderJobs` status queued→rendering→complete/failed. Respect Cloud Functions gen2 memory/timeout (2GB/540s pattern already used by `executeVideoJob`). Acceptance: real MP4 produced from a fixture cover+audio; failure path marks job `failed` honestly; NO generated music — audio is strictly the artist's upload.

**P7 — `audit_sample_clearance` (Legal, two-stage).**
  - *P7a interim (buildable now):* check the track's declared `samples`/`interpolations` metadata against a `clearanceStatus` field; return a structured verdict of DECLARED-BUT-UNVERIFIED vs NONE-DECLARED. Never claim a fingerprint match. If the track has no such fields, stay fail-closed.
  - *P7b full (credential-gated — BLOCKED on founder):* integrate an audio-fingerprint provider (ACRCloud or Pex). Requires founder to choose a vendor and supply an API key via GCP Secret Manager (`defineSecret`). Add to `docs/RELEASE_CHECKLIST.md` as a founder action.

**P8 — ISSUE-1092 live verification (BLOCKED on founder cloud action).** Deploy `mcpEndpoint` (and the new Inngest/render functions) via `firebase deploy --only functions`; bind IAM invoker; run a real ID-token → SSE → tool-call round-trip against the deployed endpoint. Founder runs deploy or authorizes gcloud; agent verifies the live round-trip immediately after and records evidence. Only then does ISSUE-1092 acceptance #3 close.

#### Dependencies (encode-build-order rule [[encode-build-order-in-ledger]])

- P1 depends on: pdf-lib install. P2, P4 standalone. P3 depends on: verified split-recipient + Connect-account schema (confirm `stripe_accounts`/`splits` collections). P5, P6 depend on: Inngest function registration in `functions/index.ts`. P6 depends on: cover-art + audio Storage path conventions. P7b + P8 are founder-gated and do not block P0–P6.
- **ISSUE-1092 → FIXED when:** P0 lands AND every tool's response is honest AND P8 live round-trip verified. [P0 ✅ 2026-07-20; P8 still open.]
- **ISSUE-1093 → FIXED when:** P1–P6 land (all buildable backends real) AND P7a lands AND P7b is either done or explicitly accepted-as-vendor-gated by the founder. **[✅ ALL MET 2026-07-20 — founder explicitly accepted P7b as vendor-gated in-session; tracked in `docs/RELEASE_CHECKLIST.md`. ISSUE-1093 marked FIXED.]**

- **Acceptance (this plan entry closes when):** each of P0–P6 + P7a is committed, verified (tsc + vitest + honest-response grep), and its owning tool marked done in the truth table above; P7b + P8 are tracked as founder-gated with matching `docs/RELEASE_CHECKLIST.md` entries. **[P7b entry added 2026-07-20 ("Sample Clearance Fingerprint Vendor"). P8 needs its own RELEASE_CHECKLIST.md entry once deploy runs — see P8 below.]**

---

## Session 2026-07-20 — Computer Execution capability (Execution Layer extension)

> Source: founder-directed audit + design pass. Full architecture in `docs/COMPUTER_EXECUTION_EXTENSION.md`
> (Phase-1 audit answers, extension-point table, provider comparison, security posture).
> Mandate: extend the existing Execution Layer — no redesign, no LangChain, no new orchestrator.
> Audit conclusion: the Layer already dispatches to Electron (Browser Brain–Body–Bridge) and to a
> remote-origin desktop executor (RemoteRelayService + Studio executor lease). Computer = one new
> capability module + one new Electron body.

### ISSUE-1110: CE-1 — Computer capability bridge + read path (screenshot, app list/open, permission preflight)
- **Status:** ✅ FIXED (2026-07-20)
- **Severity:** 🟡 MEDIUM (new capability, foundation slice)
- **Module:** packages/main (handlers/computer.ts, services/ComputerExecutionService.ts, services/computer/{ComputerProvider,NativeMacProvider}.ts, preload.ts), packages/renderer (tools/ComputerTools.ts, ToolRiskRegistry.ts, tools/index.ts), packages/shared (ipc/electron-api.types.ts)
- **Evidence:** No `electronAPI.computer.*` namespace exists; no ComputerTools module in TOOL_REGISTRY. Browser capability proves the pattern (`BrowserTools.ts` → `handlers/agent.ts` → Puppeteer body).
- **Expected (acceptance):** New IPC namespace with `validateSender` + Zod schemas mirroring `handlers/agent.ts`; `ComputerExecutionService` behind a `ComputerProvider` interface; tools `computer_check_permissions` (read), `computer_screenshot` (write), `computer_list_apps` (read), `computer_open_app` (write); macOS TCC preflight (Screen Recording + Accessibility via `systemPreferences.isTrustedAccessibilityClient`) returns actionable guidance, never mid-run failure; web build fails closed with `COMPUTER_DESKTOP_ONLY` (mirror of `BROWSER_DESKTOP_ONLY`); risk entries added to `TOOL_RISK_REGISTRY`; typecheck + lint + `npm test -- --run` green.
- **Closure note:** CE-1 delivers the macOS provider abstraction (`ComputerProvider` interface + `NativeMacProvider` body using only Electron built-ins and `osascript`/`open`, no native modules), the Electron IPC bridge (`handlers/computer.ts` with `validateSender` + Zod on every channel, `electronAPI.computer.*` in preload + shared/renderer types), tool registration into `TOOL_REGISTRY` via `ComputerTools.ts`, approval metadata in `ToolRiskRegistry.ts` (`computer_check_permissions`/`computer_list_apps` read-tier auto-approve; `computer_screenshot`/`computer_open_app` write-tier with `requiresApproval:true`), Zod input validation (`ComputerScreenshotSchema`, `ComputerOpenAppSchema` blocking CLI-flag injection), and desktop-only fail-closed behavior (`COMPUTER_DESKTOP_ONLY`, mirroring `BROWSER_DESKTOP_ONLY`). Typecheck (0 errors), lint (0 errors, warning count unchanged from baseline), and the targeted test suite (49/49 passing) all verified before commit. Committed: `c2f40a9f4ef77e9c5b0416e6f84fc845c19e3324`. CE-1's own acceptance criteria are fully met; input control, the autonomous loop, and remote dispatch are separately gated as ISSUE-1111/1112/1113 and do not block this closure.
- **Depends on:** founder approval of `docs/COMPUTER_EXECUTION_EXTENSION.md` (provider choice: Gemini Computer Use brain + @jitsi/robotjs body). Nothing else — standalone slice.

### ISSUE-1111: CE-2 — Computer input body (click/type/key/scroll) + kill switch + app allowlist, handshake-gated
- **Status:** 🟡 PARTIAL (2026-07-20 — code, IPC/security wiring, and kill-switch/allowlist tests complete; cliclick live-hardware verification and provider unit coverage pending)
- **Severity:** 🟡 MEDIUM
- **Module:** packages/main (`services/computer/{ComputerProvider,NativeMacProvider,ComputerAllowlistStore}.ts`, `services/ComputerExecutionService.ts`, `handlers/computer.ts`, `main.ts`), packages/renderer (`tools/ComputerTools.ts`, `ToolRiskRegistry.ts`)
- **Evidence:** No OS-level input control existed anywhere in the codebase; `execute_code` set the precedent that host-level actions are `destructive / requiresApproval: true`.
- **Expected (acceptance):** `computer_click` / `computer_type` / `computer_key` / `computer_scroll` classified `destructive`, `requiresApproval: true` — unapproved calls pause with `WAITING_ON_HANDSHAKE` via existing DigitalHandshake flow (no engine changes); kill switch (global hotkey + UI stop) checked in main process before EVERY action; app allowlist enforced in main process, not renderer; refuse `type` when macOS SecureInput is active; input provider = maintained robotjs fork (`@jitsi/robotjs`), AppleScript/cliclick fallback if native module packaging fights Electron Forge; NO credential entry ever (system-prompt + main-process enforcement).
- **Delivered (commit `9e4de796c74b078c228831ae1201f9ad1e357591`):** All four tools classified `destructive`/`requiresApproval:true` in `ToolRiskRegistry.ts` — flows through unmodified `DigitalHandshake`. Kill switch (`ComputerExecutionService.abort()/resetAbort()`) checked before every input method; two independent trigger paths (renderer IPC `computer:abort` + main-process global hotkey `Cmd/Ctrl+Shift+Escape`, non-fatal registration, unregistered on quit). App allowlist (`ComputerAllowlistStore`, electron-store-backed) is fail-closed by default (empty list = nothing allowed) and gates `openApp` before dispatch. Every new IPC channel validated via `validateSender` + Zod (`ComputerClickSchema`/`ComputerTypeSchema` with a control-character guard/`ComputerKeySchema`/`ComputerScrollSchema`). Provider chosen: `cliclick` CLI (not `@jitsi/robotjs`) — zero native npm modules, avoids Electron Forge native-module packaging risk documented in `docs/COMPUTER_EXECUTION_EXTENSION.md` §4. Kill-switch and allowlist logic verified via `ComputerExecutionService.test.ts` (8 tests, dependency-injected fake provider) and `ComputerAllowlistStore.test.ts` (5 tests); IPC validation verified via `computer.test.ts` (15 tests). Typecheck/lint/full targeted suite (77/77) green before commit.
- **Residual (keeps this PARTIAL, not FIXED):**
  1. **cliclick command syntax is unverified against real macOS hardware.** The exact argv (`c:`/`dc:`/`rc:`/`t:`/`kp:`/`kd:`/`ku:`/`w:`) is implemented from documented, long-stable cliclick behavior but has not been exercised on a real machine with `cliclick` installed. Must run a live click/type/key/scroll sequence and confirm actual OS behavior before this closes.
  2. **`NativeMacProvider`'s click/type/key/scroll methods have no automated unit test.** An attempt to mock `child_process.execFile` for this file hit a reproducible Vitest module-resolution quirk — this file's own top-level `promisify(execFile)` did not observe the test's `vi.mock('child_process', ...)`, confirmed via two independent runs with consistent, fast (not hung/flaky) failures. Documented in `NativeMacProvider.ts`. A follow-up should resolve this (candidate fix: inject `execFile` via constructor instead of a module-level `promisify` binding) so the class gets real coverage.
  3. **macOS SecureInput detection not implemented.** No verified shell/API method was found to reliably detect `IsSecureEventInputEnabled` from this environment; fabricating one was rejected as dishonest. Currently relies solely on tool-description/system-prompt guidance ("never type credentials") — not enforced at the OS layer. Needs a real solution before acceptance.
  4. **No renderer UI for allowlist management** — `computer:allowlist-*` IPC channels exist but nothing calls them yet; the list must be edited via the persisted store file directly.
- **Depends on:** ISSUE-1110 (✅ FIXED — bridge + provider interface).

### ISSUE-1112: CE-3 — ComputerAgentDriver autonomous loop + `computer_drive` tool + session tracking
- **Status:** 🟡 PARTIAL (2026-07-20 — code + 10 unit tests complete and committed; end-to-end live drive session against real macOS/cliclick not yet verified — inherits ISSUE-1111's residual hardware-verification gap)
- **Severity:** 🟡 MEDIUM
- **Module:** packages/renderer (`ComputerAgentDriver.ts`, `ComputerTools.ts` — `computer_drive`, `core/config/intelligence-models.ts`), Firestore (`users/{uid}/computerSessions/{id}`, new owner-scoped rule)
- **Evidence:** `BrowserAgentDriver.ts` is the proven loop shape (capture → reason → act → repeat, max-step bounded, `INTELLIGENCE_MODELS.BROWSER.AGENT`). No computer equivalent existed.
- **Delivered (commit `15e9558266048b99bc527948ac8a0f64766d2c58`):** `ComputerAgentDriver` mirrors `BrowserAgentDriver` shape exactly — coordinate-space actions instead of CSS selectors. Preflights permissions before starting (fails fast with guidance, not mid-run). Kill switch checked twice per step (loop top + immediately pre-dispatch, since reasoning calls can take seconds). Model: `INTELLIGENCE_MODELS.COMPUTER.AGENT` added reusing `APPROVED_MODELS.BROWSER_AGENT` — no hardcoded literal (Platinum Anti-Pattern #9 clean). `computer_drive` tool classified `destructive`/`requiresApproval:true`. Session doc (`computerSessions`) tracks status/steps/logs only — never raw screenshot frames (`hashScreenshot()` computes SHA-256 for future audit use, per the architecture doc's privacy posture). System prompt explicitly instructs refusal on credential/payment fields. 10 unit tests cover preflight failure (unsupported platform, permissions denied), both kill-switch checks, finish/fail short-circuits, click-dispatch-then-rescreenshot, and max-steps bounding. Typecheck/lint clean, combined CE-1/2/3 suite 87/87 passing.
- **Residual (keeps this PARTIAL):** No live drive session has been run end-to-end against real macOS hardware with `cliclick` installed — this inherits ISSUE-1111's residual gap #1, since `computer_drive` composes the same unverified `NativeMacProvider` input primitives. Closes together with ISSUE-1111's live-verification item.
- **Expected (acceptance):** `ComputerAgentDriver` mirrors the browser loop with coordinate action space; model resolved from new `INTELLIGENCE_MODELS.COMPUTER.AGENT` config key — NO hardcoded model/endpoint IDs (Platinum Anti-Pattern #9; `/plat` grep must stay clean); `computer_drive` registered as `destructive / requiresApproval: true`; session doc tracks status + per-step action log (screenshot hashes/metadata only, never raw frames in Firestore); kill switch re-checked every step; per-step audit inherited from BaseAgent loop (`agent_audit` + GEAP fingerprints) verified present.
- **Depends on:** ISSUE-1111 (input body).

### ISSUE-1113: CE-4 — Remote dispatch of computer tasks (phone/cloud → desktop) via existing relay + lease
- **Status:** 🔴 OPEN
- **Severity:** 🟢 LOW (later phase; desktop-local value ships without it)
- **Module:** packages/renderer (RemoteRelayService command vocabulary, StudioExecutorLeaseService integration), packages/firebase (lease validation)
- **Evidence:** `RemoteRelayService.ts` (Firestore broker: `users/{uid}/remote-relay-commands` → desktop → `remote-relay-responses`) and `issueStudioExecutorLease` already ship — computer tasks are a new command type on an existing channel.
- **Expected (acceptance):** New relay command `{type: 'computer_task', goal, constraints}`; desktop executes ONLY while holding a valid executor lease; remote-originated tasks always land in the handshake/memory-inbox approval queue — never auto-approved in v1; response carries session doc reference.
- **Depends on:** ISSUE-1112 (driver + sessions).

### ISSUE-1114: CE-5 — Computer capability hardening (Windows provider, session-scoped grants, redaction)
- **Status:** 🔴 OPEN
- **Severity:** 🟢 LOW (post-MVP hardening)
- **Module:** packages/main (NativeWinProvider, secure-input coverage), packages/renderer (session-scoped approval grants)
- **Evidence:** CE-1..CE-3 target macOS first (founder's machine); Windows desktop target exists (NSIS build) and will need parity.
- **Expected (acceptance):** Windows input/screenshot provider behind the same `ComputerProvider` interface; session-scoped approval grants (approve once per drive session instead of per-action) as a DigitalHandshake-compatible relaxation; screenshot redaction pass before any frame leaves the machine; `/plat` GO verdict on the full capability.
- **Depends on:** ISSUE-1112 (mac path proven). Windows work parallelizable with ISSUE-1113.

#### Dependencies (encode-build-order rule [[encode-build-order-in-ledger]])

- Build order: **1110 → 1111 → 1112 → {1113, 1114 in parallel}**.
- 1110 is gated on ONE founder decision: approve the architecture in `docs/COMPUTER_EXECUTION_EXTENSION.md` (brain = Gemini Computer Use via Vertex, body = @jitsi/robotjs local). Rejected alternatives recorded there: LangChain (redesign — forbidden), Anthropic/OpenAI CUA (second vendor, fallback only), Browserbase/Stagehand (browser-only, future cloud target).
- No entry here blocks or is blocked by the MCP backend plan (ISSUE-1100 P-series) — independent tracks.
