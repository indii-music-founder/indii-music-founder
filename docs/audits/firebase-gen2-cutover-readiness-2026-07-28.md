# Firebase Gen2-Only Cutover Readiness — 2026-07-28

## Scope and current release state

This is a preparation artifact, not deployment evidence. It records the
source migration inventory, the safe cutover/rollback sequence, and the release
gates that must be satisfied before any live Gen1 function is removed.

- Published baseline: `333656e03edf3b7c54adb1434ece03b9915f9c28`.
- The published baseline's exact Build and Test run `30388950058` passed.
- The latest scheduled Health Check Monitor run `30390996335` is marked
  successful, but its logs show only 13/103 checks passing and a service-account
  JSON parsing fallback. The workflow exits successfully after writing results,
  so that green badge is not service-health acceptance evidence.
- The exact production deploy run `30388087703` for prior code SHA
  `0db019fd60942270e95e473db30e83b8c994342c` passed, including its Cloud
  Functions deployment.
- A separate active Cloud Build trigger currently fails because it expects a
  root `Dockerfile` that does not exist. Its build ID is
  `f73f3917-...`; this is an outstanding attributable release-system failure.
- The local migration is 13 commits ahead of that baseline and is not
  published.
- The final atomic source cluster is intentionally uncommitted while its owner
  is token-limited. It must not be staged or approximated by another lane.
- Local migration validation currently passes Firebase production TypeScript,
  Firebase test TypeScript, and 89 Firebase suites / 600 tests.
- No migration deployment or live deletion has been authorized or performed.

## Authoritative source migration inventory

The published source contained 81 runtime exports backed by Gen1 declarations.
The local migration accounts for all 81 as the 58 committed exports and the 23
exports in the held atomic cluster below.

### Committed locally — 58 exports

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

### Held atomic cluster — 23 runtime exports

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

Every former Gen1 export must declare:

- memory of at least `512MiB`;
- `cpu: 'gcf_gen1'`; and
- `concurrency: 1`.

Existing higher memory, region, timeout, secret binding, App Check behavior,
auth gate, and trigger path must be preserved. Existing native-Gen2 exports
remain outside this contract so their current concurrency is not reduced.

The committed 58 pass this contract. The held cluster audit found one known
release blocker: `ragProxy` declares CPU and concurrency but not explicit
memory. The cluster owner must add the explicit cold-start floor. The current
semantics guard is also incomplete: it reports only the committed 58 and does
not parse the 21 direct cluster declarations or the two deployed factory
aliases. Its green result is not final migration evidence.

## Source and CI safeguards still required

Before the migration commit can enter the release lane:

1. Extend the semantics manifest/parser to cover all 81 deployed former-Gen1
   exports, including the two factory aliases, and reject unmanifested
   `cpu: 'gcf_gen1'` declarations.
2. Add a zero-Gen1 static guard over implementation and test source. It must
   reject `firebase-functions/v1`, v1 builder chains, v1-only helpers, and v1
   mocks without rejecting legitimate v2 namespace imports.
3. Wire the memory, semantics, and zero-Gen1 guards into package scripts,
   pre-commit, and the exact-main Build and Test workflow.
4. Add direct v2 CloudEvent coverage for `executeVideoJob` using
   `{ data: snapshot, params: { jobId } }`, including an absent-snapshot no-op
   and the queued/skip paths.
5. Preserve `details` in the shared v2 `HttpsError` test mock.
6. Remove stale Gen1 comments only in the migration owner's coherent source
   commit.
7. Require Firebase production/test typechecks, the full Firebase suite,
   scoped lint, diff check, all three guards, and repository pre-commit gates.

## Generation-aware live manifest

A pre-removal official Firebase CLI inventory reported 167 live registry
entries: 82 Gen1 and 85 Gen2, all in `us-central1` on Node.js 22. It reported
166 `ACTIVE` and one `FAILED`, with no duplicate function IDs.

All 58 names in the committed source-migration manifest are still live Gen1.
The remaining 24 live Gen1 entries are the 23 held-cluster/helper exports plus
one Firebase Extension function:

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

The one `FAILED` registry entry is Gen2 `videoJobOrchestrator`. Its Cloud Run
service and Eventarc trigger are missing, while published source exports the
replacement name `videoJobFirestoreOrchestrator`. Treat it as stale broken
registry state: reconcile ownership and traffic evidence before removing it,
then prove the canonical replacement is healthy.

Current Gen1 trigger mix is 67 callable, 7 HTTP, 4 event-driven, and 4
scheduled. Current Gen1 memory tiers are 32 at 256MiB, 39 at 512MiB, 5 at
1024MiB, and 6 at 2048MiB. These live values are snapshot evidence, not the
candidate Gen2 configuration.

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

## Downstream integration conflict map

Migration must land and reach exact-main green before either downstream lane.

### Reservation lifecycle (`467c45349`)

- Shared files: `packages/firebase/src/index.ts`,
  `packages/firebase/src/__tests__/image_gen.test.ts`, billing enforcement,
  renderer rate limiting, and the uncommitted
  `FirebaseIntelligenceService.ts` adapter.
- Preserve the published Vertex route resolver, property-based v2
  resource-exhausted recognition, typed JSON 429 body/retry metadata, and the
  no-general-fallback rule.
- Insert owner-scoped reservation void before returning the typed 429.
- Add one reservation per stream attempt, opaque `costReservationId` in the
  request body, atomic claim before provider submission, terminal
  `{ complete: true }` only after settlement, cancellation propagation, and a
  callable that can void only an unclaimed hold.
- Retain both typed-routing tests and claim/settle/void/cancel tests.
- The backend commit and adapted renderer service must land atomically because
  the backend makes `costReservationId` mandatory.

### Boardroom image/result preservation (`7dd4`)

- Files are renderer-only: `BaseAgent.ts`, `BaseAgentUsage.test.ts`,
  `CostControlService.ts`, and `CostControlService.test.ts`.
- Remove the client-side founder/admin cost bypass; backend admission remains
  authoritative.
- Preserve an already-completed tool result when only the post-tool summary
  turn is rate-limited, without making another provider call or reporting a
  failed tool as successful.
- Apply after reservation lifecycle is exact-main green so the Boardroom's
  rate-limit recovery is tested against the canonical typed errors and durable
  reservation behavior.

The separate image-timeout lane is conclusively a duplicate of the Vertex,
reservation, and Boardroom lanes; it has no distinct source change to
integrate.

## Founder-facing Boardroom production acceptance matrix

This gate runs only after the Gen2-only cutover, reservation lifecycle, and
Boardroom image/result-preservation patch are integrated and exact-main green.
Unit tests, source inspection, and planned code are structural evidence only.
They cannot change a row to `AVAILABLE`.

The application capability answer must be generated from the same status
record. It must not advertise a connector or workflow as active when this
matrix says `DEGRADED` or `BLOCKED`.

| Workflow | Current status | Production evidence required | Billing, rights, and security evidence | Remaining credential or founder action |
|---|---|---|---|---|
| Specialist conversation and routing | `BLOCKED` | Genuine authenticated Boardroom conversation; selected specialist and route receipt; typed unavailable/capacity behavior; logs proving no general-model fallback | Verified owner/session, App Check and Arcjet admission, truthful model/capability identity, no prompt or receipt leakage | Genuine founder sign-in and permission to run the production conversation |
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
