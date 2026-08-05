# Arcjet Protection Matrix (ISSUE-1244)

> **Authority & Compliance Record**
> - **Module:** `packages/firebase/src/**`
> - **Total Trigger-Declaring Files Inventory:** 100
> - **Client-Reachable Endpoints (`onCall` / `onRequest`):** 79
> - **Internal-Only Event Triggers (`onSchedule` / Firestore / Storage / Cloud Tasks):** 21
> - **Requirement:** Every client-reachable function carries Arcjet rate-limiting / security request protection and mounts `ARCJET_KEY` via `secrets`. Internal-only event triggers are explicitly documented as exemptions without binding `ARCJET_KEY`.

---

## 1. Client-Reachable Endpoints Matrix (79 Files)

All client-reachable boundaries evaluate Arcjet protection (`protectCallableRequest`, `protectAuthenticatedApiRequest`, or `protectAnonymousSignupRequest`) against the raw HTTP request and bind `ARCJET_KEY` via `secrets: [arcjetKey]`.

| # | File Path | Trigger Type | Primary Arcjet Policy Class | Secret Bound (`ARCJET_KEY`) | Protection Status |
|---|---|---|---|---|---|
| 1 | `index.ts` | `onCall`, `onRequest` | `verified-free` / `paid` | Yes | PROTECTED |
| 2 | `pod/printful.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 3 | `releases/generateDownloadUrl.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 4 | `marketplace/createMarketplaceCheckout.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 5 | `marketplace/getStemDownloadUrl.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 6 | `distribution/ingestion.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 7 | `mcp/index.ts` | `onRequest` | `verified-free` / `admin` | Yes | PROTECTED |
| 8 | `streaming/agentStream.ts` | `onRequest` | `verified-free` | Yes | PROTECTED |
| 9 | `subscription/activateFounderPass.ts` | `onCall` | `founder` | Yes | PROTECTED |
| 10 | `subscription/cancelSubscription.ts` | `onCall` | `paid` | Yes | PROTECTED |
| 11 | `subscription/createCheckoutSession.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 12 | `subscription/createMicroTransaction.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 13 | `subscription/createOneTimeCheckout.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 14 | `subscription/generateInvoice.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 15 | `subscription/getCustomerPortal.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 16 | `subscription/getSubscription.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 17 | `subscription/getUsageStats.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 18 | `subscription/resumeSubscription.ts` | `onCall` | `paid` | Yes | PROTECTED |
| 19 | `subscription/trackUsage.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 20 | `social/refreshTokenCallable.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 21 | `orchestration/toggle/unified-distribution.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 22 | `lib/audio.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 23 | `lib/image_generation.ts` | `onCall` | `paid` | Yes | PROTECTED |
| 24 | `lib/marketing.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 25 | `lib/touring.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 26 | `marketing/campaignMetricsCallable.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 27 | `marketing/shopifyWebhook.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 28 | `marketing/smartLink.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 29 | `functions/video/alignSessionMaster.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 30 | `functions/video/applyAudioRecipe.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 31 | `functions/video/approveSessionEditPlan.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 32 | `functions/video/cancelVideoSession.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 33 | `functions/video/createSocialHandoffDraft.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 34 | `functions/video/createVideoSession.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 35 | `functions/video/generateSessionEditPlan.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 36 | `functions/video/getVideoRenderReceipt.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 37 | `functions/video/retrySessionProxyJob.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 38 | `functions/security/logAuditEvent.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 39 | `functions/security/persistFraudAlert.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 40 | `functions/security/writeSharedOperationalData.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 41 | `functions/auth/entitlements.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 42 | `functions/auth/handoff.ts` | `onRequest` | `verified-free` | Yes | PROTECTED |
| 43 | `functions/admin/setGodMode.ts` | `onCall` | `admin` | Yes | PROTECTED |
| 44 | `functions/distribution/distributionRecords.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 45 | `functions/agent/getCapabilitySnapshot.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 46 | `functions/agent/manageSemanticMemory.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 47 | `functions/agent/reportBugFn.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 48 | `functions/storage/fetchStorageAssetForCanvas.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 49 | `functions/storage/verifyMasterAudio.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 50 | `functions/rights/queueRightsRegistration.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 51 | `functions/knowledge/query.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 52 | `functions/knowledge/upload.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 53 | `functions/api/router.ts` | `onRequest` | `verified-free` / `paid` / `admin` | Yes | PROTECTED |
| 54 | `functions/finance/calculateRoyaltyAllocations.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 55 | `functions/finance/ingestEarningsReport.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 56 | `functions/finance/setRecoupmentBalance.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 57 | `functions/finance/submitTaxForm.ts` | `onRequest` | `verified-free` | Yes | PROTECTED |
| 58 | `functions/creative/gateway.ts` | `onCall` | `verified-free` / `paid` | Yes | PROTECTED |
| 59 | `functions/creative/getMediaDuration.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 60 | `functions/webhooks/dispatcher.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 61 | `functions/billing/enforceOperationCost.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 62 | `functions/remote/issueStudioExecutorLease.ts` | `onCall` | `admin` | Yes | PROTECTED |
| 63 | `relay/telegramLink.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 64 | `relay/telegramWebhook.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 65 | `legal/digitalSignature.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 66 | `legal/mechanicalLicense.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 67 | `legal/pandadocProxy.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 68 | `legal/pandadocWebhook.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 69 | `assets/auditReleaseArtwork.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 70 | `email/sendEmail.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 71 | `email/tokenManager.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 72 | `analytics/platformTokenExchange.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 73 | `stripe/connect.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 74 | `stripe/escrow.ts` | `onRequest` | `verified-free` | Yes | PROTECTED |
| 75 | `stripe/paymentLinks.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 76 | `stripe/splitEscrow.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 77 | `stripe/taxForms.ts` | `onCall` | `verified-free` | Yes | PROTECTED |
| 78 | `stripe/webhookHandler.ts` | `onRequest` | `anonymous-signup` | Yes | PROTECTED |
| 79 | `factory.ts` | Abstraction Helper | N/A (Factory Module) | No | EXEMPT (Factory Helper) |

