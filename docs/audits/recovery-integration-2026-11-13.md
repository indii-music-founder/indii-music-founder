# Recovery branch reconciliation — 2026-11-13

Base: da08cd3f0. Recovery follows the oldest outstanding snapshots before new work.

## Disposition of the final five snapshots

- `agent-file-access-boundaries` (`527b69e50`): MCP verified-entitlement admission, strict bearer parsing, session-owner enforcement and scoped scheduling patches already exist in current main. Current gateway also retains newer anonymous-admission handling. Generated declarations are superseded by current shared source and build outputs. The archived ledger is retained under the current V3 protocol.
- `rights-hosted-filing` (`e97b4d4c8`): recovered the missing-assessment preflight regression and the missing-document read permission it needs. After contact information is added, anonymous reads remain denied. Current immutable filing receipt protection takes precedence over historical owner-delete behavior.
- `finish-boardroom-reliability` (`968b4a256`): documentation-only snapshot. Its unique historical findings are preserved below without reopening the sealed V2 ledger or certifying its old statuses.
- `boardroom-image-reliability-final` (`028fcc1d6`): recovered Boardroom roster normalization, advisory dispatch leases and slot allocation, agent-stream lifecycle/terminal reconciliation, image lease metadata, capacity outcomes and completed-tool receipt recovery. Kept current workspace/header controls, session-bound message routing, persona finalization, token cost estimation and provider admission. Adapted callable APIs to current Gen 2 imports. Literal test configurations declare their tool authorizations and clear prior simulated responses between cases.
- `debug-app-logic-issue` (`7d2301213`): recovered draft revision validation and owner-only read access for four server-owned knowledge collections. Recovered legal actor receipts through owner-scoped reads and queries. Cross-owner global audit access and deletion of durable registration receipts were superseded by current ownership/immutability guarantees.

## Verification

Selected structural service and UI checks, STANDARD Firestore emulator rules checks, typechecking and lint are recorded in the delivery PR. None of these claim genuine customer production acceptance. Deployment must pass for the delivered SHA before readiness is claimed.

## Scoped rules audit

```json
{"score":4,"summary":"Owner and actor identity guards deny cross-user reads and writes. Knowledge records remain server-write-only, legal receipts remain immutable, and contact PII stays protected after a missing-record preflight.","findings":[{"check":"Payload limits","severity":"minor","issue":"Existing screenwriter payload shape and size limits remain outside the recovered revision constraint.","recommendation":"Apply the existing draft schema at the persistence boundary in a separately scoped change."}]}
```

## Historical findings from finish-boardroom-reliability

These are preserved historical observations from the recovery snapshot. Their statuses and acceptance statements are not current verification results.

### ISSUE-1295: Image reservations are not atomically claimed before paid provider submission
- **Status:** ⏳ OPEN
- **Severity:** 🔴 CRITICAL
- **Location:** `packages/firebase/src/functions/creative/gateway.ts:1100-1205`; `packages/firebase/src/functions/billing/enforceOperationCost.ts:662-685`
- **Details:** `generateImageV3` creates a random job and performs a read-only `APPROVED` reservation check, but it never atomically binds that reservation to the job before crossing the provider boundary. Concurrent Boardroom agents, tabs, or reload retries can all observe the same approved receipt and submit multiple paid generations while idempotent settlement records only one charge. The image path also voids every failure without a returned output, including ambiguous timeout/disconnect/5xx failures after provider submission may have occurred.
- **Expected (acceptance):** Atomically claim one reservation and create one authoritative image job bound to owner, normalized request digest, and durable request ID before provider submission. Concurrency and replay tests must prove exactly one provider call and one terminal settlement. Persist explicit `not_submitted`, `submission_attempted/ambiguous`, and terminal evidence; void only failures proven to precede submission, and reconcile ambiguous claims without blind resubmission.
- **Honest fallback:** Reject an unclaimable or reused receipt before provider submission. If submission status is ambiguous, retain the claim/job in a typed reconciliation-required state and tell the user to wait/check status rather than retry immediately.
- **DO NOT:** Do not use a read-then-update sequence, process-local mutex, prompt-derived key, silent retry, or absence of returned bytes as proof that the provider was not reached.

