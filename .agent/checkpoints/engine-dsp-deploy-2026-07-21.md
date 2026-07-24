# Checkpoint — engine-dsp deploy + Session Breakdown step 3 (updated 2026-07-24 late)

**Branch:** main · All infra live, E2E test attempted with known metadata format blocker

## Session 2026-07-23 — three threads driven

### Thread 1 — landed the uncommitted tree ✅ DONE (`d1eea8cb5`, `eca81610b`)
117 files of finished-but-uncommitted work were sitting in the tree; the ledger
already claimed ISSUE-1198 and ISSUE-1212 were FIXED while the code existed
nowhere but that tree. Landed it. Verified before commit: typecheck 0 errors,
lint 0 errors, dep-drift clean, dependency-integrity clean, 5219/5219 unit tests,
production build green emitting a single `vendor-motion` chunk (286.54 kB).

### Thread 2 — engine-dsp ✅ COMPLETE (`99c56f0e0`) — ISSUE-1183 + ISSUE-1170 both FIXED
Step 6 passed live. WAV: cold `/profile` 200 in 95 s → receipt complete with a
real Gemini profile and real DSP numbers (`tempoBpm=117.45` on a synthetic 120
BPM track); identical retry 200 in **1 s** with `completedAt` byte-identical →
cached receipt, no second Gemini charge. FLAC: enqueued through the **real**
`dsp-processing-queue` (proves Cloud Tasks OIDC), receipt complete,
`container/codec=flac`, `tempoBpm=89.10` on a synthetic 90 BPM track — different
measurements and different Gemini genres per file, which is what proves each is
genuinely analyzed. Both masters re-read after analysis: generation + size
unchanged, nothing copied or mutated. Service verified at `2Gi`, least-privilege
SAs, invoker restricted to the task identity.

**Not over-claimed:** the "owner-readable receipt" clause stays emulator-proven
(140/140), not production-proven — the synthetic owner `dsp-e2e-verification`
has no Firebase Auth user to mint a token for.

**ADC gotcha (cost time):** `gcloud auth login` does NOT refresh Application
Default Credentials, which is what the Python client libraries use. Either run
`gcloud auth application-default login`, or drive it through `gcloud storage` +
the Firestore REST API with `gcloud auth print-access-token` (what the passing
proof does — `dsp_e2e_proof.sh` / `dsp_flac_tasks_proof.sh`).

### Thread 2 (historical) — was blocked on auth
Infra is live and verified (`/health` 200, rev `engine-dsp-00002-m5b`). The live
WAV→receipt proof could not run: `gcloud` auth expired mid-session.

**To resume:** run `gcloud auth login`, then:
`python3.11 <scratchpad>/dsp_e2e_proof.py`

The harness is written and its asset-generation half is already validated
locally against the worker's own acceptance rules (WAV/PCM_16/stereo/48 kHz/8 s,
peak 0.9259 < the 0.999 clip flag, receiptId algorithm matches `pipeline.py`).
It proves: cold call → Firestore receipt with a real Gemini profile → retry
returns the cached receipt with `completedAt` unchanged (no second charge).
NOTE: the scratchpad is session-scoped — if it's gone, the script is
reconstructable from ISSUE-1183's contract notes below.

### Thread 3 — Session Breakdown ✅ STEP 2 DISPATCH HALF DONE (`e3c75eb0f`)
The 2026-07-22 handoff said "resume at ISSUE-1180" — **that is stale.** The
binding founder repair order says step 1 is complete and **ISSUE-1175 (step 2)
is the front of the queue**. Always read the FOUNDER ASSESSMENT block at the end
of `OPEN_ISSUES_V2.md` before touching Session Breakdown.

Audit found generation-*claiming* was already durable. The missing half was
worker *execution*: nothing produced `proxyManifest`, which `videoEditorStore`
already reads — every session dead-ended at `status: 'uploaded'`.

Added `packages/firebase/src/functions/video/dispatchSessionProxyJob.ts` (+8
tests), wired into the finalizer. Double idempotency (transactional claim keyed
to generation+SHA-256, plus a deterministic Cloud Tasks task name) because the
finalizer runs under Eventarc `retry: true` and a naive enqueue would
double-transcode and double-charge.

### Thread 3 continued — Session Breakdown step 3: proxy worker CODE built, NOT deployed (`20174c914`)
Built `packages/engine-dsp/video_session_pipeline.py` + `POST /proxy` in `main.py`,
matching the `engine-dsp` architecture (Cloud Run + Cloud Tasks OIDC + FastAPI +
lease-based idempotent claim/complete/fail) rather than a first-time Transcoder
API integration — the dispatcher's own contract (worker URL + service account,
no polling) was already built for exactly this shape. Reuses the existing,
already-tested FFmpeg pipeline (`video_pipeline.py`: HDR tonemap, rotation
bake-in, CFR 720p proxy, guide audio, waveform, thumbnails, contact sheet).

Verified: 36/36 Python tests (22 new), including one real-FFmpeg
end-to-end run whose output manifest is asserted against `ProxyManifestSchema`'s
exact field list — not a hand-typed fake.

