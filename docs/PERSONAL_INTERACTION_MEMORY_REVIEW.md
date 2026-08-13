# Personal Interaction Memory Review

**Reviewed:** 2026-08-13  
**Scope:** Persistent recall of personal facts, preferences, decisions, and
prior conversations across authenticated sessions and devices.  
**Finding:** The repository has most of the storage and retrieval substrate, but
the automatic capture path is not connected to the authenticated application
lifecycle. As a result, a conversation can persist without becoming durable,
reusable personal memory.

## Executive summary

The platform currently has three distinct continuity mechanisms:

1. **Conversation persistence:** `SessionService` stores session metadata in
   Firestore and messages in an append-only `sessions/{sessionId}/messages`
   subcollection. The session slice subscribes to the active conversation and
   merges pending optimistic messages.
2. **Long-term memory:** `AlwaysOnMemoryEngine` stores extracted memories under
   the authenticated user's Firestore document and `BigBrainEngine` retrieves
   memory before agent execution.
3. **Explicit semantic memory:** `manageSemanticMemory` provides authenticated
   vector add/search operations for `users/{uid}/memories`.

The key missing link is automatic capture. `AutoMemoryExtractor` exists and can
extract the latest 20 messages, but production initialization starts only
`AlwaysOnMemoryEngine`; no production caller starts `AutoMemoryExtractor`.
Explicit `save_user_memory` tool calls can work, but ordinary personal
interaction is therefore not reliably promoted from a saved transcript into
long-term memory.

## Where memory should be added

### P0 — Connect automatic extraction to the authenticated lifecycle

**Insertion point:**
`packages/renderer/src/providers/AppInitializationProvider.tsx`

Start `autoMemoryExtractor` alongside `alwaysOnMemoryEngine` after a verified,
non-demo user is available. Stop both services in the effect cleanup and
whenever the account boundary changes.

Why this is first:

- `AutoMemoryExtractor.start(userId)` is currently only exercised by its unit
  tests.
- Starting the memory engine alone enables storage, consolidation, and
  retrieval, but does not capture normal conversations.
- Account-bound start/stop prevents one user's timer or cached identity from
  surviving into another user's session.

Do not merely add a timer import. The lifecycle integration should be covered by
a provider test proving start and cleanup for sign-in, sign-out, and user
switching.

### P0 — Extract on durable conversation boundaries, not only every five minutes

**Insertion points:**

- `packages/renderer/src/core/store/slices/agent/agentSessionSlice.ts`
- `packages/renderer/src/services/agent/memory/AutoMemoryExtractor.ts`

Add an extraction checkpoint after a completed assistant response has been
durably written, and before switching, archiving, or closing the active session.
Keep the timer only as a fallback.

The extractor currently reads only the active in-memory session and takes the
last 20 messages. That misses short sessions closed before the timer fires,
inactive sessions, and facts older than the rolling window. Replace
`lastExtractedAt` as the sole global marker with a per-session durable cursor
such as `lastExtractedMessageId` (or timestamp plus message ID). Extraction must
be idempotent and retryable.

Recommended flow:

1. Finish and persist the model response.
2. Enqueue extraction for the session and message range.
3. Extract user facts, preferences, corrections, goals, relationships, and
   explicit decisions.
4. Persist memories and the extraction cursor atomically or with an idempotency
   key.
5. Retry failures without blocking chat.

### P0 — Consolidate the two user-memory stores

**Insertion points:**

- `packages/renderer/src/services/agent/memory/AlwaysOnMemoryEngine.ts`
- `packages/renderer/src/services/agent/memory/MemoryBankService.ts`
- `packages/firebase/src/functions/agent/manageSemanticMemory.ts`

There are currently two different Firestore concepts:

- `users/{uid}/alwaysOnMemories`, used by `AlwaysOnMemoryEngine` and the Memory
  Dashboard.
- `users/{uid}/memories`, used by the callable semantic-vector API.

Choose one canonical memory record and retrieval contract, or add an explicit
synchronization layer. Without this, a fact saved through one tool can be absent
from the context path used by another agent. The canonical schema should include
source session/message IDs, provenance, confidence, consent state,
created/updated/accessed timestamps, supersession links, and an embedding
version.