### ISSUE-1296: Boardroom has no durable single owner for side-effecting image requests
- **Status:** ⏳ OPEN
- **Severity:** 🔴 CRITICAL
- **Location:** `packages/renderer/src/services/agent/AgentService.ts:123-127,253-371,883-1045`; `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts:47`; `packages/renderer/src/services/image/ImageGenerationService.ts:133-156,265-274`
- **Details:** Boardroom dispatches the same action prompt to every seated agent in chunks, while multiple agents can expose image-generation tools. `isProcessing` and image single-flight state are process-memory only. Timeout races release the lock without aborting or reconciling the losing execution, and renderer reload recreates both guards. This matches the production incident where one visible seated agent produced five overlapping model streams and left an orphaned `Reviewing request...` record without reaching image generation.
- **Expected (acceptance):** Assign exactly one deterministic qualified owner to each side-effecting image action, give all other seats advisory-only execution, and create a durable per-user/conversation/request lease that survives duplicate UI dispatch, renderer reload, timeout, and reconnect. Tests with multiple image-capable seats and duplicate/reload attempts must prove one reservation, one job, one provider submission, and recovery of the same result.
- **Honest fallback:** If ownership cannot be established or the previous request status cannot be reconciled, block paid submission and show a truthful checking/wait state; require the user to seat a qualified specialist if none is available.
- **DO NOT:** Do not rely on prompt wording, reduce only `CHUNK_SIZE`, add another boolean/localStorage lock, allow a general/untrained fallback, or clear ownership while underlying work can still continue.

### ISSUE-1297: Boardroom image jobs and message placeholders are not reload-safe or durably ordered
- **Status:** ⏳ OPEN
- **Severity:** 🟠 HIGH
- **Location:** `packages/renderer/src/services/agent/AgentService.ts:905-911,968-1032`; `packages/renderer/src/modules/boardroom/components/BoardroomConversationPanel.tsx:124-140`; `packages/renderer/src/services/agent/tools/DirectorTools.ts:192-208`; `packages/firebase/src/functions/creative/gateway.ts:231-254,1116-1129,1248-1295`
- **Details:** Initial and terminal Boardroom message syncs are fire-and-forget and unversioned, while the UI locally clears streaming after 60 seconds even though executions may run 300-600 seconds. Authoritative image job creation/completion uses persistence helpers that swallow Firestore failures, and gallery/history import occurs only after the original renderer receives the callable response. A reload can therefore leave a paid completed job undiscoverable, regress a terminal message to the placeholder, or leave Firestore permanently streaming.
- **Expected (acceptance):** Require authoritative job/claim persistence before submission, use versioned ordered message/request state, persist a typed terminal or reconciling outcome, and reconcile owned processing/completed jobs into Boardroom and gallery after reload. A reload/race test must prove a terminal record cannot regress to streaming and a completed asset appears exactly once.
- **Honest fallback:** Display `connection lost; checking request` and preserve the retry lock until the durable job state is known. If initial authority cannot be persisted, fail before provider submission.
- **DO NOT:** Do not merely lengthen the 60-second timer, await only the final write without ordering/version protection, swallow authoritative Firestore errors, or claim background completion without a durable job receipt.

