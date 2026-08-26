# Cloud HyperFrames Render — GCP Activation Runbook

**Owner:** founder / browser-control agent
**Goal:** make the in-app video render pipeline available to every user
(web included) by deploying the cloud render worker built in MIG-010.

The code is complete and on `main`. This runbook provisions ONLY the GCP
resources; every step is copy-pasteable and idempotent where possible.

## 1. Architecture recap

```
Studio (web) ──queueCloudVideoRender──▶ users/{uid}/videoRenderJobs/{jobId} (queued)
                                              │  onDocumentCreated trigger
                                              ▼
                        dispatchCloudVideoRender (Firebase function)
                                              │  POST /v1/render (Bearer secret)
                                              ▼
                        Cloud Run: indii-render-worker (chromium + ffmpeg)
                        stages media → compiles (@indii/video-compiler) →
                        renders MP4 → uploads to default storage bucket →
                        job → completed (signed URL)
```

Nothing in this runbook changes application code. Secrets:

| Secret | Held by | Purpose |
|---|---|---|
| `RENDER_WORKER_SECRET` | Cloud Run (env) + dispatcher function | Mutual Bearer auth |
| `RENDER_WORKER_URL` | dispatcher function | Where to POST jobs |

## 2. Prerequisites

- `gcloud` CLI authenticated as an Owner (or with the roles listed per step).
- Project ID: `indii-music-founder` (substitute `$PROJECT` throughout).
- The repo checked out on `main` (build context for Cloud Build).

```bash
export PROJECT=indii-music-founder
export REGION=us-central1
gcloud config set project $PROJECT
```

## 3. Enable APIs

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com --project $PROJECT
```

## 4. Create the worker service account

```bash
gcloud iam service-accounts create render-worker \
  --display-name "indii cloud render worker" --project $PROJECT
```

Grant Firestore access (job docs + project docs) and Storage access
(media download via signed URLs + artifact upload):

```bash
gcloud projects add-iam-policy-binding $PROJECT \
  --member "serviceAccount:render-worker@$PROJECT.iam.gserviceaccount.com" \
  --role roles/datastore.user
gcloud projects add-iam-policy-binding $PROJECT \
  --member "serviceAccount:render-worker@$PROJECT.iam.gserviceaccount.com" \
  --role roles/storage.objectAdmin
```

## 5. Create the shared secret

```bash
openssl rand -hex 32 > /tmp/render-worker-secret.txt
gcloud secrets create RENDER_WORKER_SECRET --project $PROJECT \
  --data-file=/tmp/render-worker-secret.txt --replication-policy=automatic
```

## 6. Build the worker image (Cloud Build)

From the repo root:

```bash
gcloud builds submit \
  --config packages/render-worker/cloudbuild.yaml \
  --substitutions _IMAGE=us-central1-docker.pkg.dev/$PROJECT/render-worker/indii-render-worker:latest \
  .
```

## 7. Deploy Cloud Run

```bash
gcloud run deploy indii-render-worker \
  --image us-central1-docker.pkg.dev/$PROJECT/render-worker/indii-render-worker:latest \
  --region $REGION \
  --cpu 2 --memory 4Gi --timeout 1200 \
  --concurrency 1 --max-instances 5 \
  --service-account render-worker@$PROJECT.iam.gserviceaccount.com \
  --set-env-vars RENDER_ARTIFACT_PREFIX=video-render-jobs,HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium,HYPERFRAMES_HOME=/tmp/hf-home \
  --set-secrets RENDER_WORKER_SECRET=RENDER_WORKER_SECRET:latest \
  --allow-unauthenticated
```

> **Why `--allow-unauthenticated`:** the dispatcher (Firebase function) cannot
> reach internal-only ingress, and a static Bearer is not Cloud Run's IAM
> auth. The worker itself rejects every request without the correct
> `Authorization: Bearer <RENDER_WORKER_SECRET>`, and job paths are
> server-minted. Keep the secret rotation-only; upgrade to an OIDC check
> later if desired.

Get the service URL:

```bash
gcloud run services describe indii-render-worker --region $REGION \
  --format "value(status.url)"
```

## 8. Register the worker URL with the dispatcher

```bash
printf 'https://indii-render-worker-<hash>-uc.a.run.app' \
  | gcloud secrets create RENDER_WORKER_URL --project $PROJECT --data-file=- \
    --replication-policy=automatic
```

(Use the exact URL from step 7. If the secret already exists:
`gcloud secrets versions add RENDER_WORKER_URL --data-file=-`.)

## 9. Deploy the Firebase functions

`queueCloudVideoRender` and `dispatchCloudVideoRender` are already exported
from `packages/firebase/src/index.ts`. Deploy either way:

- **CI (preferred):** `gh workflow run deploy.yml --ref main` — the pipeline
  deploys functions to production.
- **CLI:** `firebase deploy --only functions:queueCloudVideoRender,functions:dispatchCloudVideoRender`

## 10. Verify end-to-end

1. Open the Studio editor in a **web** browser (not the desktop app) and
   click **Render Video** on a project with clips.
2. In Firestore, watch `users/{uid}/videoRenderJobs/{jobId}`:
   `queued` → `running` → `completed` with `artifactUrl`.
3. Open `artifactUrl` — it must play as an MP4.
4. Confirm the editor preview updated automatically.

Failure drill: `running` stuck > 20 min or `failed` with `error` — read the
Cloud Run logs:

```bash
gcloud logging read 'resource.type=cloud_run_revision AND
  resource.labels.service_name=indii-render-worker' --limit 50
```

## 11. Cost and safety rails

- Cloud Run bills per vCPU-second and GiB-second. A 78s 1080p render on
  2 vCPU / 4 GiB costs roughly $0.02–0.05.
- Rails already in place: `--max-instances 5`, `--concurrency 1`,
  `--timeout 1200`, the job protocol's one-hop transitions, and the worker's
  fail-closed artifact check.
- Optional extra rail: a billing alert on the Cloud Run service.

## 12. Rollback

```bash
gcloud run services delete indii-render-worker --region $REGION
gcloud secrets delete RENDER_WORKER_URL   # then redeploy functions without it —
                                          # dispatcher logs and jobs stay queued
```

The queue callable and the renderer web path keep working either way —
without the worker, jobs simply wait in `queued` until it returns.
