# Post-Mastering Administrative Engine — Technical Implementation Plan (2026-09-26)

Mission: evolve indii from a static administrative database into an autonomous, proactive
post-mastering operational engine — background monitors that stage one-click reconciliation
actions, a deterministic Master Ingestion Runbook, and machine-readable semantic catalog
surfaces — with Jev (TypeSafe System One) supplying bounded semantic judgments inside
deterministic workflows.

Audit basis: three codebase surveys (2026-09-26) covering ingestion, schema/rights, and
orchestration/DDEX/exports. All file:line refs verified by those surveys.

---

## 0. Audit — current state vs the three pillars

### Pillar 1 — Autonomous administrative monitors: **MISSING**
- Jev is deeply integrated as **point-in-time judgments** (~70 in
  `packages/renderer/src/config/typesafeJudgments.ts`, server proxy
  `packages/firebase/src/functions/intelligence/typesafeJudge.ts`, model `jev-latest`,
  key via `TYPESAFE_API_KEY` secret `packages/firebase/src/config/secrets.ts:9`) — but **no
  durable Jev worker exists**; nothing schedules or event-drives audits
  (closest: `functions/agent/agentLoopCron.ts:107` 15-min cron).
- **No AdministrativeTasks collection.** Nearest analogs are generic: `users/{uid}/tasks`
  (`ProjectTools.ts:96`), single-doc `agent_queue` (`agentTaskSlice.ts:94`),
  PandaDoc-only `distribution_pipeline_queue` (`legal/pandadocWebhook.ts:254`).
- **No identifier cross-validation**: ISRC/UPC pool uniqueness only
  (`functions/distribution/distributionRecords.ts:166-301`); ISWC↔IPI check exists in
  `ISWCService.ts:258-263`; nothing joins ISRC↔ISWC↔UPC↔IPI across entities. The canonical
  identifier graph (`packages/shared/src/schemas/musicEntity.ts:79-110`, identifiers with
  `provenance`) is not joined to legacy `GoldenMetadata` fields.
- **Split checks are scattered float sums** in 4+ places (§1.5); only
  `calculateRoyaltyAllocations.ts:103-146` (basis-point exact) blocks.

### Pillar 2 — Deterministic post-mastering runbooks: **PARTIAL, USER-INITIATED ONLY**
- Canonical master pipeline is strong but **entirely user-triggered**: client parses
  WAV/FLAC + SHA-256 (`services/audio/MasterAudioValidation.ts:24-108`) → content-addressed
  upload `masters/{uid}/{hash}/original.*` (`MasterAudioService.ts:37`) → `processAudioIngestion`
  callable (`packages/firebase/src/distribution/ingestion.ts:223`) → hash re-verify
  (`functions/storage/verifyMasterAudio.ts:91-138`) → Cloud Tasks `dsp-processing-queue`
  (`ingestion.ts:81-132`) → engine-dsp librosa+Gemini (`packages/engine-dsp/pipeline.py:517-540`)
  → lease-idempotent `audio_analysis_receipts` (`pipeline.py:136-248`). **No storage trigger on
  `masters/`; no Firestore/Inngest event when a receipt completes** — the chain stops until a
  human opens a UI (`TrackIngestionService.ts:37-40`, `QCPanel.tsx:236`, `useDDEXRelease.ts:288`).
- **Five+ overlapping status enums, no canonical master lifecycle**:
  `ReleaseDistributionStatus` (`services/metadata/types.ts:184-198`), `ReleaseStatus`
  (`services/distribution/types/distributor.ts:158-174`), receipt
  `processing|complete|failed`, verification `verified|rejected`, DeliveryStatus
  (`proprietary-ingestion/types/common.ts:189-198`). Transitions are ad-hoc client writes.
- DDEX ERN 4.3 builders exist and are reusable: shared TS
  (`packages/shared/src/distribution/ddexBuilder.ts:15-214`) and Electron Python
  QC→ISRC→DDEX→SFTP (`packages/main/src/handlers/distribution.ts:515-591` →
  `execution/distribution/ingestion_build.py`); Jev DDEX pre-flight gate already exists
  (Judgment 28, `typesafeJudgments.ts:2296`).
- **Split signature workflow**: split sheets are `recorded_unsigned` only;
  `registerSplitSheet.ts` (remote MCP tool, sha256-derived doc ids + `idempotencyKey`
  `:146-149`) and `DigitalSignatureService.ts` exist but nothing dispatches/tracks
  collaborator sign-off automatically.
- **No ledger receipt**: closest precedents to reuse — hash-chained `users/{uid}/auditLogs`
  (`lib/auditLogChain.ts:60,133`), `ApprovalReceiptSchema` schemaVersion pattern
  (`shared/src/schemas/approvalReceipt.ts:14-25`), content-addressed receipts.

