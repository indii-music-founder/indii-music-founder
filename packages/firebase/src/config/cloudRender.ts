import { defineSecret } from 'firebase-functions/params';

/**
 * Cloud render worker wiring (MIG-010).
 *
 * Both values are infrastructure-minted and provisioned through the GCP
 * runbook (docs/CLOUD_HYPERFRAMES_RUNBOOK.md):
 *   - RENDER_WORKER_URL — the deployed Cloud Run service URL, e.g.
 *     https://indii-render-worker-<hash>-uc.a.run.app
 *   - RENDER_WORKER_SECRET — the shared Bearer secret the worker and this
 *     dispatcher both hold (Secret Manager).
 */
export const renderWorkerUrl = defineSecret('RENDER_WORKER_URL');
export const renderWorkerSecret = defineSecret('RENDER_WORKER_SECRET');