### ISSUE-1298: Image request/result contracts are incomplete and typed capacity metadata is collapsed
- **Status:** ⏳ OPEN
- **Severity:** 🟠 HIGH
- **Location:** `packages/shared/src/schemas/creative.ts:4-24`; `packages/shared/src/types/ai.dto.ts:302-312`; `packages/shared/src/types/errors.ts:1-15`; `packages/renderer/src/services/image/ImageGenerationService.ts:135-156,490-528`; `packages/renderer/src/services/agent/tools/DirectorTools.ts:563-587`; `packages/renderer/src/services/agent/BaseAgent.ts:91-139`
- **Details:** The canonical image request has no durable request/idempotency ID, the client single-flight key omits output-affecting inputs, and shared/renderer error contracts have drifted. The actual `DirectorTools.generate_image` path converts `GENERATION_CAPACITY_LIMITED` into generic `GENERATION_ERROR`, discarding retry timing, category, and `providerSubmitted=false`. Post-tool recovery is also keyed to two tool names plus a later capacity classifier, so timeout/network/abort/5xx summary failures can report failure after a successful image job.
- **Expected (acceptance):** Define one canonical discriminated image request/outcome/error contract carrying request ID, job/reservation receipt, normalized request digest, terminal/submission state, safe retry metadata, and provider-submitted evidence. Exact duplicates replay/reconcile one job; different output inputs never coalesce. Preserve authoritative completed or typed-failed image outcomes across every later summary-only failure without making a second model/provider submission.
- **Honest fallback:** When a durable receipt or submission state is unavailable, return a safe typed unknown/unavailable outcome, preserve the user's request, and do not present success or encourage immediate paid retry.
- **DO NOT:** Do not add another copied enum/schema, stringify raw base64 as a permanent key, infer submission from error text/returned bytes, expose provider endpoints or quota internals, or auto-resubmit.

### ISSUE-1299: Boardroom capability truth is neither centrally enforced nor evidence of current availability
- **Status:** ⏳ OPEN
- **Severity:** 🟠 HIGH
- **Location:** `packages/renderer/src/services/agent/AgentService.ts:415-428,850-934`; `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts:110-131`; `packages/firebase/src/functions/agent/getCapabilitySnapshot.ts:52-63,115-220`; `packages/renderer/src/services/agent/CapabilitySnapshotService.ts:48-59`
- **Details:** Capability intent is intercepted only inside the Generalist after Boardroom swarm routing, so other seated specialists can still answer through ordinary models or the Generalist can be absent. The server labels image generation `available` from any completed job within seven days using an unordered 50-document sample, which does not prove current gateway/admission/provider health. Client calls are uncached and server social-token reads are unbounded; evidence failures silently collapse without internal diagnostic category.
- **Expected (acceptance):** Detect capability intent once before swarm dispatch and emit one policy-owned response with no specialist/model fan-out. Use ordered, indexed, bounded evidence plus current server-owned serving/admission health, or explicitly label historical evidence as such. Cache a valid signed snapshot until expiry while allowing local failures to downgrade it, and emit non-sensitive structured telemetry for evidence failures.
- **Honest fallback:** Report capability as unverified or temporarily unavailable without claiming generation works now and without probing through paid generation.
- **DO NOT:** Do not trust historical success as live health, use prompt instructions as enforcement, expose provider/quota details, or let a general/untrained model answer when the attested responder is absent.

### ISSUE-1300: Broad `unsafe-eval` CSP workaround weakens every hosted application surface
- **Status:** ⏳ OPEN
- **Severity:** 🟠 HIGH
- **Location:** `firebase.json:76,151,196,260`
- **Details:** The crash workaround adds general JavaScript `'unsafe-eval'` to every deployed `script-src` policy, including landing and authenticated surfaces. This removes an important defense against eval/Function execution if an injection path or allowed dependency is compromised. The Boardroom sweep independently found a concrete unstable Zustand selector crash candidate, so weakening CSP is not an acceptable substitute for correcting renderer/runtime incompatibility.
- **Expected (acceptance):** Identify and remove the eval-dependent bundle/runtime path, restore CSP without general `'unsafe-eval'`, retain only narrowly justified directives such as existing `wasm-unsafe-eval`, and validate affected production routes under the restored policy.
- **Honest fallback:** Disable or isolate the specific eval-dependent feature behind a truthful unavailable state until a CSP-compatible build exists.
- **DO NOT:** Do not preserve broad `'unsafe-eval'` to hide a renderer crash, weaken other CSP directives, or scope the exception to more routes than technically required.
