# Open Issues — Real-Life Test Findings (V2, ACTIVE)

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-07-18
> **Branch:** `main`
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

- **Status:** 🟡 PARTIAL (2026-07-18 — architecture landed; auth + honesty defects fixed in follow-ups; uid plumbing completed; NOT live-verified against a deployed endpoint)
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
  2. **artistId/releaseId/trackId ownership is not verified** against the authenticated uid — [FIXED] Enforced `verifyOwnership` checking across all 11 MCP tools before executing logic.
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

- **Status:** 🟡 PARTIAL (2026-07-20 — Brand backend fetchBrandKit and Finance calculateRecoupment now read Firestore ledgers; remaining Finance Stripe/Legal/Creative/Publicist/Distribution backends still open)
- **Status:** 🟡 PARTIAL (2026-07-20 — Brand backend fetchBrandKit now reads the authenticated user profile brandKit from Firestore; remaining Finance/Legal/Creative/Publicist/Distribution backends still open)
- **Severity:** 🔴 HIGH
- **Module:** `packages/firebase/src/mcp/tools/**`, `packages/firebase/src/functions/triggers/**`
- **Scope:** The 11 MCP tools currently execute stub logic that merely returns hardcoded strings or writes a row to a job queue. The true business logic and third-party API integrations need to be wired up for the tools to perform actual work.
- **Evidence:** 
  - [FIXED 2026-07-20] `calculateRecoupment` no longer returns static hardcoded figures; it reads Firestore recoupment and earnings ledgers.
  - Tools like `stageStripePayouts` write to the `payoutJobs` collection, but the downstream `processPayoutJobs` trigger merely logs the event without calling Stripe.
- **Acceptance:**
  1. **Finance Backends**: [PARTIAL 2026-07-20] `calculateRecoupment` now reads `recoupment_balances` and `earnings` from Firestore instead of hardcoded figures; `stageStripePayouts` still needs to stage real transfers via the Stripe API for split recipients.
  2. **Legal Backends**: `registerSplitSheet` generates a verifiable PDF using `pdfkit` (or similar) and saves it to a secure GCS bucket. `draftCwrRegistration` generates valid Common Works Registration files. `auditSampleClearance` integrates with an Audio API or database to verify sample lineage.
  3. **Creative Backends**: `queueRemotionRender` successfully dispatches Remotion Lambda renders via Inngest. `auditAssetResolutions` uses `sharp` to validate image/video dimensions inside Cloud Storage.
  4. **Publicist Backends**: `scheduleCampaignWaterfall` updates real campaign timelines in Firestore. `generatePlaylistPitch` synthesizes pitch templates using backend Vertex/Gemini and optionally sends them via SendGrid.
  5. **Brand Backends**: [FIXED 2026-07-20] `fetchBrandKit` returns the user's actual `brandKit` data structure from their profile document, with uid ownership enforcement and focused unit coverage.
  6. **Distribution Backends**: `draft_dsp_metadata_xml` fetches Audio DNA and artist profile from Firestore, formatting it properly per DDEX standards.

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
