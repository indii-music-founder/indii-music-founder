# Firebase Gen2-Only Cutover Readiness — 2026-07-28

## Scope and current release state

This began as a preparation artifact. It now records the completed Gen2-only
source and registry cutover, the historical rollback sequence, and the product
acceptance gates that still require genuine authenticated evidence.

- Published capability baseline: `35e36370b5f3d2148b7b509d695a1020607d42c1`.
- Its exact production run `30560106706` passed all 26 jobs, including rules,
  unit shards, build, staging E2E, Hosting, media-worker, and Cloud Functions
  deployment. `getCapabilitySnapshot` is `ACTIVE` at revision
  `getcapabilitysnapshot-00001-new`.
- The pre-correction scheduled Health Check Monitor run `30548187271`
  is marked successful but reported `13/103` because it divided by skipped and
  pending discoveries. It also swallowed a future nonzero Vitest exit and
  attempted to parse the base64 service-account secret as JSON before falling
  back to ADC. The release-owned correction now calculates pass rate over
  executed tests, records skipped/pending counts separately, uses ADC directly,
  and exits nonzero after recording any failed run. Exact post-merge
  workflow-dispatch run `30566873144` is green on `33eaa3988`: its log reports
  `13/13` executed at 100% with 90 skipped/pending and 103 discovered, then a
  successful Firestore write. Read-only Firestore verification confirms newest
  `healthChecks/Nw2rS0c15XUYLls6OFCN` is `health-check.v2`, `passed`, with 13
  passed, 0 failed, 90 skipped, and 103 discovered.
- The historical missing-root-Dockerfile Cloud Build failure is not an active
  release failure. Recent listed Cloud Builds are successful, and the exact
  production deployment above is green.
- The complete migration is published. Firebase production/test TypeScript,
  the no-Gen1 guard, the 512MiB memory floor, the migration-semantics guard,
  repository lint, pre-commit, and exact-main CI all pass.
- On 2026-07-30 the official Firebase CLI removed the sole stale failed
  `videoJobOrchestrator` registry shell after confirming its Cloud Run service
  and Eventarc trigger were absent and the canonical
  `videoJobFirestoreOrchestrator` replacement was `ACTIVE`.
- The post-cleanup official inventory is **167 functions: 167 Gen2, 167
  `ACTIVE`, zero Gen1, zero failed**, with an empty extension registry.

## Authoritative source migration inventory

The pre-cutover source contained 81 runtime exports backed by Gen1
declarations. The published migration accounts for all 81 as 58 independent
exports plus the 23-export coupled cluster below. The semantics guard tracks
82 source declarations because it also includes the source-only
`generateImageV3Fn` factory, which is not a separate deployed endpoint.

### Published independent cohort — 58 exports

1. Security and shared operational data (4):
   `logAuditEvent`, `persistFraudAlert`, `registerAiContextCache`,
   `recordInstrumentUsage`.
2. Distribution records (6):
   `assignDistributionIdentifier`, `recordDistributionIdentifier`,
   `recordDistributionAuditEvent`, `requestDistributionTakedown`,
   `createSftpIngestionRecord`, `updateSftpIngestionRecord`.
3. Timeline and social (2):
   `onMilestoneScheduled`, `refreshSocialToken`.
4. Studio relay callables (6):
   `issueStudioExecutorLease`, `publishStudioPresence`,
   `releaseStudioPresence`, `claimStudioCommand`, `publishStudioResponse`,
   `completeStudioCommand`.
5. Release, legal, and finance (5):
   `generateReleaseDownloadUrl`, `auditReleaseArtworkForDelivery`,
   `verifyMechanicalLicense`, `sendForDigitalSignature`, `requestTaxForms`.
6. Telegram link callables (2):
   `generateTelegramLinkCode`, `getTelegramLinkStatus`.
7. Stripe Connect, touring, and marketing (9):
   `createStripeAccount`, `createStripeConnectAccount`, `createTransfer`,
   `generateItinerary`, `checkLogistics`, `findPlaces`, `executeCampaign`,
   `dispatchSocialPost`, `createInfluencerBounty`.
8. Bug reporting and analytics OAuth (6):
   `reportBugFn`, `analyticsExchangeToken`,
   `analyticsFinalizeInstagramConnection`, `analyticsGetConnectionStatus`,
   `analyticsRefreshToken`, `analyticsRevokeToken`.