### P1 — Make archive recall truly semantic and unbounded

**Insertion points:**

- `packages/renderer/src/services/agent/memory/AlwaysOnMemoryEngine.ts`
- `packages/renderer/src/services/agent/memory/MemorySearch.ts`
- `packages/renderer/src/services/agent/SessionTools.ts`
- `packages/renderer/src/services/agent/SessionService.ts`

`AlwaysOnMemoryEngine.retrieve()` currently returns recent records and applies
only the first requested category; its own comment notes that this is not true
vector retrieval. `getAllMemories()` has a 10,000-document ceiling.
`sessions_history()` reads only sessions already loaded into Zustand, while the
real-time session subscription is intentionally limited to the most recent 50
sessions.

Add a server-side recall API that searches the full authenticated archive
without loading every transcript into the renderer. It should support semantic
and lexical fallback, source/session filters, cursor pagination, relevance
scores, and an explicit `searchedCount`/`hasMore` result. Keep the 50-session
live subscription for UI performance; do not confuse that working set with the
recall archive.

### P1 — Store compact session summaries and decisions

**Insertion point:** a new backend-owned summarization path adjacent to
`SessionService`, using `SummaryService` only as the summarizer rather than as
the database owner.

On session close/archive and at token thresholds, persist a versioned summary
containing:

- user goals and personal facts;
- preferences and corrections;
- decisions, commitments, and unresolved items;
- participating agents and project context;
- source message ranges and summary model/version.

Raw transcripts remain the audit source. Summaries provide cheap continuity and
should never silently overwrite authoritative user facts.

### P1 — Add user control, correction, and provenance

**Insertion points:**

- `packages/renderer/src/modules/memory/MemoryDashboard.tsx`
- settings UI backed by `users/{uid}/settings/autoMemory`

The dashboard supports browsing and deletion, but durable personal memory also
needs:

- an explicit automatic-memory toggle with a clear explanation;
- per-memory edit/correct, pin, forget, and “do not learn this” actions;
- source links back to the originating conversation/message;
- export and full-reset controls;
- visible distinction between user-stated facts, agent inference, and
  consolidated summaries;
- retention controls for sensitive or short-lived information.

Never store credentials, payment data, authentication material, or raw sensitive
attachments as conversational memory. Memory extraction should use allowlisted
categories and redact likely secrets before persistence.

### P2 — Measure continuity rather than storage alone

Add structural integration tests for these chains:

1. User states a preference in session A; the extractor persists it with
   provenance.
2. A new store/app instance starts session B; `ContextPipeline` retrieves the
   preference.
3. The generated prompt contains the relevant fact once, within the memory
   budget.
4. A correction supersedes the old fact; subsequent recall returns only the
   current fact.
5. Deletion/reset removes the memory, embeddings, summaries, insights, and
   cached context.
6. User switching never exposes the first user's transcript or memory.

These tests demonstrate wiring and isolation. Genuine cross-device or production
claims must still use the repository's real-user authenticity process and real
authorized accounts.

## What is already in the right place

- Session messages use append-only child documents, avoiding concurrent
  whole-array overwrites.
- Session pagination exists for archive browsing and initial synchronization.
- `ContextPipeline` calls `BigBrainEngine` before agent execution, and
  `BaseAgent` has explicit prompt insertion points for relevant memory.
- Firestore rules scope sessions and always-on memories to authenticated owners.
- The Memory Dashboard already provides a useful base for browsing, querying,
  and deleting individual records.

These pieces should be extended, not replaced.

## Recommended implementation sequence

1. **Lifecycle wiring:** start/stop automatic extraction for the active
   authenticated account.
2. **Durable extraction checkpoints:** per-session cursor,
   completion/session-close triggers, retry, and idempotency.
3. **Canonical schema:** unify `memories` and `alwaysOnMemories` or formally
   bridge them.
4. **Full-archive recall:** backend semantic/lexical search with pagination and
   provenance.
5. **User controls:** consent, correction, source visibility, export, retention,
   and comprehensive reset.
6. **Continuity tests and telemetry:** capture success, recall hit rate,
   stale/superseded facts, latency, and deletion completeness.

## Acceptance criteria

Memory is complete only when all of the following are true:

- A signed-in user's memorable statement is captured without requiring a
  tool-specific phrase.
