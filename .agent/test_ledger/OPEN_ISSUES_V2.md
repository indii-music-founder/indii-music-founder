# Open Issues — Real-Life Test Findings (V2, ACTIVE)

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-07-22 (**REPAIR-ORDER STEP 1 IS COMPLETE — ISSUE-1193..1197 all ✅ FIXED and on `main` (commits `ef9526c7a`, `86486670c`; CI 29942881908 green 25/25). The critical timeline data-loss path is closed. Step 2 of the founder repair order — durable ingestion generation-claiming and worker execution, ISSUE-1175 — is now the front of the queue.** **Repo-wide perf/bloat audit appended — ISSUE-1198..1209, findings only, nothing fixed yet.** **STEP-1 AUDIT of ISSUE-1180 appended — ISSUE-1193..1197; ISSUE-1193 is CRITICAL and is the first thing to fix in the whole repair order.** FOUNDER ASSESSMENT block appended at end of file — ISSUE-1175..1181 scope corrected and a binding 6-step repair order recorded; read it before touching Session Breakdown.** ISSUE-1187 fixed for real and its premature ✅ corrected; `/qa` unit-suite verification ISSUE-1191..1192; browser QA sweep ISSUE-1185..1190 — 1185/1186/1187 fixed, 1188..1190 open; earlier: ISSUE-1110..1114 Computer Execution plan, ISSUE-1095..1099 audit + fixes)
> **Branch:** `main` (direct commits)
>
> **Ledger protocol (V2):** This is the ACTIVE master ledger. It operates exactly like the original:
> same entry format (`### ISSUE-NNNN: <title>` with Status/Severity/Module/Evidence/Impact/Fix/Acceptance),
> same status vocabulary (🔴 OPEN / 🟡 PARTIAL / ✅ FIXED / WONTFIX), same append-only discipline.
> Issue numbering CONTINUES from the archive — entries ≤ ISSUE-1089 live in
> `archive/OPEN_ISSUES_LEGACY_2026-07-21.md` (sealed archive, 1.7MB+; never renumber,
> never move entries between files). New entries start
> at ISSUE-1092 and are appended HERE. ISSUE-1090 and ISSUE-1091 already
> identify unrelated archived issues, so they are intentionally not reused.
> Cross-references like ISSUE-1083 resolve in the archive.
> When searching for a pattern, grep BOTH files.

## Session 2026-07-18 — A2A Swarm MCP Integration (remote tool backbone)

### ISSUE-1092: A2A Swarm MCP integration — remote tool suite wired end-to-end but not yet functional or live-verified

- **Status:** ✅ FIXED (2026-07-21 — live SSE round-trip verified against the deployed endpoint with a real Firebase ID token: `listTools()` returned all 11 real tools; `callTool('audit_sample_clearance', {trackId: 'live-verify-nonexistent-track'})` executed the real handler and returned an honest `NOT_FOUND` — no fabricated success. All acceptance items below now hold.
  **CRITICAL DISCOVERY en route:** the deployed `mcpEndpoint` was NOT running any of the 11 real tools at all — `mcp/registry.ts`'s `McpToolRegistry` (the per-session, auth-aware dispatcher this issue's evidence log described as already built) was imported by zero files in the entire codebase. The live function was a stale pre-registry relic: one hardcoded tool inlined with duplicate logic, a single shared `Server` instance, and ZERO auth verification. Rewired `mcp/index.ts` to actually instantiate `McpToolRegistry` with all 11 tools, verify `Bearer <Firebase ID token>` via `admin.auth().verifyIdToken()`, and bind a fresh `Server` per SSE session (commit f0ea412f1).
  **Four more real bugs found via live testing, each fixed and redeployed in turn:** (1) Gen1 (`firebase-functions/v1`) hard-kills any connection at its ~60s execution ceiling — architecturally incompatible with SSE's stay-open-indefinitely model; migrated to Gen2/Cloud Run (commit 0ed982938). (2) `req.baseUrl`/`req.originalUrl` don't carry the `/mcpEndpoint` function-name prefix internally (platform strips it before Express sees the request) — the advertised `/message` URL 404'd until reconstructed from the Host header (commits 5125259f7, 1fdcd7813). (3) `req.protocol` reports `http` even for real HTTPS callers (TLS terminates at the load balancer) — fixed via `trust proxy` + hardcoded `https://` (commit 1fdcd7813). (4) Firebase Functions v2 pre-parses the JSON body, draining the stream before the MCP SDK's own `getRawBody()` call — fixed by passing `req.body` as `handlePostMessage`'s `parsedBody` argument (commit 8b6951e8a).
  IAM invoker binding remains deliberately unbound — tracked separately under ISSUE-1086, not a blocker for this issue's own acceptance criteria (the real auth boundary is the Bearer-token check inside Express, by design; see acceptance #1 below).)
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
- **Acceptance (all hold as of 2026-07-21):**
  1. [FIXED] **Job queues have real consumers or explicit no-auto-processing labels.** P0 (commit ed8890269) + P3/P5/P6 (Stripe Connect staging, Inngest campaign dispatch, ffmpeg canvas render) landed. `payoutJobs`/`mcpRenderJobs`/`campaigns`/`payoutBatches` are each either processed or explicitly labeled as durable intents.
  2. [FIXED] **Ownership verification** — ISSUE-1096's `verifyReleaseOwnership` helper checks real Firestore ownership against the authenticated uid; the decorative args-derived pattern is gone from all 8 affected tools.
  3. [FIXED 2026-07-21] **Live verification:** real ID-token → SSE → tool-call round-trip run against the deployed `mcpEndpoint` and confirmed working end to end (see Status above for the full defect chain found and fixed to get here). IAM invoker binding stays intentionally unbound — tracked under ISSUE-1086, not required for this acceptance item since the Bearer-token check is the actual auth boundary by design.
  4. [FIXED] **Firestore rules** for job collections strictly scope read/write/delete to `initiatorUid`; client writes denied entirely.
  5. [FIXED] **E2E hardening:** `mcp-a2a-routing.spec.ts` mock/timeout issues resolved.
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

- **Status:** ✅ CLOSED (2026-07-21 housecleaning — register + code-review gate built and verified. Remaining work is founder-only asset-by-asset evidence collection, tracked in `docs/RELEASE_CHECKLIST.md` § "Intellectual Property & Value Evidence". Not an engineering issue; removed from the open ledger per founder directive.)
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

- **Status:** ✅ FIXED (2026-07-21 — P0–P8 ALL LANDED, commits ed8890269 / a770ac1f0 / 2ad295172 / 966393107 / 27a901787 / 4c4bf088f / acb3cf981 / 68fb3a399 / f0ea412f1 / 0ed982938 / 5125259f7 / 1fdcd7813 / 8b6951e8a. P8 live verification is done: real ID-token → SSE → tool-call round-trip confirmed against the deployed `mcpEndpoint`, see ISSUE-1092 for the full defect chain that surfaced and got fixed along the way. **P7b remains tracked as a founder action item in `docs/RELEASE_CHECKLIST.md` ("Sample Clearance Fingerprint Vendor") per founder directive 2026-07-20 — explicitly accepted as vendor-gated, not a plan blocker.**)
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

- P1 depends on: pdf-lib install. P2, P4 standalone. P3 depends on: verified split-recipient + Connect-account schema (confirm `stripe_accounts`/`splits` collections). P5, P6 depend on: Inngest function registration in `functions/index.ts`. P6 depends on: cover-art + audio Storage path conventions. P7b is founder-gated and does not block P0–P8.
- **ISSUE-1092 → FIXED when:** P0 lands AND every tool's response is honest AND P8 live round-trip verified. **[✅ ALL MET 2026-07-21 — P0 landed 2026-07-20; P8 live SSE round-trip verified 2026-07-21 with a real Firebase ID token against the deployed mcpEndpoint. ISSUE-1092 marked FIXED.]**
- **ISSUE-1093 → FIXED when:** P1–P6 land (all buildable backends real) AND P7a lands AND P7b is either done or explicitly accepted-as-vendor-gated by the founder. **[✅ ALL MET 2026-07-20 — founder explicitly accepted P7b as vendor-gated in-session; tracked in `docs/RELEASE_CHECKLIST.md`. ISSUE-1093 marked FIXED.]**

- **Acceptance (this plan entry closes when):** each of P0–P6 + P7a is committed, verified (tsc + vitest + honest-response grep), and its owning tool marked done in the truth table above; P7b is tracked as founder-gated with a matching `docs/RELEASE_CHECKLIST.md` entry; P8 live round-trip is verified against the deployed endpoint. **[ALL MET. P7b entry added 2026-07-20 ("Sample Clearance Fingerprint Vendor"). P8 verified live 2026-07-21 — five real defects found and fixed along the way (dead registry never wired to any endpoint, Gen1→Gen2 migration, message-URL prefix reconstruction, trust-proxy HTTPS detection, parsedBody stream fix); see ISSUE-1092 for full detail. This plan entry is CLOSED.]**

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
- **Status:** ✅ FIXED (2026-07-21 — closed by explicit founder decision after a real, documented live-test attempt; see SPECIAL NOTE below)
- **⚠️ SPECIAL NOTE — closure basis, read before trusting this as "verified":** This is closed on the same basis as ISSUE-1114, not because live hardware verification succeeded outright. What actually happened: cliclick's core input mechanism was proven genuinely functional on real hardware across three live rounds (see the round 1–3 log below) — round 2 proved raw cursor movement, and round 3 *accidentally proved the full type+submit path end-to-end* when a test command landed in an unrelated Claude chat window and was sent as a message there (no destructive effect; a stray nonsense chat message, confirmed by the founder via screenshot). That incident is real evidence the mechanism works completely — just not evidence it reliably targets the INTENDED window on a busy multi-session desktop, which is a materially different and more important property for a tool that will eventually control a user's real desktop autonomously. Live testing was stopped immediately after that incident rather than risk a repeat. The founder then made an informed decision to close this issue and move on rather than keep attempting live verification in an environment that already produced one real (if minor) misfire. Residual items 1–3 below are accepted risk, not resolved; item 4 was independently completed with real code and tests, unrelated to the live-test question.
- **Severity:** 🟡 MEDIUM
- **Module:** packages/main (`services/computer/{ComputerProvider,NativeMacProvider,ComputerAllowlistStore}.ts`, `services/ComputerExecutionService.ts`, `handlers/computer.ts`, `main.ts`), packages/renderer (`tools/ComputerTools.ts`, `ToolRiskRegistry.ts`)
- **Evidence:** No OS-level input control existed anywhere in the codebase; `execute_code` set the precedent that host-level actions are `destructive / requiresApproval: true`.
- **Expected (acceptance):** `computer_click` / `computer_type` / `computer_key` / `computer_scroll` classified `destructive`, `requiresApproval: true` — unapproved calls pause with `WAITING_ON_HANDSHAKE` via existing DigitalHandshake flow (no engine changes); kill switch (global hotkey + UI stop) checked in main process before EVERY action; app allowlist enforced in main process, not renderer; refuse `type` when macOS SecureInput is active; input provider = maintained robotjs fork (`@jitsi/robotjs`), AppleScript/cliclick fallback if native module packaging fights Electron Forge; NO credential entry ever (system-prompt + main-process enforcement).
- **Delivered (commit `9e4de796c74b078c228831ae1201f9ad1e357591`):** All four tools classified `destructive`/`requiresApproval:true` in `ToolRiskRegistry.ts` — flows through unmodified `DigitalHandshake`. Kill switch (`ComputerExecutionService.abort()/resetAbort()`) checked before every input method; two independent trigger paths (renderer IPC `computer:abort` + main-process global hotkey `Cmd/Ctrl+Shift+Escape`, non-fatal registration, unregistered on quit). App allowlist (`ComputerAllowlistStore`, electron-store-backed) is fail-closed by default (empty list = nothing allowed) and gates `openApp` before dispatch. Every new IPC channel validated via `validateSender` + Zod (`ComputerClickSchema`/`ComputerTypeSchema` with a control-character guard/`ComputerKeySchema`/`ComputerScrollSchema`). Provider chosen: `cliclick` CLI (not `@jitsi/robotjs`) — zero native npm modules, avoids Electron Forge native-module packaging risk documented in `docs/COMPUTER_EXECUTION_EXTENSION.md` §4. Kill-switch and allowlist logic verified via `ComputerExecutionService.test.ts` (8 tests, dependency-injected fake provider) and `ComputerAllowlistStore.test.ts` (5 tests); IPC validation verified via `computer.test.ts` (15 tests). Typecheck/lint/full targeted suite (77/77) green before commit.
- **Residual (accepted, not fully resolved — see SPECIAL NOTE):**
  1. **cliclick's exact mechanism is proven functional; safe targeting on a busy desktop is not.** The argv (`c:`/`dc:`/`rc:`/`t:`/`kp:`/`kd:`/`ku:`/`w:`) is confirmed real and executable — see the live attempt log below. What remains genuinely open: a clean run where the click/type/key/scroll sequence provably lands on the INTENDED window, not just some window. Accepted as residual risk rather than continuing to test live.
     - **2026-07-21 live attempt, round 1 (founder-approved):** Installed `cliclick` 5.1 via Homebrew on the actual dev machine — real binary, confirmed working (`cliclick p` returns a live cursor position). Attempted `cliclick c:100,100`; issued without a syntax error but its real effect was unverifiable — both `osascript -e 'tell application "System Events" to get UI elements enabled'` (returned `false`) and `screencapture` (failed: "could not create image from display") confirmed this process held neither Accessibility nor Screen Recording TCC permission. Both are one-way grants a human must click in System Settings → Privacy & Security.
     - **2026-07-21 live attempt, round 2 (founder granted Accessibility, retried):** `osascript "UI elements enabled"` now returns `true` — Accessibility is genuinely granted. **Real positive result: raw cursor movement works.** `cliclick m:513,327` followed by `cliclick p` confirmed the physical cursor moved to the exact commanded coordinate — proves cliclick's core CGEventPost mechanism is functional on this machine with Accessibility granted, not merely installed. However, the full click+type+key sequence into a target app (a scratch TextEdit document) could not be cleanly verified end-to-end: across four attempts (separate calls, immediate refocus-check, single chained invocation, fully consolidated one-shot activate+click+type+read) the target window repeatedly lost frontmost status to the Claude Desktop app hosting this very session between setup and cliclick execution (`osascript "get name of first application process whose frontmost is true"` returned `Claude`, not `TextEdit`, immediately after the click) — a real characteristic of running a live GUI-automation test on the same machine actively hosting this session, not a `cliclick` or `NativeMacProvider.ts` defect. One readback did show 2 of the 17 typed characters ("Cl") landed somewhere, consistent with a focus race rather than a total failure. Screen Recording remains ungranted, so visual confirmation independent of AppleScript readback was also unavailable this round. Stopped after four genuinely-diagnosed attempts (each with a different root-cause hypothesis, not blind repetition) per the anti-looping standard rather than continuing to guess at workarounds.
     - **2026-07-21 live attempt, round 3 (founder-reported real incident):** The round-2 `t:cliclick-verify-12345 kp:return` sequence did NOT go nowhere — it landed in a *different* open Claude Code chat session on the same machine (not TextEdit, not this session) and, because the sequence included `kp:return`, it was actually submitted as a message there. Founder confirmed via screenshot: a stray `cliclick-verify-12345cliclick-verify-12345`-type string appeared as a sent message in an unrelated conversation. No destructive or externally-visible effect (a nonsense chat message, nothing sent outside the app, nothing deleted), but this is a real, concrete instance of exactly the failure mode CE-2's design (kill switch, per-action approval gate, app allowlist) exists to prevent in production: an input-simulation action landing on the wrong target in a busy multi-window desktop. Live cliclick testing was stopped immediately after this was reported rather than risk a repeat in some other window.
     - **Net assessment:** This is now the strongest evidence gathered — round 3 *proves* cliclick's `t:`/`kp:` mechanism genuinely types and submits on real hardware end-to-end (it worked completely, just against the wrong window). The residual gap is no longer "does cliclick work" — it demonstrably does — but "was this specific live-test methodology (activate a target app, click, type, on a machine with several active Claude sessions open) safe enough to keep running," and the answer that emerged live was no. A clean, safe re-test needs either a machine/session dedicated to nothing else while the test runs, or Screen Recording granted so the target can be visually confirmed before any type/key command fires — not just an activate-and-hope approach.
  2. **`NativeMacProvider`'s click/type/key/scroll methods have no automated unit test.** An attempt to mock `child_process.execFile` for this file hit a reproducible Vitest module-resolution quirk — this file's own top-level `promisify(execFile)` did not observe the test's `vi.mock('child_process', ...)`, confirmed via two independent runs with consistent, fast (not hung/flaky) failures. Documented in `NativeMacProvider.ts`. A follow-up should resolve this (candidate fix: inject `execFile` via constructor instead of a module-level `promisify` binding) so the class gets real coverage. Still open.
  3. **macOS SecureInput detection not implemented.** No verified shell/API method was found to reliably detect `IsSecureEventInputEnabled` from this environment; fabricating one was rejected as dishonest. Currently relies solely on tool-description/system-prompt guidance ("never type credentials") — not enforced at the OS layer. Still open; needs a real solution from someone with a verified technique.
  4. **✅ RESOLVED (2026-07-21, commit `e1865d37f...`):** Renderer UI for allowlist management. Added directly to the Approvals panel (`ToolApprovalsPanel.tsx`) — add/remove apps, live list, fail-closed semantics preserved (empty list still means nothing allowed). 7 new component tests (empty state, unavailable-desktop state, add via click, add via Enter, remove, error-toast on failure, disabled-on-blank-input). This item is genuinely done, independent of the live-hardware question above.
- **Live cliclick attempt log (2026-07-21, founder-approved):**
  - **Round 1:** Installed `cliclick` 5.1 via Homebrew on the real dev machine — binary confirmed working (`cliclick p` returns a live cursor position). `cliclick c:100,100` issued without a syntax error but its effect was unverifiable: neither Accessibility nor Screen Recording TCC permission was granted to this process (`osascript "UI elements enabled"` → `false`; `screencapture` → "could not create image from display"). Both require a human to grant them in System Settings — no automated process can self-grant.
  - **Round 2 (founder granted Accessibility):** `osascript "UI elements enabled"` now `true`. **Proven: raw cursor movement works** — `cliclick m:513,327` then `cliclick p` confirmed the physical cursor moved to the exact commanded coordinate. The full click+type+key sequence into a target TextEdit document could not be cleanly verified across four differently-diagnosed attempts (separate calls, immediate refocus-check, chained single invocation, fully consolidated one-shot) — the target window repeatedly lost frontmost status to the Claude Desktop app hosting this session. Screen Recording remained ungranted, so no independent visual check was possible either.
  - **Round 3 (real incident, founder-reported):** The round-2 `t:cliclick-verify-12345 kp:return` sequence landed in a *different* open Claude Code chat window and was actually submitted as a message there (confirmed via founder screenshot). No destructive or externally-visible effect. **This proves the full type+submit mechanism works end-to-end on real hardware** — just against the wrong window. Live testing stopped immediately after.
  - **Conclusion:** cliclick is proven functional, not merely installed. The open question shifted from "does it work" to "can it be safely tested on a desktop with several active sessions" — the answer that emerged live was no, for this environment, today. Founder decision: close as FIXED, document the real risk, move on. Re-verification would need a dedicated test machine/session or Screen Recording granted for pre-action visual confirmation.
- **Depends on:** ISSUE-1110 (✅ FIXED — bridge + provider interface).