### Pillar 3 — Semantic metadata engine: **SEEDS ONLY**
- **No public catalog/JSON-LD/RSS endpoint.** Only internal generators (EPK
  `schema.org/MusicGroup` string, `EPKGeneratorService.ts:95-104`; landing page block) and an
  internal Jev filter (`services/catalog/SemanticCatalogFilterService.ts:26`).
- Remote MCP server (`packages/firebase/src/mcp/index.ts`) exposes 12 tools incl.
  `registerSplitSheet`, `draftCwrRegistration`, `draftDspMetadata`, `auditAssetResolutions` —
  the right surface to extend, not duplicate.
- `packages/sdk` REST client targets routes **no server implements**.

### Reusable primitives (do not reinvent)
| Need | Existing primitive |
|---|---|
| Durable multi-step workflow | Inngest (6 fns served at `index.ts:1055-1093`; skip-if-intent-exists idiom `lib/long_form_video.ts:228`; status-guarded `executeVideoJob` `index.ts:540-576`) |
| Transactional state machine | `CampaignFSM` guard pattern (`firebase/src/orchestration/fsm/machine.ts:44-76`) |
| Resumable step records | `WorkflowStateService` zod-validated `users/{uid}/workflowExecutions` (`WorkflowStateService.ts:22-43`) |
| Approval-gated mutation | `ToolApprovalService` approve-then-replay-exact-args (`services/agent/governance/ToolApprovalService.ts`), `staged_pending_approval` money pattern (`stageStripePayouts.ts:254-260`), `TOOL_RISK_REGISTRY` tiers, `ExecApprovalService` |
| Fixed-point math | `SHARE_UNITS_PER_PERCENT = 10_000` basis-point share units + BigInt micros largest-remainder (`calculateRoyaltyAllocations.ts:4-5,103-146`), `DecimalMoney` (`shared/src/foundry/DecimalMoney.ts`) |
| Server-side Jev | fetch-based `TypeSafeEvidenceProvider` (`functions/knowledge/evaluation/TypeSafeEvidenceProvider.ts:7-63`; JS SDK has a reported Node 20/22 cancellation issue — keep fetch) |
| DB discipline | Database Platinum Protocol: TS interface + zod + rules parity, ownership anchor, predictable IDs, `createdAt/updatedAt`, no full scans |

---

## 1. Schema & state machine updates

### 1.1 Canonical master lifecycle (shared, zod-validated)
New file `packages/shared/src/schemas/masterLifecycle.ts`:

```ts
export const MASTER_LIFECYCLE_STATUSES = [
  'DRAFT', 'INGESTED', 'METADATA_AUDITED', 'SPLITS_PENDING',
  'ADMIN_LOCKED', 'DISTRIBUTION_READY',
  // terminal exception side-states (never on the happy-path spine)
  'ADMIN_BLOCKED', 'TAKEN_DOWN',
] as const;
export const MasterLifecycleStatusSchema = z.enum(MASTER_LIFECYCLE_STATUSES);

/** Legal transitions — the ONLY edges the FSM may take. */
export const MASTER_LIFECYCLE_EDGES: Record<MasterLifecycleStatus, MasterLifecycleStatus[]> = {
  DRAFT:             ['INGESTED'],
  INGESTED:          ['METADATA_AUDITED', 'ADMIN_BLOCKED'],
  METADATA_AUDITED:  ['SPLITS_PENDING', 'ADMIN_BLOCKED'],
  SPLITS_PENDING:    ['ADMIN_LOCKED', 'ADMIN_BLOCKED'],
  ADMIN_LOCKED:      ['DISTRIBUTION_READY'],
  DISTRIBUTION_READY:['TAKEN_DOWN'],
  ADMIN_BLOCKED:     ['METADATA_AUDITED', 'SPLITS_PENDING', 'TAKEN_DOWN'],
  TAKEN_DOWN:        [],
};
```

Semantics:
- `INGESTED` — content verified (`master_verifications` `verified`) AND analysis receipt
  `complete` (technical + profile blocks present).
- `METADATA_AUDITED` — deterministic mandatory-metadata checklist passes with no open
  `blocking` tasks (checklist in §3 Step 2).
- `SPLITS_PENDING` — master/publishing splits do not both resolve to exactly 100.00%, or any
  listed rights holder lacks PRO affiliation or IPI/CAE, or signatures are outstanding.
- `ADMIN_LOCKED` — splits signed at exactly 100.00%/100.00%, identifier drafts staged, and the
  immutable ledger receipt written. Record is frozen for admin purposes.
- `DISTRIBUTION_READY` — ERN 4.3 built + validated + Jev pre-flight passed.

**Authoritative store (new server-owned collection)**
`users/{uid}/master_admin/{masterHash}` — keyed by the content hash (NOT the client-invented
`SONIC-…` fingerprint; closes audit gap A-5):

