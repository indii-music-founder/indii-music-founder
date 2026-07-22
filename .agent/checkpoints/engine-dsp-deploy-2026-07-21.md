# Checkpoint — engine-dsp Cloud Run deploy (2026-07-21)

**Branch:** main · **Last pushed:** `997d08fe8` (in sync, 0/0 vs origin)

## Done this session (verified, on origin/main)
- Root-caused the engine-dsp "service broken" 404: **Google GFE intercepts the literal path `/healthz` on `*.run.app`** and returns a generic HTML 404 before the container. Fix = added `/health` route beside `/healthz` in `packages/engine-dsp/main.py` (+ `packages/engine-dsp/test_main.py`). Logged in ERROR_LEDGER.
- engine-dsp **deployed & live**: `https://engine-dsp-omromhtbxq-uc.a.run.app`, revision `engine-dsp-00002-m5b`, image digest `sha256:c1e75b6197e05a11143215b2153576d1bcb3ddbd77f0ee56127cd6ccca9b7ce5`.
- Live authed probe: `/health`→200 `{"status":"ok"}`, `/healthz`→404, `/docs`→200.
- ISSUE-1183 updated to 🟡 PARTIAL with full deployment evidence.

## Infra facts (for step 6)
- Project: `indii-music-founder` · Master bucket: `indii-music-founder.firebasestorage.app`
- Runtime SA: `engine-dsp-runtime@indii-music-founder.iam.gserviceaccount.com` (aiplatform.user, datastore.user, storage.objectViewer on bucket)
- Invoker SA: `engine-dsp-invoker@indii-music-founder.iam.gserviceaccount.com` (run.invoker on service; Cloud Tasks agent has tokenCreator on it)
- Firebase Functions `processaudioingestion` env set: `ENGINE_DSP_URL`, `ENGINE_DSP_SERVICE_ACCOUNT`, `ENGINE_DSP_AUDIENCE` (canonical URL)
- Cloud Tasks queue `dsp-processing-queue` in us-central1
- OIDC token for manual testing:
  `gcloud auth print-identity-token --impersonate-service-account=engine-dsp-invoker@indii-music-founder.iam.gserviceaccount.com --audiences=https://engine-dsp-omromhtbxq-uc.a.run.app 2>/dev/null`
  (redirect stderr to /dev/null — the WARNING line otherwise corrupts the bearer token → HTTP 000)
- `/profile` request body (pydantic `IngestionRequest`) requires: `storageBucket, storagePath, masterFingerprint, contentHash, generation, ownerId`. storagePath must be `masters/{owner_id}/{content_hash}/original.(wav|flac)`.

## NEXT SESSION — start here (CRITICAL queue)
1. **ISSUE-1183 step 6 (the only thing left to close the deploy):** upload one small synthetic WAV to `masters/{owner_id}/{content_hash}/original.wav`, enqueue a real Cloud Task, confirm a Firestore `audio_analysis_receipts` receipt lands, confirm a retry returns the cached receipt **without a second Gemini call** (no double-charge). Record evidence in ISSUE-1183 + ISSUE-1170.
2. Once step 6 passes → **close ISSUE-1170**, which **unblocks ISSUE-1152** (browser receipt-hydration UI).
3. Then continue down CRITICAL queue: 1155, 1157, 1158, 1159, 1160, 1162, 1165, 1168, 1169.

## Dirty-tree note
~50 unrelated files dirty (checkpoint-treadmill churn: workflows, checkpoints, CLAUDE.md mirrors, deleted OPEN_ISSUES.md). Not part of any task. Leave unless William asks otherwise.