9. Email OAuth and PandaDoc proxy (8):
   `emailExchangeToken`, `emailRefreshToken`, `emailRevokeToken`,
   `pandadocListTemplates`, `pandadocCreateDocument`,
   `pandadocSendDocument`, `pandadocGetDocumentStatus`,
   `pandadocGetSigningLink`.
10. Scheduled storage and relay trigger (5):
    `cleanupOrphanedVideos`, `trackStorageQuotas`,
    `cleanupExpiredVideoTemps`, `flagVideosForArchival`,
    `processRelayCommand`.
11. Webhooks and split escrow (5):
    `pandadocWebhook`, `telegramWebhook`, `initiateSplitEscrow`,
    `signEscrow`, `releaseEscrow`.

### Published coupled cluster — 23 runtime exports

The 21 direct root declarations are:

`triggerVideoJob`, `executeVideoJob`, `triggerLongFormVideoJob`,
`renderVideo`, `inngestApi`, `generateSpeech`, `generateContentStream`,
`ragProxy`, `listGKEClusters`, `getGKEClusterStatus`, `scaleGKENodePool`,
`listGCEInstances`, `restartGCEInstance`, `executeBigQueryQuery`,
`getBigQueryTableSchema`, `listBigQueryDatasets`, `exportUserData`,
`requestAccountDeletion`, `healthCheck`, `healthCheckWest1`, and
`enrichFanData`.

The two deployed aliases created through helper factories are `analyzeAudio`
(`analyzeAudioFn`) and `editImage` (`editImageFn`). `generateImageV3Fn` is
test-only in this legacy helper and is not an additional root runtime export;
the actual `generateImageV3` export comes from the already-Gen2 creative
gateway.

### Runtime-semantics contract

Every former Gen1 export now declares:

- memory of at least `512MiB`;
- `cpu: 'gcf_gen1'`; and
- `concurrency: 1`.

Existing higher memory, region, timeout, secret binding, App Check behavior,
auth gate, and trigger path must be preserved. Existing native-Gen2 exports
remain outside this contract so their current concurrency is not reduced.

All published migration declarations pass this contract, including
`ragProxy`, the 21 direct coupled-cluster declarations, the two deployed helper
aliases, and the source-only image factory. The guard reports all 82 tracked
source declarations.

## Completed source and CI safeguards

1. The semantics manifest/parser covers the migrated declarations and rejects
   missing memory, CPU, or concurrency preservation.
2. The zero-Gen1 static guard rejects v1 imports, builder chains, helpers,
   callable types, and mocks across implementation and test source.
3. Memory, semantics, and zero-Gen1 guards are wired through
   `check:functions`, repository lint, pre-commit, and exact-main CI.
4. Direct v2 CloudEvent coverage exists for the video workers, including
   absent-snapshot and queued/skip behavior.
5. The shared v2 `HttpsError` test mock preserves details.
6. Firebase production/test typechecks, focused and sharded tests, lint,
   security/routing guards, diff checks, and pre-commit gates are green.

## Generation-aware live manifest

A pre-removal official Firebase CLI inventory reported 167 live registry
entries: 82 Gen1 and 85 Gen2, all in `us-central1` on Node.js 22. It reported
166 `ACTIVE` and one `FAILED`, with no duplicate function IDs. The remaining
24 Gen1 entries at that historical point were the 23 coupled-cluster/helper
exports plus one Firebase Extension function:

`analyzeAudio`, `editImage`, `enrichFanData`, `executeBigQueryQuery`,
`executeVideoJob`, `exportUserData`,
`ext-storage-resize-images-generateResizedImage`, `generateContentStream`,
`generateSpeech`, `getBigQueryTableSchema`, `getGKEClusterStatus`,
`healthCheck`, `healthCheckWest1`, `inngestApi`, `listBigQueryDatasets`,
`listGCEInstances`, `listGKEClusters`, `ragProxy`, `renderVideo`,
`requestAccountDeletion`, `restartGCEInstance`, `scaleGKENodePool`,
`triggerLongFormVideoJob`, and `triggerVideoJob`.