- Capture survives navigation, reload, and a new device/session.
- A relevant later request retrieves the fact before model execution.
- Recall identifies its source and does not cross user or organization
  boundaries.
- Corrections supersede stale facts deterministically.
- Users can disable capture and inspect, edit, export, or permanently delete
  stored memory.
- Failures are observable and retryable; the UI never claims a memory was saved
  when persistence failed.

## Delivery blueprint

### Target architecture

Use one account-scoped memory pipeline with five explicit stages:

```text
durable session messages
        |
        v
extraction job + per-session cursor
        |
        v
canonical memory records -----> correction / deletion / retention controls
        |
        v
hybrid recall (vector + lexical + authoritative facts)
        |
        v
budgeted ContextPipeline injection with provenance
```

Firestore remains the source of truth. Zustand holds only the current working
set and optimistic UI state. Cloud Functions own embedding generation, canonical
memory writes, archive search, and destructive account-wide operations. The
renderer may request these operations but must not become a second database
owner.

### Canonical data model

Adopt `users/{userId}/memories/{memoryId}` as the canonical collection because
the authenticated semantic-memory function already owns that namespace. Migrate
`alwaysOnMemories` into it rather than maintaining permanent dual writes.

Each memory record should contain:

```typescript
interface CanonicalUserMemory {
  id: string;
  userId: string;
  orgId: string;
  content: string;
  normalizedContent: string;
  category: MemoryCategory;
  kind: "user_stated" | "agent_inferred" | "session_summary";
  importance: number;
  confidence: number;
  status: "active" | "superseded" | "deleted";
  source: {
    sessionId?: string;
    messageIds: string[];
    projectId?: string;
    agentId?: string;
  };
  consent: {
    captureMode: "automatic" | "explicit";
    capturedAt: Timestamp;
  };
  embedding?: VectorValue;
  embeddingModel?: string;
  extractionVersion: string;
  supersedes?: string;
  supersededBy?: string;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt?: Timestamp;
  accessCount: number;
}
```

Store extraction progress at
`users/{userId}/memoryExtractionCursors/{sessionId}` with the last committed
message timestamp and ID, extraction version, attempt count, and last error. Use
`sessionId + terminalMessageId + extractionVersion` as the idempotency key.

Store versioned summaries at `sessions/{sessionId}/summaries/{summaryId}`. A
summary records its covered message range, participant IDs, source project,
model/version, and the memory IDs produced from it. It does not replace the raw
transcript.

### Service contracts

Implement backend callable functions (or equivalent authenticated endpoints)
with schemas shared through `packages/shared`:

- `extractSessionMemory`: read an owned session range, redact secrets,
  deduplicate, write memories, and advance its cursor.
- `recallUserMemory`: run hybrid recall with filters, scores, provenance,
  `searchedCount`, and a pagination cursor.
- `correctUserMemory`: supersede an old record and transactionally create the
  corrected authoritative record.
- `deleteUserMemory`: delete or tombstone a record and remove derived embedding
  and cache references.
- `resetUserMemory`: delete all memories, summaries, insights, cursors, and
  cached derived context for the authenticated account.
- `exportUserMemory`: produce a user-readable export without embeddings or
  internal model metadata.

Every contract must derive `userId` from authentication, validate App Check in
production, enforce organization ownership, validate input with a shared schema,
and return typed error codes. The client must never submit a trusted `userId`.

### Capture policy

Automatic extraction should remember only durable, user-relevant information:

- explicit preferences and corrections;
- stable personal or professional facts;
- declared goals and deadlines;
- named collaborators and relationships;
- decisions the user expects the platform to carry forward;
- recurring workflow preferences.

Do not automatically retain greetings, transient brainstorming, model-authored
claims, credentials, authentication tokens, payment details, government IDs,
health data, private keys, or raw attachment contents. Run deterministic secret
redaction before model extraction and again before persistence. Agent inference
must be labeled as inference and should require a higher confidence threshold
than user-stated facts.

### Capture triggers and reliability

Use event-driven checkpoints in addition to the fallback timer:

1. After the final assistant message is durably stored, enqueue the new message
   range for extraction.
2. Before changing the active session, enqueue any unprocessed range without
   blocking navigation.
