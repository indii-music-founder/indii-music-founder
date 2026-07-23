# Checkpoint — engine-dsp deploy + Session Breakdown step 2 (updated 2026-07-23)

**Branch:** main · in sync with origin · working tree clean

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

## NEXT SESSION — pick up here
1. **ISSUE-1152 — now the front of the engine-dsp chain, and unblocked.** Wire
   browser receipt hydration: read `audio_analysis_receipts/{receiptId}` where
   `receiptId = 'audio_' + sha256('ownerId\0contentHash\0generation').slice(0,48)`.
   The Firestore rule already lets a client read only its own receipts, so no new
   endpoint is needed. Two real receipts exist to develop against (ISSUE-1170).
2. **Repair-order step 3:** build the proxy worker (H.264/AAC 720p CFR Rec.709,
   orientation baked in, PTS mapping, guide audio, waveform, thumbnails) as a
   Cloud Run service + `session-proxy-queue`. The dispatcher already expects:
   `SESSION_PROXY_WORKER_URL`, `SESSION_PROXY_SERVICE_ACCOUNT`, optional
   `SESSION_PROXY_AUDIENCE` / `SESSION_PROXY_TASKS_QUEUE` /
   `SESSION_PROXY_TASKS_LOCATION`. Until set, sessions record an honest
   `proxyJob.status = 'blocked'`.
3. Then steps 4→6 in the founder's binding order. ISSUE-1175..1181 only close on
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