---

## 2. Internal-Only Trigger Exemptions Matrix (21 Files)

The following 21 files declare internal-only Cloud Functions triggers (`onSchedule`, Firestore triggers, Storage event triggers, Cloud Task handlers). Because these functions are invoked exclusively by GCP infrastructure and Cloud Scheduler/Cloud Tasks (and cannot be reached by external client requests), HTTP request protection is inapplicable. Binding `ARCJET_KEY` as a secret is explicitly avoided to prevent unnecessary secret noise.

| # | File Path | Internal Trigger Type | Exemption Rationale | Secret Binding |
|---|---|---|---|---|
| 1 | `publishing/iswc.ts` | Firestore (`onDocumentUpdated`) | Invoked automatically by Firestore document mutation. No HTTP or client caller. | Omitted |
| 2 | `publishing/iswcMapper.ts` | Firestore (`onDocumentCreated`) | Invoked automatically by Firestore document mutation. No HTTP or client caller. | Omitted |
| 3 | `devops/storageMaintenance.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered internal maintenance worker executed by GCP Cloud Scheduler. | Omitted |
| 4 | `daemons/retention-daemon.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered data retention worker executed by GCP Cloud Scheduler. | Omitted |
| 5 | `distribution/pollDeliveryStatus.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered delivery status poller executed by GCP Cloud Scheduler. | Omitted |
| 6 | `distribution/processDDEXAck.ts` | Cloud Storage (`onObjectFinalized`) | Eventarc storage trigger executed when DDEX acknowledgment files land in Storage. | Omitted |
| 7 | `social/deliverScheduledPosts.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered scheduled post delivery worker executed by GCP Cloud Scheduler. | Omitted |
| 8 | `orchestration/index.ts` | Firestore (`onDocumentWritten`) | Invoked automatically by workflow document mutation in Firestore. | Omitted |
| 9 | `orchestration/pulseTick.ts` | Cloud Scheduler (`onSchedule`) | System heartbeat tick executed on schedule by GCP Cloud Scheduler. | Omitted |
| 10 | `marketing/flushConversionEvents.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered conversion event flush worker executed by GCP Cloud Scheduler. | Omitted |
| 11 | `functions/video/cleanupVideoSessions.ts` | Cloud Scheduler (`onSchedule`) | Scheduled cleanup task executed by GCP Cloud Scheduler. | Omitted |
| 12 | `functions/video/finalizeVideoSessionUpload.ts` | Cloud Storage (`onObjectFinalized`) | Eventarc storage trigger executed on video file upload completion. | Omitted |
| 13 | `functions/video/settleVideoSessionCost.ts` | Firestore (`onDocumentWritten`) | Invoked automatically by video session document completion state writes. | Omitted |
| 14 | `functions/agent/agentLoopCron.ts` | Cloud Scheduler (`onSchedule`) | Autonomous agent loop heartbeat executed by GCP Cloud Scheduler. | Omitted |
| 15 | `functions/agent/workflowOrchestrator.ts` | Firestore (`onDocumentWritten`) | Invoked automatically by agent workflow execution state writes. | Omitted |
| 16 | `functions/knowledge/indexWorker.ts` | Cloud Tasks (`onTaskDispatched`) | Authenticated private Cloud Task queue worker for Knowledge RAG ingestion. | Omitted |
| 17 | `functions/creative/videoJobOrchestrator.ts` | Firestore (`onDocumentWritten`) | Invoked automatically by video job state changes in Firestore. | Omitted |
| 18 | `functions/analytics/bigquery-pipeline.ts` | Cloud Scheduler (`onSchedule`), Firestore (`onDocumentCreated`) | Internal analytics sync pipeline executed by Cloud Scheduler & document triggers. | Omitted |
| 19 | `relay/relayCommandProcessor.ts` | Firestore (`onDocumentCreated`) | Invoked automatically by relay command queue writes in Firestore. | Omitted |
| 20 | `timeline/onMilestoneScheduled.ts` | Firestore (`onDocumentWritten`) | Invoked automatically by milestone document updates in Firestore. | Omitted |
| 21 | `timeline/pollTimelineMilestones.ts` | Cloud Scheduler (`onSchedule`) | Cron-triggered timeline milestone poller executed by GCP Cloud Scheduler. | Omitted |

---

## 3. Policy & Runtime Enforcement Rules

1. **Secret Mounting:** `ARCJET_KEY` is mounted **only** via `secrets: [arcjetKey]` on client-callable HTTP/callable Cloud Function definitions.
2. **Fail-Closed Security:** Unavailable configuration or decision errors fail closed with a structured HTTP 503 (`SECURITY_UNAVAILABLE`) or HttpsError `unavailable`.
3. **No External Client Impersonation:** Arcjet policy classes (`verified-free`, `paid`, `founder`, `admin`, `byo-api`) are derived on the server from Firebase Auth and server-owned entitlement state.