3. On archive/close, enqueue extraction and summary generation.
4. On startup, scan cursor metadata for incomplete ranges and resume them.
5. Keep a low-frequency timer only to repair missed events.

The job should claim an idempotency key transactionally, retry transient errors
with bounded exponential backoff, and move terminal failures to an observable
dead-letter state. Advance the cursor only after all canonical writes commit.
The UI may show `Remembering…`, `Memory saved`, or `Will retry`, but only from
real job state.

### Recall and prompt assembly

`ContextPipeline` should request recall once per user turn using the user
message, active agent, project, and conversation participants. The backend
should:

1. Fetch authoritative pinned facts and active corrections.
2. Run vector nearest-neighbor search over active memories.
3. Run lexical fallback for names, dates, identifiers, and exact phrases.
4. Merge, deduplicate, and remove superseded or expired records.
5. Return bounded results with scores and source references.

Prompt assembly should preserve the existing 10,000-character total budget,
prioritize authoritative user-stated facts, and include untrusted memory inside
a clearly delimited data block. Memory text is context, never system
instruction. Record which memory IDs were injected so the response can expose
provenance and recall quality can be measured.

### User experience

Add a **Memory** section in settings with:

- automatic memory off/on, defaulted according to the approved product privacy
  policy rather than silently enabled in code;
- a concise explanation of what is and is not remembered;
- retention selection for inferred and short-lived memories;
- export and **Forget everything** actions;
- a link to the existing Memory Dashboard.

Extend the dashboard with filters for source, kind, and status;
source-conversation links; edit/correct; pin; forget; and
`Do not remember this again`. Corrections must create an audit-safe supersession
relationship instead of mutating history in place. Destructive actions require
confirmation and report backend completion, not optimistic success.

## Work breakdown

### Milestone 0 — Decisions and safety contracts

#### Deliverables

- Approve the canonical collection, capture defaults, retention policy, and
  sensitive-data denylist.
- Add shared request/response and Firestore record schemas.
- Add an architecture decision record describing source of truth, tenancy, and
  deletion semantics.
- Threat-model prompt injection through stored memory and cross-account leakage.

**Exit gate:** schemas and policy are approved; no implementation depends on an
unresolved consent or retention decision.

### Milestone 1 — Lifecycle and extraction reliability

#### Files likely touched

- `packages/renderer/src/providers/AppInitializationProvider.tsx`
- `packages/renderer/src/services/agent/memory/AutoMemoryExtractor.ts`
- `packages/renderer/src/core/store/slices/agent/agentSessionSlice.ts`
- new shared extraction schemas and Firebase function
- `packages/firebase/firestore.rules`

#### Lifecycle tasks

- Start and stop extraction with the authenticated account lifecycle.
- Introduce per-session cursors and idempotency keys.
- Add completed-response, session-switch, archive, and startup recovery
  triggers.
- Implement retries, terminal failure state, and structured telemetry.
- Add rules and indexes for cursor and canonical-memory ownership.

**Exit gate:** a preference stated in a short session is persisted exactly once
even if the app closes before five minutes, and account switching stops all work
for the prior account.

### Milestone 2 — Canonical store migration

#### Migration tasks

- Inventory record counts and schema variants in both memory collections.
- Build a resumable, idempotent migration keyed by legacy document ID.
- Convert categories, timestamps, provenance, embeddings, and active/deleted
  state; quarantine malformed records for review.
- During rollout, read canonical first and legacy only as fallback.
- Compare counts and sampled hashes, then disable legacy writes.
- Retain rollback metadata until the observation window closes; remove fallback
  only in a later release.

**Exit gate:** memories saved through every existing tool appear through one
recall contract and one dashboard, with no duplicate active facts.

### Milestone 3 — Full-archive recall and summaries

#### Recall tasks

- Implement hybrid recall and cursor pagination on the backend.
- Replace renderer-side recent-record retrieval in `AlwaysOnMemoryEngine`.
- Make `sessions_history` fetch authorized archive pages instead of depending
  solely on the Zustand working set.
- Generate versioned summaries at close/archive and long-session thresholds.
- Add provenance to `BigBrainEngine` results and prompt injection telemetry.