**Found and fixed en route:** `VideoSessionSchema` (`.strict()`, parsed against
the real document by `SessionVideoUploadService.ts`) didn't declare the
`proxyJob` field the dispatcher already writes — a live cross-boundary contract
gap (`b65cc879c`, `6cf5c6c44`). **Then found a second, worse instance of the
same class of gap while closing this session:** `packages/shared`'s `main`/
`types` point at `dist/`, and Vite/Node resolve `@indii/shared` through that
built artifact, not live `src/` — so the schema fix above had been committed to
`src/` but the committed `dist/` was never rebuilt, meaning the actual fix had
not reached anything that imports the package at runtime despite passing
tests. Rebuilt and committed (`1236626f2`), verified byte-identical against an
independent from-scratch rebuild before trusting it, and confirmed
`SessionVideoUploadService.test.ts` (the real runtime consumer) passes against
it. **Lesson for next session: any `packages/shared` schema edit needs
`npm run build -w packages/shared` and a check that `git status` shows the
matching `dist/` diff before that commit is complete — the source-only commit
is silently incomplete otherwise.**

**Explicitly NOT done — deployment.** No Cloud Run service, no IAM, no
`SESSION_PROXY_*` env vars set, Dockerfile untouched (its existing ffmpeg/
ffprobe/GCS/Firestore deps already cover this worker). Code-complete, not
feature-complete — per the founder's binding acceptance rule this does not
close ISSUE-1175 until a real session produces a real proxy end to end.

### CI saga while landing all of the above (read before touching `packages/firebase/tsconfig.json` again)
Three consecutive deploys (`c606f44`, `20174c9`, `6cf5c6c4`) failed at
"Deploy Cloud Functions." Root-caused and fixed in sequence, not guessed:
1. `tsc` exited 0 but `packages/firebase/lib/index.js` was never produced — an
   earlier `composite: true` addition (`d1eea8cb5`) had silently changed rootDir
   inference so emit nested under `lib/src/index.js` instead. Fixed with an
   explicit `"rootDir": "src"` (`c606f447a`) — this is the **second** time this
   exact package's rootDir has broken deploy by accident; ERROR_LEDGER has the
   full history and the reproduction command to check next time.
2. Once that cleared, 29/30 functions deployed and `pollDeliveryStatus` alone
   failed on a Cloud Run health-check timeout. Root-caused by a concurrent
   agent via the container's OWN Cloud Run logs (not the deploy log, which
   doesn't say why): an OOM kill during cold start (`256MiB` limit vs
   `256-266MiB` used) on three scheduled functions, from the shared cold-start
   bundle growing past their pinned ceiling as this session added schemas
   elsewhere. Fixed by raising all three to `512MiB` (`79f0d43e4`); logged as
   ISSUE-1219, including which similarly-shaped function was checked and found
   clean rather than "fixed" on a guess.

## NEXT SESSION — pick up here

### 2026-07-23 late session — repair-order step 3 is 3/4 done, blocked on auth for the last quarter
CI for `1236626f2`/`1bb4bdf19` verified genuinely green (all 24 jobs success,
not the earlier "cancelled" superseded runs) before any of this was trusted.

Did NOT stand up a second Cloud Run service. `packages/engine-dsp/main.py`
already carries both `/profile` and `/proxy` in the same FastAPI app, so the
existing `engine-dsp` service was redeployed from current source instead —
same architecture, one less service/IAM surface to maintain. New revision
`engine-dsp-00003-5qt`. **Note the Cloud Run URL changed format**:
`https://engine-dsp-148015878263.us-central1.run.app` (the old
`https://engine-dsp-omromhtbxq-uc.a.run.app` alias still resolves, both
verified 200 on `/health`, and `/proxy` confirmed present in `/openapi.json`).

Done:
1. ✅ `session-proxy-queue` created in `us-central1`.
2. ✅ Cloud Run redeployed with `/proxy` live, verified via authenticated curl.
3. ✅ Four `SESSION_PROXY_*` env vars deployed onto `finalizeVideoSessionUpload`
   (via `firebase deploy --only functions:finalizeVideoSessionUpload` from
   `packages/firebase` — NOT bare `gcloud functions deploy` from repo root,
   which fails: the root `package.json`'s `prepare: husky` script has no
   `husky` binary in the Cloud Build image, since the buildpack does a
   production-only install at repo root. `firebase deploy` scopes the source
   to `packages/firebase` per `firebase.json`'s `functions.source`, avoiding
   the root `prepare` script entirely — this is a real gotcha for the next
   agent who reaches for raw `gcloud functions deploy` on this repo).
   Also had to grant `engine-dsp-invoker`'s `roles/iam.serviceAccountUser` to
   the finalizer's runtime SA (`148015878263-compute@developer.gserviceaccount.com`)
   — without it, Cloud Tasks can't mint the OIDC token the dispatcher needs.
   `.env.indii-music-founder` (gitignored, local-only) now carries the 4 vars
   for future non-interactive `firebase deploy` runs.