This reconciled the historical 82-vs-81 discrepancy exactly:
`ext-storage-resize-images-generateResizedImage` belonged to Firebase Extension
`firebase/storage-resize-images` v0.3.5. The founder directed that the unwanted
extension be removed rather than replaced. On 2026-07-28 the official
manifest-driven Firebase extension deploy deleted the instance. Post-removal
proof shows an empty extension registry and no managed
`ext-storage-resize-images-generateResizedImage` function. The pre-existing
bucket was not an extension-managed resource: all prior uploads and derivative
objects were retained, and the application tool that guessed extension output
paths was retired.

### Storage Resize Images removal evidence

- Target project/instance: `indii-music-founder` /
  `storage-resize-images`.
- The live instance used
  `indii-music-founder.firebasestorage.app`, `200x200`, 1024MiB, private
  outputs, animated-image support, regenerated download tokens, content
  filtering off, and `DELETE_ORIGINAL_FILE=false`.
- The extension specification owned one resource only:
  `ext-storage-resize-images-generateResizedImage`. The bucket was an input
  parameter, not an extension-created resource.
- Before removal the bucket held 707 objects, including 175 names matching the
  extension's `_200x200` derivative convention. The object-name inventory
  checksum was
  `13138bcb8584b8e5245c81a5cf0582409df270d2652a4cea48536b8b0e589262`.
- No bucket/object deletion command was run. After removal the bucket held 709
  objects, including 176 `_200x200` derivatives; the count increased rather
  than decreased. Bucket versioning remains enabled and soft-delete retention
  is seven days.
- The official sequence was: export the legacy live instance into the current
  Firebase manifest, remove it with `ext:uninstall`, confirm the deletion plan
  with an extensions-only dry run, then execute
  `deploy --only extensions --force`.
- Firebase reported `Successfully deleted storage-resize-images`. Post-removal
  `ext:list` returns an empty result, `functions:list` returns 166 total
  functions (81 Gen1 / 85 Gen2) with zero extension matches, and direct
  description of the managed function returns `404 not found`.
- Repository cleanup deletes
  `extensions/storage-resize-images.env`, leaves an explicit empty
  `"extensions": {}` deployment manifest, removes
  `get_resized_image_variants` from implementation and the capability
  registry, and updates the historical Firebase note and issue ledger.
- Validation: renderer TypeScript passed; the agent capability/tool selection
  ran 35 test files with 211 tests passing; repository diff checking passed;
  post-removal extensions-only dry run reports no pending changes.

The former sole `FAILED` registry entry, Gen2 `videoJobOrchestrator`, is now
removed. Before deletion, read-only inspection proved its Cloud Run service
and Eventarc trigger were absent, its only logs were the failed June deployment,
published source did not export it, and the canonical
`videoJobFirestoreOrchestrator` replacement was `ACTIVE` with its
`videoJobs/{jobId}` Eventarc trigger. The official command deleted only that
named function. Direct description now returns 404, while the replacement
remains active.

The current trigger generation count is zero Gen1. The post-cleanup official
inventory contains 167 Gen2 functions, all `ACTIVE`.

The release manifest must be generated from a single captured JSON inventory
that records, for every live function:

- exact name, region, generation, state, update time, and runtime;
- trigger type and trigger resource/event filters;
- memory, CPU, concurrency, timeout, min/max instances, ingress, and service
  account;
- environment variables and secret bindings by name (never secret values);
- invoker/IAM bindings;
- source migration owner and replacement export;
- shadow-Gen2 validation status;
- canonical cutover status; and
- rollback status.

The inventory command must query both generations in one fail-closed operation.
Do not use `gcloud functions describe NAME --gen2 ... || true` for
classification: a Gen1-only function appears absent under `--gen2`, and a
permission/API failure is also collapsed into an empty result.

## Safe cutover and rollback checklist

Apply this sequence to one coherent dependency cohort at a time. Stop on the
first discrepancy.

1. Capture the full two-generation inventory, function descriptions, IAM
   policies, Cloud Run service descriptions for Gen2, scheduler/Eventarc
   bindings, and recent error/latency logs.
2. Compare the live inventory to the 81-name source manifest. The formerly
   extension-owned 82nd Gen1 endpoint has been removed through the supported
   Firebase Extensions lifecycle and must not reappear.
3. Build the exact candidate SHA and retain the prior published source,
   configuration snapshot, IAM snapshot, and an executable rollback command
   for every member of the cohort.