```ts
interface MasterAdminState {
  id: string;                 // sha256 content hash (predictable ID, Platinum #2)
  userId: string;             // ownership anchor (Platinum #3)
  masterHash: string;
  storagePath: string;        // masters/{uid}/{hash}/original.{ext}
  generation: number;         // Storage generation the state was computed from
  lifecycle: MasterLifecycleStatus;
  enteredAt: Timestamp;
  history: { from; to; at: Timestamp; actor: 'runbook'|'audit'|'user'; reason?: string }[];
  openTaskIds: string[];
  ledgerReceiptId?: string;
  distributionReadyRef?: string; // ERN digest + validation receipt
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

Transitions happen **only** in Cloud Functions via a transactional guard extracted from the
`CampaignFSM` pattern (new `packages/firebase/src/functions/audit/masterFsm.ts`, reusing
`orchestration/fsm/machine.ts:44-76` shape: read current → check `MASTER_LIFECYCLE_EDGES` →
write with appended history). Firestore rules: clients get read-only on
`users/{uid}/master_admin` (server-only writes, mirroring the `/users/{uid}/ledger` lockdown
precedent). `MasterAudioReference` (`services/metadata/types.ts:9`) gains an optional read-only
`lifecycleStatus` mirror for UI convenience (renderer reads `master_admin` directly via
onSnapshot where richer state is needed).

### 1.2 AdministrativeTasks (the monitor output queue)
New collection `users/{uid}/administrative_tasks/{taskId}`, doc id = deterministic dedupe key
`'{type}_{sha256(canonical(entityRefs))[:24]}'` (Platinum #2 — re-audits can never duplicate):

```ts
interface AdministrativeTask {
  id: string; userId: string; schemaVersion: 'administrative-task.v1';
  type:
    | 'IDENTIFIER_ISRC_WITHOUT_ISWC' | 'IDENTIFIER_ISWC_WITHOUT_ISRC'
    | 'IDENTIFIER_FORMAT_INVALID'    | 'IDENTIFIER_POOL_MISMATCH'
    | 'SPLIT_SUM_MASTER'             | 'SPLIT_SUM_PUBLISHING'      // ≠ 100.00%
    | 'SPLIT_PRO_AFFILIATION_MISSING'| 'SPLIT_IPI_MISSING'
    | 'SPLIT_SIGNATURE_OUTSTANDING'
    | 'METADATA_MANDATORY_FIELD'     | 'METADATA_TAG_CONFLICT'      // embedded tag vs entered field
    | 'REGISTRATION_PAYLOAD_STAGED';                                // actionable draft ready
  severity: 'info' | 'warning' | 'critical' | 'blocking';
  status: 'open' | 'action_ready' | 'awaiting_confirmation' | 'executed' | 'dismissed' | 'failed';
  entityType: 'master' | 'track' | 'release' | 'composition' | 'collaborator';
  entityRefs: { masterHash?; trackId?; releaseId?; splitSheetHash?; collaboratorId? };
  findings: { field: string; expected: string; observed: string; source: string }[];
  proposedAction?: {
    kind: 'staged_registration_payload' | 'split_invitation' | 'metadata_patch';
    payload: Record<string, unknown>;   // fully pre-filled, validated draft
    requiresApproval: true;             // ALWAYS true — engine never auto-executes
    builderRef: string;                 // e.g. 'draftCwrRegistration@v1'
  };
  jevRef?: { judgment: string; confidence: number; model: string };  // receipt, not authority
  dedupeKey: string;
  createdAt: Timestamp; updatedAt: Timestamp; resolvedAt?: Timestamp;
}
```

- Composite index: `userId + status + severity + createdAt desc` (firestore.indexes.json).
- Rules: owner-scoped CRUD with `isValidAdministrativeTask()` schema check (Platinum #1/#5);
  `status → executed` transitions additionally verified against the linked
  `proposedAction.requiresApproval === true` receipt.
- Lifecycle: monitors create `open`; staging a payload promotes to `action_ready`;
  one human confirmation executes and archives with `resolvedAt` (single-click contract).

### 1.3 Admin ledger receipts (immutable)
New collection `users/{uid}/admin_ledger/{receiptId}`, id =
`led_v1_{sha256(canonicalReceiptJson)[:40]}` (content-addressed), rules **create-only**
(no update/delete), following the `master_verifications` create-only precedent
(`storage.rules` analog / `firestore.rules:2458`):

```ts
interface AdminLedgerReceipt {
  id: string; userId: string; schemaVersion: 'admin-ledger-receipt.v1';
  masterHash: string; storageGeneration: number;
  splits: {
    recording: { collaboratorId: string; shareBasisUnits: number }[];  // Σ = 1_000_000
    publishing: { collaboratorId: string; shareBasisUnits: number }[]; // Σ = 1_000_000
  };
  signatories: { collaboratorId: string; method: string; signedAt: Timestamp; receiptHash: string }[];
  identifiers: { isrc?; iswc?; upc?; ipi?: string[] };   // as registered at lock time
  ernDigest?: string;                                     // sha256 of ERN XML
  prevReceiptHash?: string;                               // hash-chain via auditLogChain pattern
  lockedAt: Timestamp;
}
```

### 1.4 Shared fixed-point share-units module (closes the float regime)
New `packages/shared/src/finance/shareUnits.ts` (single source of truth; mirrors
`calculateRoyaltyAllocations.ts` semantics):

```ts
export const SHARE_UNITS_PER_PERCENT = 10_000;         // basis points per percent
export const TOTAL_SHARE_UNITS = 100 * SHARE_UNITS_PER_PERCENT;
export const toShareUnits = (pct: number): number => Math.round(pct * SHARE_UNITS_PER_PERCENT);
export const sumShareUnits = (pcts: number[]): number => pcts.reduce((s, p) => s + toShareUnits(p), 0);
export const splitsResolveExactly = (pcts: number[]): boolean => sumShareUnits(pcts) === TOTAL_SHARE_UNITS;
```

Replace the four float-summation sites (audit-verified):
1. `services/release-harness/ReleaseHarnessAdapters.ts:145` — `reduce(...) !== 100` → `!splitsResolveExactly(...)` for both `recordingSplits` and `compositionSplits`.
2. `services/publishing/PublishingRightsCompiler.ts:63` — float `totalWriterShare` → share-units compare.
3. `packages/firebase/src/mcp/tools/registerSplitSheet.ts:104-106` — tolerance float → exact `TOTAL_SHARE_UNITS` (keep the tolerance only as a *migration* warning, never an accept).
4. `services/legal/DigitalSignatureService.ts:49` — same replacement.

`RoyaltySplit.percentage` stays a stored float (0–100, human-facing) but **all comparisons,
sums, and payout math** go through share units / micros. No storage migration required.

### 1.5 Mandatory-metadata contract (shared, one place)
New `packages/shared/src/distribution/mandatoryMetadata.ts`: zod schema + pure
`auditMandatoryMetadata(entity): Finding[]` covering the distributor/DDEX mandatory set —
explicit flag, release date, track-level artist roles, recording year (P-Line/C-Line year),
language — plus identifier format checks reused from `IdentifierService` regexes and
`MusicIdentifierSchema`. Both the cloud auditor and the renderer harness
(`ReleaseHarnessAdapters.ts:144-247` `buildDistributionReadiness`) consume this one module so
client readiness and server audits can never disagree.

### 1.6 Semantic graph schemas (pillar 3)
Extend `packages/shared/src/schemas/musicEntity.ts` (do not fork it) with:

```ts
SemanticCatalogNode: {
  entityId; ownerId; kind: 'track'|'release'|'writer'|'master_owner';
  isrc?; iswc?; upc?; bpm?; key?; moodTags: string[];
  instrumentalAvailable: boolean; stemsAvailable: boolean;
  master100PercentPrecleared: boolean;     // derived from splitsResolveExactly + signatures
  publishing100PercentPrecleared: boolean;
  syncContactEndpoint?: string;            // owner-set; never synthesized
  territoryRestrictions: string[];         // from ExtendedGoldenMetadata.territories
  relations: { subject: entityId; predicate: 'isrc'|'iswc'|'bpm'|'key'|'mood_tags'
             |'instrumental_available'|'stems_available'|'part_of_release'
             |'written_by'|'master_owned_by'; object: string }[];  // directional, explicit
  visibility: 'private'|'link'|'public';   // default 'private'; owner-set only
}
```
Derived flags are **computed by code** from split share-units + signed-receipt existence —
Jev never asserts preclearance.

### 1.7 Rules, indexes, tests
- `firestore.rules`: new `isValidMasterAdminState()`, `isValidAdministrativeTask()`,
  `isValidAdminLedgerReceipt()` helpers; server-only writes for `master_admin` + `admin_ledger`;
  owner-scoped for `administrative_tasks`.
- `firestore.indexes.json`: administrative_tasks composite (§1.2).
- Rules tests appended to the existing `firestore.rules.test.ts` suite (Platinum #5).

---

## 2. Jev AI integration points

Architecture rule (from `docs/TYPESAFE_OPPORTUNITIES.md` hard constraints, unchanged):
**deterministic code owns workflow, money, checksums, and thresholds; Jev supplies bounded
semantic judgments with confidence gates and a deterministic fallback; every question/threshold
lives in the single reviewable constants file.**

### 2.1 Server-side judgment client (extract, don't duplicate)
New `packages/firebase/src/functions/intelligence/typesafeClient.ts` — extract the fetch +
`jev-latest` + error-mapping logic already proven in `typesafeJudge.ts` and
`TypeSafeEvidenceProvider.ts` into one internal module (key stays in `TYPESAFE_API_KEY`
secret; no SDK on the functions runtime). `typesafeJudge` is refactored to delegate; new
server consumers import the client directly. Renderer consumers keep going through the
`typesafeJudge` callable — the key never reaches the client (API Credentials Policy).

### 2.2 New judgments (added to `typesafeJudgments.ts`, canonical shape)
Deterministic baseline first; Jev refines; confidence gates below; `noteJudgmentFailure`
cooldown applies; feature gate `TYPESAFE_JUDGMENTS` respected.

**J-A `judgeCatalogGapTriage`** (consumed by the audit worker; Choice + Noul)
```ts
questions: {
  priority: { type: 'choice',
    instructions: 'Given these deterministic audit findings for one music catalog entity, pick the
      single highest-priority administrative class to resolve first: REGISTRATION, SPLITS,
      METADATA, or MONITOR_ONLY. Format validity, sums, and identifier checksums are already
      established by code — do not re-derive them.',
    criteria: { REGISTRATION: 'A missing/invalid identifier blocks a registration that other
                                steps depend on (ISRC↔ISWC pairing, IPI for PRO filings).',
                SPLITS:       'Split sums, PRO affiliation, or IPI gaps block signature workflows.',
                METADATA:     'Mandatory distributor fields are missing or conflict with embedded tags.',
                MONITOR_ONLY: 'No finding is release-blocking; record and move on.' } },
  release_blocking: { type: 'noul',
    instructions: 'Would a professional distributor reject delivery of this release as-is,
      considering only the listed findings?' },
}
// Thresholds: release_blocking ≥ 0.70 → severity 'blocking'; 0.40–0.70 → 'warning'; else 'info'.
// priority MONITOR_ONLY at ≥0.60 confidence → suppress task creation (log only).
```

**J-B `judgeMetadataAnomaly`** (Noul; refines only ambiguous tag conflicts)
```ts
questions: {
  genuine_conflict: { type: 'noul',
    instructions: 'An embedded audio-file tag and the artist-entered catalog field disagree.
      Given both values plus the release context, is this a GENUINE conflict that requires human
      confirmation (not a benign format/encoding variant of the same value)?' },
}
// ≥0.70 → create METADATA_TAG_CONFLICT task with pre-filled patch choosing the entered value;
// <0.30 → auto-resolve to entered value with an info finding; between → create task, no auto-resolve.
// Code decides what "same value" means for identifiers (exact normalized match) — Jev never
// validates identifier format.
```

**J-C `judgeRegistrationPayloadCompleteness`** — **extend Judgment 28** (`judgeDDEXPreFlight`,
`typesafeJudgments.ts:2296`) rather than adding a parallel one: add a `registry_targets`
Choice question (`ISWC_DB|CWR|DDEX_ERN`) so the existing gate serves the staged registration
payloads too. Reuse **Judgment 50** (`judgeSplitSheetRightsClearance`, `:5179`) verbatim for
split-anomaly adjudication — the auditor feeds it `SplitAgreementInput` per collaborator.

**J-D `judgeSyncAvailability`** (semantic export enrichment; Choice)
```ts
questions: {
  licensing_readiness: { type: 'choice',
    instructions: 'Classify this catalog entity\'s sync-licensing readiness from its structured
      rights facts (preclearance flags, territory restrictions, contact endpoint presence).',
    criteria: { READY: '…', CONDITIONAL: '…', NOT_READY: '…' } },
}
// Annotation ONLY — rendered as a hint field in the semantic node; never gates distribution.
```

### 2.2.1 Worker interfaces (durable Jev-coordinated monitors)
The "Jev worker" is a **deterministic Inngest worker that calls Jev at bounded decision
points** — durable, replayable, idempotent (matches repo doctrine: Jev excluded from the
persistence path by design, `docs/CANONICAL_MUSIC_PERSISTENCE.md:80-82`).

New Inngest function `catalogAdminAuditFn` (id `catalog-admin-audit`), registered in the serve
list (`packages/firebase/src/index.ts:1055-1093`):
- **Triggers:** (i) new Firestore trigger `onAnalysisReceiptComplete`
  (`onDocumentCreated` on `audio_analysis_receipts/{id}` where `status === 'complete'`) →
  emits `admin/master.analyzed`; (ii) `onDocumentWritten` debounce on
  `proprietaryIngestionReleases/{id}` + `users/{uid}/tracks/{id}` → `admin/audit.requested`;
  (iii) weekly cron sweep (per-user batched, bounded by userId range — no full scans).
- **Steps:** fetch entity → run `auditMandatoryMetadata` + identifier cross-validation +
  share-unit split checks (pure, deterministic) → for ambiguous findings call
  `typesafeClient` with J-A/J-B (parallel questions, one round-trip) → upsert
  `administrative_tasks` by `dedupeKey` → emit `admin/task.ready`.
- **Idempotency:** dedupeKey doc ids; Inngest `step.run` around every write; the
  skip-if-intent-exists idiom (`lib/long_form_video.ts:228`).
- **Budgets:** max 1 Jev round-trip per entity per audit; cooldown via existing
  `noteJudgmentFailure` analog server-side; concurrency limit 5 (mirror
  `execute-timeline-milestone`).

### 2.3 Agent tool definitions (exact)
New file `packages/renderer/src/services/agent/tools/CatalogAdminTools.ts` following the
`wrapTool` + `toolSuccess/toolError` pattern (`DistributionTools.ts:24-121`):

```ts
const catalog_query_gaps = wrapTool('catalog_query_gaps', async (args: {
  entityType?: 'master'|'track'|'release'|'composition';
  severity?: 'info'|'warning'|'critical'|'blocking';
  status?: 'open'|'action_ready'|'awaiting_confirmation';
  limit?: number;                    // default 25, hard cap 100
}) => { /* read users/{uid}/administrative_tasks ordered by severity+createdAt; returns
          { tasks: [...], counts: { bySeverity, byType } } */ });
// Risk: read / builtin / requiresApproval: false — auto-approved.

const catalog_stage_registration_payload = wrapTool('catalog_stage_registration_payload', async (args: {
  masterHash: string;
  registry: 'ISWC' | 'CWR' | 'DDEX_ERN';
}) => { /* loads master_admin + linked release/track, builds the payload via the EXISTING
          builders (draftCwrRegistration / draftDspMetadata / shared ddexBuilder), validates it,
          writes it into an administrative_tasks doc proposedAction.payload with status
          'action_ready'. NEVER submits anything. Returns { taskId, validation: [...] } */ });
// Risk: write / core / requiresApproval: true (ExecApprovalService gate, EditorTools.ts:16,179 precedent).

const catalog_dispatch_split_invitations = wrapTool('catalog_dispatch_split_invitations', async (args: {
  masterHash: string;
  channel: 'in_app' | 'email';
}) => { /* resolves split sheet hash (sha256 canonical splits), creates/updates one
          split_invitation administrative_task per rights holder with a tokenized secure
          sign-off link (DigitalSignatureService), idempotent per (masterHash, collaboratorId,
          sheetHash). Returns per-collaborator dispatch receipts. */ });
// Risk: write / core / requiresApproval: true — outbound collaborator contact is never autonomous.
```

Wiring (audit-verified plug-in points):
1. `functions` getter + `tools[0].functionDeclarations` + `authorizedTools` in
   `definitions/PublishingAgent.ts` and `definitions/DistributionAgent.ts` (no new agent needed —
   both domains are already rostered in `agents/`; a new agent would add VALID_AGENT_IDS,
   `CardRegistry`, prompt.md — deferred until a dedicated "Catalog Compliance" persona is wanted).
2. `TOOL_RISK_REGISTRY` rows for the three tools (`ToolRiskRegistry.ts`).
3. System-prompt addenda: `agents/publishing/prompt.md`, `agents/distribution/prompt.md`
   (document the tools; remove nothing).
4. Remote MCP mirror (`packages/firebase/src/mcp/tools/` + `McpToolRegistry`): expose
   `audit_catalog_gaps` (read) and `stage_registration_payload` (staging only) so external
   Jev-driven systems act through the same gated surface. `registerSplitSheet` already exists.
5. New directive: `directives/post_mastering_admin_engine.md` (Layer-1 SOP per
   `directives/architecture_standard.md` rule 2) codifying pillars, state machine, and the
   draft-only autonomy boundary.

---

## 3. Master Ingestion Runbook — end-to-end execution flow

New Inngest function `masterIngestionRunbookFn` (id `master-ingestion-runbook`, event
`admin/master.analyzed`, retries 3, concurrency 5). Every step is an Inngest step keyed by
`(masterHash, generation)`; lifecycle transitions are transactional FSM writes; tasks are
dedupe-keyed. The runbook **stages only** — the two human gates are explicit.

```
[User] drop mastered WAV/FLAC (existing canonical flow, unchanged UI)
   │  MasterAudioValidation → content-addressed upload masters/{uid}/{hash}/original.*
   ▼
T1 onMasterUploaded (NEW storage onObjectFinalized, path-guard masters/{uid}/{hash}/original.*)
   │  idempotent: skip if master_verifications[sha] verified OR audio_analysis_receipts exists
   │  calls verifyMasterAudioObject (reuse functions/storage/verifyMasterAudio.ts) server-side
   │  then enqueues the EXISTING dsp-processing-queue Cloud Task (ingestion.ts:81-132)
   ▼
engine-dsp /profile (EXISTING; extended, see E1) → receipt complete
   ▼
T2 onAnalysisReceiptComplete (NEW onDocumentCreated) → emits admin/master.analyzed
   ▼
RUNBOOK masterIngestionRunbookFn
   Step 0  FSM: DRAFT→INGESTED            (master_admin upsert; generation pinned)
   Step 1  Binary & tag audit             (E1 fields: bext/iXML, loudness, key)
           • cross-check embedded tags vs entered fields → J-B on genuine_conflict
           • METADATA_TAG_CONFLICT tasks (pre-filled patch, entered value proposed)
   Step 2  Mandatory metadata audit       (shared auditMandatoryMetadata §1.5)
           • deterministic checklist; blocking findings → INGESTED holds + tasks;
             clean → FSM: INGESTED→METADATA_AUDITED
   Step 3  Split resolution
           • share-units check (§1.4) on recordingSplits + compositionSplits
           • PRO affiliation + IPI/CAE population check per rights holder
           • complete AND resolved → draft split sheet (registerSplitSheet canonical
             text + sha256) → dispatch signature links → FSM: →SPLITS_PENDING
           • incomplete → SPLIT_* tasks each carrying a pre-filled split_invitation
             payload (J-50 refines role/rights-stream ambiguity)
   Step 4  Identifier cross-validation
           • ISRC present w/o ISWC (and inverse) → stage ISWC/CWR draft payload
             (J-C gate) → REGISTRATION_PAYLOAD_STAGED task, status action_ready
           • format/pool/UPC↔release/IPI-digit checks → IDENTIFIER_* tasks
   Step 5  ADMIN LOCK (human gate #1 — signatures)
           • when: all split_invitations signed AND Σ recording = Σ publishing = 1_000_000 bu
             AND zero open blocking tasks
           • write AdminLedgerReceipt (content-addressed, hash-chained §1.3)
           • FSM: SPLITS_PENDING→ADMIN_LOCKED
   Step 6  Distribution preparation (human gate #2 — release approval, existing flow)
           • build ERN 4.3 (shared ddexBuilder) → XSD validation path
             (desktop validate-xsd IPC / shared validator) → J-28 pre-flight
           • FSM: ADMIN_LOCKED→DISTRIBUTION_READY; upsert semantic node (§1.6)
   ▼
[Existing downstream] prepare_release / ingestion_build.py / DDEX ACK (processDDEXAck.ts:86) — untouched
```

**Human-gate invariant:** the runbook can stage payloads, dispatch invitations, and flip FSM
states — it can never execute a registration submission, publish a release, move money, or
transfer rights without the existing `ToolApprovalService`/`ExecApprovalService` confirmation
(mission §4: drafting/staging only).

**Engine-dsp extension (E1)** in `packages/engine-dsp/pipeline.py` (receipt schema additive):
- parse BWF `bext` + `iXML` chunks (deterministic; `soundfile`/manual chunk walk) →
  `technical.embeddedTags` (ISRC in `bext`'s ICRC field, originator, origination date/time,
  UMID/loudness fields where present).
- EBU R128 integrated LUFS + true peak (`pyloudnorm` or `librosa` + `ebur128` scan) →
  `technical.loudness { integratedLufs, truePeakDbTp }` (closes gap A-4; today only Electron
  measures this, `handlers/audio.ts:59-78`, and it is never persisted server-side).
- chroma-based key estimate (`librosa.feature.chroma_*` + Krumhansl profile) →
  `openSourceProfile.musicalKey` (replaces hardcoded `'unmeasured'`,
  `AudioIntelligenceService.ts:112`; labeled `estimated: true`).
- All additive — existing receipt ids, leases, and TS mirrors keep working.

---

## 4. Semantic catalog endpoints (pillar 3 delivery)

- **Projection store:** `users/{uid}/catalog_graph/{entityId}` (server-written, schema §1.6),
  regenerated by the runbook Step 6 and the weekly audit sweep; plus
  `public_catalog/{entityId}` server-written mirrors for nodes whose owner-set
  `visibility ∈ {'link','public'}` (default `private` ⇒ never mirrored).
- **Endpoint:** new `onRequest` `catalogSemanticApi` (`packages/firebase/src/index.ts` export):
  - `GET /catalog/v1/entity/{id}` → JSON-LD document (`schema.org/MusicRecording` /
    `MusicAlbum` / `MusicGroup` + `indii:` extension predicates for the explicit boolean
    rights flags and directional relations) built from `public_catalog` only — private data is
    unreachable by construction.
  - `GET /catalog/v1/artist/{uid}/feed` → paged JSON-LD `@graph` (bounded `.limit()`, no scans).
  - Owner mutations of `visibility` go through an authenticated callable with rules +
    App Check parity; read path is unauthenticated, cache-friendly (`Cache-Control: public,
    max-age=300`), rate-limited, and serves **only** the denormalized projection (no joins, no
    owner PII beyond the artist display name the owner opted in).
- **SDK backing (thin):** point the existing `packages/sdk` catalog client at the live routes
  (idempotent-retry helper already at `client.ts:52-56`) so the mission's "programmatic sync
  retrieval" contract has one blessed consumer example.

---

## 5. Security & validation invariants (non-negotiable)

1. **Draft/stage only.** No autonomous mutation may publish, submit, or transfer. Every
   `proposedAction.requiresApproval === true`; execution only via ToolApprovalService replay or
   the explicit confirm callable; money stays behind `staged_pending_approval`.
2. **Fixed-point everywhere.** Split sums/comparisons via share units (§1.4); money in micros +
   `DecimalMoney`; the four float sites are migrated in the same commit they're touched.
3. **Jev is advisory.** Confidence-gated, fallback-first, never on the persistence authority
   path; key server-side only; every Jev-influenced decision stores a `jevRef` receipt.
4. **Idempotency keys everywhere:** dedupeKey task ids; content-addressed ledger receipts;
   `(masterHash, generation, stepId)` Inngest steps; sha256 split-sheet hashes; receipt lease
   (existing).
5. **Platinum DB protocol:** every new collection gets TS interface + zod + rules helper +
   rules test, ownership anchor, predictable ids, server timestamps, indexed queries.
6. **Rules-first ordering:** security rules land in the same commit as the schema, before any
   client write path (Platinum #5).
7. **No hardcoded infra identifiers** (Platinum Anti-Pattern #9); no secrets in renderer
   (API Credentials Policy).

---

## 6. Delivery phases (each = one coherent, locally validated commit to `main`)

| Phase | Content | Local verification |
|---|---|---|
| P1 Schema & math | shared `masterLifecycle`, `shareUnits`, `mandatoryMetadata`, semantic node schemas; `master_admin` / `administrative_tasks` / `admin_ledger` collections + rules + indexes; migrate 4 float sites | `npm run typecheck`, `npm run lint`, targeted vitest (shareUnits, lifecycle edges, mandatoryMetadata), `firestore.rules.test.ts` |
| P2 Audit engine | `typesafeClient` extraction; `catalogAdminAuditFn` + `onAnalysisReceiptComplete` + debounce triggers; task emission (deterministic first, J-A/J-B behind feature gate) | vitest for audit checks + idempotency (dedupeKey), Inngest handler tests in `packages/firebase` setup |
| P3 Jev tools & wiring | `CatalogAdminTools.ts` (3 tools), risk rows, Publishing/Distribution agent wiring, prompt addenda, MCP mirror | agent-wiring vitest (EditorBridgeAgentWiring.ts precedent), tool schema tests |
| P4 Runbook | `onMasterUploaded` trigger; engine-dsp E1; `masterIngestionRunbookFn` steps 0–6; signature dispatch; ledger receipt; FSM writes | python unit smoke for chunk/loudness/key parse; runbook step idempotency tests; full typecheck |
| P5 Semantic surface | `catalog_graph` + `public_catalog` projections; `catalogSemanticApi` JSON-LD; SDK client backing; directive `post_mastering_admin_engine.md` | JSON-LD golden-file tests; endpoint integration test (emulator), lint/typecheck, `npm run build:studio` |

Every phase closes with the pre-push `/plat` checklist (Error Ledger cross-reference included).
CI is watched on the exact pushed SHA per `.agent/workflows/branch-safety.md`.

**Explicitly out of scope for this plan:** auto-issuing ISRC/UPC from pools without human
confirmation (ISSUE-781 backend-only issuance stands), any autonomous money movement, and any
real-user/production claims without the `.agent/REAL_USER_AUTHENTICITY.md` flow.

---

## 7. Critical files appendix

New: `shared/src/schemas/masterLifecycle.ts`, `shared/src/finance/shareUnits.ts`,
`shared/src/distribution/mandatoryMetadata.ts`, `firebase/src/functions/audit/masterFsm.ts`,
`firebase/src/functions/audit/catalogAdminAudit.ts`, `firebase/src/functions/audit/masterIngestionRunbook.ts`,
`firebase/src/functions/audit/triggers.ts` (onMasterUploaded, onAnalysisReceiptComplete),
`firebase/src/functions/intelligence/typesafeClient.ts`,
`renderer/src/services/agent/tools/CatalogAdminTools.ts`,
`directives/post_mastering_admin_engine.md`.
Modified: `firebase/src/index.ts` (serve list + exports), `firestore.rules`,
`firestore.indexes.json`, `engine-dsp/pipeline.py`, `metadata/types.ts` (mirror field),
`ReleaseHarnessAdapters.ts:145`, `PublishingRightsCompiler.ts:63`,
`registerSplitSheet.ts:104-106`, `DigitalSignatureService.ts:49`, `ToolRiskRegistry.ts`,
`definitions/PublishingAgent.ts`, `definitions/DistributionAgent.ts`,
`agents/publishing/prompt.md`, `agents/distribution/prompt.md`,
`mcp/registry.ts` + `mcp/tools/`, `typesafeJudgments.ts` (J-A/J-B/J-C/J-D),
`sdk/src/client.ts`.
