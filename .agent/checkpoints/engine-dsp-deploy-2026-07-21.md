# Checkpoint — engine-dsp deploy + Session Breakdown step 2 (updated 2026-07-23)

**Branch:** main · in sync with origin · working tree clean

## Session 2026-07-23 — three threads driven

### Thread 1 — landed the uncommitted tree ✅ DONE (`d1eea8cb5`, `eca81610b`)
117 files of finished-but-uncommitted work were sitting in the tree; the ledger
already claimed ISSUE-1198 and ISSUE-1212 were FIXED while the code existed
nowhere but that tree. Landed it. Verified before commit: typecheck 0 errors,
lint 0 errors, dep-drift clean, dependency-integrity clean, 5219/5219 unit tests,
production build green emitting a single `vendor-motion` chunk (286.54 kB).

### Thread 2 — engine-dsp step 6 ⏸ BLOCKED ON AUTH
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
1. `gcloud auth login` → run the engine-dsp step-6 proof → close ISSUE-1183,
   which unblocks ISSUE-1170 → ISSUE-1152.
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
