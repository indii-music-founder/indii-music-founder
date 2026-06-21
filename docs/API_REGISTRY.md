# API Registry: Master Endpoint Map

> [!IMPORTANT]
> **Source of Truth:** This document is the master manifest for all API endpoints in the indii-music system.
> **Backend Implementation:** All Firebase functions listed here are exported from `packages/firebase/src/index.ts`.
> **Calling Convention:** The majority of these are Firebase `onCall` (Gen 1) or `onCall` (Gen 2) functions, meaning they must be invoked from the client via the Firebase Functions SDK (`httpsCallable`), not via raw HTTP `fetch()`, unless explicitly marked as HTTP (`onRequest`).

## 1. Background Jobs & Orchestration (Inngest)
These functions interface with or trigger background jobs processed by Inngest.
- **`inngestApi`**: The main webhook endpoint (`onRequest`) that Inngest calls to execute background step functions.
- **`triggerVideoJob`**: Kicks off a standard video generation job.
- **`executeVideoJob`**: The actual execution step for the video job (often called by Inngest).
- **`triggerLongFormVideoJob`**: Initiates a long-form video composition job.
- **`renderVideo`**: Orchestrates video rendering (via Remotion or other rendering engines).

## 2. Creative & AI (Genkit / Gemini)
Core generative and analysis endpoints. Payloads typically include media URLs, prompt texts, and context objects.
- **`editImage`**: Modifies an existing image (e.g., via Vertex AI or Gemini Pro Vision).
- **`analyzeAudio`**: Audio intelligence processing (YAMNet / Essentia context).
- **`generateSpeech`**: Text-to-Speech (TTS) generation (Gemini 2.5 Pro TTS / Google Cloud TTS).
- **`generateContentStream`**: Streaming content generator (likely uses Genkit/Gemini).
- **`ragProxy`**: Retrieval-Augmented Generation endpoint for searching documents.
- **`generateImageV3` / `generateVideoV3` / `generateAudioV3` / `generateOmniRemixV3`**: V3 creative gateway functions.

## 3. Touring & Logistics (Agent Spoke)
Endpoints utilized by the touring and logistics subagents.
- **`generateItinerary`**: Creates tour schedules.
- **`checkLogistics`**: Validates routing and distances.
- **`findPlaces`**: Venue and POI lookup.
- **`calculateFuelLogistics`**: Generates fuel estimates based on routing.

## 4. Marketing & Social (Agent Spoke)
Endpoints for campaign execution.
- **`executeCampaign`**: Orchestrates a marketing campaign rollout.
- **`dispatchSocialPost`**: Sends a post to connected platforms via OAuth tokens.
- **`createInfluencerBounty`**: Creates an influencer marketing bounty.

## 5. App & System Health
- **`healthCheck`**: Standard health check (returns basic 200 OK + status).
- **`healthCheckWest1`**: Regional health check for multi-region validation.

## 6. User Data & Account Management
Privacy and compliance endpoints.
- **`exportUserData`**: Compiles all user data for GDPR/CCPA requests.
- **`requestAccountDeletion`**: Triggers full data wiping procedures.
- **`enrichFanData`**: Enriches fan profiles using external data APIs (Clearbit/Apollo).

## 7. Infrastructure (GCP Management)
Administrative operations on GCP resources.
- **`listGKEClusters` / `getGKEClusterStatus` / `scaleGKENodePool`**: Google Kubernetes Engine management.
- **`listGCEInstances` / `restartGCEInstance`**: Compute Engine management.

## 8. Data & Analytics (BigQuery)
- **`executeBigQueryQuery`**: Executes a predefined or validated BQ query.
- **`getBigQueryTableSchema`**: Retrieves schema for analytics consumption.
- **`listBigQueryDatasets`**: Lists available analytics datasets.

---

## Instructions for Agents

When requested to use or debug one of these endpoints:
1. **Find the Definition:** Go to `packages/firebase/src/index.ts` to see where the function is imported from (e.g., `import { triggerVideoJob } from "./lib/video"`).
2. **Check the Schema:** Open that specific source file and look for the Zod schema or TypeScript interface defining the payload.
3. **Verify Auth:** Note if the function enforces App Check or specific authentication claims (e.g., `requireAdmin` or `validateOrgAccess`).
4. **Client Invocation:** Use `httpsCallable(functions, "functionName")` from `@/core/services/firebase` in the frontend code. Do not write raw `fetch` routes unless the endpoint is specifically an `onRequest` HTTP trigger.