4. Deploy a temporary Gen2 shadow service from the candidate build for each
   externally callable/HTTP endpoint where an independent shadow probe is
   possible. Preserve region, service account, secrets, ingress, timeout,
   memory, CPU, concurrency, and authorization. Do not direct production
   traffic to the shadow.
5. Run genuine authenticated positive probes and unauthenticated/cross-owner
   negative probes against applicable shadow endpoints. For scheduled and
   event-driven functions, use read-only configuration verification and a
   separately authorized non-production event path; do not fabricate a
   production success claim.
6. Check Cloud Logging for cold-start failure, permission denial, malformed
   callable/event envelopes, duplicate processing, retries, and unexpected
   provider work. Record request/execution IDs.
7. Re-read the canonical live function immediately before cutover and require
   that generation, update time, config, and IAM still match the captured
   manifest.
8. Delete only that proven Gen1 cohort, deploy the same-name Gen2 replacements
   immediately, and restore/verify the generation-appropriate invoker policy
   (`roles/run.invoker` on the Gen2 Cloud Run service rather than assuming the
   Gen1 `roles/cloudfunctions.invoker` binding transfers).
9. Repeat the positive, negative, contract, and logging probes against the
   canonical URLs. Require every replacement to report `GEN_2` and healthy
   state before proceeding to the next dependency cohort.
10. If a replacement fails its gate, stop traffic where possible, delete only
    the failed Gen2 replacement, redeploy the recorded Gen1 source/config/IAM
    snapshot, verify its health, and leave later cohorts untouched.
11. After all canonical replacements are proven, remove temporary shadow
    services and their registry/IAM entries, then prove the live Gen1 count is
    zero, the stale `videoJobOrchestrator` registry entry is gone, and the live
    function set exactly matches the source inventory.
12. Run exact-main CI/deploy to green, review post-cutover logs, verify the
    authenticated product flows, and require a clean canonical checkout with
    local `main` equal to `origin/main`.

## Cohort ordering

Use dependency order, not file order:

1. Independent callables with no shared trigger or client contract.
2. Distribution, legal, OAuth, Telegram, and webhook cohorts with their bound
   secrets and invoker policies.
3. Scheduled storage and Firestore relay triggers with scheduler/Eventarc
   verification.
4. Root admin/data callables and health endpoints.
5. Image/audio helper aliases.
6. Coupled video, Inngest, streaming, App Check, Arcjet, and routing cluster.

The coupled cluster is atomic because it shares root imports, callable/HTTP
admission, the video Firestore trigger, specialist routing, and test mocks.

## Downstream integration completion record

The conflict-sensitive downstream sequence is now published in dependency
order and each gate reached exact-main green before the next one landed.

### Reservation lifecycle

- Main commit `4a2b78ba41138ca8a90ef5002a5d2e3f3e421cec`; exact deployment
  run `30549732758` green.
- The published gateway and renderer preserve Vertex typed capacity/retry
  metadata and the no-general-fallback rule while adding owner/type/status
  claims, pre-provider voids, settlement before terminal `{ complete: true }`,
  disconnect cancellation, and bounded stale reconciliation.
- The backend and renderer client contract landed atomically. Both required
  `costLedger` composite indexes are `READY`.

### ISSUE-1135 frame-conditioned safety

- Main commit `0a274bcfa39bf42711900748130ea1ede5d8aad5`; exact deployment
  run `30552228181` green.
- Explicit `dont_allow` is normalized before reservation/staging and survives
  frame/reference-conditioned queueing into the worker payload.

### Boardroom image/result preservation

- Main commit `a24cb4ab21f48c2adeed633fcedaa4fd850658f0`; exact deployment
  run `30555585723` attempt 2 green after a transient unchanged Firebase Rules
  API 503 in attempt 1.
- Both synthetic founder/admin receipt paths are removed; backend admission is
  authoritative.
- An authoritative completed or typed-failed image result survives a
  post-tool summary capacity error without a second provider/model call.
  Recovery is image-only and cannot expose raw results from another tool.

### Server-attested capability truth

- Main commit `35e36370b5f3d2148b7b509d695a1020607d42c1`; exact deployment
  run `30560106706` green across all 26 jobs.