### ISSUE-1112: CE-3 — ComputerAgentDriver autonomous loop + `computer_drive` tool + session tracking
- **Status:** ✅ FIXED (2026-07-21 — closed by explicit founder decision; inherits ISSUE-1111's closure basis, see SPECIAL NOTE there)
- **Severity:** 🟡 MEDIUM
- **Module:** packages/renderer (`ComputerAgentDriver.ts`, `ComputerTools.ts` — `computer_drive`, `core/config/intelligence-models.ts`), Firestore (`users/{uid}/computerSessions/{id}`, new owner-scoped rule)
- **Evidence:** `BrowserAgentDriver.ts` is the proven loop shape (capture → reason → act → repeat, max-step bounded, `INTELLIGENCE_MODELS.BROWSER.AGENT`). No computer equivalent existed.
- **Delivered (commit `15e9558266048b99bc527948ac8a0f64766d2c58`):** `ComputerAgentDriver` mirrors `BrowserAgentDriver` shape exactly — coordinate-space actions instead of CSS selectors. Preflights permissions before starting (fails fast with guidance, not mid-run). Kill switch checked twice per step (loop top + immediately pre-dispatch, since reasoning calls can take seconds). Model: `INTELLIGENCE_MODELS.COMPUTER.AGENT` added reusing `APPROVED_MODELS.BROWSER_AGENT` — no hardcoded literal (Platinum Anti-Pattern #9 clean). `computer_drive` tool classified `destructive`/`requiresApproval:true`. Session doc (`computerSessions`) tracks status/steps/logs only — never raw screenshot frames (`hashScreenshot()` computes SHA-256 for future audit use, per the architecture doc's privacy posture). System prompt explicitly instructs refusal on credential/payment fields. 10 unit tests cover preflight failure (unsupported platform, permissions denied), both kill-switch checks, finish/fail short-circuits, click-dispatch-then-rescreenshot, and max-steps bounding. Typecheck/lint clean, combined CE-1/2/3 suite 87/87 passing.
- **Residual (accepted, same as ISSUE-1111):** No live drive session has been run end-to-end against real macOS hardware — `computer_drive` composes the same `NativeMacProvider` input primitives whose live-test attempt (log in ISSUE-1111) proved the underlying mechanism works but surfaced a real wrong-window incident before a clean full-loop run could be completed. Closed together with ISSUE-1111 on the same founder decision, not because this item was independently re-verified.
- **Expected (acceptance):** `ComputerAgentDriver` mirrors the browser loop with coordinate action space; model resolved from new `INTELLIGENCE_MODELS.COMPUTER.AGENT` config key — NO hardcoded model/endpoint IDs (Platinum Anti-Pattern #9; `/plat` grep must stay clean); `computer_drive` registered as `destructive / requiresApproval: true`; session doc tracks status + per-step action log (screenshot hashes/metadata only, never raw frames in Firestore); kill switch re-checked every step; per-step audit inherited from BaseAgent loop (`agent_audit` + GEAP fingerprints) verified present.
- **Depends on:** ISSUE-1111 (input body).

### ISSUE-1113: CE-4 — Remote dispatch of computer tasks (phone/cloud → desktop) via existing relay + lease
- **Status:** ✅ FIXED (2026-07-21 — approval-queue property restored by ISSUE-1116's real gate; own acceptance criteria fully met)
- **Severity:** 🟢 LOW (later phase; desktop-local value ships without it)
- **Module:** packages/renderer (`RemoteRelayService.ts` — `AgentDispatchTask.type: 'computer_task'`, `useRemoteCommandListener.ts` — dispatch switch case + `validateComputerTaskDispatch`/`buildComputerTaskInstruction`)
- **Evidence:** `RemoteRelayService.ts`'s existing `agent_dispatch_queue` mechanism (Firestore: `users/{uid}/agent_dispatch_queue` → atomic claim → desktop executes → status update) and `studioExecutorLeaseService.getLease()` already shipped — computer tasks reuse this exact channel as a new `AgentDispatchTask.type`, not a new collection.
- **Expected (acceptance):** New dispatch type `{type: 'computer_task', payload: {goal, constraints}}`; desktop executes ONLY while holding a valid executor lease; remote-originated tasks always land in an approval queue — never auto-approved in v1; response carries session doc reference.
- **Delivered (commit `a21e73ec0e3dff1760c2b3736e67d05cd93e8f39`):** `computer_task` added to `AgentDispatchTask.type` union with `goal`/`constraints` payload fields. `useRemoteCommandListener.ts`'s dispatch switch gained a `computer_task` case with two real, effective guards on top of the atomic claim every dispatch type already shares: (1) desktop must be the Electron Studio app (`window.electronAPI.computer` present), (2) desktop must hold a currently-valid executor lease (`studioExecutorLeaseService.getLease()` — throws and fails the task if not). The goal routes through `agentService.sendMessage()`, matching every sibling dispatch type's pattern exactly (no bespoke execution path). Two pure functions extracted and tested (`validateComputerTaskDispatch`, `buildComputerTaskInstruction`), 7 new unit tests, combined CE-1..4 suite 156/156 passing.
- **Closure note (2026-07-21):** This entry previously carried a retracted claim — the original commit stated a phone-originated task "always lands in an approval queue — never auto-approved," attributing this to `computer_drive`'s `DigitalHandshake`/`requiresApproval` classification, which was false at the time (see ISSUE-1116). **ISSUE-1116 is now fixed** (commit `3afa3b87b4f64f2b69473b77c7bb56f0869e4673`): `BaseAgent.ts`'s dispatch loop now genuinely halts before executing any `requiresApproval:true` tool and persists a pending approval. Since `computer_drive` carries that classification, a `computer_task` dispatched from a phone now, in fact, always pauses for human approval before the desktop takes any action — the originally-claimed property is real. ISSUE-1113's own acceptance criteria (dispatch type, lease check, desktop-app check, approval-queue property) are therefore all met; it does not inherit ISSUE-1111/1112's live-cliclick-hardware gap because that gap is about whether the underlying input primitive *works*, not whether this issue's own relay/lease/approval logic is correct — same reasoning already used to close ISSUE-1110 independent of downstream hardware gaps.
- **Depends on:** ISSUE-1112 (driver + sessions) — done. ISSUE-1116 — done.

### ISSUE-1114: CE-5 — Computer capability hardening (Windows provider, session-scoped grants, redaction)
- **Status:** ✅ FIXED (2026-07-21 — closed by explicit founder decision; see SPECIAL NOTE below)
- **⚠️ SPECIAL NOTE — closure basis differs from every other FIXED entry in this ledger:** Every other item closed FIXED in this track (1110, 1113) was closed because live verification was either obtained or genuinely not applicable to that item's own scope. `NativeWinProvider`'s click/type/key/scroll/listApps/openApp code has **never been run on real Windows hardware**, because none exists anywhere in this development environment — not "blocked pending a permission grant" like ISSUE-1111/1112 (which a human CAN unblock), but structurally impossible here regardless of any action anyone takes in this environment. The founder made an explicit, informed decision (2026-07-21) to close this as FIXED anyway, accepting that residual risk rather than leaving it open indefinitely for something this environment can never resolve. If `NativeWinProvider` is ever exercised on real Windows and something in its PowerShell/SendKeys/`mouse_event` argv is wrong, that is a live bug in code that was shipped unverified by design — not a regression from a previously-working state. Treat any future Windows-path bug report against this code with that context, not as "how did this regress."
- **Severity:** 🟢 LOW (post-MVP hardening)
- **Module:** packages/main (`services/computer/{NativeWinProvider,redactScreenshot}.ts`, `services/ComputerExecutionService.ts` — session grants + platform selection, `handlers/computer.ts` — grant channels), `packages/main/src/services/computer/NativeMacProvider.ts` (redaction applied retroactively)
- **Evidence:** CE-1..CE-3 targeted macOS first (founder's machine); Windows desktop target exists (NSIS build) and needed parity.
- **Expected (acceptance):** Windows input/screenshot provider behind the same `ComputerProvider` interface; session-scoped approval grants (approve once per drive session instead of per-action) as a future DigitalHandshake-compatible relaxation; screenshot redaction pass before any frame leaves the machine; `/plat` GO verdict on the full capability.
- **Delivered (commit `01b86e93bf19fc40d7271bbbe88a452759a987a6`):**
  1. **`NativeWinProvider`** — full `ComputerProvider` implementation (screenshot reuses the identical cross-platform Electron `desktopCapturer`/`screen` call NativeMacProvider uses; listApps/openApp/click/type/key/scroll shell out to bundled PowerShell, no external install required). `ComputerExecutionService.defaultProviderForPlatform()` now resolves mac/win32/null; `getPermissionStatus()` gained a Windows branch (no TCC model there — reports supported+granted without calling macOS-only APIs).
  2. **Session-scoped approval grants** — `grantSession`/`revokeGrant`/`hasActiveGrant`/`getGrant` on `ComputerExecutionService`, TTL-based expiry, 3 new IPC channels (`validateSender` + Zod). Real, fully tested (6 dedicated tests: grant/revoke/expiry/independence/defaults). **Not wired into any enforcement point** — building Computer-only enforcement here would create a second approval system inconsistent with whatever ISSUE-1116 eventually builds platform-wide, so this exposes the primitive and stops there, same reasoning as its ledger note already states.
  3. **`redactScreenshotPng`** — strips PNG ancillary metadata chunks (tEXt/zTXt/iTXt/eXIf/tIME) that can leak OS username/software-version/timestamp strings, applied in both providers' `screenshot()`. Pure function, 7 dedicated tests including malformed-input safety. Deliberately scoped to metadata only, not pixel content — the model needs to see the real screen to act, so redacting arbitrary "sensitive" on-screen regions has no concrete, buildable definition.
  4. **`/plat` GO verdict obtained** on the full CE-1..5 capability: hygiene/revert/anti-pattern gates PASS, typecheck PASS (0 errors), lint PASS (0 errors, baseline warnings), full monorepo test suite PASS (5089 passed, 52 pre-existing skips, 0 failed), functional build PASS via `build:studio` (the literal `npm run build` command is blocked by a pre-existing production-secrets preflight gate unrelated to this code — confirmed the compiled `dist/main`/`dist/preload` bundles contain the CE-5 code). One new Error Ledger entry recorded (Vitest `child_process`/`promisify` module-resolution quirk hit while testing the providers).
- **Residual (accepted, not resolved — see SPECIAL NOTE):** `NativeWinProvider`'s PowerShell-based click/type/key/scroll/listApps/openApp implementations have not been exercised against real Windows hardware or a real Electron process on Windows, and cannot be in this environment (no Windows machine exists here at all — unlike ISSUE-1111/1112's mac gap, which is a permission grant away from being testable). The exact PowerShell/SendKeys/`mouse_event` invocations are implemented from documented, long-stable .NET/Win32 APIs but remain unverified live. Session-scoped grants and screenshot redaction (the other two deliverables) have no hardware dependency and are fully verified — only the Windows input/screenshot provider itself carries this accepted risk.
- **Depends on:** ISSUE-1112 (mac path proven — done, PARTIAL for the same class of reason). Windows work was parallelizable with ISSUE-1113 (now ✅ FIXED, since its own gap was ISSUE-1116, unrelated to Windows hardware).

### ISSUE-1115: Artist Operating Profile (AOP) as a first-class execution input — not yet built
- **Status:** ✅ CLOSED (RE-TICKETED → ISSUE-1172, 2026-07-21 housecleaning — content moved verbatim to OPEN_ISSUES_V2.md; this entry retained for history only)
- **Severity:** 🟢 LOW (design/data-model gap, no immediate consumer)
- **Module:** none yet — no code exists for this. Candidate: new Firestore doc `users/{uid}/aop` (or similar), read by `DigitalHandshake`/`ComputerExecutionService` at decision time.
- **Evidence:** Founder-shared architecture note (2026-07-20 chat) describes execution decisions as informed by an "Artist Operating Profile" — preferences, business goals, creative boundaries, permissions, installed software, connected services, security policies, automation preferences. Today that information is scattered: static tool config in `ToolRiskRegistry.ts`, per-directive compute allocation in `DigitalHandshake.ts`, no per-user record of e.g. "has this artist opted into autonomous computer control" or "is `cliclick` installed on this machine."
- **Expected (acceptance):** Not specified yet — this entry exists to record the gap, not to scope the build. A future pass should define the AOP schema, decide where it's read from (Firestore vs local store vs both), and identify the first real consumer (candidate: CE-4's remote-task approval flow, so a phone-originated `computer_task` checks AOP permissions in addition to the executor lease).
- **Depends on:** Nothing. Does not block ISSUE-1113/1114 and is not scheduled ahead of them — logged for future prioritization only, per explicit founder instruction to work the encoded order without inserting new work ahead of it.

### ISSUE-1116: CRITICAL — ToolRiskRegistry.requiresApproval is not enforced for direct (non-A2A) tool calls
- **Status:** ✅ FIXED (2026-07-21 — real live end-to-end verification obtained, see LIVE VERIFICATION below)
- **Severity:** 🔴 CRITICAL (affects every `requiresApproval: true` tool in `TOOL_REGISTRY`, not just Computer)
- **Module:** packages/renderer/src/services/agent (`BaseAgent.ts` tool-dispatch loop, `governance/ToolApprovalService.ts` — new, `ToolRiskRegistry.ts`), `packages/renderer/src/core/components/right-panel/ToolApprovalsPanel.tsx` — new, `packages/firebase/firestore.rules`
- **Evidence:** Traced the full call chain for a normal single-agent turn (`agentService.sendMessage()` → `BaseAgent.ts`'s tool loop → `wrapTool()` → the tool function): `wrapTool()` calls `fn(args, ...)` immediately with no pre-execution risk check. `BaseAgent.ts` had no `getToolRiskMetadata`/`DigitalHandshake` reference near tool dispatch — its only approval mechanism (`resultStatus === 'AWAITING_HUMAN'`) is *tool-initiated after the tool already ran*, not a pre-call gate. `DigitalHandshake.require()` is called from exactly one place, `A2AClient.ts` (`consult_specialist` / agent-to-agent calls) — never from the primary `TOOL_REGISTRY` dispatch path that every directly-called tool (including all `ComputerTools`) goes through. Also confirmed: `DigitalHandshake`'s own `pingMemoryInbox` write target (`users/{uid}/memoryInbox`) has zero UI consumers — grepped before building anything, to avoid inventing a parallel mechanism if one already existed.
- **Impact:** Every tool classified `requiresApproval: true` — `execute_code`, `rotate_credentials`, `deploy_storefront_preview`, `trigger_digital_signature`, and (added in CE-2/CE-3) `computer_click`/`computer_type`/`computer_key`/`computer_scroll`/`computer_drive` — executed immediately the moment the model decided to call it, with zero pause, zero approval prompt, zero enforcement of the classification. This was a pre-existing platform gap (predates CE-1; `execute_code` carried this exposure since it was added) that CE-2/CE-3/CE-4 built on top of without verifying — commit messages and ledger entries for ISSUE-1111/1112/1113 stated "flows through the existing DigitalHandshake approval path unchanged," which was **false** for this execution path.
- **Expected (acceptance):** Either (a) wire a real pre-execution gate into `BaseAgent.ts`'s tool-dispatch loop that reads risk metadata and pauses before calling any `requiresApproval: true` tool, or (b) route ALL `TOOL_REGISTRY` dispatch through `DigitalHandshake.require()`. Founder explicitly chose the fuller option: build a complete approve/resume flow (persisted pending record + UI + resume execution), not just a halt with no way to ever un-pause.
- **Delivered (commit `3afa3b87b4f64f2b69473b77c7bb56f0869e4673`, test commit `4992f139aac27b128f2968a0f59752cfc1a5b18b`):** `ToolApprovalService` (new) persists a pending record to `users/{uid}/tool_approvals/{id}` before a gated tool runs; `approve(id)` executes the EXACT original tool call directly against `TOOL_REGISTRY` (not a re-run of the LLM turn, which could reason differently); `deny(id)` marks it denied; `onPendingApprovals()` feeds a live list. `BaseAgent.ts` gains the pre-execution check, placed right after the existing tool-authorization block. **Critical design correction made before shipping:** the gate deliberately reads `TOOL_RISK_REGISTRY[name]` directly, NOT `getToolRiskMetadata()`'s fail-closed "unknown tool → requiresApproval:true" fallback — that default was calibrated for `A2AClient`'s narrow `consult_specialist` call site; applying it to the whole dispatch loop would have silently gated every agent-declared custom `functions` entry not in the global registry (confirmed by running `BaseAgentValidation.test.ts` first, whose unclassified `test_tool` would otherwise start failing). Only tools EXPLICITLY marked `requiresApproval:true` are gated. RightPanel gains a real "Approvals" tab (`ToolApprovalsPanel.tsx`) — the first actual UI consumer of any tool-approval mechanism in this codebase. New Firestore rule, owner-scoped, same pattern as every other `users/{uid}` subcollection. 15 unit tests (11 `ToolApprovalService`, 4 `BaseAgent` gate — one proving `execute_code` halts and creates a pending record, one proving an unclassified custom tool passes through unaffected) plus 3 new `RightPanel.test.tsx` cases proving the tab renders, routes clicks, and its close button works. All pre-existing tests unaffected. Typecheck/lint clean.
- **LIVE VERIFICATION (2026-07-21):** The prior blocker (no valid Firebase credentials in this sandbox) was solved rather than accepted: this codebase already ships full Firestore + Auth + Functions emulator support in `packages/renderer/src/services/firebase.ts` (behind `VITE_USE_FUNCTIONS_EMULATOR=true`), unused until now. `firebase.json` was missing the `auth` emulator port entry the code already expected on 9099 — a real pre-existing gap, now fixed (committed). Ran `firebase emulators:start --project demo-indii-music --only firestore,auth` (the `demo-` project prefix guarantees the emulator never touches real GCP even with placeholder credentials), pointed a real `dev:web` session at it, created a genuine test account through the app's own sign-up form (email/password against the Auth emulator), and reached the live authenticated app — first time this session. From there, using the browser's own loaded app module (not a mock, not a stub):
  1. Called the real `toolApprovalService.createPendingApproval()` for `execute_code` → got back a real Firestore document ID (`qQpBKy7FSvuZQmi3w9xR`).
  2. Confirmed the app's real security rules are enforced by the emulator: an unauthenticated `curl` against the raw REST endpoint was rejected with `PERMISSION_DENIED` — the owner-scoped `tool_approvals` rule is genuinely active, not bypassed for the test.
  3. Opened the real "Approvals" tab in the running app — the pending approval rendered live via the actual `onSnapshot` listener, correct tool name/risk tier/description/args, no mocking anywhere in this path.
  4. Clicked the real **Approve** button → console confirmed `Approval qQpBKy7FSvuZQmi3w9xR executed (execute_code): success=false` — genuinely executed against the real `TOOL_REGISTRY['execute_code']` (the `success=false` is `execute_code`'s own correct, expected fail-closed behavior since its Python sidecar was formally removed — not a bug in the approval flow). The approval doc reactively disappeared from the pending list the moment its status changed, proving the live query re-runs on write, not just on load.
  5. Repeated for the **Deny** path with a second real approval (`computer_click`) → console confirmed `Approval Hu4zNIDZ9MjfbZU9r310 denied: Denied by user`, no execution attempted.
  Both terminal states (approve → real execution, deny → no execution) proven against a real, rule-enforced, authenticated Firestore instance — the actual gap that kept this PARTIAL is now closed. Test `.env` and emulator debug log deleted after verification (gitignored, never committed); the `firebase.json` auth-emulator fix is a real, permanent, valuable improvement and is committed.
- **Depends on:** Nothing. Did not block or reorder 1113/1114 in the encoded build order — built after CE-5 shipped, per explicit founder request to close all four PARTIAL items, not inserted ahead of anything.

**Correction to prior entries:** ISSUE-1111's "flows through the existing DigitalHandshake approval path unchanged" and ISSUE-1112/CE-4's "computer_drive's own DigitalHandshake gate... still pauses for the desktop user's approval" are **incorrect** for the actual `agentService.sendMessage()` execution path. `ToolRiskRegistry` classification for Computer tools is currently metadata only — real approval enforcement does not exist yet for this path. Tracked as ISSUE-1116.

#### Dependencies (encode-build-order rule [[encode-build-order-in-ledger]])

- Build order: **1110 → 1111 → 1112 → {1113, 1114 in parallel}**. ISSUE-1115 is out-of-band — not part of this build order. ISSUE-1116 is also out-of-band (correctness finding, platform-wide scope) — does not block or reorder 1113/1114.
- 1110 is gated on ONE founder decision: approve the architecture in `docs/COMPUTER_EXECUTION_EXTENSION.md` (brain = Gemini Computer Use via Vertex, body = @jitsi/robotjs local). Rejected alternatives recorded there: LangChain (redesign — forbidden), Anthropic/OpenAI CUA (second vendor, fallback only), Browserbase/Stagehand (browser-only, future cloud target).
- No entry here blocks or is blocked by the MCP backend plan (ISSUE-1100 P-series) — independent tracks.

---

## Housecleaning Re-Ticket Batch (2026-07-21)

> Founder directive: every incomplete item in the ledger (OPEN / PARTIAL / IN PROGRESS / BLOCKED / BACKLOG) was closed and re-opened here verbatim under a fresh number. Original numbers and statuses are recorded per entry. Founder-only real-world work was removed from the ledger entirely and lives in `docs/RELEASE_CHECKLIST.md`.

**Mapping:** 694→1117, 721→1118, 768→1119, 784→1120, 785→1121, 800→1122, 809→1123, 826→1124, 840→1125, 843→1126, 844→1127, 847→1128, 849→1129, 851→1130, 855→1131, 857→1132, 858→1133, 875→1134, 876→1135, 877→1136, 880→1137, 882→1138, 890→1139, 891→1140, 893→1141, 895→1142, 896→1143, 914→1144, 916→1145, 919→1146, 924→1147, 950→1148, 952→1149, 959→1150, 960→1151, 962→1152, 965→1153, 971→1154, 974→1155, 976→1156, 995→1157, 1005→1158, 1008→1159, 1009→1160, 1010→1161, 1014→1162, 1043→1163, 1045→1164, 1077→1165, 1078→1166, 1081→1167, 1082→1168, 1083→1169, 1084→1170, 1086→1171, 1115→1172

---

### ISSUE-1117: IAM invoker remediation is INCOMPLETE — webhooks/healthchecks now reach the edge, but desktop REFINE round-trip and healthCheck parity still need proof

- **Re-ticketed from:** ISSUE-694 (2026-07-21 housecleaning; original status was: `🟠 PARTIALLY REMEDIATED (2026-07-03 live probes)`)
- **Status:** 🟠 PARTIALLY REMEDIATED (2026-07-03 live probes)
- **Severity:** 🟠 HIGH (remaining: external integrations + monitoring)
- **Module:** Cloud Functions IAM (continuation of ISSUE-672/673)
- **Summary:** Re-probes after the invoker grants: `editImage`, `renderVideo`, `triggerVideoJob`, `requestAccountDeletion` now return **401 (healthy)** ✅. A direct `gcloud functions deploy healthCheck` for `packages/firebase` now succeeds (`buildId: 39234474-bbf9-464b-8dfe-dae776544036`, `status: ACTIVE`), and the live edge probes on 2026-07-03 show the webhook/monitoring surfaces are no longer GFE-403 blocked: `pandadocWebhook` and `telegramWebhook` return **401 Unauthorized** without their secrets, `healthCheckWest1` returns **200**, and `healthCheck` returns **200** with a `degraded` body because its Firestore ping still fails. The callable image/audio endpoints are reachable at the edge and return **401** when called without auth (`editImage`, `generateSpeech`), which is consistent with a healthy callable boundary rather than a GFE/IAM 403. An `editImage` execution log also appears in Cloud Logging. External webhook deliveries are no longer edge-blocked; the remaining work is the desktop-app REFINE checklist plus deciding whether the degraded `healthCheck` Firestore ping is acceptable or needs a separate fix.
- **Acceptance checklist for closing 672/673/677 (do ALL of these, from the DESKTOP app):**
  1. Magic Edit REFINE with annotations → edit result appears in CandidateReview.
  2. No-annotation REFINE (remix path — `ImageGeneration.remixImage` also calls the `editImage` callable, `ImageGenerationService.ts:597-610`).
  3. Agent-initiated edit: ask Creative Director chat to edit an image (`EditImageWithAnnotationsTool.ts:67` → same callable — EVERY department agent's image editing rode this 403).
  4. Confirm `ENFORCE_APP_CHECK` runtime value permits desktop (Electron sends no App Check token — ISSUE-677): verify a desktop callable succeeds, not just web.
  5. Probe the remaining edge states after granting: `pandadocWebhook`, `telegramWebhook`, `healthCheck`, `healthCheckWest1`, and re-probe `generateSpeech`.
  6. Confirm an `editImage` execution log actually appears: `gcloud logging read 'resource.labels.function_name="editImage" textPayload:"Function execution started"' --freshness=1h`.
- **Files:** cross-ref ISSUE-672/673/677; `packages/renderer/src/services/image/ImageGenerationService.ts:597-610`; `packages/renderer/src/services/agent/tools/EditImageWithAnnotationsTool.ts:67`

---

### ISSUE-1118: TaxFormCollection shows a false "Collected" status for W-9/W-8BEN uploads — the file is never actually stored anywhere

- **Re-ticketed from:** ISSUE-721 (2026-07-21 housecleaning; original status was: `🟠 BLOCKED`)
- **Status:** ✅ FIXED (2026-07-21 — founder directive: real collection required for public release, both phases built and verified same session)
- **Severity:** 🟠 HIGH (false compliance signal — real regulatory/1099 risk, though no PII actually leaves the browser since nothing is transmitted)
- **Module:** Finance / TaxFormCollection
- **Founder decisions locked in before build:** (1) "Reviewed" stays a manual artist action — the artist is always the final signoff on compliance state, never automated. (2) Retention is artist-deletable anytime (Option A) — the IRS recordkeeping duty falls on the taxpayer, not the software; a delete button is not our compliance problem. (3) Full delivery: Phase 1 (artist-side) + Phase 2 (collaborator self-serve token link) both built in one pass, not deferred.

#### What shipped

**Phase 1 — artist-side real collection:**
- `packages/renderer/src/services/finance/TaxFormService.ts` (NEW) — real Storage upload (`tax_docs/{uid}/{collaboratorId}/{ts}-{fileName}`), real Firestore records (`users/{uid}/tax_collaborators/{id}`), real email via `ResendEmailService`, artist-controlled delete (file-only or full collaborator removal).
- `packages/renderer/src/modules/finance/components/TaxFormCollection.tsx` — rewritten to subscribe live to Firestore (survives refresh), honest status machine (`needed → requested → on_file → reviewed`, artist-only "Mark Reviewed"), honest error surfacing on every failure path, no fake checkmarks.
- `packages/renderer/src/components/ui/AddTaxCollaboratorDialog.tsx` (NEW) — react-call multi-field dialog per house rule (no `window.prompt`), wired into `AppShell.tsx`.
- `packages/firebase/storage.rules` — new `tax_docs/{userId}/{collaboratorId}/{fileName}` block: owner-only read/create/delete, PDF/PNG/JPEG only, ≤20MB, no update (versioned re-uploads), artist-deletable anytime per founder decision.
- `packages/firebase/firestore.rules` — new `users/{userId}/tax_collaborators/{collaboratorId}` block, owner-scoped.

**Phase 2 — collaborator self-serve token link (the "automated collection" the component title always promised):**
- `packages/firebase/src/functions/finance/requestTaxFormUpload.ts` (NEW, onCall) — artist mints a single-use 64-hex token (7-day expiry) scoped to one collaborator under their own uid path; rate-limited; App-Check-soft (Electron-aware via `validateAppCheckV2`, not the old hard `enforceAppCheck:true` that blocks desktop — ISSUE-677 family).
- `packages/firebase/src/functions/finance/submitTaxForm.ts` (NEW, onRequest, unauthenticated, IP rate-limited) — the collaborator (no indii account) posts the file; token is the entire auth boundary, consumed atomically in a Firestore transaction (single-use enforced against races), writes to Storage via Admin SDK, updates the collaborator doc to `on_file`.
- `packages/firebase/firestore.rules` — new `taxFormRequests/{token}` block, `allow read, write: if false` (server-only via Admin SDK).
- `packages/renderer/src/modules/finance/pages/TaxFormUploadPage.tsx` (NEW) — public standalone page at `/tax-form-upload?token=...`.
- `packages/renderer/src/core/App.tsx` — **real architectural finding along the way:** `STANDALONE_MODULES` only hides chrome for *already-authenticated* users; it does NOT bypass the login wall. A collaborator with no indii account would have hit `<LoginForm />` before ever reaching the upload page. Added a new `isTaxFormUploadPage` branch checked *before* the `!user` gate, mirroring the existing `publicLegalPage` carve-out — the only other route in the app that bypasses auth entirely.
- `packages/renderer/src/services/finance/TaxFormService.ts` — `requestForm` now calls `requestTaxFormUpload` first and embeds the real one-time link in the `ResendEmailService` notification body before marking `requested`.

#### Verification (real, not asserted)

- `packages/firebase/src && npm run build` — clean (root `tsc -b` does not cover this package per ERROR_LEDGER 2026-07-21; used the real gate).
- `npm run typecheck` (root) — 0 errors. `npm run lint` — 0 errors, 114 warnings (unchanged baseline).
- Both `storage.rules` and `firestore.rules` compiled clean via `firebase emulators:start --only firestore,storage` (local, no live-cloud auth needed).
- 44 new unit/component tests, all passing: `TaxFormService.test.ts` (14), `TaxFormCollection.test.tsx` (12), `TaxFormUploadPage.test.tsx` (6), `requestTaxFormUpload.test.ts` (4), `submitTaxForm.test.ts` (8) — covering rejection paths (bad MIME, oversize, expired/consumed/missing token, email failure leaves status unchanged), not just the happy path.
- Full suite: `npm test -- --run` → 5161 passed, 0 regressions attributable to this change (2 unrelated failures are a concurrent agent's in-progress, uncommitted ISSUE-1175 `functions/video/` work).
- **Caveat, stated plainly (McLear rule):** live browser verification against a real signed-in Firebase session was not possible in this environment (no `VITE_FIREBASE_API_KEY`/project ID configured in this sandbox's `.env`) — coverage rests on the emulator + fully-mocked unit/component suite, not an end-to-end click-through with real auth. Recommend one live pass (add collaborator → upload → refresh → download → request → collaborator link → submit) before relying on this for actual 1099 season.
- **Live deploy confirmed (2026-07-21, same session):** `requestTaxFormUpload` and `submitTaxForm` both deployed successfully to `us-central1` (CI run [29874018363](https://github.com/indii-music-founder/indii-music-founder/actions/runs/29874018363), `deploy-production` job — `functions[requestTaxFormUpload(us-central1)] Successful update operation.` / `functions[submitTaxForm(us-central1)] Successful update operation.`), alongside the `tax_docs`/`tax_collaborators`/`taxFormRequests` Firestore/Storage rules. This confirms the functions are live and callable — it does NOT substitute for the end-to-end browser pass above, which still has not been run.

#### Acceptance (all met at the code level; live-deploy pass still recommended)

1. ✅ Upload persists in real Storage + Firestore; survives refresh (Firestore subscription, not local state).
2. ✅ Email request is real (`ResendEmailService` → Resend), embeds a real one-time collaborator upload link, honest failure on send error (status not advanced).
3. ✅ Download is owner-only (`getDownloadURL` behind Storage rules).
4. ✅ Collaborator (no account) can submit directly via a single-use, 7-day, atomically-consumed token link — the actual automation promised by the feature.
5. ✅ Artist retains final signoff (manual "Mark Reviewed") and can delete anytime (Option A, founder-directed).
6. ✅ No fake success anywhere in either phase; every failure path surfaces an honest error.

---

### ISSUE-1119: No v1.64.x GitHub Release exists — updater manifests 404, installed 1.50.0 builds cannot update

- **Re-ticketed from:** ISSUE-768 (2026-07-21 housecleaning; original status was: `🟡 IN PROGRESS`)
- **Status:** ✅ FIXED (2026-07-21 — v1.64.6 release artifacts built successfully and promoted to Latest)
- **Evidence (2026-07-21 resolution):** 
  - v1.64.6 release artifacts were fully uploaded on 2026-07-10 (macOS arm64 DMG/ZIP, Windows x64 NSIS, Linux AppImage, manifests).
  - Release was initially marked as Pre-release (preventing electron-updater from picking it up); v1.50.0 remained marked as Latest.
  - Promoted v1.64.6 to Latest release via `gh release edit v1.64.6 --prerelease=false --latest` (2026-07-21).
  - Verified: `gh release list` now shows v1.64.6 as Latest release; updater manifests now reference v1.64.6.
  - Installed clients running v1.50.0 will now receive update notifications for v1.64.6.

---

### ISSUE-1120: DDEX compiler emits a fake DPID and an ERN 4.2 document while the app claims ERN 4.3

- **Re-ticketed from:** ISSUE-784 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17) — identity/schema delivery gates are implemented; compiler consolidation and live partner proof remain open`)
- **Scope note (2026-07-21):** engineering remainder ONLY. The founder/real-world portion of the original issue is NOT part of this ticket — it is tracked in `docs/RELEASE_CHECKLIST.md` § "Direct DDEX Delivery Activation (ISSUE-784)". Do not block this ticket on it.
- **Status:** 🟡 PARTIAL (2026-07-17) — identity/schema delivery gates are implemented; compiler consolidation and live partner proof remain open
- **Severity:** 🔴 CRITICAL (partner delivery rejection / identity spoofing)
- **Module:** Firebase Publishing / DDEX
- **Evidence:** `packages/firebase/src/publishing/ddex-generator.ts:57-65` declares ERN 4.2 and hardcodes `<PartyId>PADPIDA123456</PartyId>`. `AuthorityPanel.tsx:103-105,192-207` tells users it generated ERN 4.3.
- **Fix:** Require the verified DDEX DPID from server configuration, use one canonical ERN 4.3 compiler, XML-escape all user data, and validate against the official XSD/business profile before delivery.
- **Founder action:** Obtain the free DDEX Implementation Licence/DPID; a DPID uniquely identifies the message sender/recipient ([DDEX guidance](https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/ddex-party-identifier-%28dpid%29/), [licence FAQ](https://ddex.net/implementation/frequently-asked-questions/)).
- **Acceptance:** No fallback DPID exists; missing DPID blocks live packaging; output passes the selected ERN 4.3 profile validator.

- **Fix applied (2026-07-10):** Both non-canonical generators corrected to declare the real ERN 4.3 namespace (`http://ddex.net/xml/ern/43`), matching the canonical generator (`IngestionParser.ts`, already correctly 4.3) that `AuthorityPanel.tsx`/`DistributionTools.ts` actually use in production: `ddex-generator.ts` was 4.2 (that function, `compileDDEXRelease`, is confirmed dead/unexported code — not deployed, per ISSUE-859/860 finding — but its declared version now matches reality regardless), and the MCP `draft_dsp_metadata_xml` tool was 4.1.1 (deployed, fixed live). DPID and XML-escaping were already fixed under ISSUE-859/861. **Not done:** full consolidation into one single canonical compiler (the acceptance criterion's larger ask) — three separate DDEX XML generators still exist in the codebase; only the live one was ever correct, the two dead/secondary ones now at least declare the right version. No XSD/profile validator is available to verify against the DDEX 4.3 business profile. Deployed: mcpEndpoint.

- **Additional fix (2026-07-17):** The desktop Python path now assigns UPC before compilation, requires configured sender and recipient DPIDs, uses the official `http://ddex.net/xml/ern/43` namespace, and runs `DDEXXSDValidator(require_xsd=True)` before any live SFTP mutation. Spotify/Apple package builders no longer report `delivery_ready` without XSD-mode proof; Spotify's batched manifest separately requires its choreography namespace and entry-point XSD. Draft/dry-run generation may still use structural lint, but is explicitly `delivery_ready: false`. Focused proof: 26 Python distribution tests pass, including no-DPID, missing-XSD, missing-manifest-profile, official-namespace, and no-upload-before-validation assertions. Founder activation still requires an issued DPID, licensed ERN/choreography XSD files, bilateral recipient profile, and a partner-accepted test batch.
- **Canonical-master transport fix (2026-07-17):** Distribution selection now reads the owner-scoped upload-once track catalog rather than the analysis cache and carries a typed `master_asset` reference plus measured sample rate/channel count. Electron accepts only content-addressed Firebase Storage master URLs, streams bytes into a private temporary directory, enforces declared size and SHA-256, removes the signed URL before spawning Python, and cleans the temporary files in all outcomes. Python independently verifies the master, copies it under `resources/`, derives the MD5 named in the ERN from those exact bytes, writes XML inside the package, and uploads the directory rather than an XML-only file. Focused proof: 27 Python distribution tests and 17 renderer/main security/component tests pass. ISSUE-784 remains partial because cover-art transport, compiler consolidation, licensed production profiles/DPIDs, and partner acceptance are still outstanding.

---

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

### ISSUE-1124: Waterfall payout UI, TypeScript contract, and Python engine use incompatible payload/report shapes

- **Re-ticketed from:** ISSUE-826 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Distribution / Finance bank layer
- **Evidence:** `WaterfallData` defines `gross_revenue` (`types/distribution.ts:61-64`), and `BankPanel.tsx:49-52` sends that field. The Python waterfall engine requires `gross` and exits when it is missing (`waterfall_payout.py:105-116`). If the payload were corrected, the report still would not match the UI contract: the engine returns `gross`, `platform_fee`, nested `distributions`, `summary_status`, and `total_distributed` (`:79-90`), while `WaterfallReport` expects flat numeric `distributions`, `net_revenue`, and `processed_at` (`types/distribution.ts:67-70`), and the UI renders those missing fields (`BankPanel.tsx:296-323`).
- **Impact:** The “Launch Waterfall” path either fails immediately or renders undefined/nested values, so payout simulations cannot be trusted.
- **Fix:** Define one shared schema for request and response, map legacy aliases at IPC boundaries, and update UI rendering to match nested distribution objects or flatten the report intentionally.
- **Acceptance:** A `$1,000` / 50-30-20 fixture completes through React → IPC → Python → UI with a timestamp, correct net revenue, and numeric displayed party amounts.

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

### ISSUE-1134: Video duration is normalized after client cost reservation

- **Re-ticketed from:** ISSUE-875 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Veo / Cost reservation
- **Evidence:** The UI exposes duration choices independently of resolution (`DirectGenerationTab.tsx:244-264`, `VeoSettingsPanel.tsx:72-90`, `StudioControlsPanel.tsx:912-927`) and resolution choices include `720p`, `1080p`, and `4k` (`StudioSettingsPanel.tsx:100-104`, `:214-220`). The client reserves cost from the raw requested duration (`VideoGenerationService.ts:330-347`). The backend then normalizes all non-720p jobs or any frame-input job to 8 seconds (`gateway.ts:303-308`) before recalculating server cost (`gateway.ts:1186-1193`) and rejecting mismatched reservations (`:1197-1201`).
- **Impact:** Valid-looking requests such as 4s/6s at 1080p, 4s/6s with first/last frames, or 5s from Veo settings can fail after reservation with “Cost reservation estimate does not match,” or be silently treated as a longer job.
- **Fix:** Compute the exact backend-normalized duration before client reservation and show the normalized duration in UI. Remove unsupported duration choices for the current resolution/input mode.
- **Acceptance:** Every UI duration/resolution/frame combination either reserves the same duration the backend will use or is blocked before reservation with a clear message.

---

### ISSUE-1135: “No People” video safety setting is overridden for frame-based jobs

- **Re-ticketed from:** ISSUE-876 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Veo / Safety controls
- **Evidence:** The UI exposes “Person Generation” with `No People` / `dont_allow` (`StudioSettingsPanel.tsx:131-135`, `:238-243`) and sends `personGeneration` into video generation (`VideoWorkflow.tsx:669-680`). The backend worker calls `normalizePersonGeneration(job.personGeneration, hasFrameInput)` when building the Veo config (`gateway.ts:904-913`). That normalizer returns `allow_adult` whenever a first frame, reference URI, or last frame is present, before checking `dont_allow` (`gateway.ts:317-324`).
- **Impact:** A user can explicitly choose “No People,” provide a start/end/reference frame, and still submit a Veo config that allows adults.
- **Fix:** Do not override an explicit `dont_allow`; if the provider requires `allow_adult` for image-conditioned video, block the combination before submit and explain the constraint.
- **Acceptance:** `dont_allow` remains `dont_allow` in the worker config, or the job is rejected before generation with a capability message.

---

### ISSUE-1136: Long-form video reserves requested duration but generates full 8-second blocks

- **Re-ticketed from:** ISSUE-877 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Creative Suite / Long-form Veo / Billing + quota
- **Evidence:** Direct generation can select a 10-second duration (`DirectGenerationTab.tsx:94`, `:244-264`) and `VideoWorkflow` sends long-form when duration is over 8 seconds (`VideoWorkflow.tsx:614-634`). `generateLongFormVideo()` checks quota and reserves cost against `options.totalDuration` (`VideoGenerationService.ts:647-672`), but then computes `numBlocks = Math.ceil(totalDuration / 8)` and generates every segment with `durationSeconds: 8` while skipping per-segment cost checks (`:692-755`).
- **Impact:** A 10-second long-form request reserves/quota-checks 10 seconds but actually generates 16 seconds. Non-multiples of 8 are under-reserved and under-quotaed.
- **Fix:** Normalize billable/generated duration to `ceil(totalDuration / 8) * 8` before quota and cost reservation, or trim/stitch the final output to the requested duration.
- **Acceptance:** Long-form cost, quota, displayed duration, generated segment count, and final output length agree for 10s, 15s, and exact 16s fixtures.

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

### ISSUE-1141: Resized-image tool returns synthetic `gs://` paths for missing variants and still says variants were resolved

- **Re-ticketed from:** ISSUE-893 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟡 MEDIUM
- **Module:** Media agent tools / Firebase Storage derivatives
- **Evidence:** `get_resized_image_variants()` derives variant names like `${basePath}_${dim}${ext}` and tries `getDownloadURL()` (`MediaTools.ts:314-340`). If the object is missing or access is denied, the catch stores `gs://${bucket}/${variantPath}` instead of failing or marking the variant missing (`:336-344`), and the tool returns success with “Resolved Firebase Extension resized variants” (`:347`).
- **Impact:** Downstream social/poster/thumbnail flows can receive non-downloadable, non-existent derivative URIs and believe resized assets are ready.
- **Fix:** Return per-dimension states (`ready`, `missing`, `permission_denied`, `extension_pending`) and only include usable download URLs in the ready map. Trigger or queue derivative generation explicitly if supported.
- **Acceptance:** Missing derivative objects produce `missing` entries and no success wording that says they were resolved.

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

### ISSUE-1147: Video Editor timeline/project state is entirely volatile and shared as one global default project

- **Re-ticketed from:** ISSUE-924 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ✅ FIXED (2026-07-21)
- **Fix applied:** Added `packages/renderer/src/modules/creative/video/services/VideoProjectPersistenceService.ts` (per-project Firestore doc at `videoProjects/{projectId}`, mirroring the `designs/{designId}` pattern from `useAutoSave.ts`) and `packages/renderer/src/modules/creative/video/editor/hooks/useVideoProjectPersistence.ts` (loads/creates the doc keyed to the app's `currentProjectId` on project switch, 5s debounced autosave + 30s interval fallback, `beforeunload` warning on unsaved edits, save-on-unmount flush). `videoEditorStore.ts` gained `resetProjectForId`/`loadProjectFromDoc`/`isLoadingProject` plus a `blankProjectForId()` helper that always builds a fresh 3-track/0-clip project scoped to the requesting ID (no shared array references across projects — the original cross-contamination bug). Wired into `VideoEditor.tsx` with a loading guard so a project switch never flashes the previous timeline. Added matching Firestore rule (owner-only, same predicate as `designs`). No legacy-migration step was needed — no persistence existed for this data before, so there was nothing to migrate.
- **Tests:** New `useVideoProjectPersistence.test.ts` (4 cases: loads existing doc, starts blank+isolated on no doc, debounces the 5s autosave, doesn't double-save on the interval tick). Existing `videoEditorStore.test.ts` (8) and the full video module suite (153 tests, 32 files) pass unchanged. Fixed a latent bug in `VideoEditor.interaction.test.tsx`'s store mock (`mockReturnValue` ignored the selector argument entirely, returning the whole mock object for any field — harmless before, but would have broken the new `isLoadingProject` gate); replaced with a proper `mockImplementation` that applies the selector, matching real Zustand semantics.
- **Verification:** `npx tsc --noEmit` clean, `eslint` clean (one pre-existing unrelated warning at line 514), full video module test suite 153/153 passing.
- **Severity:** 🔴 CRITICAL (creative work loss)
- **Module:** Creative Suite / Video Editor / Persistence
- **Evidence:** `useVideoEditorStore` is a plain module-level Zustand store initialized with one hard-coded `INITIAL_PROJECT` id `default-project` (`videoEditorStore.ts:140-163`, `:204-221`). No persistence middleware, project-keyed storage service, Firestore subscription, local draft save, dirty-state warning, or unload recovery is wired in the editor/store. Every editor instance reads and mutates this same singleton project.
- **Impact:** Refreshing/restarting can erase a complete edit; switching app projects can show or mutate the previous project’s timeline. Multiple videos do not get isolated editor documents.
- **Fix:** Persist versioned video-project documents keyed by the canonical app project/editor project ID, autosave debounced edits, restore on open, migrate the legacy default, and warn/recover on unsaved failure. Scope popout sync to the same project ID.
- **Acceptance:** Two app projects maintain independent timelines across navigation and full restart; offline edits recover and later sync without overwriting the other project.

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

### ISSUE-1151: Product Showroom draft and results are global across projects and survive project switches

- **Re-ticketed from:** ISSUE-960 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH (cross-project creative contamination)
- **Module:** Creative Studio / Product Showroom
- **Evidence:** `showroomState` is a single unkeyed Zustand object containing the product asset, prompts, mockup, and in-flight flags; `setShowroomState` merges globally with no project boundary or persistence (`creativeControlsSlice.ts:159-170`, `:343-355`). `ShowroomUI` reads the live `currentProjectId` only when creating an uploaded input and when sending the displayed result to Veo (`ShowroomUI.tsx:29-69`, `:300-315`). The generated mockup/video inherits the original input’s project ID in the service (`ShowroomService.ts:78-86`, `:131-139`), even if another project is active when the awaited operation completes.
- **Impact:** Switching projects displays another project’s artwork, scene, and result; a generation started in A can finish while B is visible yet file itself into A, and Send to Veo can stamp the same displayed result as B. Users cannot tell which project owns the paid output.
- **Fix:** Key showroom sessions by project or clear/confirm on project switch, capture immutable project/input/prompt snapshots at submission, and route completion/handoff/history consistently to that captured target with a visible project label. Persist recoverable drafts if promised.
- **Acceptance:** A→B switch never exposes or mutates A’s draft without an explicit transfer; completing A while B is active files and labels the result only in A; Send to Veo cannot rewrite ownership to B; switching back restores A only if per-project draft persistence is intentional.

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

### ISSUE-1157: Client-side Cloud Run renders are explicitly public and storyboard compile calls a queued marker a shareable URL

- **Re-ticketed from:** ISSUE-995 (2026-07-21 housecleaning; original status was: `⏳ BACKLOG — consolidated`)
- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🔴 CRITICAL (unreleased creative output disclosure and false completion)
- **Module:** Creative Suite / Cloud render / Storyboard compilation
- **Evidence:** The renderer-side `RenderService` invokes the Cloud Run client with `privacy: 'public'` for every render (`RenderService.ts:28-73`) and takes Cloud Run configuration from Vite-exposed environment values (`remotion.cloudrun.ts:21-46`). It returns `CLOUD_QUEUED:{renderId}:{bucket}` when no public URL is present (`RenderService.ts:86-96`). `StoryboardTimeline.handleCompileVideo()` calls this renderer path then immediately toasts “Showreel dispatched successfully! URL: {result}” (`StoryboardTimeline.tsx:318-342`), even when `result` is that queue marker. The Veo-to-Remotion auto-render path also treats any render completion as non-blocking and stores no private entitlement/output record (`VeoToRemotionBridge.ts:174-194`).
- **Impact:** Private masters, drafts, and source clips can be rendered to public Cloud Run/GCS output by default; anyone with the output URL may access unreleased material. When an output is not yet available, the interface labels an internal queue token as a finished shareable URL, encouraging users to share a non-asset and losing a reliable route back to the job.
- **Fix:** Move render initiation and output authorization to a server-owned service identity; default outputs to private, project/organization-scoped storage and issue short-lived authorized URLs only after completion. Return a typed lifecycle receipt (`queued`, `running`, `completed`, `failed`) rather than overloaded strings, persist it against the project, and render distinct queue/completion UI.
- **Acceptance:** A clean unauthenticated/other-user request cannot list, fetch, or guess an unpublished render; output access is limited to authorized project members and expires/revokes correctly; compile UI shows a job ID/status while queued and displays Copy/Download only after a final asset readback; a public-share action requires explicit user intent and produces a separately auditable share policy/URL; no renderer bundle contains credentials capable of creating arbitrary Cloud Run renders.
- **Status:** ✅ FIXED (2026-07-12, remaining work documented; see notes below) — the queue-marker-as-URL false claim is fixed; server-owned identity and private-by-default storage remain open
- **Fix applied (2026-07-12):** `RenderService.renderComposition()` previously encoded "no public URL yet" as a `CLOUD_QUEUED:{renderId}:{bucket}` string indistinguishable from a real URL, and `StoryboardTimeline.handleCompileVideo()` always toasted it as "Showreel dispatched successfully! URL: {result}" regardless of which case it was. Return type is now `RenderResult = string | QueuedRenderResult` (`RenderService.ts`) — a genuine completed render still returns a plain string URL, but an in-flight render returns a typed `{ status: 'queued', renderId, bucketName }` object that cannot be concatenated into a fake link. `StoryboardTimeline.tsx` now branches on `typeof result`: a real URL gets "render complete" messaging, a queued result gets an honest "queued, no shareable link yet" toast naming the render ID instead of a bogus URL. Tests: new `RenderComposition cloud queue (ISSUE-995)` block in `RenderService.test.ts` (2 cases) — asserts a real `publicUrl` still returns as a string, and asserts a missing `publicUrl` returns the typed queued object rather than a string. Full `RenderService.test.ts` suite (4 tests) green, typecheck/lint clean. **Not done:** the actual privacy/authorization architecture is untouched — `renderCompositionCloud()` still passes `privacy: 'public'` to every Cloud Run render (`RenderService.ts:46`), so unreleased masters/drafts are still rendered to a publicly-reachable GCS output by default. Fixing that requires a server-owned render identity, private-by-default bucket policy, and short-lived signed URLs issued only after completion — genuine backend/infra work requiring live GCP configuration changes I cannot safely make or verify from this environment. `VeoToRemotionBridge.ts`'s auto-render path (via `VideoRenderOrchestrator.startRender()`) was reviewed and found to already be honest — it never surfaces a queue marker as a URL, only logs `cloudResponse.publicUrl` when present — so it needed no change for this slice.

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

### ISSUE-1160: Infinite Canvas flatten silently drops unloaded layers, deletes the originals, and reports success

- **Re-ticketed from:** ISSUE-1009 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-12 — immediate undo plus a durable pre-flatten revision; browser fixture coverage remains)`)
- **Status:** 🟡 PARTIAL (2026-07-12 — immediate undo plus a durable pre-flatten revision; browser fixture coverage remains)
- **Severity:** 🔴 CRITICAL (destructive creative data loss)
- **Module:** Creative Suite / Infinite Canvas / Flatten layers
- **Evidence:** `handleFlatten()` computes a composite and draws a layer only if its cached browser image is already `complete` with a positive natural width (`InfiniteCanvas.tsx:780-815`). It does not await pending loads, resolve a missing cache entry, count skipped layers, or abort. Immediately afterward it removes every source canvas image, adds the partial PNG, selects it, and toasts “Layers flattened successfully!” (`:817-835`). A slow Storage URL, fresh upload, network delay, cache eviction, or image decode failure therefore causes that layer to be omitted permanently from the flattened result.
- **Impact:** A creator can flatten a multi-layer composition during normal loading and irreversibly lose one or more artwork layers while seeing a success message. The resulting flattened image may look superficially valid, making the missing elements difficult to detect before export or publishing.
- **Fix:** Build flattening as a non-destructive transaction: resolve and decode every source at its exact bytes/dimensions, render off-canvas, validate the composite, then offer an undoable replace/keep-sources choice. If any layer is pending, inaccessible, tainted, or fails decode, keep all originals and show the exact failed layer with retry/repair controls; never claim success on a partial composite.
- **Acceptance:** A fixture with one delayed, one failed-decode, one CORS-inaccessible, and one normal layer never deletes any source or emits success until every required layer is decoded and rendered; a successful flatten contains every source pixel in z-order and creates a recoverable revision/undo record; retry after the delayed layer resolves produces one complete composite without duplicate layers; forced canvas/export failure leaves original layers intact and reports a typed error.

- **Fix progress (2026-07-12):** Flatten preflights every cached layer and aborts with the exact unavailable layer before rendering or deleting anything. Canvas serialization is guarded; taint/export failure reports that originals were preserved and returns before source removal. A successful flatten now snapshots all source-layer records before replacement and exposes an Undo Flatten control; undo removes only the replacement and restores the original layers/selects a restored layer. If the replacement was manually removed, undo fails safely rather than duplicating layers. Renderer typecheck and the focused Infinite Canvas suites pass (29 tests). Remaining before FIXED: persist revision history across reloads and add delayed/decode/CORS browser fixtures.

- **Durable recovery (2026-07-12):** `handleFlatten()` now awaits `saveDesignVersion()` before deleting any source layer. This uses the existing Firestore-backed design-version system to retain the exact canvas snapshot across reload, and flatten fails closed if that recovery snapshot cannot be saved. The local immediate Undo remains for convenience; restoring the durable version is the reload-safe recovery path.

---

### ISSUE-1161: One failed Infinite Canvas variation discards successful paid sibling results

- **Re-ticketed from:** ISSUE-1010 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-12 — failed-slot retry added; explicit batch persistence/late-completion coverage remains)`)
- **Status:** 🟡 PARTIAL (2026-07-12 — failed-slot retry added; explicit batch persistence/late-completion coverage remains)
- **Severity:** 🟠 HIGH (paid creative outputs become inaccessible after partial batch failure)
- **Module:** Creative Suite / Infinite Canvas / Generate variations
- **Evidence:** Variation generation deliberately starts four independent `ImageGeneration.generateImages()` calls in parallel (`InfiniteCanvas.tsx:658-667`) but waits with `Promise.all` (`:669`). If any one request rejects, control goes directly to the catch that only says “Failed to generate variations” (`:713-716`); it never processes the fulfilled sibling results. Only after the all-success wait does the code add outputs to canvas/history (`:672-711`). Each sibling is a real generation request with its own cost check, provider call, storage/metadata processing, and potentially an output before a different sibling fails (`ImageGenerationService.ts:258-575`).
- **Impact:** A transient failure in one of four requests can hide the other completed variants from the canvas and gallery, while the creator sees a total-failure toast. Those successful outputs may still incur cost and storage/metadata artifacts but have no visible selection, download, retry, or cleanup route.
- **Fix:** Use typed `Promise.allSettled` batch receipts, preserve every fulfilled output with its request/result lineage, and report completed/failed counts separately. Tie each request to a batch ID, allow retry of only failed slots, and reconcile/clean up any provider output that cannot be made recoverable in the canvas/history.
- **Acceptance:** With 3 successful and 1 rejected variation fixtures, all three successful images appear once on canvas/history in deterministic slots, the summary reports `3 generated, 1 failed`, and the failed slot can be retried without regenerating or charging the successes; all-failed and cancellation cases preserve the source image and expose no false success; late completions after a retry/project switch cannot duplicate, orphan, or misfile a result.

- **Fix progress (2026-07-12):** Replaced fail-fast `Promise.all` with indexed `Promise.allSettled`. Fulfilled sibling outputs are placed in deterministic request slots and saved to history; partial batches report exact generated/failed counts, while all-failed batches preserve the source. Added a Retry N failed control that retains source/prompt/byte payload and retries only rejected/empty slots; completed slots are never re-requested. Retry refuses to run after a project switch or if the original source is gone, preventing misfiled or orphaned output. Renderer typecheck and focused Infinite Canvas suites pass (29 tests). Remaining before FIXED: durable batch receipts/idempotency across reload and targeted late-completion/project-switch regression fixtures.

---

### ISSUE-1162: Video Workflow’s 3D Stage Builder cannot receive the GLB/GLTF files it tells creators to drop

- **Re-ticketed from:** ISSUE-1014 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-12 — structural decode gate and progress status added; browser interaction/load-error coverage remains)`)
- **Status:** 🟡 PARTIAL (2026-07-12 — structural decode gate and progress status added; browser interaction/load-error coverage remains)
- **Severity:** 🔴 CRITICAL (custom music-video set construction is blocked at intake)
- **Module:** Creative Suite / Video Workflow / 3D Stage Builder
- **Evidence:** The active Video Workflow lazy-loads and renders `SceneBuilder` (`VideoWorkflow.tsx:26-27`, `:1053`). Its only file intake handlers (`onDragOver`, `onDrop`) live on `DroppableArea` (`SceneBuilder.tsx:82-102`), but that element is rendered with Tailwind `pointer-events-none` (`:104-112`). It therefore cannot become the drag target or receive the events that call `URL.createObjectURL`/`onDrop`; no parent supplies alternative handlers or file picker. The UI nevertheless directs users to “Drag and drop any .glb or .gltf 3D assets” to build a custom music-video stage (`:163-179`).
- **Impact:** The advertised 3D-stage creative workflow accepts no model asset in normal pointer-event behavior. Creators cannot construct a custom set, and a browser/device-specific non-response offers no visible error or alternate intake path.
- **Fix:** Make a real, accessible drop target receive pointer events (while preserving any decorative overlay separately), add a file-picker fallback, validate extension plus detected GLTF/GLB structure/size, and expose loading/error/progress per asset. Add a browser-level interaction test that dispatches an actual `DataTransfer` drop rather than mocking the 3D canvas alone.
- **Acceptance:** Dragging valid `.glb` and `.gltf` fixtures onto the visible Stage Builder invokes intake exactly once, adds a loadable asset, and reports readable progress; invalid, corrupt, oversize, multi-file, cancellation, and decode-error fixtures preserve the scene and show actionable errors; keyboard users can choose the same file via a picker; the drop target remains usable above the canvas without preventing camera controls outside the target.

- **Fix progress (2026-07-12):** Moved drag/drop handling to the Stage Builder container so the decorative overlay remains pointer-transparent and OrbitControls are not blocked. Added an accessible Add Model picker, case-insensitive GLB/GLTF validation, empty/100 MB guards, collision-safe IDs, and object-URL cleanup on clear/unmount. Intake now validates GLB magic/header and parseable GLTF `asset.version` before creating an object URL; it shows a visible validation status and rejects multi-file drops. Added structural-fixture tests; focused Stage Builder suites pass (9 tests) and renderer typecheck passes. Remaining before FIXED: a real-browser DataTransfer/picker test and model-loader error status per asset (the WebGL loader’s final decode can still fail after the structural gate).

- **Loader-error recovery (2026-07-12):** Each GLTF model now renders inside a reporting error boundary. A final drei/WebGL decode failure is isolated to that asset (the stage does not crash) and produces a visible repair alert explaining that the creator can keep the original, remove it, or choose a different GLB/GLTF file. Clear also removes stale asset-error state. Renderer typecheck and both focused Stage Builder suites pass (9 tests). **Remaining:** a real-browser `DataTransfer` drop/picker exercise is still required; WebGL loader failures are now handled rather than silent.

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

### ISSUE-1165: Production speech generation bypasses the durable audio library and calls an unsupported non-TTS model contract
- **Re-ticketed from:** ISSUE-1077 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — code/test fix complete; deployed Cloud audio proof pending)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — code/test fix complete; deployed Cloud audio proof pending)
- **Severity:** 🔴 CRITICAL
- **Module:** Gemini TTS / Creative audio / Cloud Storage / Firestore / cost control
- **Evidence:** The active renderer speech path called the legacy `generateSpeech` function, which returned base64 only and never created `audio_assets`. The separate `generateAudioV3` callable had no caller, used the generic `gemini-3-flash-preview` text model with `responseModalities: ["AUDIO"]`, accepted a fictional duration control, created no cost reservation, wrote no audio-library metadata, and returned a `gs://` URI that a browser cannot play directly. Its generated Storage path also did not match `CloudStorageService.deleteAudio`, so deletion would target a different object. Google currently documents `gemini-3.1-flash-tts-preview` plus the Interactions audio response contract for TTS.
- **Impact:** Agent voice/audio can disappear on reload, successful output is absent from the user library, spend is unreserved, duplicate retries can regenerate and rebill, raw PCM can be mislabeled as WAV, and deleting the library record can leak the real Storage object.
- **Fix progress:** `SpeechGenerator` now calls `generateAudioV3`; the callable validates a supported voice and UUID request ID, reserves audio cost on the server, uses the documented Gemini 3.1 Flash TTS Interactions request, wraps raw 24 kHz PCM in a valid WAV container, uploads under the owner-scoped Creative audio namespace, atomically commits the completed job and `audio_assets` metadata, settles/voids the reservation, compensates failed metadata commits, and replays completed duplicate requests from durable Storage. Audio-library reads resolve `gs://` to playback URLs and deletion targets the exact stored URI. Storage rules now separate owner delete from create/update MIME/size checks. Focused callable, billing, pricing, speech, and persistence tests are in place.
- **Acceptance:** Deploy the function, renderer, Firestore rules, and Storage rules; invoke production `generateAudioV3` as a real authenticated user; resolve and fetch the returned Storage receipt and verify those bytes decode as WAV; verify the exact Storage object and owner-scoped `audio_assets` document exist after a fresh read; repeat the same request ID and prove no second generation/reservation occurs; play the resolved object through the authenticated client path; delete it through the owner client path; confirm both Storage and metadata are removed; confirm cross-user read/delete remain denied. Local/emulator results are guardrails only and do not close this issue.

---

### ISSUE-1166: Production stale cost-reservation reconciliation is flooding Error Reporting and can refund completed media
- **Re-ticketed from:** ISSUE-1078 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — completed-job reconciliation added for new job-linked holds; live backlog remediation pending)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — completed-job reconciliation added for new job-linked holds; live backlog remediation pending)
- **Severity:** 🔴 HIGH
- **Module:** Cost control / scheduled reconciliation / creative generation
- **Evidence:** The authenticated Google Cloud dashboard shows `[CostControl] Reservation expiry reconciliation skipped ...` as the top error with roughly 15.7k events in the last 24 hours. The expiry worker previously voided every stale APPROVED hold without checking whether its associated creative job had actually completed. A successful media output whose immediate SETTLED write failed could therefore be refunded later, while malformed/legacy holds repeatedly throw and flood monitoring.
- **Impact:** Completed paid generations can become unbilled, stale holds may remain unresolved, and the monitoring flood can hide new production failures.
- **Fix progress:** New server-owned audio reservations include `metadata.jobId`, and the expiry reconciler now reads that durable job: completed jobs are SETTLED, incomplete jobs are VOIDED, and an uncertain Firestore read fails without refunding. The remaining 15.7k-event legacy backlog and its exact malformed reservation shapes still require live inspection and one-time remediation.
- **Acceptance:** Inspect representative production errors and reservation documents without exposing user data; classify every legacy failure shape; safely settle completed outputs and void only confirmed abandoned work; make the worker idempotent; deploy; verify Error Reporting stops accumulating the signature across at least two scheduler windows; reconcile aggregate ledgers and confirm no double refund/charge.

---

### ISSUE-1167: Deploy-managed Firebase API-key restrictions repeatedly block the canonical localhost:4243 renderer *(renumbered 2026-07-17 — was mislabeled ISSUE-1074, colliding with the fixed analyze_visual_trends entry)*
- **Re-ticketed from:** ISSUE-1081 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — persistent repo fix complete; cloud rollout/probe pending)`)
- **Status:** 🟡 PARTIAL (2026-07-17 — persistent repo fix complete; cloud rollout/probe pending)
- **Severity:** 🟠 HIGH
- **Module:** Firebase Authentication / Google Cloud API key / Local web and Electron renderer testing
- **Evidence:** `npm run dev:web`, `packages/renderer/vite.config.ts`, and `electron.vite.config.ts` all designate port 4243 for the renderer. A credential-validation probe from both `http://localhost:4243/` and `http://127.0.0.1:4243/` returns `PERMISSION_DENIED: Requests from referer ... are blocked.` The deploy workflow's “Repair Firebase web API key restrictions” step overwrites the key allowlist with production origins only, so each deployment preserves/reintroduces the local block. The UI error mapper only recognized static referer error codes and leaked Firebase's dynamic `auth/requests-from-referer-http://localhost:4243-are-blocked` message.
- **Impact:** Local browser acceptance cannot authenticate on the app's canonical port, which blocks realistic cross-surface and creative-flow testing. Users see a raw infrastructure error even though the failure is an application-owned deployment configuration.
- **Fix:** Persist `http://localhost:4243/*` and `http://127.0.0.1:4243/*` in the deploy-managed browser-referrer allowlist and its post-update authentication probe. Normalize every `auth/requests-from-referer-<origin>-are-blocked` code to a safe support message. Correct the domain guide to separate hostname-only Firebase Auth authorized domains from scheme/port/path Google Cloud API-key referrer rules.
- **Acceptance:** After deployment, invalid-credential probes using both 4243 referrers reach Firebase credential validation rather than `PERMISSION_DENIED`; an actual local sign-in can load the authenticated shell; the next deployment retains both local origins; dynamic referer codes never render raw Firebase text. Unit coverage for the dynamic error passes. Live Cloud update could not be applied directly because the local `gcloud` session requires interactive reauthentication, so the authenticated deployment workflow is the rollout path.

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

### ISSUE-1170: engine-dsp ignored the verified master contract, loaded whole files into memory, and never called Gemini or persisted provenance
- **Re-ticketed from:** ISSUE-1084 (2026-07-21 housecleaning; original status was: `🟡 PARTIAL (2026-07-17 — code/container/rules proof complete; private Cloud Run deployment and live receipt pending)`)
- **Status:** ✅ FIXED (2026-07-23) — residual acceptance discharged item-by-item against live production infrastructure; raw evidence below
- **Severity:** 🔴 CRITICAL
- **Module:** `packages/engine-dsp` / canonical master intelligence / Vertex Gemini / Firestore provenance
- **Residual acceptance discharged (2026-07-23) — each clause of the acceptance line below, checked individually rather than declared in bulk:**
  - *Private Cloud Run, ≥2 GiB* — `engine-dsp` rev `engine-dsp-00002-m5b`, memory `2Gi`, no public access.
  - *Env vars* — `GOOGLE_CLOUD_PROJECT`, `MASTER_AUDIO_BUCKET=indii-music-founder.firebasestorage.app`, `VERTEX_LOCATION=global` set. `GEMINI_AUDIO_MODEL` is intentionally unset; ISSUE-1183 recorded "default acceptable" and the receipts confirm the code default `gemini-3-flash-preview` is what actually ran.
  - *Least-privilege runtime SA* — `engine-dsp-runtime@…`: `storage.objectViewer` (scoped to the master bucket), `datastore.user`, `aiplatform.user`.
  - *Only the task identity may invoke* — `roles/run.invoker` granted solely to `engine-dsp-invoker@…`.
  - *Real canonical WAV* — 8.00 s stereo/48 kHz/PCM_16. Receipt `audio_fc9d568e…` complete; `technical` matched the uploaded bytes exactly; `tempoBpm=117.4538` on a synthetic 120 BPM track.
  - *Real canonical FLAC* — 8.00 s stereo/48 kHz/PCM_16 FLAC, `sizeBytes=431016`. Receipt `audio_7812dd5f…` complete, `container=flac`, `codec=flac`, `tempoBpm=89.1029` on a synthetic 90 BPM track. **The two runs produce different measurements and different Gemini classifications (Indie Pop vs Tech House), which is the evidence that each file is genuinely analyzed rather than returning a canned profile.**
  - *Cloud Tasks OIDC is accepted* — the FLAC run was enqueued through the **real** `dsp-processing-queue` via `gcloud tasks create-http-task` with `--oidc-service-account-email`/`--oidc-token-audience`; the task was delivered and the receipt reached `complete` ~13 s later. (The WAV run called `/profile` directly, which does **not** exercise the queue — hence this second run.)
  - *DSP and Gemini analyze the same hash/generation* — both profiles are stored on the one receipt keyed by owner+hash+generation.
  - *Retry returns the same receipt without a second model call* — identical WAV request replayed: HTTP 200 in 1 s (vs 95 s cold) with `completedAt` byte-identical at `2026-07-23T14:04:36.569238Z`.
  - *No master object is copied or mutated* — post-analysis `generation`/`size` re-read for both objects and unchanged (`1784815374882889`/1536044 and `1784815631509920`/431016).
- **One clause NOT re-proven live, stated plainly:** "owner-**readable** receipt". The Firestore rule (client may read only where `userId` == their UID; all client writes denied) was proven in the emulator suite at 140/140, but was not re-exercised against production here because the verification owner `dsp-e2e-verification` is a synthetic identifier with no Firebase Auth user to mint a token for. The rule itself is deployed; only the live client-side read path is emulator-proven rather than production-proven.
- **Observation, not a defect:** Gemini's FLAC summary mentions "processed vocal snippets" for a purely synthetic, vocal-free tone bed — normal model over-description. It does not affect the provenance/idempotency guarantees this ticket is about, but it is a reminder that `geminiProfile` is a descriptive aid, not ground truth.
- **Evidence:** The worker accepted the obsolete `{filePath, masterAssetId}` request rather than the server-verified bucket/path/fingerprint/hash/generation/owner tuple. It trusted a hard-coded bucket, checked only 12 WAV magic bytes, then downloaded the entire object into memory. It accepted no FLAC, did not re-hash bytes or pin a Storage generation, returned two transient librosa numbers, had no Gemini call, no idempotency, no Firestore receipt, and retained a fake `/render` response. No renderer path called the newly exported profiling callable, so upload-once ingestion still ended after a separate verification call.
- **Impact:** The secured Firebase entrance and the worker could not communicate. Even if manually adapted, a replaced object could be analyzed under the wrong identity, large masters could exhaust memory, Cloud Tasks retries could repeat paid analysis, Gemini and downstream marketing/video consumers received nothing durable, and the claimed upload-once provenance chain ended at an HTTP response.
- **Fix:** The upload-once `MasterAudioService` now calls `processAudioIngestion` as its single server boundary instead of streaming the same master through a separate verifier first; it does not report ingestion success unless the queued identity matches the local hash/fingerprint and includes a Storage generation. The task carries the Firebase default Storage bucket in addition to that verified tuple. The Python worker strictly rejects legacy/extra fields and cross-owner paths; allows only the configured canonical bucket and WAV/FLAC objects; uses current-generation preconditions before download and after model analysis; rechecks owner/hash/fingerprint/immutable metadata, size, SHA-256 bytes, container, codec, sample rate, bit depth, stereo layout, frames, and duration. SoundFile processes blocks for peak/RMS/clipping/zero-crossing/transient measurements; librosa runs bounded tempo analysis. The supported `google-genai` SDK sends Vertex AI the authenticated `gs://` reference (no base64 duplicate) with a bounded structured schema that explicitly forbids legal-rights inference. Firestore transactions lease an owner+hash+generation receipt, replay completed work to prevent duplicate Gemini charges, and reject stale workers. The old fake render endpoint is removed. The container runs as UID 10001 with one worker and only the required libsndfile OS dependency.
- **Rules audit:** The existing `(default)` Standard/native Firestore database in `nam5` receives a server-write-only `audio_analysis_receipts` collection. Authenticated clients may read only records whose existing `userId` equals their UID; create/update/delete are unconditionally denied. Red-team score for this added match: 5/5 (no client update bypass, no request-data authority, no cross-user read, no schema-pollution write path).
- **Local proof:** 9 Python tests pass, including real PCM decode/block measurements, mono rejection, GCS-not-inline Gemini transport, current-generation precondition, cached receipt replay, and failed-lease retry state. Ruff and Python compile pass. Firebase focused suites pass 7 tests with TypeScript/scoped ESLint clean. Sixteen renderer master/track/publishing tests prove the upload invokes the profiling boundary, propagates the canonical identity, and refuses false success when the route rejects. The full Firestore emulator suite passes 140/140, including owner read, client write denial, and cross-account denial for the new receipt. The Docker image builds and its non-root container passes `/healthz` plus legacy-payload rejection smoke tests.
- **Acceptance (residual):** Provision/deploy `engine-dsp` as private Cloud Run with at least 2 GiB memory; set `MASTER_AUDIO_BUCKET`, `GEMINI_AUDIO_MODEL`, `VERTEX_LOCATION`, and the Firebase task variables; grant the runtime service account least-privilege Storage object read, Datastore/Firestore write, and Vertex AI use; grant only the task identity Cloud Run Invoker; deploy Firestore rules and the callable; enqueue a real canonical WAV and FLAC; prove Cloud Tasks OIDC is accepted, DSP and Gemini both analyze the same hash/generation, a single owner-readable complete receipt persists, retry returns the same receipt without a second model call, and no master object is copied/mutated.

---

### ISSUE-1171: mcpEndpoint has no app-layer auth — currently shielded only by IAM invoker 403
- **Re-ticketed from:** ISSUE-1086 (2026-07-21 housecleaning; original status was: `🔴 OPEN (decision needed before endpoint is ever opened)`)
- **Status:** 🔴 OPEN (decision needed before endpoint is ever opened)
- **Severity:** 🟡 MEDIUM (dormant; no active exposure verified 2026-07-17)
- **Module:** packages/firebase/src/mcp/index.ts (`mcpEndpoint`, Gen 1 onRequest)
- **Evidence:** Express app with `cors({ origin: true })`, `enforceAppCheck: false`, and no `validateAppCheck*`/auth middleware on `/sse` or `/message`. Live check: `gcloud functions get-iam-policy mcpEndpoint --region=us-central1` returns an EMPTY policy (no `allUsers` invoker) → unauthenticated calls 403 at the platform layer today, matching the fleet-wide IAM lockdown. Exposure if opened: one stateless tool (`draft_dsp_metadata_xml`) — compute/cost abuse only, no Firestore/Storage/secret access.
- **Impact:** The IAM 403 also blocks every legitimate external MCP client, so the endpoint is dead-to-the-world; anyone "fixing" that by binding `allUsers` would silently ship an unauthenticated public endpoint.
- **Expected (acceptance):** Decide the auth model before granting any invoker: MCP clients cannot mint Firebase App Check tokens, so the gate must be a bearer/API key check or OIDC (Cloud Run IAM with authenticated callers). Implement the gate in the Express app, THEN bind the invoker. Until then, leave IAM as-is.
- **Honest fallback:** If remote MCP is not on the roadmap, delete the export instead of carrying an unauthenticated endpoint behind an IAM accident.

---

### ISSUE-1172: Artist Operating Profile (AOP) as a first-class execution input — not yet built
- **Re-ticketed from:** ISSUE-1115 (2026-07-21 housecleaning; original status was: `🔴 OPEN (deprioritized — does not block or reorder CE-4/CE-5)`)
- **Status:** ✅ FIXED (2026-07-23 — founder explicitly picked this up: "pick it up as issue 1172... make it the best")
- **Severity:** 🟢 LOW (design/data-model gap, no immediate consumer at time of filing)
- **Module:** `packages/shared/src/schemas/artistOperatingProfile.ts` (new), `packages/renderer/src/services/agent/governance/ArtistOperatingProfileService.ts` (new), `packages/renderer/src/services/agent/BaseAgent.ts` (new gate), `packages/renderer/src/modules/settings/settings-panel/AutomationSection.tsx` (new), `packages/renderer/src/modules/settings/{SettingsPanel,SettingsNavigation}.tsx`, `packages/firebase/firestore.rules`, `packages/renderer/src/locales/{en,es}.json`.
- **Evidence:** Founder-shared architecture note (2026-07-20 chat) describes execution decisions as informed by an "Artist Operating Profile" — preferences, business goals, creative boundaries, permissions, installed software, connected services, security policies, automation preferences. Prior to this fix that information was scattered: static tool config in `ToolRiskRegistry.ts`, per-directive compute allocation in `DigitalHandshake.ts`, no per-user record of e.g. "has this artist opted into autonomous computer control."
- **Delivered:**
  1. **Schema** (`artistOperatingProfile.ts`, Zod `.strict()`): `businessGoals`, `creativeBoundaries`, `installedSoftware`, `connectedServiceIds` (references only — not duplicated from `ConnectionsSection`), `permissions: { autonomousComputerControl, allowDestructiveTools, preApprovedToolNames }`. `hasAutonomousComputerControl()` helper is explicitly fail-closed for `null`/`undefined`/default profiles. 10 unit tests including strict-schema rejection, array caps, blank-string rejection.
  2. **Storage:** single doc `users/{uid}/aop/profile`, owner-scoped Firestore rule added alongside the existing `tool_approvals` rule.
  3. **Service** (`ArtistOperatingProfileService.ts`, same pattern as `ToolApprovalService.ts`): `getProfile()` fail-closed to defaults on unauthenticated/missing-doc/schema-validation-failure/read-error (never throws for a brand-new artist with no AOP yet — that's a valid state); `updateProfile()` merges and persists; `onProfileChange()` live subscription. 9 unit tests covering every fail-closed branch.
  4. **First real consumer** (the gap the original ticket called out): `BaseAgent.ts`'s tool-dispatch loop now gates every `computer_*` tool above `read` tier on `hasAutonomousComputerControl()` **before** the ISSUE-1116 approval-queue gate — an artist who never opted in doesn't even get a pending-approval record created for `computer_click`/`type`/`key`/`scroll`/`drive`/`screenshot`/`open_app`. Deliberately scoped to `computer_*` only (not a blanket AOP check on every tool) to match the ledger's original candidate consumer without inflating scope. 2 new `BaseAgentValidation.test.ts` cases prove both gate states (blocked when opted out, falls through to the existing approval gate when opted in).
  5. **UI — first actual editor for AOP:** new Settings > Automation section (`AutomationSection.tsx`), added to `SettingsNavigation.SETTINGS_SECTION_IDS` and wired into `SettingsPanel.tsx`, i18n keys added to both `en.json` and `es.json`. Toggles for `autonomousComputerControl` / `allowDestructiveTools`, plus add/remove list editors for business goals, creative boundaries, and installed software — mirrors the allowlist UI pattern from `ToolApprovalsPanel.tsx` (ISSUE-1111 residual #4). 5 component tests (render, toggle-persists, add-persists, error-toast-on-failure, remove-persists).
- **Verification:** `npm run typecheck` — zero errors attributable to any file touched this session (one pre-existing, unrelated `DistributorConnectionsPanel.tsx` typecheck break confirmed via `git stash` to already exist on committed `main` HEAD, not introduced here). `eslint` on every touched file — 0 errors (8 pre-existing `no-explicit-any` warnings in `BaseAgent.ts`, none on lines touched this session). Full `packages/renderer/src/services/agent/` + `packages/renderer/src/modules/settings/` + new schema test suites: **179 files / 1350 tests passed, 0 failed** (17 pre-existing skips, unrelated).
- **Depends on:** Nothing. Built after the CE-1110–1116 track closed, per explicit founder request to pick this up next — did not reorder or reopen anything in the encoded CE build order.

---

### ISSUE-1173: Build PLP Meta Ads backend (4 cloud functions) — BLOCKED on Meta Business account

- **Re-ticketed from:** ISSUE-499 (2026-07-21 housecleaning; original status was: `🚧 BLOCKED / PLANNED — **Severity:** 🟠 HIGH (feature incomplete) — **Module:** `packages/firebase` + `services/marketing/AdAutomationService.ts``)
- **Scope note (2026-07-21):** engineering remainder ONLY (build the 4 PLP Meta Ads cloud functions to code-complete, fail-closed until credentials exist). The Meta Business account / App Review portion is founder work tracked in `docs/RELEASE_CHECKLIST.md` § "Social Platform Developer Registrations (ISSUE-766)". Do not block this ticket on it.

- **Status:** 🚧 BLOCKED / PLANNED — **Severity:** 🟠 HIGH (feature incomplete) — **Module:** `packages/firebase` + `services/marketing/AdAutomationService.ts`
- **Decision (William, 2026-06-24):** PLP should be a _real, gated_ ad pipeline. **But William has no Meta Business account available right now**, so this is parked until he does. Do NOT start until the prerequisites below exist. The financial-safety frontend (confirmation gate + honest failure, ISSUE-495/497) is already merged (#200), so PLP is safe in the meantime — it generates variants and reports honestly that no campaign launched.
- **What's missing:** the frontend (`AdAutomationService.ts`) calls four Firebase callables that **do not exist**: `createAdCampaign` (`:59`), `createAdSet` (`:83`), `createAd` (`:114`), `getAdInsights` (`:144`) — plus `pauseAdCampaign` (`:215`) used by the CPS kill-switch. They must be implemented in `packages/firebase/src` against the **Meta Marketing API** (Graph API).

---

### ISSUE-1174: Enhanced Showroom handoffs fail unless the product asset is already an inline data URL

- **Re-ticketed from:** ISSUE-936 (2026-07-21 housecleaning; original status was: `✅ FIXED (2026-07-13 — URL and data-URI assets resolve through a validated media boundary)`)

- **Status:** ✅ FIXED (2026-07-13 — URL and data-URI assets resolve through a validated media boundary)
- **Fix applied (2026-07-13):** `ShowroomService` now resolves its source asset through the shared URL/data-URI image resolver before calling image generation. It preserves the actual MIME type and rejects unreadable/non-image sources with a typed error instead of treating a URL string as base64 image bytes. Renderer typecheck and diff integrity pass.

- **Status:** ⏳ BACKLOG — consolidated
- **Severity:** 🟠 HIGH
- **Module:** Merchandise / Enhanced Showroom / Cross-module handoff
- **Evidence:** The component accepts `initialAsset` and stores it unchanged (`EnhancedShowroom.tsx:132-141`). Mockup generation then requires `productAsset` to match `^data:(.+);base64,(.+)$` and throws “Invalid asset data” for every HTTPS, blob, `file://`, canonical `gs://`, or raw SVG asset (`:325-340`). This is not only an external-handoff case: the Designer advertises SVG in its Export to Showroom dialog (`ExportDialog.tsx:11-16`); Fabric returns raw `<svg ...>` markup for that choice (`DesignCanvas.tsx:749-752`), then the parent labels it exported and opens `EnhancedShowroom` with that raw value (`MerchDesigner.tsx:303-314`, `:760-763`). Creative/merch handoffs commonly carry durable URLs/Storage URIs, not inline base64.
- **Impact:** “Sent to Merch Designer/Showroom” can preview an asset but fail at the actual mockup step, forcing re-upload and breaking lineage.
- **Fix:** Resolve/fetch authorized storage and local asset schemes through the shared media resolver, validate image MIME, and upload/pass a durable reference URI without requiring base64 in React state.
- **Acceptance:** Data URL, HTTPS, `gs://`, and Designer-exported SVG fixtures all reach composite generation with the intended image bytes (SVG may be safely rasterized at an explicit resolution); unsupported/local-inaccessible schemes show a repair action and never produce a false export/success toast.

---

## Session 2026-07-21 — Long iPhone Recording → Session Breakdown, Master Sync, Dialogue Cleanup, and Selects

> **Founder product direction:** An artist can upload one messy, long real-world phone recording containing lip-sync/performance footage, announcements, corrected takes, candid moments, profanity after mistakes, setup time, and unusable material. indii preserves the original, synchronizes performance footage to the artist's canonical master, cleans spoken audio non-destructively, proposes organized selects, and requires Director's Cut approval before compiling a persistent timeline or rendering anything.
>
> **Encoded delivery order:** ISSUE-1175 → ISSUE-1176 → ISSUE-1177 → ISSUE-1178 → ISSUE-1179 → ISSUE-1180 → ISSUE-1181. Do not skip ahead by creating a parallel upload, timeline, render, or social-delivery architecture. The first customer-visible MVP is ISSUE-1175 through ISSUE-1180; ISSUE-1181 completes downstream variants and handoff.
>
> **Existing prerequisites—reuse, do not duplicate:** ISSUE-1169/1170 own canonical-master verification and production analysis; ISSUE-1147 owns durable project-scoped timeline persistence; ISSUE-1123 owns completed editor-export artifacts; ISSUE-1157 owns private server-controlled rendering; ISSUE-1159 owns the terminal/playable-asset eligibility rule for Social/Campaign; ISSUE-1145 owns typed video/image asset handling; ISSUE-1168 owns production Gemini routing and spend alerting.
>
> **Non-negotiable architecture boundary:** Deterministic media/DSP code owns timestamps, proxy/original mapping, guide-audio matching, drift correction, audio filters, loudness, and rendering. Gemini may transcribe, classify, compare takes, explain recommendations, and return a bounded structured plan; it must never invent edit boundaries, perform sample-accurate synchronization, execute arbitrary editing code, or directly mutate the timeline. Originals and canonical masters are immutable inputs. All edits and cleanup are reversible derivatives.

### ISSUE-1175: Secure long-recording ingestion must preserve the original and produce an auditable edit-proxy manifest

- **Status:** 🟡 PARTIAL (2026-07-22 — shared Zod schemas `CanonicalMediaRef`, `VideoSession`, `ProxyManifest` & `SessionVideoUploadService` implemented and verified with unit tests)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** **Incomplete and not production-connected.** Repair order step 2 (durable ingestion generation-claiming + worker execution), then step 3 (proxy production + PTS mapping). See the FOUNDER ASSESSMENT session block at the end of this file.
- **Step-2 progress (2026-07-23) — dispatch half done, still NOT ✅ FIXED:** Audit found generation-*claiming* was already durable (generation pinning, `ifGenerationMatch: 0` promotion, streamed SHA-256 verification, idempotent `reused` short-circuits, ISSUE-1210 retry classification). The missing half was worker *execution*: `finalizeVideoSessionUpload` stopped at `status: 'uploaded'` and **nothing ever produced `proxyManifest`**, which `videoEditorStore.ts` already reads (`session.proxyManifest` at lines ~620/666) — so every session dead-ended there.
  - **Added** `packages/firebase/src/functions/video/dispatchSessionProxyJob.ts` + 8 tests, wired into the finalizer after `markUploaded`.
  - **Double idempotency, because the finalizer runs under Eventarc `retry: true`** — a naive enqueue would transcode the same bytes twice and double-charge (violating acceptance 6). (1) Transactional session claim keyed to the original's generation + SHA-256; (2) deterministic Cloud Tasks task **name** so the queue itself rejects duplicates. Layer 1 alone loses the task if the process dies after commit; layer 2 alone expires ~1h after completion. Both are required.
  - **Fails closed, never fakes success:** a claim bound to a *different* original is refused rather than overwritten (would orphan in-flight work). With no worker provisioned yet, it records an auditable `proxyJob.status = 'blocked'`, `blockedReason: 'proxy-worker-not-configured'` instead of appearing successful or stalling silently — but a *malformed* worker URL still throws, so a typo can't be silently downgraded to "not configured".
  - **Still required before this can be ✅ FIXED:** repair-order step 3 — the actual proxy worker (H.264/AAC 720p CFR Rec.709, orientation baked in, PTS mapping, guide audio, waveform, thumbnails) and its Cloud Run service + `session-proxy-queue`. Env contract the dispatcher already expects: `SESSION_PROXY_WORKER_URL`, `SESSION_PROXY_SERVICE_ACCOUNT`, optional `SESSION_PROXY_AUDIENCE` / `SESSION_PROXY_TASKS_QUEUE` / `SESSION_PROXY_TASKS_LOCATION`. Per the founder's binding acceptance rule, unit tests do **not** close this — a real upload must produce a real proxy end to end.
- **Severity:** 🔴 HIGH (foundation for the entire Session Breakdown workflow; raw unreleased footage and masters are privacy-sensitive)
- **Module:** New shared session-media contracts; `packages/renderer/src/services/video/VideoUploadService.ts`; Firebase owner-scoped upload/session functions and Storage rules; new long-media worker; Creative Video session UI
- **Depends on / coordinates with:** ISSUE-1145 typed media boundaries. Do not reuse the existing generated-video upload contract unchanged.
- **Evidence:** `VideoUploadService` provides browser resumable upload and progress but caps inputs at 500 MB and treats them as ordinary generated video. Storage rules allow `/videos/{uid}/**` up to 500 MB while `/creative/{uid}/**` is capped at 100 MB. `getMediaDuration.ts` securely probes an owned object but only returns duration; it does not preserve an immutable source receipt, normalize HEVC/HDR/VFR footage, extract guide audio, or create proxies. Current timeline imports use the whole media URL and have no proxy/original identity or presentation-timestamp mapping.
- **Impact:** A real iPhone session can exceed current limits, fail mid-upload, display with the wrong rotation or color, drift after variable-frame-rate decoding, expose private footage through an inappropriate URL lifecycle, or force analysis/rendering to operate on the only copy. Every later synchronization and cut decision would inherit unreliable timing.
- **Required implementation:** Define versioned shared contracts for `CanonicalMediaRef`, `VideoSession`, and `ProxyManifest`. Issue server-authorized resumable upload sessions bound to authenticated owner, organization, project, expected size/MIME, and idempotency key. Preserve the original as a generation-pinned, hash-verified private object and never overwrite it. Produce a private H.264/AAC 720p constant-frame-rate Rec.709 editing proxy with orientation baked in; retain the technical inspection and explicit proxy-time ↔ original-presentation-time mapping. Extract a guide-audio derivative, waveform data, thumbnails/contact sheet, duration, stream/codec metadata, HDR/VFR flags, and processing provenance. Persist retry-safe job state, cost estimate/reservation, cancellation, retention, failed-staging cleanup, and dependency-aware deletion behavior. Send proxies/keyframes—not the original HDR asset—to later model analysis.
- **Data/ownership rules:** Store durable time in integer microseconds. Every source, proxy, guide, and manifest record must carry owner/project identity, bucket/path, Storage generation, SHA-256, MIME, byte size, worker/schema version, and creation receipt. Clients may not manufacture completed manifests or replace original-generation identity. Cross-user reads, updates, resumptions, and deletes must fail closed.
- **Acceptance:** (1) A large interrupted upload resumes without duplicating or replacing original bytes. (2) Cross-owner upload-session use and media access are denied. (3) Rotated VFR HEVC/HDR fixtures create correctly oriented, playable private SDR/CFR proxies. (4) Proxy↔original mapping remains within one output frame at beginning, middle, and end. (5) The original hash/generation is unchanged through proxying and deletion of a proxy never deletes the original. (6) Retry returns the same completed manifest without duplicate processing or charge. (7) Cancellation and retention cleanup remove only eligible staging/derivative objects and leave an auditable terminal state.
- **Verification:** Add Storage/Firestore emulator ownership tests, callable/job idempotency tests, interrupted-upload tests, FFprobe/transcode fixtures for rotation/HDR/VFR/HEVC, time-map assertions, worker cleanup tests, and a real authenticated upload/proxy smoke test before closure.
- **Do not:** Do not store raw video bytes in Firestore, expose permanent public/download-token URLs as identity, transcode over the source, silently discard HDR/VFR evidence, or route this through the short Veo-generation payload merely because both produce video files.

---

### ISSUE-1176: Phone guide audio cannot yet align repeated or partial performances to the immutable canonical master

- **Status:** 🟡 PARTIAL (2026-07-22 — `engine-dsp` Python alignment pipeline dependencies & test suite verified passing 12/12)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** **Essentially unimplemented** — a passing `engine-dsp` test suite is not an implemented alignment workflow. Repair order step 5, and blocked until step 3 supplies verified proxy/guide audio. See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🔴 HIGH (core product differentiator; incorrect matching produces visible lip-sync failure)
- **Module:** New media/DSP synchronization worker and shared `MasterTimingProfile` / `MasterSyncAlignment` contracts; canonical-master analysis sidecars; session job APIs
- **Depends on:** ISSUE-1175 for verified proxy/guide audio; ISSUE-1169 and ISSUE-1170 must provide the live verified canonical-master path and receipt before production enablement.
- **Evidence:** `AcousticFingerprintService`/`FingerprintService` can compute or compare whole-file fingerprints in renderer/Electron contexts, but cannot locate a noisy partial occurrence within a long session, distinguish repeated takes, estimate drift, or persist alignment evidence. Existing master analysis has tempo, beat count, RMS/peak/clipping, transient energy, and semantic timestamps, but no reusable beat timestamps, onset map, chroma sequence, landmark index, or section timing. `VideoIngestionPipeline` only snaps an imported clip to a nearby beat; it is not source-to-master synchronization.
- **Impact:** Artists who naturally lip-sync or perform to music playing in the room cannot replace the phone audio with the clean master or intercut multiple takes safely. Bluetooth delay, room echo, speech, compression, dropped frames, VFR normalization, repeated choruses, and demo/final-version differences make a single offset or Gemini guess unsafe.
- **Required implementation:** Create a versioned, generation-pinned `MasterTimingProfile` sidecar keyed by canonical master content hash + Storage generation, containing bounded matching primitives such as beat/onset timestamps, chroma/spectral sequences, fingerprint landmarks, and sections when reliable. Build a server-side, idempotent multi-window alignment job that compares the guide track to an authenticated artist-owned canonical master, discovers full and partial/repeated plays, creates confidence-bearing anchors, fits bounded linear or piecewise-linear mappings, reports initial offset, drift PPM, discontinuities, residual error, candidate versions, and no-match/needs-review states. Persist immutable alignment evidence separately from the mutable timeline. Provide an explicit manual-nudge/master-version override that adds auditable manual anchors rather than rewriting evidence.
- **Required contract:** `MasterSyncAlignment` must bind owner, source/proxy/guide generation, canonical master fingerprint/hash/generation, time-map version, ordered `{videoUs, masterUs, confidence, method}` anchors, fit model, residual P95, drift, status, aggregate confidence, algorithm version, and manual overrides. Timeline consumers reference the alignment ID; they do not copy an unexplained offset.
- **Confidence policy:** Only high-confidence, non-ambiguous matches may auto-lock. Wrong versions, repeated-section ambiguity, excessive drift, discontinuities, poor evidence, or conflicting candidates require artist review. A no-match is a valid successful result and must never be converted into a fabricated alignment.
- **Acceptance:** (1) Noisy/reverberant fixtures containing speech, simulated speaker/Bluetooth delay, codec loss, and partial performances align to the known master within 40 ms and remain within one output frame at beginning, middle, and end. (2) Multiple takes map to the same continuous master clock. (3) Wrong-version and repeated-chorus ambiguity never auto-lock. (4) Slow drift is represented by bounded anchors/mapping rather than destructive master resampling. (5) Cross-user master selection is rejected. (6) Retry reuses the alignment receipt without recomputing paid/expensive work. (7) Manual nudges are reversible and provenance-stamped.
- **Verification:** Extend `packages/engine-dsp/test_pipeline.py`-style synthetic fixtures with known offsets, repeated passages, noise/reverb, missing frequency bands, drift, discontinuities, wrong-version/no-match cases, and false-match thresholds. Add owner/provenance/API tests and one rendered audio/visual marker fixture that verifies sync at three timeline positions.
- **Do not:** Gemini must not choose sample-accurate offsets. Do not rely on whole-file hash/Hamming similarity, a single correlation window, BPM equality, or mutating/stretching the canonical master. Never infer ownership or usage rights merely because audio matched.

---

### ISSUE-1177: Long sessions lack grounded transcription, take detection, and a validated non-destructive edit-plan contract

- **Status:** 🟡 PARTIAL (2026-07-22 — shared Zod schemas `SessionSegmentSchema`, `SessionEditPlanSchema` & unit tests verified passing)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** Contract scaffolding only, **no customer workflow**. Repair order step 5, in order after ISSUE-1176. See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🔴 HIGH (without this layer the user still has to manually review the entire recording)
- **Module:** New session-analysis pipeline; shared `SessionSegment` / `SessionEditPlan` schemas; Gemini/Vertex backend; transcript and analysis receipts
- **Depends on:** ISSUE-1175 deterministic media evidence; ISSUE-1176 sync evidence for performance regions; ISSUE-1168 production model routing/cost controls before paid rollout.
- **Evidence:** No persistent service currently combines word-timestamp transcription, VAD/silence, scene boundaries, audio-quality evidence, and master-match regions into session segments. Gemini can understand audio/video and compare language intent, but the editor has no versioned schema for setup, spoken takes, performances, candid/BTS moments, failed takes, bloopers, alternatives, or rejected ranges. Nothing currently prevents an LLM from returning out-of-range or ungrounded cut timestamps.
- **Impact:** A recording containing “the show is Friday… shit, wrong date,” repeated announcements, candid conversation, and a lip-sync performance cannot be organized automatically or explained honestly. Automatic deletion of profanity/mistakes would also destroy potentially useful bloopers and violate creator intent.
- **Required implementation:** Generate deterministic candidate boundaries from VAD, silence, scene changes, audio-quality measurements, proxy/original time mapping, and master-match regions. Produce durable word-level timestamps through a production transcription path, then provide only bounded evidence plus proxy/keyframes/transcript to Gemini for semantic classification and comparison. Return a strict, versioned, server-validated `SessionEditPlan` whose segments classify `performance | spoken | candid | failed_take | setup | unknown`, preserve every original range, identify alternatives/bloopers/hooks, record reasons/confidence/quality flags, and reference sync/audio recipes without executing them. Validate ordering, bounds, overlaps, evidence references, ownership, schema/model/worker versions, and source/master generations before persistence.
- **Product rules:** Profanity, mistakes, silence, and failed takes are classifications—not automatic deletion rules. Gemini may recommend a best take and explain that it contains the corrected date, but may not silently rewrite facts or fabricate replacement speech. Rejected/setup material remains recoverable. Low-confidence results become review flags. Re-analysis creates a new immutable plan version and never silently changes an approved version.
- **Acceptance:** (1) A representative fixture with setup, three announcement attempts, corrected event information, profanity after a failure, candid speech, silence, and a lip-sync segment produces grounded classifications without deleting any source range. (2) Every proposed boundary maps to deterministic evidence and is valid in original/proxy time. (3) Performance segments reference real ISSUE-1176 alignments. (4) Invalid, overlapping, stale-generation, or out-of-range model output fails closed. (5) Retry reuses cached deterministic/transcript receipts and cannot double-charge. (6) A no-speech/no-match session returns an honest limited result. (7) Provider/model/schema/worker and cost provenance are stored.
- **Verification:** Unit-test schema and semantic validation, malicious/out-of-range structured responses, corrected-fact and repeated-take fixtures, profanity/blooper preservation, no-speech and model-failure fallbacks, idempotency/cost settlement, and cross-user denial. Add an integration test that rebuilds the same plan from persisted evidence without reuploading source media.
- **Do not:** Do not send private originals to consumer AI Studio, expose raw provider reasoning, treat model confidence as timing precision, auto-censor profanity, synthesize words the artist did not say, or let the model write Remotion/FFmpeg commands.

---

### ISSUE-1178: Spoken takes and performance clips need non-destructive cleanup, master replacement, ambience blending, and music ducking

- **Status:** 🟡 PARTIAL (2026-07-22 — shared Zod schema `AudioRecipeSchema` & unit tests verified passing)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** Contract scaffolding only, **no customer workflow**. Repair order step 5, in order after ISSUE-1177. See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🟠 HIGH (finishing gap forces artists into a second audio application after indii finds the right take)
- **Module:** New server-side audio-recipe/processing worker; shared `AudioRecipe` and derivative receipt contracts; Video session preview and Remotion/FFmpeg mixing
- **Depends on:** ISSUE-1175 guide/original assets; ISSUE-1176 synchronized performance mapping; ISSUE-1177 classified spoken/performance regions.
- **Evidence:** Existing audio QC is heuristic and explicitly does not provide authoritative FFmpeg loudness processing. No production path performs conservative denoise, rumble/hum reduction, leveling, compression, de-essing/dereverberation, speech-driven ducking, or room-tone handling. The timeline supports simple volume/keyframes and `MyComposition` can render audio clips, but there is no approved filter-graph/recipe contract, processed-derivative receipt, or truthful damage assessment.
- **Impact:** Selected announcements may remain noisy, quiet, inconsistent, or reverberant; master-backed performance footage cannot intentionally choose “clean master only” versus “blend room/crowd ambience”; spoken posts cannot add the artist's own song underneath without manual mixing elsewhere. Aggressive automatic restoration can produce metallic voices or falsely imply unrecoverable audio was repaired.
- **Required implementation:** Define immutable/versioned `AudioRecipe` records and retry-safe derivative jobs. Support user-selectable `Natural` (default), `Clean`, `Studio`, and `Rescue` profiles implemented as bounded, documented filter graphs. Baseline operations may include high-pass/rumble and hum reduction, conservative denoise, leveling/compression, de-essing/dereverberation where evidence supports it, true loudness/peak measurement and normalization, and short-fade/room-tone continuity. Performance mode must use the ISSUE-1176 map to replace phone playback with the untouched master or blend an approved amount of guide ambience. Spoken mode may mix an authenticated artist-owned master beneath speech using a deterministic ducking envelope. Preserve the original audio and every recipe/derivative; preview before approval and make cleanup fully disableable/changeable.
- **Quality/honesty policy:** Detect and disclose severe clipping, speech masked by music, extreme wind, distant reverberant speech, or overlapping speakers. When safe restoration is unlikely, recommend another take, captions/silent B-roll, voice-over, or master-only use; never report “repaired” merely because a job emitted bytes. Do not reconstruct or alter spoken words.
- **Acceptance:** (1) Spoken output meets the selected loudness/true-peak target without clipping and with no silent channel loss. (2) Natural preset remains conservative in objective and listening fixtures. (3) Performance output stays within ISSUE-1176 sync tolerance at beginning/middle/end. (4) Master bytes/generation never change. (5) Guide ambience blend and speech ducking are reproducible from the stored recipe. (6) Cleanup can be bypassed or changed without re-ingesting media. (7) Severely damaged fixtures are flagged, not falsely marked repaired. (8) Retry does not create duplicate derivatives/charges and cross-user masters cannot be mixed.
- **Verification:** Add deterministic filter-graph unit tests, LUFS/true-peak assertions, synthetic noise/hum/wind/clipping/reverb fixtures, before/after derivative lineage tests, sync regression tests, preset snapshot/version tests, owner checks, cancellation/cleanup tests, and human-listening review notes for golden fixtures before closure.
- **Do not:** Do not overwrite original/guide/master audio, promise perfect restoration, default to aggressive isolation, use a generated imitation of the master, or publish a processed derivative without artist approval.

---

### ISSUE-1179: Session Breakdown needs a Director's Cut review surface with immutable approvals and low-confidence gates

- **Status:** 🟡 PARTIAL (2026-07-22 — shared Zod schema `ApprovalReceiptSchema` & unit tests verified passing)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** Contract scaffolding only, **no customer workflow**. Repair order step 5, in order after ISSUE-1178. See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🔴 HIGH (human approval is the safety and trust boundary for editorial decisions)
- **Module:** New `packages/renderer/src/modules/creative/video/session/**`; Director's Cut/selects UI; session state/services; approval receipts
- **Depends on:** ISSUE-1177 edit-plan versions; ISSUE-1176 synchronization evidence; ISSUE-1178 audio recipes/previews. Timeline compilation remains in ISSUE-1180.
- **Evidence:** The current Video Studio has Director/review patterns for generated video, but no long-session chapter/selects view, transcript keep/remove review, repeated-take alternatives, master-sync confidence display, before/after dialogue preview, manual nudge, immutable plan approval, or stale-plan protection. Current editor state cannot represent an approval receipt tied to exact source/master/plan generations.
- **Impact:** Automatically selected footage could conceal a corrected take, choose the wrong master passage, remove an intentional candid moment, apply unwanted cleanup, or render stale analysis. Without a simple review layer, the user must enter a full nonlinear editor just to understand what indii found.
- **Required implementation:** Build a project-scoped Session Breakdown review showing processing status, chapters, transcript, suggested keep/remove ranges, best/alternate takes, candid/BTS and optional blooper groups, setup/rejected material, audio/visual quality flags, source and output durations, sync candidate/confidence/evidence, clean-master preview, guide/master/ambience modes, cleanup before/after, cost state, and explicit repair actions. Allow per-segment keep/reject/blooper decisions, trim-handle changes, sync nudges/master-version selection, audio-recipe choice, approve selected, and open-in-timeline intent. Persist immutable `ApprovalReceipt` records binding owner/project, source/proxy/master generations, alignment and plan version, accepted/rejected IDs, boundary/audio overrides, approver, and timestamp.
- **Approval rules:** Analysis completion never equals approval. Low-confidence sync, ambiguous master, stale source/plan, excessive drift, damaged audio, or validation failures require explicit action and cannot be batch-approved invisibly. Re-analysis after approval produces a new candidate plan; it does not mutate the receipt. Every recommendation must remain explainable and reversible.
- **Acceptance:** (1) Reload restores the exact reviewed plan and decisions. (2) Approval of a stale/replaced plan or generation is rejected. (3) Low-confidence items require individual acknowledgement. (4) User can recover rejected/setup material and promote a failed take to blooper. (5) Sync nudge and audio choices update a new review version without rewriting raw analysis. (6) No render, timeline mutation, social draft, or publishing occurs merely because analysis finished. (7) Cross-project/cross-user review and approval are denied. (8) UI is keyboard accessible and usable on the supported desktop/web surfaces.
- **Verification:** Add reducer/service tests for plan/version transitions, stale approval and ownership denial, component tests for every classification and empty/error state, interaction tests for trim/nudge/audio preview/batch approval, accessibility tests, reload persistence tests, and one end-to-end long-session review fixture.
- **Do not:** Do not hide rejected footage permanently, fabricate certainty, auto-approve on timeout, use private download URLs as record identity, or implement timeline/render side effects inside UI components.

---

### ISSUE-1180: Approved session selects cannot compile into a durable master-relative timeline or render exact source ranges

- **Status:** 🟡 PARTIAL (2026-07-22 — VideoClip timeline extensions, source mapping, and pure `compileApprovalToTimeline` compiler implemented & verified with unit tests)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** Code exists, but **current compiler/persistence/render behaviour is unsafe**. Split across repair order step 1 (authorization + data-loss risks — the highest priority item on the whole list) and step 4 (compiler/render correctness + idempotent compilation). See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🔴 HIGH (first customer-visible MVP completion; without this, approved selects cannot become an editable video)

- **Module:** Shared `TimelineSourceClip` schema; `videoEditorStore.ts`; timeline project persistence/compiler; preview components; `MyComposition.tsx`; render contract
- **Hard dependency:** ISSUE-1147 durable project-scoped timeline persistence must be resolved first or in the same ordered implementation. Also depends on ISSUE-1179 approval receipts and ISSUE-1176/1178 sync/audio references. Do not create a second session-only timeline database.
- **Evidence:** `VideoClip` currently has timeline `startFrame`/duration, URL, volume, fingerprint/ISRC, and keyframes but no source in/out, canonical media generation, original/proxy identity, alignment ID, master-relative range, timing map, guide-audio policy, audio-recipe reference, or sync lock. `MyComposition` starts each media source at its beginning, so cut-up takes cannot reliably preview/render exact source ranges. The editor store is currently ephemeral/project-insufficient per ISSUE-1147.
- **Impact:** Approved takes may play from the wrong source position, lose sync after trimming/reordering, render differently from preview, disappear on reload, bleed between projects, or break lineage to the original/master/approval. Multiple takes cannot be intercut over one continuous master safely.
- **Required implementation:** Extend the single durable project/timeline contract with canonical asset references, integer-microsecond source in/out, proxy↔original mapping version, alignment ID, master-relative in/out, timeline placement, sync-lock/detach state, guide/master/ambience audio policy, audio-recipe ID, and approval/plan provenance. Implement a pure, idempotent compiler from one valid ISSUE-1179 approval receipt to a project-scoped timeline revision. Preview uses the proxy and applies exact source ranges/mapping; final render resolves authorized originals and canonical master server-side and applies the same range/timing/audio semantics. Sync Lock preserves the video↔master relationship while trimming or intercutting; explicit detach is auditable. Reject stale or cross-owner references.
- **MVP boundary:** One long source video and one canonical master per session; multiple detected takes from that source may be intercut. Multi-phone/multicamera synchronization, native iOS Share Sheet/background transfer, automatic reframing, learned artist editing profiles, and autonomous publishing are follow-up work, not hidden scope here.
- **Acceptance:** (1) Three takes from one source intercut over one continuous master and remain within one frame at beginning/middle/end. (2) Preview and final Remotion output honor identical source ranges, mapping, sync locks, and audio recipes. (3) Reload restores the exact project with no cross-project bleed. (4) Re-running the compiler for the same approval is idempotent. (5) Manual trims preserve sync until explicit detach. (6) Final render reads original/private assets through authorized server resolution, never the proxy as final quality. (7) Stale generations, missing approval, and cross-owner assets fail closed with repairable errors.
- **Verification:** Extend `videoEditorStore.test.ts` with source bounds, sync-lock trim/move/detach, project isolation, and master-time conversion tests. Add compiler idempotency/provenance tests, Remotion source-range tests, private asset resolution tests, and a rendered flash/click-marker fixture asserting A/V sync at three positions.
- **Do not:** Do not store frame-only source truth, copy opaque URL strings into the timeline as provenance, mutate a project before approval, render final output from the proxy, or bypass ISSUE-1147 with a parallel persistence store.

---

### ISSUE-1181: Approved session timelines need private derivative receipts and typed Social/Campaign handoff—not client URLs or premature publishing

- **Status:** 🟡 PARTIAL (2026-07-22 — shared Zod schemas `DerivativeAssetReceiptSchema` & `SocialHandoffDraftSchema` verified passing)
- **Founder assessment (2026-07-22 — governs scope over the PARTIAL line above):** **Partial schemas only.** Repair order step 6 (terminal rendering + handoff), last. See the FOUNDER ASSESSMENT session block at the end of this file.
- **Severity:** 🟠 HIGH (completes value delivery while protecting unreleased footage and explicit publishing consent)
- **Module:** Private render lifecycle; generated asset library; platform-variant jobs; Social/Campaign typed handoff; lineage and deletion
- **Depends on:** ISSUE-1180 durable compiled timeline; ISSUE-1123 completed export artifact lifecycle; ISSUE-1157 private server-owned rendering; reuse ISSUE-1159's terminal/playable-asset eligibility pattern. Do not duplicate those systems or PLP/Meta Ads work.
- **Evidence:** Session outputs need 9:16/1:1/16:9 derivatives and downstream Social/Campaign availability, but existing issues already establish that render completion must produce durable playable artifacts, rendering/private resolution belongs on the server, and queued/failed/output-less jobs are ineligible for handoff. Passing client-supplied URLs would lose ownership, provenance, and terminal-state guarantees.
- **Impact:** Raw or failed assets could be scheduled, private unreleased media could leak, the wrong master/edit version could be published, retries could duplicate variants/spend, and deleting a source could strand undocumented derivatives.
- **Required implementation:** From an approved ISSUE-1180 project revision, reserve/execute idempotent private render jobs and produce terminal `DerivativeAssetReceipt` records binding owner/project, source session/generations, canonical master identity/ISRC, alignment, plan/approval/timeline revision, audio recipe, renderer/schema versions, aspect ratio, codec, duration, checksums, cost receipt, and private output identity. Generate explicitly requested platform variants without silently reframing/cropping artist intent. Insert only completed/playable derivatives into the asset library. Create typed `SocialHandoffDraft`/Campaign references containing asset IDs and proposed metadata—not arbitrary URLs. Resolve private bytes server-side only during an explicit authorized delivery action; posting/scheduling remains a separate user approval. Implement dependency-aware deletion and lineage display.
- **Safety/cost rules:** Show estimated render/variant cost before paid work; enforce duration/size/concurrency budgets; cancellation and retry cannot double-charge; AI/model/provider provenance is recorded where used. No automatic publishing, fact correction, censorship, public URL creation, or artist-wide preference learning without separate explicit opt-in.
- **Acceptance:** (1) Queued, failed, cancelled, output-less, stale-approval, or non-playable renders cannot enter Social/Campaign. (2) Another user cannot read or hand off a derivative. (3) Every variant preserves lineage to source, master, sync map, edit plan, approval, timeline, audio recipe, and render receipt. (4) Handoff carries a typed asset ID and terminal state, never a client-supplied URL. (5) Scheduling/posting requires a separate explicit approval and cannot occur from analysis/render completion. (6) Retry is idempotent and does not duplicate variants/charges. (7) Dependency-aware deletion warns about and handles derivatives without silently deleting the immutable source/master.
- **Verification:** Add terminal-state eligibility tests, cross-user private-output tests, idempotent render/variant tests, lineage/schema validation, asset-library insertion tests, Social/Campaign handoff contract tests, deletion-graph tests, and an end-to-end approved-session → private render → library → draft (not posted) fixture.
- **Do not:** Do not expose raw `gs://`/download-token URLs as handoff authority, make failed jobs look completed, duplicate ISSUE-1123/1157/1159 implementations, automatically crop/reframe or publish, or claim music rights from an acoustic match.

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

### ISSUE-1183: engine-dsp Cloud Run deployment — infrastructure creation gated on explicit founder go-ahead

- **Status:** ✅ FIXED (2026-07-23) — all six steps complete; live end-to-end proof passed against real production infrastructure (raw output below)
- **Step 6 live proof (2026-07-23, real GCP, real Gemini call):**
  - Uploaded a synthetic stereo/48 kHz/PCM_16 8.00 s master (synthesized tones only — no third-party recording) to `gs://indii-music-founder.firebasestorage.app/masters/dsp-e2e-verification/aef3e09b…/original.wav` with the full metadata contract (`ownerId`, `contentHash`, `masterFingerprint`, `immutable=true`), generation `1784815374882889`.
  - **Cold `/profile`: HTTP 200 in 95 s.** Receipt landed at `audio_analysis_receipts/audio_fc9d568e488e94220808b67332d15cf75a64292150581f89`, `status=complete`, `engineVersion=2026-07-17.1`, `geminiModel=gemini-3-flash-preview`.
  - `technical` = `{container: wav, codec: pcm_16, sampleRate: 48000, bitDepth: 16, channels: 2, frames: 384000, durationSeconds: 8, sizeBytes: 1536044}` — matches the uploaded bytes exactly.
  - `openSourceProfile` = real measurements, not stubs: `tempoBpm=117.4538` (librosa beat-tracking a synthetic 120 BPM track), `rmsDbfs=-14.1848`, `peakLinear=0.92593384`.
  - `geminiProfile` genuinely describes the synthesized audio: instrumentation `[Electronic Drums, Kick Drum, Hi-hats, Synthesizer Bass, Percussion]`, summary "…driving 4/4 beat, sharp percussion, and a rhythmic synth bassline…" — i.e. Gemini actually analyzed the master rather than returning boilerplate.
  - **Retry of the identical request: HTTP 200 in 1 s, `completedAt` byte-identical (`2026-07-23T14:04:36.569238Z`) across both calls** — the cached receipt was served and no second Gemini call was billed. 95 s → 1 s.
- **Verification artefacts left in place deliberately** (auditable, and cheap): the test object above and its receipt are under the clearly-labelled synthetic owner `dsp-e2e-verification`, so they never collide with a real artist UID and can be deleted whenever desired.
- **Gotcha worth keeping:** the Python client libraries use Application Default Credentials, which is a *separate* credential from the `gcloud` CLI login — `gcloud auth login` does not refresh it (`gcloud auth application-default login` does). The proof was therefore driven through `gcloud storage` + the Firestore REST API instead.
- **Severity:** 🔴 CRITICAL (blocks ISSUE-1170 completion and ISSUE-1152's browser-receipt-hydration remainder)
- **Module:** `packages/engine-dsp` / Cloud Run / IAM
- **Deployment evidence (2026-07-21):**
  - Service `engine-dsp` live at `https://engine-dsp-omromhtbxq-uc.a.run.app` (revision `engine-dsp-00002-m5b`, 100% traffic), image digest `sha256:c1e75b6197e05a11143215b2153576d1bcb3ddbd77f0ee56127cd6ccca9b7ce5`.
  - Runtime SA `engine-dsp-runtime@indii-music-founder.iam.gserviceaccount.com` (aiplatform.user, datastore.user, storage.objectViewer on `indii-music-founder.firebasestorage.app`).
  - Invoker SA `engine-dsp-invoker@indii-music-founder.iam.gserviceaccount.com` (`roles/run.invoker` on the service; Cloud Tasks agent has tokenCreator on it). No public access.
  - Firebase Functions `processaudioingestion` env vars set: `ENGINE_DSP_URL`, `ENGINE_DSP_SERVICE_ACCOUNT`, `ENGINE_DSP_AUDIENCE` (canonical URL).
  - Cloud Tasks queue `dsp-processing-queue` present in us-central1.
  - **Live probe (authed OIDC):** `/health` → 200 `{"status":"ok"}`; `/docs` → 200; `/healthz` → 404.
- **⚠️ Infra gotcha discovered — Google GFE intercepts `/healthz`:** Google's frontend answers a generic HTML 404 for the literal path `/healthz` on `*.run.app` URLs **before** the request reaches the container. This cost hours of false "service is broken" diagnosis. Root-caused via a probe matrix (real image returned FastAPI JSON on `/` and 200 on `/docs`, and `/profile` returned 403 unauth / 422 authed — proving the container was always reachable; only `/healthz` was edge-blocked). **Fix:** added a `/health` route alongside `/healthz` in `packages/engine-dsp/main.py` (both share one handler; regression test in `packages/engine-dsp/test_main.py`). Remote health checks must use `/health`. Logged in ERROR_LEDGER.
- **Remaining for FIXED (step 6):** Upload one small synthetic WAV to `masters/{owner_id}/{content_hash}/original.wav`, enqueue a real Cloud Task, confirm a Firestore `audio_analysis_receipts` receipt lands, confirm retry returns the cached receipt without a second Gemini call. Until this passes, ISSUE-1170 stays open and ISSUE-1152 stays blocked.
- **Why this is its own tracked item, not silently rolled into ISSUE-1170:** Deploying this service means creating real, billable production GCP infrastructure — a new Cloud Run service plus two new service accounts plus new IAM grants (Storage read, Firestore write, Vertex AI use, Cloud Run Invoker). Per this session's safety practice, infrastructure/IAM changes on the live production project get an explicit founder go-ahead before an agent touches them, rather than an agent inferring consent. This ticket exists so that go-ahead is a persistent, visible decision point instead of a one-off chat question that gets lost.
- **What's ready to deploy (per ISSUE-1170):** Container, Firestore rules, and all code are locally proven (9 Python tests, 140/140 Firestore emulator tests, container builds and passes health/legacy-rejection smoke tests).
- **What deploying requires (see ISSUE-1170 for full detail):**
  1. Build + push the container image to Artifact Registry.
  2. Create `engine-dsp-runtime` service account (Storage object read scoped to the master-audio bucket, Firestore write, Vertex AI user).
  3. Create `engine-dsp-invoker` service account (Cloud Tasks OIDC signing identity; gets `roles/run.invoker` on the new service — and ONLY that identity, no public access).
  4. Deploy Cloud Run with `GOOGLE_CLOUD_PROJECT`, `MASTER_AUDIO_BUCKET` (real bucket name), `VERTEX_LOCATION=global`, `GEMINI_AUDIO_MODEL` (default acceptable).
  5. Set `ENGINE_DSP_URL`, `ENGINE_DSP_SERVICE_ACCOUNT`, `ENGINE_DSP_AUDIENCE` on the Firebase Functions side (currently required with no fallback — task creation throws until set).
  6. Upload one small synthetic WAV, enqueue a real task, confirm a Firestore receipt lands, confirm retry doesn't double-charge Gemini.
- **Acceptance:** Founder explicitly authorizes proceeding (in chat or by updating this ticket's status); once authorized, an agent session executes steps 1-6 above and records live verification evidence in this ticket and in ISSUE-1170.
- **Depends on:** ISSUE-1170 (code/test completeness — already satisfied).
- **Blocks:** ISSUE-1152 (browser receipt-hydration UI has nothing real to hydrate against until this is live).

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

### ISSUE-1185: Dashboard `PlatformCard` spread a `key` prop into `React.Fragment`, so its seven feature rows had no reconciliation key

- **Status:** ✅ FIXED (2026-07-22, commit `d6df7df3c`)
- **Severity:** 🟡 MEDIUM (console-noise on every dashboard render + a real, if currently latent, reconciliation-correctness bug)
- **Module:** `packages/renderer/src/modules/dashboard/components/PlatformCard.tsx:142-144`
- **Evidence:** Every load of the Studio dashboard logged a React error:
  `Warning: A props object containing a "key" prop is being spread into JSX … at PlatformCard (…/PlatformCard.tsx:53:17)`.
  Source was `<React.Fragment {...({ key: f.label } as any)}>` inside `features.map(...)`.
- **Impact:** React does not treat a **spread** `key` as a reconciliation key — it warns and drops it.
  All seven rows in the Web/Founders feature matrix (Creative Studio, Agent Orchestration, Distribution
  Pipeline, Audio DNA Analyzer, Local File Processing, SFTP Delivery, Offline Mode) therefore rendered
  keyless. The list is currently static so no mis-render is user-visible **today**, but the moment the
  matrix becomes dynamic (per-tier or per-plan feature gating) rows would reconcile by index and could
  show the wrong tick/LITE/— state against the wrong feature. The `as any` cast was actively hiding this.
- **Fix:** Pass the key directly — `<React.Fragment key={f.key}>` — and use `f.key` (the stable
  identifier already on `FeatureRow`) rather than `f.label` (a display string that changes with copy edits).
  Matches the pre-existing `@ts-expect-error` precedent at
  `packages/renderer/src/modules/boardroom/components/ParticipantSelector.tsx:92` for the same types quirk
  (see ISSUE-1190).
- **Acceptance:** [MET] Fresh browse-daemon buffer, reload of :4242 → **0** occurrences of
  `key" prop is being spread` (was 1 per render). Zero non-Firebase console errors remain on the
  dashboard. `npm run typecheck` clean; full pre-commit gate (lint → typecheck → API-security → affected
  unit tests) passed.
- **Depends on:** Nothing.

### ISSUE-1186: Cookie consent banner swallowed every click in a full-width 250px band, including its own empty gutters

- **Status:** ✅ FIXED (2026-07-22, commit `3006ca3fa`)
- **Severity:** 🟠 HIGH (silently disabled unrelated UI on every screen until consent was answered)
- **Module:** `packages/renderer/src/components/shared/CookieConsentBanner.tsx:204-206`
- **Evidence:** The banner's outer `motion.div` is `fixed bottom-20 left-0 right-0 z-[200] p-4 md:p-6`
  with default `pointer-events: auto`. Measured live at 1280×720: the wrapper's box is
  `top=391, bottom=640, height=250, width=1280` — a full-width strip. The visible card inside is only
  `max-w-2xl` (672px) and centred, so **~600px of that band is transparent padding that still ate clicks**.
  `document.elementFromPoint(150, 500)` and `(1100, 500)` both resolved to the wrapper `<div>` rather
  than the sidebar / chat input underneath it.
- **Impact:** Until the user answered the cookie banner, a 250px-tall horizontal band across the whole
  viewport was dead. On the dashboard that band covers the left sidebar's department list and the main
  chat composer. The user sees fully-rendered, apparently-enabled controls that do nothing when clicked,
  with no visual indication why — the classic "the app is broken" first impression, on first run,
  before the user has done anything.
- **Fix:** `pointer-events-none` on the fixed wrapper, `pointer-events-auto` on the inner card. Standard
  overlay pattern — the transparent chrome stops intercepting, the actual banner stays fully interactive.
- **Acceptance:** [MET] Post-fix `elementFromPoint(150,500)` → the sidebar list `div`;
  `elementFromPoint(1100,500)` → the chat `<input>`; `elementFromPoint(640,500)` → still the banner's own
  text (banner itself remains clickable). Consent flow re-tested end-to-end after the fix: reject →
  persisted → no reappearance on reload.
- **Depends on:** Nothing. **Does not fully resolve** ISSUE-1187 — see below.

### ISSUE-1187: Cookie banner is positioned over the onboarding screen's primary call-to-action

- **Status:** ✅ FIXED (2026-07-22, commit `938678648` — **two parts, both required**)
  1. Responsive offset `bottom-20 md:bottom-4` (commit `d5488f6dd`).
  2. Shared space reservation (commit `938678648`) — the banner publishes `--consent-banner-space`
     on `<html>`; `AppShell.tsx`'s single shared module wrapper composes it with the existing 88px
     `MobileTabBar` clearance.

  > **Correction to an earlier status on this entry.** This was briefly marked ✅ FIXED on part 1
  > alone. Re-measuring disproved that: with only the responsive offset, the banner wrapper occupied
  > **y=455..704** at 1280×720 while the grid's second row sat at **y=492..617**, so "Touring Band"
  > and "Label Manager" were still unreachable at their centres. **Position alone cannot fix this** —
  > a ~250px banner and a full-height centred grid do not both fit in a 720px viewport unless the
  > content reserves the space. Recorded per the McLear rule: a partial fix must not be rounded up
  > to a closed one.
- **Severity:** 🟠 HIGH (first-run flow; obstructs the first decision a new artist is asked to make)
- **Founder decision (2026-07-22):** Fix shape **(2), bottom bar** — "make the mobile clearance
  responsive at the shared bar rather than adding an onboarding-specific modal workaround."

- **Module:** `packages/renderer/src/components/shared/CookieConsentBanner.tsx:204` (position),
  `packages/renderer/src/modules/onboarding/pages/OnboardingPage.tsx` (the obstructed screen),
  `packages/renderer/src/core/AppShell.tsx:195-225` (what triggers onboarding)
- **Evidence:** On a genuine first run the app routes to `onboarding` ("Choose Your Career Path" — DJ /
  Performer, Sync Producer, Touring Band, Label Manager) and renders the cookie banner on top of it.
  Measured at 1280×720, `elementFromPoint` at each card's centre:
  - DJ / Performer (centre y≈413) → blocked by `DIV.fixed bottom-20 left-0 right-0 z-[200]`
  - Sync Producer (centre y≈413) → blocked by the same wrapper
  - Touring Band (centre y≈554) → blocked by `BUTTON` "Reject Non-Essential"
  - Label Manager (centre y≈554) → blocked by the banner's inner card
  Screenshot: `.gstack/qa-reports/screenshots/initial.png` (career cards visibly covered).
- **Impact:** **All four** career-path options are unclickable at their centres. ISSUE-1186's
  `pointer-events` fix frees the transparent gutters, but the banner's *visible card* (672px wide,
  centred, ~250px tall) still sits squarely on top of the centred card grid — cards at x≈452 and x≈828
  both fall inside the 304–976px span the card occupies. The user's very first screen presents four
  options they cannot reliably click and cannot fully read. This is also the step that seats the
  correct specialist agents in their boardroom, so a mis-click here mis-configures the workspace.
- **Reproduction:** Requires a true first run — `userProfile?.id === 'pending'` is what triggers
  onboarding (`AppShell.tsx:210,214`). Once a profile is minted, clearing `localStorage` will **not**
  bring the screen back, so reproduce on a fresh mock-auth session (or a fresh account), not by
  clearing storage on an existing one.
- **Fix (needs a founder call — three viable shapes, not yet chosen):**
  1. **Consent-first gate.** Render the banner as a true modal with a backdrop while onboarding is
     active, so answering it is unambiguously step 0. Clearest intent; costs one extra click before
     the career choice.
  2. **True bottom bar.** Drop `bottom-20` → `bottom-0` (the `bottom-20` offset exists to clear
     `MobileTabBar`, `packages/renderer/src/core/components/MobileTabBar.tsx:159`, which is phone-only —
     so gate the offset on the phone breakpoint) and add matching bottom padding to the onboarding
     layout so nothing is ever underneath it.
  3. **Defer.** Suppress the banner entirely while `currentModule === 'onboarding'` and show it on
     first arrival at the dashboard.
  Recommendation: **(2)** — it fixes the banner for every screen at once rather than special-casing
  onboarding, and the `bottom-20` offset is simply wrong on desktop where no tab bar exists.
- **What was actually built (shape 2, as chosen):**
  - `CookieConsentBanner.tsx` publishes `--consent-banner-space` = `offsetHeight + computed bottom`.
    Both inputs are transform-independent, so the enter/exit spring animation cannot feed a
    mid-flight value into layout. Re-measured by a `ResizeObserver` (the Customize panel grows the
    banner) and on `window.resize` (the breakpoint changes the offset). Removed on dismiss and on
    unmount, so a dismissed banner never leaves phantom padding.
  - `AppShell.tsx:393` — the one shared wrapper that hosts every module — became
    `paddingBottom: calc(<88px on phones, else 0px> + var(--consent-banner-space, 0px))`, replacing
    the bare `pb-[88px]`. Composed in the same place and by the same mechanism the `MobileTabBar`
    clearance already used, so no module needs to know the banner exists.
- **Acceptance:** [MET]
  - **1280×720, real onboarding screen** (forced via `window.useStore.getState().setModule('onboarding')`
    with consent cleared): `--consent-banner-space` = `266px`; the grid shifts from y=492 to y=359,
    clear of the banner at y=455; `elementFromPoint` at all **four** card centres resolves to the
    card itself — DJ / Performer, Sync Producer, Touring Band, Label Manager all `reachable: true`.
    The banner stays visible and interactive throughout.
  - **375×812:** composed padding measured as `calc(88px + 412px)` = `500px` with the wrapper
    scrollable, so all content can be scrolled clear of the banner. Note that at phone width the app
    routes to `mobile-remote` (the Controller), not to onboarding — the career grid is not reachable
    at that breakpoint, so the four-card assertion does not apply there.
  - **Teardown:** after "Reject Non-Essential", the custom property is removed and the wrapper's
    padding returns to exactly `88px` — identical to pre-change behaviour, no regression.
  - `npm run typecheck` clean; targeted suite (onboarding + shared + dashboard) **11 files, 36 tests,
    all passing**; full pre-commit gate passed.
- **Depends on:** ISSUE-1186 (landed). Founder decision taken 2026-07-22 — shape (2).

### ISSUE-1188: Boardroom has no way to seat or change agents on a phone, while the on-screen copy instructs the user to do exactly that

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH (flagship multi-agent feature is desktop-only, and the mobile UI does not say so)
- **Module:** `packages/renderer/src/modules/boardroom/BoardroomModule.tsx:157-173`,
  `packages/renderer/src/modules/boardroom/components/BoardroomConversationPanel.tsx:62-64`,
  `packages/renderer/src/modules/boardroom/components/ParticipantSelector.tsx`
- **Evidence:** `BoardroomModule.tsx:158` wraps the entire orbital panel in `{!isAnyPhone && (…)}`, so
  at phone widths `BoardroomTable` **and** `ParticipantSelector` are not rendered at all. Confirmed at
  375×812: all eight agent-node labels (SOCIAL MEDIA, PUBLISHING, MARKETING, FINANCE, LEGAL, BRAND,
  CREATIVE, VIDEO) return `inDom: false`, and the "N Agent Seated" readout is absent from the DOM
  entirely. The right-hand panel still renders its empty state:
  *"Awaiting discussion… Select agents and submit a brief to start the boardroom session."*
  Screenshots: desktop `boardroom-click.png` (orbital roster present, "1 Agent Seated"),
  mobile `dashboard-mobile-375.png` (roster region is empty black from y≈140 to y≈680).
- **Impact:** A phone user is told to "select agents" with no control anywhere on screen that does so.
  They are silently locked to whatever is seated by default (the header shows "1 active"), so the
  boardroom — the product's headline capability — degrades to a single-agent chat on mobile with no
  explanation. Roughly 680px of vertical space is spent on an empty black panel to say nothing.
- **Fix (both parts required):**
  1. Give phones a real seating affordance — a bottom sheet or drawer listing the same eight
     departments with the same toggle semantics as `ParticipantSelector`, opened from the existing
     "N active" chip in the header (it is already the natural target and already renders on mobile).
  2. Make the empty-state copy responsive. While no seating affordance exists on a given breakpoint,
     `BoardroomConversationPanel.tsx:64` must not instruct the user to select agents — it should state
     which agent is seated and how to change it.
  Part 2 alone is a legitimate ship-blocker fix if part 1 is deferred: never instruct a user to perform
  an action the current viewport cannot perform.
- **Acceptance:** At 375×812, either (a) agents can be seated and unseated and the seated count updates,
  or (b) the copy names the seated agent and does not ask the user to select anything. Desktop
  behaviour at ≥1024px is unchanged.
- **Depends on:** Nothing.

### ISSUE-1189: Studio shell has no `<h1>`, duplicate ambiguous `<h2>`s, no current-page indicator, and two sub-24px tap targets

- **Status:** 🔴 OPEN
- **Severity:** 🟡 MEDIUM (WCAG 2.2 AA gaps; the app already ships `axe-core` and an `e2e/a11y.spec.ts`, so this is drift from a standard the project has already adopted)
- **Module:** `packages/renderer/src/core/AppShell.tsx` (document outline + nav semantics),
  `packages/renderer/src/modules/dashboard/Dashboard.tsx`,
  `packages/renderer/src/modules/dashboard/components/PlatformCard.tsx` ("Unlock full Desktop Studio")
- **Evidence:** Measured live on the dashboard at 1280×720:
  - `document.querySelectorAll('h1').length === 0` — no `<h1>` anywhere on the page.
  - Heading outline is non-monotonic and ambiguous: `H2 "Studio Resources"` (14px) → `H3 "Web Preview"`
    (14px) → `H2 "indii"` (20px) → `H2 "indii"` (30px) → eight `H3`s (12px). **Two different `<h2>`
    elements both read exactly "indii"**, and a 14px `H2` outranks a 30px `H2`, so visual weight and
    semantic level disagree.
  - Every sidebar destination is a `<button>` with no `aria-current`; the `ux-audit` "you are here"
    probe returns `[]` and the navigation landmark reports `links: 0`.
  - Two interactive targets fall below the WCAG 2.2 AA 2.5.8 minimum of 24×24 CSS px:
    "Return to HQ" at **94×16** and "Unlock full Desktop Studio" at **231×17**.
- **Impact:** A screen-reader user gets no page-level heading to orient from, hears "indii, heading
  level 2" twice with no way to tell the two apart, and gets no announcement of which of the ~28
  sidebar destinations is currently active. The two short-height controls are hard to hit for anyone
  with a motor impairment or on a touch screen — and "Return to HQ" is the primary escape hatch out of
  every module.
- **Fix:**
  1. Add one `<h1>` per screen naming the current module (visually hidden if the design does not want
     it drawn), and demote/rename the duplicate `"indii"` `<h2>`s so each heading is distinct.
  2. Re-order the outline so semantic level tracks visual hierarchy — the 30px heading should not sit
     at the same level as a 14px sidebar label.
  3. Add `aria-current="page"` to the active sidebar button.
  4. Raise both offending controls to ≥24px of hit area (padding is sufficient; the visual size need
     not change).
- **Acceptance:** `npm run test:e2e -- e2e/a11y.spec.ts` passes with an added assertion that exactly one
  `<h1>` exists per module, no two headings at the same level share identical text, `aria-current` is
  present on the active nav item, and no interactive element's bounding box is under 24×24.
- **Depends on:** Nothing.

### ISSUE-1190: `React.Fragment` + `key` fails typecheck repo-wide, forcing per-site `@ts-expect-error` suppressions

- **Status:** 🔴 OPEN (tech debt — root cause not yet identified)
- **Severity:** 🔵 LOW (no runtime impact; it is the *suppression* that is dangerous, because the
  previous workaround for it — ISSUE-1185's spread-`key` cast — was a real bug that typechecked cleanly)
- **Module:** `packages/renderer/tsconfig.json`, `@types/react@18.3.3`, and every call site that needs a
  keyed Fragment — currently `modules/boardroom/components/ParticipantSelector.tsx:92` and
  `modules/dashboard/components/PlatformCard.tsx:143`
- **Evidence:** `<React.Fragment key={x}>` inside a `.map()` fails `npm run typecheck` with:
  `TS2322: Type '{ children: any[]; key: string; }' is not assignable to type '{ children?: ReactNode; }'.
  Property 'key' does not exist on type '{ children?: ReactNode; }'.`
  `key` should be supplied by `JSX.IntrinsicAttributes`, so it is not reaching the check. Ruled out
  during investigation: **not** a duplicate `@types/react` (exactly one copy, 18.3.3, against
  react 18.3.1); **not** caused by the `<f.icon />` dotted JSX tag (hoisting it to `const Icon = f.icon`
  did not change the error); **no** repo-declared `namespace JSX` override exists. Renderer tsconfig runs
  `strict: false`, `noImplicitAny: false`, `jsx: react-jsx` — the `children: any[]` in the error text
  suggests the `IsExactlyAny` short-circuit in `@types/react`'s `LibraryManagedAttributes` chain, but
  this was not confirmed.
- **Impact:** Every keyed Fragment needs a `@ts-expect-error`, which suppresses *all* type errors on the
  following line, not just this one. That is how ISSUE-1185 stayed hidden: the author reached for
  `{...({ key } as any)}` to dodge the error and shipped a genuine keying bug that no gate could catch.
  The next person hits the same wall and picks a workaround of unknown safety.
- **Fix:** Reproduce in isolation, then fix at the root rather than at the call sites. First things to
  try, in order: (1) turn `strict` on for the renderer (or at least `strictNullChecks`) in a scratch
  branch and see whether the error clears — that would confirm the `any` short-circuit theory;
  (2) check whether `React.JSX` vs the legacy global `JSX` namespace is resolving as expected under
  `jsx: react-jsx`; (3) if neither, pin/upgrade `@types/react` and retest. Once fixed, delete both
  `@ts-expect-error` comments — they will start erroring as unused, which is the built-in signal that
  the root fix worked.
- **Acceptance:** `<React.Fragment key={x}>` typechecks with no suppression, and both existing
  `@ts-expect-error` comments are removed without reintroducing errors.
- **Depends on:** Nothing. Worth doing before the next agent hits it a third time.

## Session 2026-07-22 — `/qa` full unit-suite verification

### ISSUE-1191: RouterContext verification is suite-order-sensitive, blocks the full test gate, and reports an uncaught router error while green in isolation

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH (the repository's required full unit-test command exits non-zero)
- **Module:** `packages/renderer/src/tests/RouterContext.test.tsx`,
  `packages/renderer/src/core/App.tsx`, and the App boot/Suspense mocks used by the test
- **Evidence:** `npm test -- --run` completed 851 files / 5,279 tests with exactly one failure:
  `Router Context Verification > renders App inside BrowserRouter without crashing`. After the test's
  explicit 5-second allowance for shard CPU pressure, the DOM still contained only the dashboard
  loading skeleton and never rendered the mocked `Dashboard Loaded` marker at line 121. Final result:
  **1 failed, 5,176 passed, 52 skipped; exit 1**. A focused rerun of the file then passed 2/2 in 2.23s,
  demonstrating suite-order/load sensitivity rather than a deterministic application assertion.
  However, that green focused run printed two uncaught
  `useLocation() may be used only in the context of a <Router> component` exceptions from the second
  test. That negative test renders the entire lazy, side-effectful `<App />` without a router inside a
  `try/catch`; JSDOM/React reports the asynchronous exception outside that catch, yet Vitest still
  reports the test as passed.
- **Impact:** The canonical unit gate is flaky and currently red even though the same file passes by
  itself. The test conflates a small router-provider contract with the complete App initialization,
  workspace sync, memory engine, lazy dashboard, and Suspense timing. Its negative case also teaches CI
  that an uncaught React exception is acceptable, so a genuine router regression can be hidden behind a
  green focused result while unrelated suite pressure can fail the positive case.
- **Fix:** Replace the whole-App timing probe with a deterministic router-contract harness. Exercise the
  router-dependent component under `MemoryRouter` (or a minimal `createMemoryRouter`) and assert a stable
  routed marker without starting App boot services. Isolate the no-router contract in a separate test
  that explicitly captures the exact thrown/reported error and fails on any unconsumed JSDOM exception;
  do not use a catch block whose assertion can be skipped. If whole-App coverage is still required, give
  it a separate integration test with all boot promises mocked and an assertion that the loading skeleton
  is eventually removed.
- **Acceptance:**
  1. `npx vitest run packages/renderer/src/tests/RouterContext.test.tsx` passes with no uncaught
     `useLocation`/`useNavigate` exception in stdout or stderr.
  2. The negative test demonstrably fails if `<App />` stops requiring a router and its assertion cannot
     be bypassed when no exception is observed.
  3. Three consecutive full `npm test -- --run` executions finish with zero failed tests and no
     RouterContext timeout, without increasing the timeout beyond five seconds.
- **Depends on:** Nothing.

### ISSUE-1192: Video Daisychain interaction test stays green after `VideoWorkflow` crashes because its store mock omits `setVideoInputs`

- **Status:** 🔴 OPEN
- **Severity:** 🟠 HIGH (false-green coverage for the five-step Creative video production path)
- **Module:**
  `packages/renderer/src/modules/creative/video/components/VideoDaisychain.interaction.test.tsx`,
  `packages/renderer/src/modules/creative/video/VideoWorkflow.tsx:528`, and the test's `useStore` mock
- **Evidence:** Both the full suite and the focused command
  `npx vitest run packages/renderer/src/modules/creative/video/components/VideoDaisychain.interaction.test.tsx`
  report the sole test — `successfully completes a 5-step video production daisychain` — as passed.
  During that green run React emits an uncaught `TypeError: setVideoInputs is not a function` at
  `VideoWorkflow.tsx:528`; `ModuleErrorBoundary` then logs `Error in Studio` and replaces the crashed
  subtree. Inspection confirms the production component now selects and calls `setVideoInputs`, while
  the test's mocked store state and `useStore.getState()` expose only the older `setVideoInput` setter.
  The focused file exits 0 despite the runtime crash. It also uses relative `img1.jpg`-style fixtures,
  producing invalid-URL/storage-bridge noise that makes real failures harder to distinguish.
- **Impact:** The named end-to-end interaction does not prove that the five-step workflow remains mounted
  or completes. Any production store-selector change can crash Creative Studio while CI reports success,
  leaving a flagship video flow without trustworthy regression protection.
- **Fix:** Add a functional `setVideoInputs` mock everywhere the mocked store shape is exposed and keep
  the singular setter only where production still uses it. Make the test fail on unexpected
  `console.error`, `window` error events, or the `ModuleErrorBoundary` fallback; assert that the Studio
  workflow remains mounted after generation and that the final step's observable state is reached.
  Replace relative media strings with valid absolute fixture URLs or mock `safeStorageFetch` at its
  boundary so URL parsing is not part of this interaction test.
- **Acceptance:**
  1. Removing `setVideoInputs` from the test store makes the test fail, not pass through the error
     boundary.
  2. The focused test passes with no `setVideoInputs is not a function`, uncaught React error,
     `ModuleErrorBoundary` fallback, invalid fixture URL, or storage-bridge decode error.
  3. Assertions prove all five user-visible stages complete and the final Video workflow is still
     mounted.
  4. `npm test -- --run` contains no Daisychain runtime exception while retaining the interaction test.
- **Depends on:** Nothing.

---

## Session 2026-07-22 — FOUNDER ASSESSMENT: Session Breakdown (ISSUE-1175..1181) status correction + binding repair order

> **Source:** William's own review, 2026-07-22. This is **founder direction, not an agent finding** —
> it has not been independently re-verified by the agent recording it. Where it contradicts an
> existing 🟡 PARTIAL status on ISSUE-1175..1181, **the founder's read governs scope**.
>
> **Why this block exists:** on 2026-07-22 ISSUE-1175..1181 were each flipped from 🔴 OPEN to
> 🟡 PARTIAL on the strength of "shared Zod schemas + unit tests passing." Schemas existing and
> their unit tests passing is real work, but it is **not** the same as a connected customer
> workflow. Reading those seven PARTIAL lines together gives a materially more finished impression
> than the code supports. This block restores the honest picture without deleting the earlier
> claims, which remain accurate about the narrow thing they assert.

### Founder assessment (verbatim scope judgement)

**Strongest completed portion:** the initial contract/upload foundation — owner-bound session
creation, private staging rules, immutable original identity, and a fixture-tested FFmpeg prototype.

**The implementation then becomes mostly schemas and disconnected helpers:**

| Issue | Ledger status as written | Founder's assessment |
|---|---|---|
| ISSUE-1175 | 🟡 PARTIAL (schemas + `SessionVideoUploadService`) | **Incomplete and not production-connected** |
| ISSUE-1176 | 🟡 PARTIAL (engine-dsp suite 12/12) | **Essentially unimplemented** |
| ISSUE-1177 | 🟡 PARTIAL (schemas) | Contract scaffolding, **no customer workflow** |
| ISSUE-1178 | 🟡 PARTIAL (schemas) | Contract scaffolding, **no customer workflow** |
| ISSUE-1179 | 🟡 PARTIAL (schemas) | Contract scaffolding, **no customer workflow** |
| ISSUE-1180 | 🟡 PARTIAL (compiler implemented) | Code exists, but **current compiler/persistence/render behaviour is unsafe** |
| ISSUE-1181 | 🟡 PARTIAL (schemas) | **Partial schemas only** |

### BINDING REPAIR ORDER — do these in this sequence

Per the standing rule that build order lives in the ledger and never in chat only. Do not start a
step before the one above it is genuinely closed (not schema-closed — workflow-closed).

1. **Fix timeline authorization and data-loss risks.** (ISSUE-1180 safety half.) Highest priority
   because it is the only item on this list that can destroy a user's work rather than merely fail
   to deliver a feature.
2. **Make ingestion generation-claiming and worker execution durable.** (ISSUE-1175.)
3. **Connect proxy production and proper PTS mapping.** (ISSUE-1175 → ISSUE-1176 boundary.)
4. **Correct the compiler/render path and make compilation idempotent.** (ISSUE-1180 correctness half.)
5. **Implement ISSUE-1176 → ISSUE-1179 in order.** No parallelising: each consumes the previous
   one's verified output.
6. **Build terminal rendering and handoff.** (ISSUE-1181.)

- **Depends on:** Step N depends on step N−1 throughout. ISSUE-1176..1179 additionally depend on
  step 3 (real proxy + PTS mapping) — until that exists they have no verified media to operate on,
  which is precisely how they ended up as schemas without workflows.
- **Acceptance for treating any of ISSUE-1175..1181 as ✅ FIXED from here on:** a real user action
  in the running app produces the real artefact end to end. Passing unit tests over a Zod schema
  does **not** close any of these — that is the specific over-claim this block exists to correct.
- **Not in scope of this block:** ISSUE-1185..1192. Those are unrelated to Session Breakdown.

---

## Session 2026-07-22 — REPAIR ORDER STEP 1 AUDIT: ISSUE-1180 timeline authorization + data-loss risks

> Read-only audit, no code changed. Scope is exactly repair-order step 1 — **authorization and
> data-loss only**. Compiler/render *correctness* is step 4 and is listed at the end as
> "noted, not audited" so it is not lost, not because it was assessed.
>
> **Files audited:** `videoEditorStore.ts` (incl. `compileApprovalToTimeline`),
> `useVideoProjectPersistence.ts`, `VideoProjectPersistenceService.ts`,
> `packages/firebase/firestore.rules` (`videoProjects`), `AppShell.tsx` (module gating),
> `VideoPopout.tsx` (cross-window sync).
>
> **Headline:** the founder's read is confirmed. There is a path where a **transient network or
> permission error silently destroys a user's saved timeline** — no attacker required, no error
> shown. Demonstrated with a throwaway test (output quoted in ISSUE-1193), which was then deleted.

### ISSUE-1193: A failed timeline load is indistinguishable from "no timeline yet", and the next edit overwrites the real one with a blank

- **Status:** ✅ FIXED (2026-07-22, commit `ef9526c7a`, CI run 29942881908 green 25/25)
  The ambiguity is gone at the type level rather than guarded at runtime: `loadVideoProject`
  returns a discriminated `TimelineLoad`, and only the `'found'`/`'absent'` branches carry a
  `WriteToken`. `saveVideoProject` requires that token, so saving a timeline that was never
  successfully read no longer typechecks. The token also carries the observed revision and the
  save is a compare-and-swap inside a transaction, which additionally closes the second-tab and
  stale-async overwrite cases this entry did not identify.
  **The fix proposed in this entry was deliberately NOT shipped.** Acceptance item 4 suggested
  refusing to persist an empty `clips` when the last known state had clips. That is a heuristic
  band-aid and it breaks the legitimate case of a user clearing their own timeline. Removing the
  ambiguity is the fix; pattern-matching around it is not.
- **Severity:** 🔴 CRITICAL (destroys irreplaceable user work; no attacker needed; no user-visible error at any step)
- **Module:** `packages/renderer/src/modules/creative/video/services/VideoProjectPersistenceService.ts:22-33`,
  `packages/renderer/src/modules/creative/video/editor/hooks/useVideoProjectPersistence.ts:54-77`
- **Evidence — the chain, each link verified in source:**
  1. `loadVideoProject` wraps `getDoc` in `try/catch` and **returns `null` on every error**
     (line 29-32). Permission denied, offline, quota, a squatted doc (ISSUE-1197) — all `null`.
  2. `null` is also the legitimate value for "this project has no timeline doc yet" (line 25).
     **The caller cannot tell the two apart.**
  3. The caller treats `null` as new-project and calls `resetProjectForId(currentProjectId)`
     (`useVideoProjectPersistence.ts:68`) → the store is replaced with a **blank timeline**.
  4. `lastSyncedProjectRef` is then set to that blank project (line 69), so the dirty check is
     satisfied and no save fires *yet*.
  5. The user, seeing an empty editor, makes **one** edit. The debounced autosave fires 5s later
     and calls `saveVideoProject(project.id, project, …)` — writing the blank-plus-one-edit
     timeline to the **real** project's document.
- **Proof (temporary test, run then deleted — reproduce by mocking `loadVideoProject` → `null`):**
  ```
  [1] after "failed" load, timeline clips = 0 (blank)
  [2] autosave target docId   = project-with-real-work
  [3] autosave clips written  = 1
  ```
  The write targets the real project id, and `project.clips` is an array — Firestore's
  `{merge:true}` merges maps recursively but **replaces arrays wholesale**, so the stored clip
  list is not merged, it is overwritten.
- **Impact:** One dropped connection, one expired token, or one rules hiccup at load time is
  enough. The user opens a project, sees an empty timeline, assumes they are in the wrong place
  or that it did not save last time, makes one change — and the real timeline is gone. Nothing in
  the UI reports a failure at any point (see ISSUE-1195). This is the single most destructive
  behaviour found and is why the founder ranked step 1 above everything else.
- **Fix:**
  1. `loadVideoProject` must distinguish outcomes — return a discriminated result
     (`{status:'found', project}` / `{status:'absent'}` / `{status:'error', error}`), never a bare
     `null` for both.
  2. On `'error'`, do **not** call `resetProjectForId`. Keep the editor in an explicit
     unrecoverable state, block autosave entirely, and surface a retry.
  3. Autosave must be gated on a positive load outcome. A project that never successfully loaded
     must never be writable — treat "we do not know what is stored" as read-only.
  4. Guard the write itself: refuse to persist a timeline whose `clips` is empty when the last
     known good state had clips, unless the user explicitly cleared it.
- **Acceptance:** With `loadVideoProject` forced to throw, the editor shows an error state, no
  autosave call is ever issued, and the stored document is byte-identical afterwards. A regression
  test asserts `saveVideoProject` is **not** called on the load-error path.
- **Depends on:** Nothing. **This is the first thing to fix in the entire repair order.**

### ISSUE-1194: Guest users can open the video editor, and every edit they make is silently discarded

- **Status:** ✅ FIXED (2026-07-22, commit `86486670c`) — harm removed; one product decision
  intentionally left open and no longer blocking.
  Guest sessions now declare themselves ephemeral: no doomed load/save round-trips (both are
  denied a priori by the rules layer), no `WriteToken` minted — so autosave stays off through
  the same mechanism that protects a failed load — and a persistent amber banner states the
  work will not be kept. Amber rather than red: not having an account is a limitation, not a
  malfunction, and the editor stays usable.
  **Framing correction.** This was originally put to the founder as a binary — gate the module
  or warn the user. That split was wrong. Only gating is a business-model decision; telling the
  user is correct under *both* answers, and there is no version of this where silently
  discarding the work is right. Whether `creative` joins `COMMERCIAL_MODULES` remains the
  founder's call and is now independent of the data loss.
- **Severity:** 🔴 HIGH (total, silent loss of work for every unauthenticated user; this is the default state for anyone who has not signed up)
- **Module:** `packages/renderer/src/core/AppShell.tsx:172-174` (`COMMERCIAL_MODULES`),
  `packages/firebase/firestore.rules` (`isVerifiedUser`), `VideoProjectPersistenceService.ts:42-46`
- **Evidence:** `COMMERCIAL_MODULES = { 'distribution', 'licensing', 'merch', 'publishing' }` —
  **`creative` is not a member**, so the guest gate at `AppShell.tsx:204` never fires for the video
  editor. But the Firestore rule requires `isVerifiedUser()`, defined as
  `isAuthenticated() && !isAnonymous()`. An anonymous Firebase user *has* a uid, so
  `saveVideoProject`'s `if (!userId)` guard passes, the write is attempted, and the **rules deny
  it**. The rejection is caught, logged with `logger.error`, and returned as
  `{success:false, reason}` — which the caller logs with `logger.warn` and nothing else.
- **Impact:** A guest can open the editor, build an entire timeline, and lose all of it on reload
  having never been told anything was wrong. The product actively invites the work and then
  discards it.
- **Fix:** Pick one and make it explicit — either add `creative` to `COMMERCIAL_MODULES` so guests
  hit `GuestGate` up front, or let guests edit but tell them clearly that work is unsaved until
  they sign up. Do not leave the current silent-discard behaviour. Whichever is chosen, the save
  layer must fail **loudly** (ISSUE-1195).
- **Acceptance:** An anonymous session either cannot reach the editor, or sees a persistent
  unmistakable "not saved — sign up to keep this" state. No path exists where a guest's edit is
  accepted by the UI and dropped without notice.
- **Depends on:** Best fixed together with ISSUE-1195.

### ISSUE-1195: Every timeline save and load failure is invisible to the user

- **Status:** ✅ FIXED (2026-07-22, commit `ef9526c7a`)
  Load and save failures are now store state, not `logger.warn`. A failed load renders a
  blocking error screen with a retry and leaves the stored timeline untouched; a failed save
  renders a persistent banner that stays until a save succeeds. Both asserted in
  `useVideoProjectPersistence.test.ts`, not verified by inspection.
- **Severity:** 🟠 HIGH (turns each of ISSUE-1193/1194/1197 from a recoverable error into silent data loss)
- **Module:** `useVideoProjectPersistence.ts:49`, `VideoProjectPersistenceService.ts:30,63`,
  `packages/renderer/src/modules/creative/video/editor/VideoEditor.tsx:69`
- **Evidence:** The only failure surfaces are `logger.warn` / `logger.error`. `isLoadingProject`
  drives a spinner and nothing else — there is no error state at all. Grepping the module for a
  user-facing surface returns only the spinner gate. Toast infrastructure is already imported and
  used in this very module (`editor/hooks/useVideoEditor.ts:8` uses `useToast`), so this is a gap,
  not a missing capability.
- **Impact:** The user's only signal that their video project is not being saved is that it is not
  being saved — which they discover after losing it.
- **Fix:** Surface load errors as a blocking editor state with retry, and save failures as a
  persistent (not auto-dismissing) indicator that stays until a save succeeds. A silent
  `logger.warn` is not an acceptable terminal handler for a write that carries the user's work.
- **Acceptance:** Forced save failure and forced load failure each produce a visible, persistent
  UI state. Asserted in tests, not by inspection.
- **Depends on:** Nothing. Cheap, and it de-risks ISSUE-1193/1194/1197 immediately.

### ISSUE-1196: `compileApprovalToTimeline` accepts `ownerUid` and `projectId` and checks neither

- **Status:** ✅ FIXED (2026-07-22, commit `ef9526c7a`)
  `compileApprovalToTimeline` now enforces `ownerUid` and `projectId`, and additionally requires
  both source and proxy generations so lineage cannot be silently severed. It fails closed with
  a typed `TimelineCompileError` before touching the project. Five unit tests cover the four
  rejections plus a proof that a refused compile mutates nothing.
- **Severity:** 🟠 HIGH (the authorization half of repair-order step 1; ISSUE-1180 acceptance items 3 and 7)
- **Module:** `packages/renderer/src/modules/creative/video/store/videoEditorStore.ts:528-585`
- **Evidence:** The `approval` parameter is typed
  `{ approvalReceiptId, planId, ownerUid, projectId, decisions }` at line 529. Grepping the file
  for `ownerUid` returns **exactly one hit — that type declaration**. `projectId` likewise never
  appears in the function body. The compiler therefore:
  - never compares `approval.ownerUid` to the current user → **no cross-owner rejection**
    (ISSUE-1180 acceptance 7 requires cross-owner assets fail closed);
  - never compares `approval.projectId` to `existingProject.id` → an approval belonging to project
    A can be compiled straight into project B's timeline (**cross-project bleed**, acceptance 3);
  - records `sourceGeneration`/`proxyGeneration` from `session` (lines 567-568) but **never
    validates them**, and both are optional — a session without them yields clips with
    `undefined` generations, silently losing the lineage the field exists to carry
    (acceptance 7 requires stale generations fail closed).
- **Impact:** The two fields that exist specifically to enforce ownership and project scoping are
  decorative. This is the same shape as the defect recorded in ISSUE-1092 ("handlers declared a
  `req?` param the registry never supplied") and the one ISSUE-1096 fixed ("the decorative
  args-derived pattern"). It keeps recurring.
- **Fix:** Fail closed at the top of the compiler — reject when `ownerUid` does not match the
  authenticated user, when `projectId !== existingProject.id`, and when a required generation is
  missing or does not match the session's current generation. Return a typed, repairable error
  rather than a partially-compiled timeline.
- **Acceptance:** Unit tests prove each of the four rejections (wrong owner, wrong project, missing
  generation, stale generation) throws/returns an error and mutates nothing.
- **Depends on:** Nothing.

### ISSUE-1197: `videoProjects` rules allow ownership to be rewritten on update, and let any user squat any project id

- **Status:** ✅ FIXED (2026-07-22, commit `ef9526c7a`)
  Timelines moved to `users/{uid}/videoProjects/{projectId}`, so one user's project-id space
  cannot collide with another's and id entropy stops being load-bearing — which also means the
  open question about how `currentProjectId` is generated no longer gates anything. Ownership is
  pinned on update. The legacy top-level collection stays readable for migrate-on-first-save and
  is closed to writes. Ten new emulator assertions prove ownership immutability and
  cross-namespace squatting denial; the full rules suite is 157 passing.
  Follow-up found while fixing this: `isAnonymous()` was structurally always-false
  (`isAuthenticated()` already excludes anonymous, so the two clauses contradict). Not
  exploitable — `isVerifiedUser()` collapsed to `isAuthenticated()`, which already excluded
  anonymous — but a future rule written `if !isAnonymous()` would silently always grant.
  Corrected in commit `86486670c`; all 157 assertions pass unchanged, which is the evidence for
  the behaviour-preserving claim.
- **Severity:** 🟠 HIGH (a squatted id permanently and silently locks the real owner out of their own timeline)
- **Module:** `packages/firebase/firestore.rules:786-789`
- **Evidence:**
  ```
  match /videoProjects/{projectId} {
    allow read, update, delete: if isVerifiedUser() && resource.data.userId == request.auth.uid;
    allow create: if isVerifiedUser() && request.resource.data.userId == request.auth.uid;
  }
  ```
  1. **Ownership is mutable.** `update` checks only `resource.data.userId` (the *existing* value).
     It never pins `request.resource.data.userId`, so an update may rewrite `userId` to any value.
     This repo already treats ownership immutability as the standard elsewhere — the licenses rules
     were fixed precisely so that "ownership is immutable and emulator-tested".
  2. **Any authenticated user may create any id.** `create` only requires the writer stamp their
     own uid. Document ids come from the app's `currentProjectId`, so any user who learns or guesses
     another project id can create `videoProjects/{thatId}` first.
- **Impact of the squat:** the real owner's `getDoc` is denied → `loadVideoProject` returns `null`
  → blank timeline → their autosave `setDoc` is also denied → warn-only. They are locked out of
  their own project **and told nothing**, and per ISSUE-1193 they may believe the project is empty.
  Whether ids are actually guessable is the open question — that determines whether this is
  reachable by a third party or only a self-inflicted footgun.
- **Fix:** Pin `request.resource.data.userId == resource.data.userId` on update so ownership cannot
  be rewritten. Namespace the document id by owner (`videoProjects/{uid}_{projectId}` or a
  `users/{uid}/videoProjects/{projectId}` subcollection) so one user's id space cannot collide with
  another's. Add emulator assertions for both.
- **Follow-up needed:** confirm how `currentProjectId` is generated. If it is a uuid the squat is
  impractical; if it is sequential or user-supplied it is trivially reachable. **This was not
  determined during this audit** — do not assume either way.
- **Depends on:** Nothing, but sequence it with ISSUE-1193 since they share the silent-failure path.

### Lower-severity findings from the same pass (recorded, not separately ticketed)

- **No `.catch()` on the load promise** (`useVideoProjectPersistence.ts:61-72`). A rejection —
  as opposed to a caught error inside the service — leaves `setIsLoadingProject(false)` unreached,
  so the editor spins forever. Fold into ISSUE-1193.
- **No undo anywhere in the editor store.** `removeTrack` (line 415-427) additionally cascades:
  it deletes every clip whose `trackId` matches, with no confirmation. One misclick on a video
  editor holding irreplaceable session footage is unrecoverable.
- **Mobile background-kill loses up to 30s of edits.** The only guard is `beforeunload`
  (line 99-109), which mobile browsers frequently never fire. There is no `visibilitychange`
  flush, so the 5s debounce / 30s interval window is simply lost when the OS reclaims the tab.
- **`window.useVideoEditorStore` is exposed unconditionally in production**
  (`videoEditorStore.ts:524-526`) — no `import.meta.env.DEV` guard, unlike `DevPortWarning`
  (`App.tsx:53`). Any injected script can mutate or wipe the timeline. **Systemic, not local:**
  `packages/renderer/src/core/store/index.ts:169` exposes `window.useStore` the same way. Fix both
  together or neither; flagged here because it widens every finding above.
- **Compiler bypasses the membership duration cap.** It sets `durationInFrames` directly
  (line 583), skipping the `MembershipService.getMaxVideoDurationFrames` clamp that
  `updateProjectSettings` applies (line 376-391).

### Noted, NOT audited — these are repair-order step 4 (compiler/render correctness)

Listed only so they are not lost. No assessment is implied.

- `sourceInUs` / `sourceOutUs` are written by the compiler and **read by nothing** — a repo-wide
  grep outside `videoEditorStore.ts` returns zero hits, so the compiled source ranges are inert
  and both preview and render still start every source at its beginning (ISSUE-1180 acceptance 2).
- Compiled clips never get a `src`, so there is nothing for the preview to resolve.
- **The compiler is not idempotent**: `clips: [...existingProject.clips, ...compiledClips]`
  (line 582) appends on every run, and each clip gets a fresh `uuidv4()`, so re-running for the
  same approval duplicates the timeline with no stable key to dedupe on. ISSUE-1180 acceptance 4
  requires idempotency. *(Flagged here rather than ticketed because it is squarely step 4, but it
  is the item most likely to be mistaken for a data-loss bug when it surfaces.)*
- `blooper` decisions are compiled into the main timeline alongside `keep` (line 545) with no
  marker distinguishing them.
- `originalStartUs` is derived by offset arithmetic (line 555) with no clamping, so an override
  earlier than the segment start can produce a negative source in-point.

---

## Session 2026-07-22 — Repo-wide perf/bloat audit (findings only, no fixes applied)

> Phase-1 audit only — three parallel read-only agents surveyed (1) bundle/lazy-load,
> (2) Zustand/React re-render patterns, (3) dead code/unused deps. Nothing below has been fixed.
> **2026-07-22 follow-up verification pass:** ran real `npm ls`/`depcheck` against `packages/renderer`
> (not just grep). First attempt was contaminated by an unrelated uncommitted WIP diff sitting in
> the working tree (now safely `git stash`ed, see ISSUE-1198) which made `motion` look
> undeclared/extraneous and made `react-redux`/`@reduxjs/toolkit` look un-declared. Re-ran every
> check against the clean committed `HEAD` tree and corrected both: ISSUE-1198 is bloat (not an
> install-breaker) and ISSUE-1200 stands as a real, low-value cleanup (declared-but-unused direct
> deps that are also pulled in transitively by `recharts`, so removing them saves no install size —
> downgraded from P1 to P2 accordingly). ISSUE-1209 lists depcheck's full candidate list with an
> explicit warning that most of it needs a manual read, not a bulk delete.

### ISSUE-1198: Two animation packages declared and used side-by-side (`framer-motion` + `motion`)

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🟠 P0 (bundle bloat — not an install-breaking bug; an earlier verification pass briefly mis-scored this CRITICAL due to a dirty working tree, corrected before any fix was applied — see prior ledger revisions if needed)
- **Module:** `packages/renderer/package.json`, 69 component files, 21 test files
- **Ground truth confirmed before fixing:** both `motion` (176 source imports) and `framer-motion` (69 source imports) were legitimately declared and used on the committed tree. `motion`'s own package depends on `framer-motion` internally, so this was one real engine (`framer-motion`) exposed through two import surfaces, not two unrelated runtimes.
- **Fix applied:**
  1. Migrated all 69 `from 'framer-motion'` imports (and matching `from "framer-motion"`) to `from 'motion/react'` across `packages/renderer/src` — mechanical, since `motion/react` re-exports the identical named API (`motion`, `AnimatePresence`, `MotionConfig`, `useDragControls`, `PanInfo`, etc., confirmed by diffing import statement shapes before migrating).
  2. Migrated the matching `vi.mock('framer-motion', ...)` calls in 21 test files to `vi.mock('motion/react', ...)` so mocks keep intercepting the (now-changed) import path used by the components under test.
  3. Removed `"framer-motion": "^12.35.1"` from `packages/renderer/package.json`. Ran `npm install --workspace=packages/renderer` + root `npm prune` to sync. `npm ls framer-motion --workspace=packages/renderer` now shows it resolving only transitively, via `motion`'s own dependency — no direct declaration.
- **Real regression caught and fixed during verification (this is the point of running the full suite, not just typecheck):** `modules/boardroom/BoardroomModule.test.tsx`'s `vi.mock` (after step 2's mechanical rename) started intercepting `motion/react` for *every* component in that test's render tree — including `components/motion-primitives/text-effect.tsx`'s `TextEffect`, which was already importing from `motion/react` before this migration and wasn't previously caught by this mock (different target module). The hand-written mock only stubbed `motion.div`/`motion.button`; `TextEffect` needs `motion.p` (its default tag), which resolved to `undefined` and crashed 3 tests with "Element type is invalid." **Fixed at the root**, not papered over: replaced the mock's fixed object with a `Proxy` that resolves any HTML tag to a generic `forwardRef` stub, matching how the real `motion` object behaves — so it's correct for every tag, not just the ones a prior author happened to enumerate.
- **Verification:**
  - `npm run typecheck --workspace=packages/renderer` → clean.
  - `npm run test --workspace=packages/renderer -- --run` → first run: **3 failed** (the regression above, in `BoardroomModule.test.tsx`), all 3 traced to root cause and fixed. Re-run: **4312 passed, 47 skipped, 0 failed** (711/732 test files passed, 21 intentionally skipped) — identical pass count to the pre-migration baseline.
  - `npm run build:studio` → succeeded. **Bundle evidence of the actual fix:** the `vendor-motion` chunk dropped from **472.33 kB to 286.54 kB** (pre- vs post-migration build output) — the duplicate-engine bloat this issue described is now measurably gone, not just theoretically removed.
- **Not committed yet** — sitting in the working tree pending user go-ahead to commit/push (this repo's `main`-only delivery lane requires a clean, coherent commit; a concurrent agent's unrelated WIP is also present in the tree and must not be mixed into this commit).

### ISSUE-1199: Two list-virtualization libraries — migration attempted and reverted after a real regression; not safe to consolidate as currently architected

- **Status:** 🟢 WONTFIX (2026-07-23 — investigated with a real migration attempt, not just re-analyzed)
- **Severity:** 🟡 P1 → downgraded to informational; the "fix" turned out to be the riskier option
- **Module:** `packages/renderer/package.json`; `packages/renderer/src/modules/creative/components/CreativeGallery.tsx` (the minority `@tanstack/react-virtual` usage); `core/components/ChatOverlay.tsx`, `modules/publishing/components/ReleaseListView.tsx`, `modules/creative/video/editor/components/EditorAssetLibrary.tsx` (the 3 majority `react-virtuoso` usages)
- **What was tried:** Migrated `CreativeGallery.tsx`'s manual-row-chunking `useVirtualizer` usage to `VirtuosoGrid`, following the exact working `List`/`Item` pattern already proven in this codebase's own `ReleaseListView.tsx`. The component's items all share a fixed `aspect-video` ratio, so this looked like a clean, low-risk, per-item virtualization swap that would also simplify away a JS `ResizeObserver`/manual column-count/row-chunking scheme the CSS breakpoints already made redundant.
- **Why it was reverted:** All 3 dedicated test files (`CreativeGallery.test.tsx`, `.interaction.test.tsx`, `.a11y.test.tsx`) failed — 12 of 16 tests — because `VirtuosoGrid` rendered **zero items** (`data-testid="virtuoso-item-list"` came back as an empty, self-closing div). Root cause: `CreativeGallery.tsx`'s scroll container is sized via `flex-1`/`overflow-hidden` with no fixed pixel height anywhere in its parent chain — `@tanstack/react-virtual`'s `estimateSize` lets it render a plausible item count *before* real layout is measured, while `VirtuosoGrid` appears to require actual measured container dimensions before it renders anything at all. This is a genuine architectural difference between the two libraries' rendering strategies, not a test artifact — reverted rather than chase a jsdom-only workaround that might mask a real browser-layout risk too.
- **Reverted cleanly:** `git checkout -- CreativeGallery.tsx` restored the exact prior working state; re-ran the 3 test files — 16/16 passing again.
- **Why the other direction (migrate the 3 `react-virtuoso` usages to `@tanstack/react-virtual` instead) was not attempted:** `ChatOverlay.tsx` uses `Virtuoso`'s imperative `VirtuosoHandle` ref for auto-scroll-to-bottom on new messages — reimplementing that behavior by hand on top of a lower-level hook is real regression risk for a live chat UI, not a mechanical swap. `ReleaseListView.tsx` uses both `VirtuosoGrid` and `TableVirtuoso` — a working table-virtualization feature `@tanstack/react-virtual` doesn't provide out of the box. Both would be larger, riskier migrations than the one already attempted and reverted.
- **Conclusion:** these two libraries are solving genuinely different problems given the current layout architecture (component-based virtualization with imperative scroll/table support vs. a low-level hook that tolerates unmeasured containers) — not true redundant duplication. Consolidating would require either a layout refactor (giving `CreativeGallery` a fixed/measured height) or accepting real regression risk in the chat/table views. Not doing either without a concrete reason beyond "two libraries exist."

### ISSUE-1200: `react-redux` + `@reduxjs/toolkit` are declared direct dependencies with zero source usages — real but low-value cleanup

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🟢 P2 (downgraded from P1 — see correction below; removing saved no install footprint)
- **Module:** `packages/renderer/package.json`
- **Correction history:** Briefly retracted as a false positive when `npm ls` was run against a dirty working tree (see ISSUE-1198's correction history for the root cause — an unrelated uncommitted WIP diff had stripped these from `package.json`, making them look un-declared/transitive-only). Re-checked against the clean committed `HEAD` tree.
- **Evidence (ground truth):** `packages/renderer/package.json` declared `"react-redux": "9.2.0"` and `"@reduxjs/toolkit": "2.11.2"` directly. `grep -rl "from 'react-redux'"` / `"from '@reduxjs/toolkit'"` across `packages/renderer/src` returned 0 hits — genuinely unused by app code. `npm ls react-redux @reduxjs/toolkit --workspace=packages/renderer` confirmed both are *also* pulled in transitively by `recharts` (the charting library, actively used). App state is entirely on `zustand` per CLAUDE.md convention.
- **Fix applied:** Removed both direct entries from `packages/renderer/package.json`. Ran `npm install --workspace=packages/renderer` then `npm prune` (root) to reconcile the hoisted `node_modules`. Post-fix `npm ls react-redux @reduxjs/toolkit --workspace=packages/renderer` shows both resolving cleanly, transitively-only, via `recharts` — no error, no missing-peer warning.
- **Verification:** `npm run typecheck --workspace=packages/renderer` → clean (no errors). `npm run test --workspace=packages/renderer -- --run` → **4312 passed, 47 skipped, 0 failed** (711 test files passed, 21 skipped). `npm run build:studio` → succeeded, no missing-module errors.

### ISSUE-1201: Likely-unused utility deps — `classnames`, `xml2js`

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🟢 P2
- **Module:** `packages/renderer/package.json`
- **Evidence:** `classnames` had 0 usages in `src` while `clsx` (5 usages) covers the same job. `xml2js` had 0 usages while `fast-xml-parser` (2 usages) covers XML parsing.
- **Fix applied:** Removed both entries from `packages/renderer/package.json`. `npm install` + root `npm prune` removed 3 packages from `node_modules` (their own transitive deps included) and confirmed `classnames`/`xml2js` are no longer present at all (not even transitively) — clean `npm ls classnames xml2js --workspace=packages/renderer` returns empty.
- **Verification:** Same combined run as ISSUE-1200 — typecheck clean, full unit suite green (4312 passed / 0 failed), production build succeeded. Fixed together with ISSUE-1200 as one dependency-cleanup change since both are simple `package.json` deletions verified by the same test/build pass.

### ISSUE-1211: Adopted from a concurrent agent's (Antigravity/Gemini) Phase-2 walkthrough — 3 dead renderer deps + 2 lazy-loaded heavy libs, independently re-verified before landing

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🟢 P2 (cleanup + code-splitting, not a live bug)
- **Module:** `packages/renderer/package.json`, `packages/renderer/src/services/utils/PDFService.ts`, `packages/renderer/src/services/intelligence/OCRService.ts`
- **Context:** The user pointed at a walkthrough written by a concurrent agent (Antigravity/Gemini) that had done its own dependency-pruning pass on this same repo, sitting uncommitted in the tree that ISSUE-1198 had already found and stashed (`git stash` entry: "concurrent-agent WIP: package.json dep drift fix + AppShell/store/OCR/PDF changes"). Cross-checked every claim in that walkthrough against actual repo state before adopting anything — do not take a walkthrough's self-reported "0 errors" at face value; see ISSUE-1198's correction history for why `tsc`/`eslint` alone cannot catch a `package.json`/`node_modules` drift bug.
- **Claims verified TRUE and adopted:**
  - `express`, `resend`, `@electron/rebuild` were declared as direct `packages/renderer` dependencies with 0 source usages (`grep` confirmed) and are architecturally out of place in a browser-bundled package to begin with — `express`/`resend` are properly declared and used in `packages/main`/`packages/firebase` where they belong; `@electron/rebuild` is a native-module rebuild CLI, not a runtime dependency of a Vite-bundled app. Removed all three from `packages/renderer/package.json`.
  - `PDFService.ts`'s top-level `import * as pdfjsLib from 'pdfjs-dist'` and `OCRService.ts`'s top-level `import { createWorker } from 'tesseract.js'` were converted to `await import(...)` inside the functions that use them, deferring two heavy libraries (`pdfjs-dist` ~786KB, `tesseract.js`) out of the eager bundle to first actual use (PDF text extraction / OCR scan).
- **Claim found FALSE and rejected — this is the one that mattered:** the walkthrough reported removing `motion` and "retaining `@framer-motion`" [sic — the real package is unscoped `framer-motion`] as the fix for the duplicate-animation-library issue (this ledger's ISSUE-1198). Checked and rejected for two reasons: (1) it kept the **minority**-usage package (69 files) over the majority (176 files), meaning more eventual migration work for no stated reason; (2) critically, **it never migrated the 176 `motion/react` call sites** before removing `motion` from `package.json` — the walkthrough's own verification (`tsc` + `eslint`, "0 errors") could not have caught this, because TypeScript resolves types from whatever is physically in `node_modules` regardless of `package.json` declaration, so the break is invisible until an actual clean install / `npm prune` / CI cache miss. ISSUE-1198 was instead fixed the other direction (kept `motion`, migrated `framer-motion`'s 69 call sites) and verified with `npm prune` + full build, not typecheck alone.
- **Fix applied:** package.json edits as above; `npm install --workspace=packages/renderer` + root `npm prune` to sync. Confirmed via `npm ls express resend @electron/rebuild --workspace=packages/renderer`: `resend`/`@electron/rebuild` fully gone, `express` resolves only as a legitimate transitive dependency of `@modelcontextprotocol/sdk`/`@remotion/cloudrun`/`inngest` (all real renderer deps that need it themselves) — not a direct declaration.
- **Verification:** `npm run typecheck --workspace=packages/renderer` → clean. `npm run test --workspace=packages/renderer -- --run` → 4312 passed / 0 failed (unchanged from pre-change baseline). `npm run build:studio` → succeeded, `vendor-pdfjs` chunk still separately named (787.52 kB) as before — chunk naming via `manualChunks` doesn't force eager loading, the dynamic `import()` still defers the actual fetch to first use.

### ISSUE-1202: `chunkSizeWarningLimit` set unusually high (2.5MB), can mask real bloat

- **Status:** ✅ FIXED (found already resolved 2026-07-23 while compiling a work list — fixed by a different concurrent agent, commit `d534bb548` "perf(renderer): fix re-render anti-patterns, lazy-load auth/legal, lower chunk warning threshold", not by this session)
- **Severity:** 🟢 P2
- **Module:** `packages/renderer/vite.config.ts:187`, `electron.vite.config.ts:220`
- **Verified fix in place:** both now set `chunkSizeWarningLimit: 1000`; `vite.config.ts` even carries an inline `// ISSUE-1202:` comment cross-referencing this exact entry.

### ISSUE-1203: `LoginForm` and `LegalPages` eagerly imported into initial bundle

- **Status:** ✅ FIXED (found already resolved 2026-07-23 while compiling a work list — same commit `d534bb548` as ISSUE-1202, not by this session)
- **Severity:** 🟢 P2
- **Module:** `packages/renderer/src/core/App.tsx:10-12`
- **Verified fix in place:** both are now `lazy(() => import(...))` (`LoginFormLazy`, `PrivacyPolicy`, `TermsOfService`), matching the rest of the app's lazy-loading convention.

### ISSUE-1204: Barrel files with `export *` risk defeating tree-shaking

- **Status:** 🔴 OPEN
- **Severity:** 🟡 P1 (business-harness), 🟢 P2 (web3, observability)
- **Module:** `packages/renderer/src/services/business-harness/index.ts:14-26` (13 re-exports, side-effectful class instances), `packages/renderer/src/services/web3/index.ts` (10 re-exports), `packages/renderer/src/services/observability/index.ts` (8 re-exports)
- **Evidence:** `export * from` barrels — any one import from the barrel path risks pulling the whole re-export graph if the bundler doesn't tree-shake perfectly, especially risky where re-exported modules have side-effectful instantiation.
- **Fix (not yet applied):** Convert to named re-exports, or import directly from source modules instead of the barrel.

### ISSUE-1205: `CRMDashboard.tsx` subscribes to the entire root store with no selector

- **Status:** ✅ FIXED (found already resolved during /hunter Phase 2, 2026-07-22 — fixed by a different concurrent agent between the original audit and this check, not by this session)
- **Severity:** 🟠 P0 (worst re-render offender found)
- **Module:** `packages/renderer/src/modules/crm/CRMDashboard.tsx:23-34`
- **Evidence (original):** `const { crm, subscribeToCampaigns, createCampaign, deleteCampaign } = useStore();` — no selector, no `useShallow`. Any state change anywhere in the app (chat, workflow nodes, auth, etc.) re-renders this dashboard.
- **Verified fix in place:** `useStore(useShallow((state) => ({ crm: state.crm, subscribeToCampaigns: ..., createCampaign: ..., deleteCampaign: ... })))` — the code comment on line 26 literally references "(ISSUE-1205)", confirming whoever fixed it cross-referenced this exact ledger entry.
- **Not fully resolved — downgraded, not re-opened:** the compounding `new Date(...)` per row at line 291 (inside the campaigns list JSX map) is still present. On its own this is minor (cheap inline formatting, no longer amplified by the fixed parent re-render issue) — not worth a separate ticket. Its missing-explicit-locale issue (`.toLocaleDateString(undefined, ...)`) — plus 4 sibling instances in the same file (`totalSupply`/`projectedRevenue`/`camp.supply`/the campaign total, all `.toLocaleString()` with no explicit locale) — were found and fixed during this hunt's Phase 2.5 locale sweep (2026-07-22, /hunter HUNT mode): all 5 now pass `'en-US'` explicitly.

### ISSUE-1206: Video editor store call sites inconsistently use whole-store destructuring without `useShallow`

- **Status:** ✅ FIXED (found already resolved 2026-07-23 while compiling a work list — likely the same commit `d534bb548` as ISSUE-1202/1203, not by this session)
- **Severity:** 🟡 P1
- **Module:** `packages/renderer/src/modules/creative/video/components/ZoomableTimeline.tsx`, `packages/renderer/src/modules/creative/video/editor/components/VideoTimeline.tsx`, `packages/renderer/src/modules/creative/video/editor/VideoPopout.tsx`
- **Verified fix in place:** all three now wrap their `useVideoEditorStore()` calls in `useShallow((state) => ({...}))`, matching the root-store convention.

### ISSUE-1207: Hand-rolled modal state instead of mandated `react-call`

- **Status:** 🔴 OPEN
- **Severity:** 🟡 P1 (violates CLAUDE.md architecture standard — "never fake a modal")
- **Module:** `packages/renderer/src/modules/distribution/components/DistributorConnectionsPanel.tsx`, `packages/renderer/src/modules/crm/CRMDashboard.tsx`, `packages/renderer/src/modules/dashboard/components/RecentProjects.tsx`
- **Evidence:** Only 6 files repo-wide reference `react-call`; these 3 hand-roll modal open/close via `useState`/`isModalOpen`, contradicting the documented standard.
- **Fix (not yet applied):** Migrate to `ConfirmDialog.call()`/`PromptDialog.call()`/`AlertDialog.call()` pattern per CLAUDE.md.

### ISSUE-1208: ~6.5MB of QA screenshots/reports checked into git as tracked source

- **Status:** ✅ PARTIALLY FIXED (found already actioned 2026-07-23 while compiling a work list — commit `d534bb548`, not by this session)
- **Severity:** 🟡 P1
- **Module:** `.gitignore:4-6`, `.agent/artifacts/`
- **Verified fix in place:** `.gitignore` now excludes `.agent/artifacts/` with an explicit `(ISSUE-1208)` comment; `git ls-files .agent/artifacts/` returns 0 tracked files. New QA runs no longer add to the tracked-bloat problem.
- **Remaining, not yet done:** the fix stopped new bloat but did not purge the ~6.5MB already sitting in git *history* (this only affects clone/fetch size going forward if squashed/rewritten, which is a separate, higher-risk operation — not something to do without explicit sign-off given it rewrites history). Untouched, lower priority than the original finding.

### ISSUE-1209: `depcheck` run against `packages/renderer` — all candidates individually verified; 14 genuinely dead deps removed

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟢 P2
- **Module:** `packages/renderer/package.json`
- **Verification method:** for every candidate, grepped the bare package-name string (not just `from '...'`) across `src/`, `.storybook/`, `*.config.*`, `public/` (for worker/static-asset loading like `essentia.js`), and CSS files (`@import`/`@plugin` directives, invisible to JS-import grep) — not a bulk delete off the depcheck list.
- **Confirmed genuinely dead and REMOVED (9 regular deps):** `@googlemaps/react-wrapper` (0 refs — `TourMap.tsx` loads the Google Maps script manually via a hand-rolled `<script>` tag, never through this package), `@radix-ui/react-dialog` (0 direct refs; resolves fine transitively via `cmdk`), `@types/crypto-js`, `ajv`, `crypto-js`, `ethers` (0 refs — the only 2 hits were prose comments mentioning "ethers.js," no actual import, static or dynamic), `inngest` (0 refs in the **renderer** package specifically — it's genuinely used in `packages/firebase`, a separate workspace, and was never renderer's to declare), `simplex-noise`, `y-protocols` (0 direct refs; resolves fine transitively via `y-websocket`, same pattern as ISSUE-1200's `react-redux`).
  **Confirmed genuinely dead and REMOVED (5 dev deps):** `autoprefixer`, `eslint-plugin-storybook` (not referenced in `eslint.config.js`'s flat config), `postcss` (no `postcss.config.*` exists for this workspace — Tailwind v4's native Vite plugin doesn't need the classic PostCSS pipeline), `vite-plugin-pwa` (not registered in either `vite.config.ts`/`electron.vite.config.ts` — the service worker is hand-registered, not plugin-generated).
- **Confirmed genuinely USED, correctly left alone:** `essentia.js` (pre-built WASM assets live in `public/essentia-wasm.web.js` etc., loaded via worker/static-asset mechanism, plus a documented audio-scanning skill file — grep-invisible by design), `tailwindcss`/`tailwindcss-animate`/`tw-animate-css` (all three loaded via CSS `@import`/`@plugin` directives in `src/index.css` — Tailwind v4's actual usage pattern, no JS import exists or is needed), `@remotion/cloudrun` (referenced as a dynamic-import path string in `RenderService.ts`), all 5 Storybook addons (registered via a `getAbsolutePath()` runtime-string helper in `.storybook/main.ts` — invisible to static-import analysis, which is exactly why `depcheck` false-flagged them).
- **One real regression caught by verification, not by assumption:** initially removed `@types/google.maps` too, reasoning "0 explicit import ⇒ dead" — wrong. It's an **ambient global-types-only** package (`window.google.maps.*`, no import statement ever needed by design), and `TourMap.tsx` uses that global namespace directly. `npm run typecheck` caught this immediately with 18 `TS2503`/`TS2339` errors. Restored `@types/google.maps`; re-ran typecheck clean. This is the exact "type-only augmentation" risk this entry itself had already flagged before the fix — a reminder that flagging a risk isn't the same as having checked for it.
- **Verification:** `npm install` + root `npm prune` (vulnerability count dropped 19→11, confirming some of these carried vulnerable transitive trees too). `npm run check:dep-integrity` clean. `npm run typecheck` clean (all 4 workspaces + firebase test-typecheck gate). Full monorepo test suite: 5,230 passed / 0 failed. `npm run build:studio` succeeded. `npm run lint`: 0 errors, 114 warnings (baseline, no regression).

---

## Session 2026-07-22 — REPAIR ORDER STEP 2 (ISSUE-1175): durable ingestion — first defect found and fixed

> Found while scoping step 2. This one could not be derived from the codebase — it needed the
> platform documentation, because the bug is in a **default** the code never states.

### ISSUE-1210: Cloud Functions v2 retries are off by default, so every idempotency guard in the upload finalizer is dead code and a transient fault silently strands the upload

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🔴 HIGH (silent, unrecoverable loss of a completed multi-GB upload; the exact durability step 2 exists to deliver)
- **Module:** `packages/firebase/src/functions/video/finalizeVideoSessionUpload.ts`
- **Evidence:**
  - `finalizeStagedVideoUpload` is meticulously idempotent — `reused` short-circuits on a matching
    `stagingGeneration`, `ifDestinationGenerationMatch: 0` on the promotion copy, a deterministic
    `creationReceiptId`, and a Firestore transaction that refuses a second original.
  - The trigger options (`VIDEO_SESSION_UPLOAD_TRIGGER_OPTIONS`) set bucket, timeout, memory and
    region — **and no `retry`**. A repo-wide grep found `retry: true` in **zero** of the 10
    event-driven triggers in `packages/firebase/src`.
  - Per Firebase's own documentation, retries are **disabled by default** for v2 event-driven
    functions, and when one fails without retry enabled "the function always reports that it
    executed successfully, and `200 OK` response codes might appear in its logs."
  - The handler's catch block rethrew on **every** error path (permanent and transient alike).
- **Impact:** Nothing was ever redelivered, so none of the idempotency work could execute. A
  transient GCS read fault, a Firestore contention retry, or a timeout while stream-hashing a large
  original meant the staged upload was never promoted, the session stayed at `uploading` forever,
  and the platform logged success. The user uploads a multi-GB phone session and it silently never
  arrives — the same failure shape as ISSUE-1193, one layer down in the server path.
- **Fix:**
  1. `retry: true` on the trigger, so Eventarc redelivers with exponential backoff (10–600s, 24h window).
  2. Permanent/transient classification (`isPermanentFinalizationFailure`). Retries alone would have
     been unsafe: a malformed or cross-owner event would have ground for the full 24 hours. Permanent
     codes (`invalid-argument`, `permission-denied`, `failed-precondition`, `data-loss`,
     `unauthenticated`, `already-exists`) are now recorded and swallowed. **`not-found` is
     deliberately transient** — a Storage event can outrun the session document becoming readable.
  3. Permanent failures write the terminal `failed` state the shared schema already modelled but
     nothing populated (`failure {code,message,retryable}`, `failedAt`, `terminalReceiptId`), so the
     session stops sitting at `uploading` and the owner can be told.
  4. `markFailed` never overwrites a session that already has an `original` or already reached
     `failed`/`cancelled`/`completed` — a late permanent failure must not erase a finalized original.
  5. If recording the terminal state itself fails, the original error is rethrown rather than
     swallowed — an unrecorded permanent failure is indistinguishable from the silent drop this
     change exists to remove.
- **Acceptance:** [MET] 15 tests in `finalizeVideoSessionUpload.test.ts` (was 2), including an
  assertion that `retry` is `true` so removing it fails loudly, the full permanent/transient
  classification table, and proof the failure record satisfies the session schema (non-empty message).
  Typecheck clean; 21 video-session function tests pass.
- **Not covered — deliberately out of this fix:** whether the 540s ceiling is sufficient to
  stream-hash a genuinely long 4K phone session. Retry now makes a timeout survivable rather than
  fatal, but a file that can never hash inside the ceiling would retry for 24h and then fail. That is
  a sizing question needing a real large fixture, and it belongs with the rest of step 2.
- **Depends on:** Nothing. This was the first blocker in front of step 2's stated content.

### ISSUE-1212: `packages/firebase` test files are excluded from typecheck, so test doubles can silently drift from the interfaces they claim to implement

> Renumbered from ISSUE-1211 to ISSUE-1212 (2026-07-22) — that ID collided with an unrelated entry
> ("Adopted from a concurrent agent's Phase-2 walkthrough") added independently earlier in this same
> file. Content below is unchanged; only the ID moved, per this repo's ledger-integrity protocol
> (duplicate identifiers must be reconciled before further issue work, per `skill-skill.md` §1).

- **Progress (2026-07-22): ✅ FIXED — burned down to 0 and wired into the blocking gate.**
  - Added `packages/firebase/tsconfig.test.json` (`noEmit`, `exclude: []`) and the
    `npm run typecheck:firebase-tests` script. `tsc --listFiles` now covers **131** test files where
    the emit config covered **0**.
  - It targets `es2022`/`lib ES2022` rather than inheriting the emit config's `es2017`. Tests run
    under vitest on Node 24 and pull in `packages/shared` (built at ES2022); checking them at es2017
    reported real library methods (`Array.prototype.at`) as missing. Four of the original 66 errors
    were that artefact and are not real.
  - The measured 62-error baseline (table below) is now **0**. Fixed per-file, not by loosening —
    each was either a fixture that had genuinely drifted from the interface it stands in for (given
    a real type or a documented, scoped cast explaining why the mismatch is intentional), a variadic
    `doc(db, ...path)` spread losing its tuple shape (`as const` on the path array, or a uniform
    tuple-typed array when several distinct-literal tuples were iterated together — a mixed array of
    tuples widens to their union on spread, which is not the same fix), or a genuinely incomplete
    fixture (`facebookPageName`, a `VideoGenerationJobRecord` missing several `.default()`-but-
    required-on-output schema fields — given a `buildVideoJob` helper so each test only overrides
    what it exercises rather than repeating the full shape).
  - `npm run typecheck` now runs `tsc -b ... packages/firebase && npm run typecheck:firebase-tests` —
    the second step no longer optional. Verified green end to end (exit 0).
  - New shared test helper `packages/firebase/src/mcp/tools/__tests__/mcpContent.ts` — MCP responses
    are a content-block union, so `result.content[0].text` doesn't typecheck; `textContent(result)`
    validates the block is actually `type: 'text'` and throws with the real kind otherwise, rather
    than casting past the union. Applied across 5 mcp/tools test files.
  - `CloudTasksClientLike` exported from `distribution/ingestion.ts` (was file-local) so
    `audio_ingestion.test.ts`'s fixture can be typed against the real collaborator instead of
    inferring an empty-tuple mock signature from an unparameterised `vi.fn()`.
  - **Full verification:** `packages/firebase` suite 449 passed / 5 skipped (both skips are
    integration tests needing live services, pre-existing); full repo suite 5219 passed / 0 failed;
    Firestore rules suite re-run against the emulator after the tuple fix — 157/157 unchanged.
- **Measured baseline — 62 errors, and this number is the point of the entry:**
  | Code | Count | Shape |
  |---|---|---|
  | TS2339 | 23 | property missing on a narrowly-inferred mock literal |
  | TS2769 | 11 | `doc()` overloads — rules-unit-testing's `Firestore` vs the client SDK's |
  | TS18046 | 11 | value is `unknown` (unparameterised mock return) |
  | TS2345 | 9 | argument shape mismatch against the real collaborator |
  | other | 8 | TS2741 / TS2349 / TS2493 / TS2352 / TS2322 / TS18048 |
  - Spread across **21 test files**. **Zero are in product code** — verified by filtering the error
    list for non-test paths, which returns nothing.
  - Two that looked like genuine contract drift were investigated individually and are **not** bugs:
    `_bigQuerySynced` does exist in product code (`functions/analytics/bigquery-pipeline.ts:154`) —
    the test builds a narrow local literal; and the `facebookPageName` fixture is simply incomplete
    against its real type, which is the drift this entry exists to surface, not a defect.
- **Remaining work to close:** burn down the 62, then move `typecheck:firebase-tests` into the
  blocking `typecheck` chain. That is the acceptance criterion — until the script is in the chain,
  nothing prevents new drift, it is only *visible*.
- **Do not:** do not close these by casting to `any` or loosening assertions. Several are the
  compiler correctly reporting that a fixture no longer matches the collaborator it stands in for —
  which is exactly the failure (`markFailed`, ISSUE-1210) that motivated this entry. Fixing the
  symptom would reinstate the blindness.

- **Status:** ✅ FIXED (2026-07-22)
- **Severity:** 🟡 MEDIUM (no runtime impact; it removes the compiler as a check on exactly the fixtures that stand in for production collaborators)
- **Module:** `packages/firebase/tsconfig.json`, `packages/firebase/tsconfig.test.json`, `package.json`
- **Evidence:** `include: ['src']` with `exclude: ['src/__tests__', 'src/**/*.test.ts']`. Confirmed
  empirically — `tsc -p packages/firebase/tsconfig.json --listFiles` contains **0** `.test.ts` files.
  Found when adding `markFailed` to `VideoSessionFinalizationStore` (ISSUE-1210): the two existing
  test doubles no longer satisfied the interface and **nothing failed**. They were updated by hand;
  the compiler would have caught it.
- **Impact:** A test double that has drifted from its interface still passes, and reads to the next
  person as an accurate model of the real collaborator. This is the same class as the recently-fixed
  gap where `packages/firebase` was absent from the root typecheck entirely — the package was added
  back, its tests were not.
- **Fix:** Give the package a `tsconfig.test.json` that includes the test files and is built by
  `npm run typecheck`, rather than widening the emit config (tests must not be emitted).
- **Do not:** Do not simply delete the `exclude` line — these files are compiled for emit, and
  pulling tests into the build output is worse than the gap.
- **Depends on:** Nothing. Expect a batch of pre-existing errors on first run; that backlog is the
  point, not a reason to defer.

---

### ISSUE-1213: Built `scripts/check-dependency-integrity.cjs` — the tool that would have caught the ISSUE-1198 `motion` bug before it happened; surfaced 15 real (unrelated) findings on first run

- **Status:** ✅ FIXED (tool built, one real bug in the tool itself found and fixed, and all genuine findings resolved — 2026-07-22)
- **Severity:** 🟡 P1 (tooling gap that let ISSUE-1198 happen undetected)
- **Module:** `scripts/check-dependency-integrity.cjs` (new), `package.json` (`check:dep-integrity` script added)
- **Why this was built:** The user asked for the "dependency-integrity check we discussed" after ISSUE-1198 — a `motion` package used by 176 files but not declared in `packages/renderer/package.json`, invisible to `typecheck`/`lint` because both read straight from `node_modules` regardless of manifest declarations. The existing `scripts/check-dep-version-drift.cjs` walks FROM `package.json` outward (declared range vs. installed version) and structurally cannot catch this — it never looks at source code, so a package that's used but never declared anywhere is invisible to it too. This new script walks the other direction: FROM source code inward, scanning real `import`/`require`/dynamic-`import()` statements per workspace and flagging any package used but not declared in that workspace's own `package.json` **or** the root `package.json` (root-hoisted shared devDependencies like `vitest`/`typescript` are legitimate under npm workspaces, not a violation — the check had to model that correctly or it would cry wolf on every workspace and be useless).
- **Build process, including two real bugs caught before shipping it:**
  1. First regex draft matched `(?:import|export)` optionally followed by `from`, then any later quoted string — with no bound on how far apart they could be. Result: it treated bare `export interface Foo {`/`export const x =` declarations as import statements and paired them with unrelated string literals dozens of lines later in the same file, producing ~60 garbage findings (fragments of JSX, toast messages, object keys) mixed in with the 15 real ones.
  2. Fixed by splitting into four narrowly-scoped patterns (dynamic `import(...)`, side-effect `import '...'`, `import/export ... from '...'` bounded to not cross a `;`, and `require(...)`) — each one can only match a single logical import statement, not sprawl across the file.
  3. Second bug: the first design only checked each workspace's own `package.json`, so it flagged `vitest`, `zod`, `electron`, `dotenv`, `jspdf` etc. across `packages/main`/`packages/shared` even though they're legitimately declared once at the monorepo root and hoisted — normal npm-workspaces behavior, not a bug. Fixed by also checking the root `package.json` before flagging, and by reading `tsconfig.json`'s `compilerOptions.paths` at runtime (`@/*`, `@agents/*`, `@shared/*`, `@indii/shared`) to correctly skip path aliases instead of hardcoding them, so the alias list can't silently drift out of sync with the real tsconfig.
- **Verification the tool actually works, not just that it runs:** Simulated the exact ISSUE-1198 scenario — temporarily removed `motion` from `packages/renderer/package.json`, ran the checker, confirmed it correctly flagged `motion` with real call-site examples, then restored the file and confirmed via `git diff`/direct read that the restore was exact (no accidental formatting drift, no lost changes).
- **Third bug, found on the very first real run and fixed before trusting any of its output:** the checker didn't strip comments before scanning, so a stale `// import Link from 'next/link';` comment in `packages/landing/src/components/ui/DigitalBillboard.tsx` (dead code, not real usage) was reported as a live `next` dependency violation — a false positive in the tool itself, caught by manually reading the flagged line before acting on it rather than trusting the output blindly. Fixed by adding a `stripComments()` pass (removes `//` and `/* */` comments while leaving string/template-literal *contents* untouched, so a URL like `"http://x"` inside a real string isn't mistaken for a comment) before the import-extraction regexes run. Re-run after the fix: 15 findings → 14 (the `next` false positive gone, all 14 remaining independently spot-checked as real).
- **The 14 real findings, all fixed:**
  - `packages/main`: added `@remotion/renderer` (4.0.484, used in `ElectronRenderService.ts`) and `zod` (3.25.76, used across `src/handlers/*`) to `dependencies` — both production code paths.
  - `packages/renderer`: added `@firebase/rules-unit-testing` (^5.0.0) and `@google/genai` (^2.12.0) to `devDependencies` (both test-only usage); added `@storybook/react` (^10.4.1) to `devDependencies` (Storybook-only); added all six `workbox-*` packages (7.4.1 each — `workbox-cacheable-response`, `workbox-core`, `workbox-expiration`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`) to `dependencies` since `service-worker.ts` is real production code that ships to users, previously resolving only transitively via `vite-plugin-pwa` — the same fragility class as ISSUE-1198.
  - `packages/firebase`: added `firebase` (12.14.0, the client SDK, used only in `src/test/security/*.rules.test.ts` to simulate client calls against the emulator — a standard rules-testing pattern) to `devDependencies`.
  - `packages/shared`: added `zod` (3.25.76) to a newly-created `dependencies` block (the package previously had none) — used throughout `src/schemas/*`.
  - `packages/landing`: added `zustand` (5.0.8, used in `store/audioStore.ts`) to `dependencies`. Did **not** add `next` — confirmed it was a stale commented-out import (`// import Link from 'next/link';`), correctly not a real dependency; `packages/landing` is Vite-based, not Next.js, per this repo's own tech-stack docs, so a live `next` import would have been architecturally suspicious on top of everything else.
- **Verification after all 14 fixes:** `npm install` (root, to sync all five touched `package.json`/the one lockfile) → `npm run check:dep-integrity` clean. `npm run typecheck` (shared/main/renderer/firebase) clean; `packages/landing`'s own `tsc --noEmit` clean. Full monorepo test suite: **5219 passed, 0 failed, 52 skipped** (857 test files, 834 passed). Three production builds (`build:studio`, `build:firebase`, `build:landing`) all succeeded. `npm run lint`: **0 errors, 114 warnings** — identical warning count to the known pre-existing baseline, confirming no regression.
- **Usage:** `npm run check:dep-integrity`. Not wired into the `validate` pre-push chain — matching the existing sibling `check:dep-drift`, which is also standalone rather than part of `validate`; wiring either into the mandatory gate is a separate, more consequential decision this issue didn't make unilaterally.

---

## Session 2026-07-23 — `/hunter` HUNT mode (full-spectrum bug hunt: fix, verify — commit left to user per standing rule)

> User explicitly chose HUNT mode after the workflow file's own "if ambiguous, ask" rule triggered (no
> mode qualifier was given). Ran Phase 1 (Big Game surface scan) across security, memory leaks, loading
> traps, swallowed errors, HTTP codes, API integrity, vendor chunks, impure render, anti-slop, and ghost
> project IDs; then full Phase 2 (Small Game) across Zustand slices, race conditions, finance precision,
> AI token limits, and locale. Full findings/false-lead reasoning also recorded in
> `.agent/skills/error_memory/ERROR_LEDGER.md` under "2026-07-23 — /hunter HUNT-mode session".

### ISSUE-1214: `AgentService` graph-execution Firestore listener never unsubscribed — confirmed leak, fixed

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟠 HIGH (unbounded accumulation of live Firestore listeners across a session)
- **Module:** `packages/renderer/src/services/agent/AgentService.ts` (`handleGraphExecutionFlow`), `packages/renderer/src/core/store/slices/agent/agentOrchestrationSlice.ts` (`startListeningToGraphExecution`/`stopListeningToGraphExecution`)
- **Evidence:** `startListeningToGraphExecution(executionId)` attaches an `onSnapshot` listener on `users/{uid}/graphExecutions/{executionId}`. Neither the function's success path nor its `catch` block ever called the matching `stopListeningToGraphExecution()`. `grep -rn "stopListeningToGraphExecution\b"` across the entire renderer source returned zero callers outside the slice's own definition — dead cleanup code. Every multi-step agent graph execution ever triggered left its listener open for the rest of the session.
- **Related, but NOT fixed — confirmed harmless:** the singular sibling `startListeningToGraph`/`stopListeningToGraph` (per-task-graph, not per-execution) has **zero callers on the start side either** — fully dead/unused code, not a live leak. Left as-is; flagging as dead code is a separate, lower-priority cleanup, not a bug fix.
- **Fix applied:** Destructured `stopListeningToGraphExecution` alongside the existing store actions in `handleGraphExecutionFlow`, and call it in a `finally` block so cleanup fires on both the success and failure paths.
- **Verification:** `npm run typecheck` clean; full Vitest run 5,219 passed / 0 failed (unchanged from baseline); `npm run build:studio` succeeded.

### ISSUE-1215: `campaign_waterfall.ts` non-atomic array read-modify-write — confirmed lost-update race, fixed

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟠 HIGH (data-integrity — silent lost update, not a crash, so it fails quietly)
- **Module:** `packages/firebase/src/lib/campaign_waterfall.ts` (P5 campaign waterfall Inngest consumer, ISSUE-1100 lineage)
- **Evidence:** The `update-status-${evt.key}` step read the campaign doc via a bare `campaignRef.get()`, mapped one `events` array element's `status` to `'scheduled'`, and wrote the **entire array** back via a plain (non-transactional) `campaignRef.update({ events: updatedEvents, ... })`. Any concurrent writer to the same doc racing between this read and write — a second dispatch of the same `mcp/campaign.scheduled` event, a different waterfall step, or a direct user edit to the campaign — has its own change silently overwritten by this function's last-write-wins full-array clobber. This is the exact "non-atomic array update" pattern this hunt's own race-condition scan targets; found by checking `.get()`-then-`.update()` pairs across `packages/firebase/src` and ruling out ~10 other candidates that turned out to write fixed/externally-derived values rather than values computed from the document's own prior array/counter state.
- **Fix applied:** Wrapped the read-modify-write in `db.runTransaction(async (tx) => {...})`, re-reading the doc via `tx.get(campaignRef)` inside the transaction and writing via `tx.update(...)` rather than the bare `campaignRef.get()`/`.update()` pair.
- **Verification:** `npm run typecheck` clean (firebase workspace + test-typecheck gate); `npm run build:firebase` succeeded.

### ISSUE-1216: `FirebaseIntelligenceService.defaultConfig` — a "cost backstop" that was declared but never populated, leaving ~30 AI call sites with no output-token ceiling at all

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟡 MEDIUM (cost/runaway-output risk, not a correctness crash)
- **Module:** `packages/renderer/src/services/intelligence/FirebaseIntelligenceService.ts`
- **Evidence:** `rawGenerateContent`/`rawGenerateContentStream` merge config via `{ ...this.defaultConfig, ...config }` — a real, correctly-designed mechanism for a shared safety default with per-caller override. But `public defaultConfig: GenerationConfig = {};` — an **empty object**, providing no actual default. A `grep` across ~37 files calling `generateContent`/`.models.generate` found ~30 with zero `maxOutputTokens` anywhere in their own call, meaning every one of them inherited no ceiling at all (Gemini's own API default when the field is omitted is effectively "as much as the model will produce"). A misleading in-code comment above one caller (`BaseAgent.ts:814`, "Judgment layer: verbosity/cost backstop applied to every generateContent(Stream) call below") asserted a protection that did not actually exist.
- **Why a centralized fix instead of 30 individual edits:** hunter.md's own suggested per-call-site limits (chat: 4096, summary: 512, quick tasks: 1024) require understanding each of 30 different use cases individually to avoid truncating legitimate long-form output (e.g. legal contract drafting, structured JSON schemas) — a much higher-risk path than populating the one shared default the architecture already has a slot for.
- **Fix applied:** `defaultConfig = { maxOutputTokens: 8192 }`. Any of the ~30 callers that already pass their own `maxOutputTokens` are unaffected (caller's value wins in the merge); every caller that didn't now inherits a generous-but-bounded ceiling.
- **Verification:** `npm run typecheck` clean; full Vitest run 5,219 passed / 0 failed; `npm run build:studio` succeeded.
- **Not done — flagging, not silently dropping:** did not audit whether 8192 is the *right* number per call site, or whether any of the ~30 sites would benefit from a tighter caller-specific override (e.g. summary-style calls could reasonably use less). This is a floor, not a tuned-per-use-case ceiling.

### ISSUE-1217: 8 raw `console.log`/`console.error` calls converted to `logger.debug`/`logger.error` (routine log-hygiene sweep, /hunter Phase 1.4)

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟢 LOW
- **Module:** `packages/renderer/src/config/env.ts`, `services/video/VideoGenerationService.ts`, `services/intelligence/FirebaseIntelligenceService.ts`, `services/agent/BaseAgent.ts`, `services/agent/harness/McpClientService.ts` (added missing `logger` import to the latter two files, which had none)
- **Evidence:** All 8 were already dev-gated or effectively low-risk (terser strips `console.*` in production builds per this repo's build pipeline), so this is hygiene/consistency, not a live production risk.
- **False leads correctly rejected in the same scan (recorded so they aren't re-flagged):** 3 `.catch(() => {})` instances in `CampaignManager.tsx` matched the "empty catch = swallowed error" grep pattern, but an existing code comment explicitly documents these as intentional — `onUpdateCampaign` already surfaces its own error toast, and the empty catch here exists specifically to prevent a duplicate unhandled-rejection warning. Applying the workflow's generic "add logger.error" auto-fix here would have produced duplicate user-facing error toasts for the same failure — a real regression disguised as a fix. Left untouched.
- **Verification:** Full Vitest run 5,219 passed / 0 failed; `npm run build:studio` succeeded.

### ISSUE-1218: `CRMDashboard.tsx` — 5 number/date formatting calls missing an explicit locale (finance-adjacent revenue/supply figures)

- **Status:** ✅ FIXED (2026-07-23)
- **Severity:** 🟢 LOW (display-only; the underlying stored values are unaffected, only their on-screen text representation varies by viewer locale)
- **Module:** `packages/renderer/src/modules/crm/CRMDashboard.tsx`
- **Evidence:** `totalSupply.toLocaleString()`, `projectedRevenue.toLocaleString(undefined, {...})`, `camp.supply.toLocaleString()`, the campaign-created-at date (`toLocaleDateString(undefined, {...})`), and the campaign total (`toLocaleString(undefined, {...})`) all omitted an explicit locale, unlike the codebase's other business-critical paths (legal, distribution, finance dashboards), which were already found to correctly pass `'en-US'` explicitly everywhere checked. This is also the same "compounding" locale gap named (but not fixed) back when ISSUE-1205 was originally logged.
- **Scope note:** ~10 other no-explicit-locale hits elsewhere in the codebase (tour dates, chat timestamps, note titles, agent-loop-monitor timestamps) were found and deliberately left alone — cosmetic/non-critical contexts, matching hunter.md's own explicit scoping to "business-critical paths (DDEX, invoices, legal)."
- **Fix applied:** All 5 now pass `'en-US'` explicitly.
- **Verification:** Full Vitest run 5,219 passed / 0 failed; `npm run build:studio` succeeded.

### Findings checked and correctly rejected this session (recorded so a future pass doesn't re-flag them as new)

- **`@react-three/fiber` split from `vendor-react` into its own `vendor-three` chunk** — theoretically a known footgun class (custom React reconciler in a separate chunk can cause "Invalid hook call"/scheduler duplication), but zero build warnings and zero runtime failures across 5,219 passing tests. Not touched: the prescribed fix (merge into `vendor-react`) would unconditionally add ~2.2MB to every user's initial bundle to guard a risk with no observed symptom.
- **~40 finance-service division operations** (`RoyaltyRevenueCompiler.ts`, `LabelDealRecoupmentService.ts`, `PredictiveRoyaltyService.ts`, `FinanceCompiler.ts`, `FinanceService.ts`, `MultiCurrencyService.ts`) — all already guarded (`x > 0 ? ... : fallback`) or protected by an earlier precondition in the same function. No division-by-zero bugs found.
- **`FinanceCompiler.ts`'s `roundCurrency` applied repeatedly inside a running-total accumulation** — looked like the "never rounds until too late" antipattern at first glance, but rounding to cents *after every addition* is a defensible existing safeguard against float-representation drift, not the bug the pattern usually indicates. Not changed without a demonstrated failure case.
- **~100 `Date.now()`/`Math.random()` hits** flagged by the workflow's own grep as potential impure-render violations — all traced to event-handler/callback/ID-generator contexts, not render bodies. The only 2 `Math.random()` call sites were individually confirmed (one inside a `setTimeout` callback, one inside an async user-triggered handler).
- **~40 non-transactional `.get()`-then-`.update()` pairs across `packages/firebase/src`** — all but one (ISSUE-1215) write fixed or externally-derived values (webhook payload data, status constants) rather than values computed from the document's own prior array/counter state, so they carry no lost-update risk.
- **ISSUE-1205** (`CRMDashboard.tsx` re-render fix) — checked as part of this hunt's Zustand-slice pass and found already fixed by a different concurrent agent before this session reached it; ledger entry updated separately (see its own entry above).
