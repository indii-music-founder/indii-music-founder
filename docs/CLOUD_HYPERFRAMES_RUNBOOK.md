# Cloud HyperFrames Render — GCP Activation Runbook

**Owner:** founder / browser-control agent
**Goal:** make the in-app video render pipeline available to every user
(web included) by deploying the cloud render worker built in MIG-010.

The worker and dispatcher must be deployed together after the Cloud Tasks queue
exists. Provision the queue before enabling the new dispatcher.

## 1. Architecture recap

```
Studio (web) ──queueCloudVideoRender──▶ users/{uid}/videoRenderJobs/{jobId} (queued)
                                              │  onDocumentCreated trigger
                                              ▼
                        dispatchCloudVideoRender (Firebase function)
                                              │  deterministic Cloud Task
                                              ▼
                        video-render-jobs queue (durable retries)
                                              │  POST /v1/render (Bearer secret)
                                              ▼
                        Cloud Run: indii-render-worker (chromium + ffmpeg)
                        stages media → compiles (@indii/video-compiler) →
                        renders MP4 → uploads to default storage bucket →
                        job → completed (signed URL)
```

Secrets:

| Secret | Held by | Purpose |
|---|---|---|
| `RENDER_WORKER_SECRET` | Cloud Run (env) + dispatcher function | Mutual Bearer auth |
| `RENDER_WORKER_URL` | dispatcher function | Where to POST jobs |

## 2. Prerequisites

- `gcloud` CLI authenticated as an Owner (or with the roles listed per step).
- Project ID: `indii-music-founder` (substitute `$PROJECT` throughout).
- The repo checked out on `main` (build context for Cloud Build).

> **Step 0 — REAUTH REQUIRED (observed 2026-08-26).** The machine's stored
> Google session was revoked by Google (`invalid_grant / invalid_rapt`), so
> BOTH credential stores must be re-established interactively before any
> other step. Run these with the founder at the keyboard (email + MFA):
>
> ```bash
> gcloud auth login                       # user credentials for gcloud
> gcloud auth application-default login   # ADC (refresh tokens)
> firebase login:reauth                   # firebase CLI store
> ```
>
> Verify: `gcloud auth list` and `firebase login:list` both show
> `wiil@indii.music`, and
> `gcloud auth application-default print-access-token` returns a token.

```bash
export PROJECT=indii-music-founder
export REGION=us-central1
gcloud config set project $PROJECT
```

## 3. Enable APIs

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com cloudtasks.googleapis.com --project $PROJECT
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

## 9. Provision durable dispatch before the function rollout

```bash
gcloud tasks queues create video-render-jobs --location "$REGION" \
  --max-concurrent-dispatches=5 --max-dispatches-per-second=1 \
  --max-attempts=-1 --max-retry-duration=86400s \
  --min-backoff=60s --max-backoff=600s --project "$PROJECT"
```

If the queue already exists, inspect its rate/retry settings and use
`gcloud tasks queues update` with the same values. Grant `roles/cloudtasks.enqueuer`
on this queue to the **actual Gen2 service account** for
`dispatchCloudVideoRender`. Read that identity from the deployed function's
`serviceConfig.serviceAccountEmail`; do not assume it is the worker account.
The function needs permission to create tasks, and the queue must be in
`us-central1` in the same project. Confirm both before deploying the new
dispatcher. A missing queue or permission leaves the Firestore job queued and
causes the trigger to retry; it must never be described as a completed render.

The worker accepts only owner-scoped objects in the configured project Storage
bucket. Existing projects with arbitrary external preview URLs must upload or
resolve those assets to owned Storage objects before cloud rendering.

## 10. Deploy the Firebase functions

`queueCloudVideoRender` and `dispatchCloudVideoRender` are already exported
from `packages/firebase/src/index.ts`. Deploy either way:

- **CI (preferred):** `gh workflow run deploy.yml --ref main` — the pipeline
  deploys functions to production.
- **CLI:** `firebase deploy --only functions:queueCloudVideoRender,functions:dispatchCloudVideoRender`

## 11. Verify end-to-end

1. Open the Studio editor in a **web** browser (not the desktop app) and
   click **Render Video** on a project with clips.
2. In Firestore, watch `users/{uid}/videoRenderJobs/{jobId}` gain
   `dispatchTaskName`, then move `queued` → `running` → `completed` with
   `artifactUrl`. Confirm the named task exists in `video-render-jobs` before
   the worker starts. A 2xx task response follows terminal execution, never
   an in-process background launch.
3. Open `artifactUrl` — it must play as an MP4.
4. Confirm the editor preview updated automatically.

Failure drill: `running` stuck > 20 min or `failed` with `error` — read the
Cloud Run logs:

```bash
gcloud logging read 'resource.type=cloud_run_revision AND
  resource.labels.service_name=indii-render-worker' --limit 50
```

## 12. Cost and safety rails

- Cloud Run bills per vCPU-second and GiB-second. A 78s 1080p render on
  2 vCPU / 4 GiB costs roughly $0.02–0.05.
- Rails: `--max-instances 5`, `--concurrency 1`, `--timeout 1200`, queue
  concurrency five, generation-pinned owned media (512 MB per object, 2 GB per
  job), and a 31-minute fenced worker lease. Repeated provider failures still
  require operator review after the queue's retry window.
- Optional extra rail: a billing alert on the Cloud Run service.

## 13. Rollback

Pause the queue before replacing a broken worker or dispatcher, inspect pending
tasks and Firestore job states, then resume after repair:

```bash
gcloud tasks queues pause video-render-jobs --location "$REGION" --project "$PROJECT"
gcloud tasks queues resume video-render-jobs --location "$REGION" --project "$PROJECT"
```

Do not delete the queue or worker while tasks are pending. Preserve the
Firestore jobs and their task names for recovery.
