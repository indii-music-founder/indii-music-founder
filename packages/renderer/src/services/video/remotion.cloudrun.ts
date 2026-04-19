/**
 * remotion.cloudrun.ts
 *
 * Configuration for Remotion Cloud Run (GCP) rendering.
 *
 * This replaces the previous Lambda (AWS) configuration to keep
 * indiiOS fully within the Google Cloud ecosystem.
 *
 * Required environment variables:
 *   VITE_REMOTION_GCP_PROJECT_ID  – GCP project ID (defaults to Firebase project)
 *   VITE_REMOTION_GCP_REGION      – Cloud Run region (defaults to us-east1)
 *   VITE_REMOTION_SERVICE_NAME    – Deployed Cloud Run service name
 *   VITE_REMOTION_SITE_NAME       – GCS site name (from `npx remotion cloudrun sites create`)
 *
 * Authentication:
 *   Uses Application Default Credentials (ADC) from gcloud CLI or
 *   a GOOGLE_APPLICATION_CREDENTIALS service account JSON.
 *   No AWS credentials required.
 */

export const RemotionCloudRunConfig = {
    /**
     * GCP region where the Cloud Run rendering service is deployed.
     * Must match the region used during `npx remotion cloudrun services deploy`.
     */
    region: import.meta.env.VITE_REMOTION_GCP_REGION || 'us-east1',

    /**
     * Name of the deployed Cloud Run rendering service.
     * Created via `npx remotion cloudrun services deploy`.
     */
    serviceName: import.meta.env.VITE_REMOTION_SERVICE_NAME || 'remotion-render',

    /**
     * GCS-hosted site URL for the bundled Remotion compositions.
     * Created via `npx remotion cloudrun sites create`.
     * Format: https://storage.googleapis.com/{bucket}/sites/{site-id}
     */
    siteName: import.meta.env.VITE_REMOTION_SITE_NAME || 'indii-os-remotion-site',

    /**
     * GCP Project ID — defaults to the Firebase project for billing/IAM alignment.
     */
    projectId: import.meta.env.VITE_REMOTION_GCP_PROJECT_ID
        || import.meta.env.VITE_FIREBASE_PROJECT_ID
        || '',
} as const;
