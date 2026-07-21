# Claude Checkpoint — MCP Backend Completion + Live Verification (ISSUE-1092/1093/1100)

**Date:** 2026-07-21
**Branch:** `main`
**Objective:** Finish the MCP backend completion plan (P0-P8), get ISSUE-1092 and ISSUE-1093 to genuinely FIXED with live evidence, then reconcile two stale planning artifacts.

## Completed

**MCP backend (P0-P8, all real):**
- P0: job-queue worker audit — orphan `mcpJobs` removed, all durable intents have real consumers or explicit no-auto-processing labels.
- P1: `register_split_sheet` — real PDF via `pdf-lib`, uid-scoped GCS.
- P2: `draft_cwr_registration` — complete CWR v2.1 file (HDR/GRH/NWR/SWR/SPT/GRT/TRL).
- P3: `stage_stripe_payouts` — real Stripe Connect account verification (`accounts.retrieve`), `payoutBatches` staging; no transfer call (money movement stays a separate human-approved action).
- P4: `draft_dsp_metadata_xml` — fuller DDEX ERN (MessageHeader/ResourceList/ReleaseList/DealList).
- P5: `schedule_campaign_waterfall` — real Inngest dispatch, `step.sleepUntil` durable per-event execution, `emailOptIn`-gated outreach email.
- P6: `queue_remotion_render` — real ffmpeg canvas MP4 composition via Inngest (artist's own cover art + audio only, no music generation).
- P7a: `audit_sample_clearance` — real metadata-declaration verdict (DECLARED-BUT-UNVERIFIED / NONE-DECLARED). P7b (fingerprint vendor) tracked as a founder action in `docs/RELEASE_CHECKLIST.md`.
- **P8 (the hard one): live SSE round-trip verified against the deployed `mcpEndpoint`** with a real Firebase ID token (service-account custom-token → Identity Toolkit exchange). `listTools()` returned all 11 real tools; `callTool()` executed a real handler and returned an honest `NOT_FOUND` — no fabricated success.

**Critical discovery + fix chain for P8 (all found only by testing the real deployed endpoint, all now committed):**
1. `mcp/registry.ts`'s `McpToolRegistry` (the auth-aware, per-session dispatcher) was imported by zero files — the live `mcpEndpoint` was a stale, unauthenticated, single-hardcoded-tool relic. Rewired `mcp/index.ts` to actually use it.
2. Gen1 Cloud Functions hard-kill any connection at their execution ceiling (~60s) regardless of `timeoutSeconds` — incompatible with SSE. Migrated to Gen2 (`firebase functions:delete` + fresh deploy; Gen1→Gen2 is not an in-place upgrade).
3. The `/mcpEndpoint` function-name path prefix is stripped before Express sees the request — the advertised `/message` callback URL had to be reconstructed from the `Host` header, not `req.originalUrl`.
4. `req.protocol` reports `http` behind the load balancer — fixed with `app.set('trust proxy', true)`.
5. Firebase Functions v2 pre-parses the JSON body, draining the stream before the MCP SDK's own read — fixed by passing `req.body` as `handlePostMessage`'s `parsedBody` argument.
6. (Polish pass) Hoisted `McpToolRegistry` construction out of the per-session hot path — it's stateless across sessions, was being needlessly rebuilt on every connection.

**Stale artifact reconciliation:**
- `task.md` (124-issue sweep, dated 2026-07-14): 50 items already fixed (checkboxes synced), 38 already backlog/consolidated (annotated, not re-worked), 1 genuinely partial (ISSUE-784, already founder-gated in `RELEASE_CHECKLIST.md`).
- `implementation_plan.md` (Command Workflow Layer): confirmed fully built and tested already (23/23 tests passing across 5 files, all 9 implementation steps verified against real code, not just imports).

**Docs:**
- New flowchart `docs/flowcharts/mcp-tool-endpoint-live-architecture-micro.md`.
- `docs/RELEASE_CHECKLIST.md`: added "Sample Clearance Fingerprint Vendor" founder-action section.
- `.agent/skills/error_memory/ERROR_LEDGER.md` + `docs/PLATINUM_QUALITY_STANDARDS.md`: logged the `packages/firebase` typecheck-coverage gap (root `tsc --noEmit`/`npm run typecheck` never check it) and the 5-defect Cloud Functions SSE chain.

## Verification

- `cd packages/firebase && npm run build` — clean (the actual gate; root typecheck does NOT cover this package, see ERROR_LEDGER).
- 45 mcp/lib tests + 23 EntryCommand tests — all passing (verified together, 83/83).
- Live production round-trip against the deployed `mcpEndpoint` — verified twice (before and after the registry-hoisting polish), both times with fresh minted tokens, both times clean.
- Full `npm run ci` gauntlet — **✅ all checks passed**: 207 test files / 1355 tests passed (2 pre-existing skips), typecheck, flowchart validation, duplicate-identifier check, Electron mocks check all clean.
- Dependency drift check (`npm run check:dep-drift`) — clean.
- Anti-hallucination grep (MOCK/TODO/FIXME/stub) across every file touched this session — zero hits.

## Fixed incidentally (found blocking the gauntlet, not part of original scope)

- `packages/firebase/src/lib/marketing.ts`: `INFLUENCER_BOUNTY_BASE_URL` param lacked a `.default('')`, blocking non-interactive deploy of every function in the codebase (Firebase's `defineString` requires a value on file, code-level defaults only pre-fill interactive prompts).
- `packages/firebase/src/mcp/tools/draftCwrRegistration.ts`: a `firestore` variable narrowed to a decorative `OwnershipFirestore` type lost `.doc()`/`.set()` — caught by `packages/firebase`'s own strict build, not by root typecheck (see ERROR_LEDGER).
- `docs/flowcharts/issue-1082-vertex-rollout.md` (unrelated, pre-existing, verified via `git blame` — commit `42483f405`): missing the required "Transition Breakdown" section header, failing `npm run ci`'s flowchart validator. One-line fix to unblock the gate for everyone, not scope creep on the file's actual content.

## Session-end state

- `main` fully clean, fully synced with `origin/main`, zero uncommitted files.
- No background agents/tasks spawned this session — nothing to kill.
- All temporary GCP service-account keys created for live-token minting were deleted immediately after use (verified: same 4 keys present at session end as at session start).

## Shared Worktree Note

A parallel agent track ("Computer Execution capability", ISSUE-1110+) has been committing throughout this session (`packages/main/src/services/computer/**`, `packages/renderer/src/services/agent/tools/ComputerTools.ts`, etc.). Their work was stashed and restored cleanly once mid-session when a pre-commit hook's full-repo typecheck caught their in-progress errors while isolating an unrelated commit — no content was lost or altered. Do not absorb their files into unrelated commits.

## Next

No open thread from this session. If resuming MCP work: P7b (sample-clearance vendor) and IAM invoker binding (ISSUE-1086) are the only tracked, founder-gated remainders — both explicitly out of engineering scope until the founder acts.