**Exit gate:** a fact outside the 50-session live window and beyond 10,000
memory records can be found without downloading the archive to the client.

### Milestone 4 — Controls and deletion completeness

#### Control tasks

- Add settings consent and retention controls.
- Add dashboard correction, provenance, pin, forget, and suppression actions.
- Implement export and full reset.
- Clear derived summaries, insights, vectors, cursors, local caches, and queued
  extraction jobs when memory is reset.
- Document deletion latency and any legally required backup-retention exception.

**Exit gate:** automated deletion tests prove the deleted fact cannot be
recalled or re-created from an old pending job.

### Milestone 5 — Rollout and quality

#### Rollout tasks

- Ship behind an account-scoped feature flag with staff-only canary first.
- Run shadow recall that records quality metrics without injecting results.
- Expand to a small opt-in cohort after privacy and security review.
- Enable prompt injection only when recall precision and latency meet targets.
- Publish support documentation and a rollback runbook.

**Exit gate:** monitoring is stable for the agreed observation window and the
rollback path has been exercised in a non-production environment.

## Test plan

### Unit tests

- extraction category allowlist, secret redaction, and confidence thresholds;
- cursor comparison and idempotency-key generation;
- correction/supersession conflict resolution;
- recall merge, deduplication, expiry, and budget ordering;
- account lifecycle start/stop and timer cleanup;
- export serialization and complete reset enumeration.

### Emulator integration tests

- rules reject cross-user and cross-organization reads/writes;
- two devices append while one extraction job runs, without message or memory
  loss;
- retry after a failed write produces one memory, not duplicates;
- migration can stop and resume safely;
- reset races with queued extraction and deletion still wins;
- vector results and lexical fallback both respect status and tenancy filters.

### Structural end-to-end tests

- session A preference is recalled in a fresh session B;
- a correction in session C supersedes session A;
- disabling automatic memory prevents new extraction;
- source navigation opens the correct conversation;
- export contains active user-readable memory and excludes embeddings;
- switching accounts clears visible and injected context.

### Real-user validation

After structural tests pass, validate the cross-session and cross-device journey
with genuinely authorized accounts under `.agent/REAL_USER_AUTHENTICITY.md`. Do
not use seeded memory, injected authentication, or mock Firestore data as
evidence that the customer-facing memory journey works.

## Observability and service objectives

Track metrics without logging raw memory content:

- extraction jobs queued, succeeded, retried, failed, and deduplicated;
- capture latency from durable message to committed memory;
- recall latency, result count, searched count, and fallback usage;
- injected-memory IDs, user correction rate, and explicit forget rate;
- stale/superseded result suppression;
- cross-account authorization denials and suspicious repeated access;
- reset duration and residual-record count.

Initial targets:

| Objective                                 | Target                     |
| ----------------------------------------- | -------------------------- |
| Successful extraction jobs                | >= 99.5% within 15 minutes |
| Duplicate canonical memories from retries | < 0.1%                     |
| Recall API p95 latency                    | < 800 ms                   |
| Cross-account memory exposure             | 0                          |
| Reset residual active memories            | 0                          |
| Prompt memory budget violations           | 0                          |

Alert on extraction backlog age, terminal failure spikes, recall latency, reset
residuals, and any authorization anomaly. Dashboards must use identifiers and
counts rather than personal memory text.

## Rollout and rollback

Use independent flags for capture, canonical reads, shadow recall, and prompt
injection. This permits disabling new capture or injection without making stored
memory unavailable for user export/deletion.

Rollout order:

1. Deploy schemas, rules, indexes, and telemetry with all flags off.
2. Enable lifecycle capture for staff accounts.
3. Migrate and validate staff records.
4. Enable shadow recall, evaluate precision and latency, then enable injection.
5. Expand through opt-in cohorts and finally the approved general population.

Rollback disables prompt injection first, then capture if needed. Never roll
back by deleting user memory. Keep canonical records readable for dashboard,
export, correction, and deletion while fixing the pipeline.

## Definition of done

The initiative is done when the acceptance criteria above pass; all unit,
emulator, structural E2E, security, migration, and deletion tests are green; the
real-user cross-session journey is verified with authorized accounts; monitoring
and alerts are live; privacy/support documentation is published; and legacy
memory reads are removed after the rollback window.