- `getCapabilitySnapshot` is `ACTIVE` at revision
  `getcapabilitysnapshot-00001-new`. Auth, App Check, entitlement, Arcjet,
  owner-scoped durable evidence, and bounded freshness form the server ceiling.
  Unknown/stale/transport-failed state is not promoted to available.

The separate image-timeout lane is conclusively a duplicate of the Vertex,
reservation, and Boardroom lanes; it has no distinct source change to
integrate.

## Founder-facing Boardroom production acceptance matrix

This gate runs only after the Gen2-only cutover, reservation lifecycle, and
Boardroom image/result-preservation patch are integrated and exact-main green.
Unit tests, source inspection, and planned code are structural evidence only.
They cannot change a row to `AVAILABLE`.

The application capability answer must not contradict this evidence matrix. It
must not advertise a connector or workflow as active when this matrix says
`DEGRADED` or `BLOCKED`.

| Workflow | Current status | Production evidence required | Billing, rights, and security evidence | Remaining credential or founder action |
|---|---|---|---|---|
| Specialist conversation and routing | `DEGRADED` | Authenticated production trace `3376b8439686cabfa58cba0ce1e58eb4` records Arcjet admission, multi-region routing, and HTTP 200; a 72-hour sample has 31 `location=us` multi-region events and zero `SPECIALIST_UNAVAILABLE`; endpoint preflight is 22/22. Still required: ask the genuine current Boardroom capability question and retain the returned snapshot/answer, plus an observed typed unavailable/capacity case without general fallback | Authenticated owner/session and Arcjet admission are proven for the sampled request; source and guards prohibit general fallback and redact endpoint identity. Capability status deliberately remains unverified without a current server authority | Genuine founder sign-in and permission to perform the non-destructive production conversation/capability check |
| Boardroom image generation | `BLOCKED` | Boardroom request ID; durable reservation and claim; one provider submission; completed owned asset/job; settled receipt; an honest recoverable failure/retry observation | Owner-scoped input/output, private storage, immutable result receipt, exact credit settlement/void behavior, no duplicate spend | Genuine verified account with applicable entitlement/credits; founder approval for any paid provider request |
| Boardroom video generation | `BLOCKED` | Boardroom request/job ID; secure staging evidence; one provider submission despite trigger delivery/retry; completed private result and receipt; playback/download proof | Owner/hash/generation validation for every media input, no arbitrary URL fetch, one claimed reservation, conservative ambiguous-provider handling | Genuine verified account, owned media, applicable entitlement/credits, and founder approval for the paid production job |
| Long-running marketing plan | `BLOCKED` | Durable task ID and state transitions; progress visible after a long run; pause, resume, and reconnect; final plan retains prior context without duplicate work | Owner-scoped task state, bounded retries/cost, durable audit events, no fabricated external action or lost context | Authorized production session and a founder-approved non-destructive plan scenario |
| Calendar action | `BLOCKED` | Connector authorization; preview/draft; explicit approval event; resulting test/draft calendar record; audit trail and truthful error evidence | Least-privilege connector identity, owner/calendar selection, no action before approval, no silent retry or duplicate event | Official calendar connector authorization. Use a draft/test event; obtain explicit founder approval before any real external calendar mutation |
| Social publishing | `BLOCKED` | Authorized account connection; composed preview; explicit approval; attribution/audit receipt; truthful provider success or failure | Correct account/tenant, no post before approval, immutable content/approval receipt, no credential exposure, idempotent publish | Official social-account authorization. Never publish a live post solely for testing without explicit founder approval |
| Cross-device/mobile continuation | `BLOCKED` | Same durable job observed on another genuine authorized device/session; progress monitoring; approval; pause/resume; final result visible without restarting | Same owner and authorization boundary across devices, no token/session impersonation, consistent reservation/job receipt and audit history | Genuine second authorized device/session and founder approval to perform the continuation exercise |

For each execution, retain:

1. exact candidate/main SHA and deployed function revisions;
2. authenticated user and connector identity in redacted form;
3. request, job, reservation, provider, asset, and audit identifiers;
4. timestamps and relevant Cloud Logging references;
5. the approval event for every external mutation;
6. expected versus actual credits and final reservation state;
7. owner, cross-owner, unauthorized, cancellation, retry, and duplicate-delivery
   outcomes where applicable; and
8. a final `AVAILABLE`, `DEGRADED`, or `BLOCKED` decision with the specific
   remaining action.