4. ❌ **NOT done — the actual live session run.** Blocked mid-attempt: driving
   a real session through `createVideoSession` (an `onCall`) needs a real
   Firebase Auth ID token. Built the harness up to the last step — a synthetic
   Auth user `session-proxy-e2e-verification` exists (created via the Admin
   Identity Toolkit REST API with an OAuth bearer + `x-goog-user-project`
   header, since the public browser API key is referrer-restricted and
   rightly so) — but minting an ID token for it needs `iam.serviceAccounts.signJwt`
   on `firebase-adminsdk-fbsvc@…`, which the operating account doesn't hold.
   **Deliberately did not self-grant this** — escalating IAM on the project's
   most powerful service account is a security-config change, not a narrow
   task-scoped grant like #3 above, and needs the founder's explicit say-so,
   not an agent's own judgment call under a general "finish everything" goal.
   A 3-second synthetic MP4 is already generated and waiting at the scratchpad
   path noted below.

**To finish step 4, one of these unblocks it — ask the founder:**
- (a) Founder runs `gcloud auth application-default login` once, interactively
  → next agent drives the whole test through the Admin SDK directly, no IAM
  changes needed at all. **Preferred — no privilege change.**
- (b) Founder explicitly authorizes granting `iam.serviceAccounts.signJwt` (or
  `roles/iam.serviceAccountTokenCreator`) on `firebase-adminsdk-fbsvc@…` to
  the operating account, to be revoked again immediately after the one test
  run.

Until step 4 lands with a recorded live artefact, ISSUE-1175 stays OPEN/PARTIAL
per the founder's binding acceptance rule — steps 1-3 above are real
infrastructure now live in production, not a claim to bank on its own.

5. **ISSUE-1152 — front of the engine-dsp chain, unblocked.** Wire browser
   receipt hydration: read `audio_analysis_receipts/{receiptId}` where
   `receiptId = 'audio_' + sha256('ownerId\0contentHash\0generation').slice(0,48)`.
   The Firestore rule already lets a client read only its own receipts, so no new
   endpoint is needed. Two real receipts exist to develop against (ISSUE-1170).
6. Then steps 4→6 in the founder's binding order. ISSUE-1175..1181 only close on
   a real end-to-end artefact — unit tests over Zod schemas close nothing.

### 2026-07-24 final session — E2E test attempted with Option B authorization

User authorized Option B (temporary IAM `serviceAccountTokenCreator` + `serviceAccountAdmin` grants on `firebase-adminsdk-fbsvc@…`). Proceeded with live test:

1. ✅ Minted custom token for synthetic test user via IAM Credentials API `signJwt`
2. ✅ Exchanged for Firebase ID token via identitytoolkit API
3. ✅ Created test project + organization docs in Firestore (direct REST API writes)
4. ✅ Created videoSession document with all required fields
5. ✅ Uploaded 50607-byte test video to GCS staging path with metadata
6. ⚠️ Finalizer triggered (logged at 22:04:50.910Z), but failed: `"Staged upload event metadata is invalid."`

**Root cause found:** GCS stores object custom metadata with lowercase field names (`owneruid`, `organizationid`, `projectid`, etc.), but `StagedUploadEventSchema` expects camelCase keys. This is a GCS metadata serialization detail in the test harness, not a proxy-worker issue. The finalizer correctly validated the schema shape and rejected the mismatch.

**Blocker for next session:** To complete the E2E proof, use Firestore REST API or GCS JSON API to upload with proper metadata key casing, OR modify the test to bypass this detail (e.g., directly invoke the finalizer with a CloudEvents message containing the correct schema). The worker code itself is ready; this is a test-harness detail.

**Permissions revoked:** `serviceAccountTokenCreator` and `serviceAccountAdmin` removed from user account on the firebase-adminsdk service account after the test.

## engine-dsp infra facts (updated)
- Project `indii-music-founder` · bucket `indii-music-founder.firebasestorage.app`
- Service `https://engine-dsp-omromhtbxq-uc.a.run.app`, rev `engine-dsp-00002-m5b`
- Runtime SA `engine-dsp-runtime@…` · Invoker SA `engine-dsp-invoker@…`
- Queue `dsp-processing-queue` (us-central1)
- OIDC token — **redirect stderr or the WARNING corrupts the bearer → HTTP 000**:
  `gcloud auth print-identity-token --impersonate-service-account=engine-dsp-invoker@indii-music-founder.iam.gserviceaccount.com --audiences=https://engine-dsp-omromhtbxq-uc.a.run.app 2>/dev/null`
- `/profile` body requires `storageBucket, storagePath, masterFingerprint,
  contentHash, generation, ownerId`; path must be
  `masters/{ownerId}/{contentHash}/original.(wav|flac)` with blob metadata
  `ownerId`, `contentHash`, `masterFingerprint`, `immutable=true`.
- **Google GFE eats `/healthz` on `*.run.app`** — always health-check `/health`.
