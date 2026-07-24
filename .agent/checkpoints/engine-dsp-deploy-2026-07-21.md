# Checkpoint — engine-dsp deploy + Session Breakdown step 3 (updated 2026-07-23 evening)

**Branch:** main · CI run in progress for the current push, watch before trusting green

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
1. **Verify the CI run for `1236626f2` (or later) is actually green** before
   assuming any of the above is truly landed — this checkpoint was written
   while that run was still queued.
2. **ISSUE-1152 — front of the engine-dsp chain, unblocked.** Wire browser
   receipt hydration: read `audio_analysis_receipts/{receiptId}` where
   `receiptId = 'audio_' + sha256('ownerId\0contentHash\0generation').slice(0,48)`.
   The Firestore rule already lets a client read only its own receipts, so no new
   endpoint is needed. Two real receipts exist to develop against (ISSUE-1170).
3. **Repair-order step 3 — deployment, not code.** Provision the Cloud Run
   service + `session-proxy-queue` + IAM (mirror engine-dsp's runtime/invoker
   service-account split), set the four `SESSION_PROXY_*` env vars on
   `finalizeVideoSessionUpload`'s Functions deployment, run one real session
   through the full chain (upload → finalize → dispatch → proxy → completed),
   and record the live proof the same way ISSUE-1183's closure did. THEN close
   ISSUE-1175.
4. Then steps 4→6 in the founder's binding order. ISSUE-1175..1181 only close on
   a real end-to-end artefact — unit tests over Zod schemas close nothing.

## engine-dsp infra facts (unchanged)
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
