// indii.music Cloud Functions - V1.1 (all triggers on Gen2 as of ISSUE-1243)
import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";
import { decisionToJobMetadata, planRenderRoute } from '@indii/shared';
import type { IndiiVideoProject } from '@indii/shared';

// Initialize Firebase Admin immediately to prevent race conditions during import analysis
admin.initializeApp();

import { setGlobalOptions } from "firebase-functions/v2";
// Fix: Increase default memory limit to prevent OOM errors in heavy Genkit/GenAI functions
setGlobalOptions({ memory: "512MiB" });

// Phase 2a: Agent Streaming (v2 - SSE support for Phase 2 orchestration)
export { agentStreamResponse, agentStreamHealth } from './streaming/agentStream';
import { serve } from "inngest/express";
import corsLib from "cors";
import { normalizeVeoDuration, resolveVeoModel, VideoJobSchema } from "./lib/video";

import { GenerateSpeechRequestSchema } from "./lib/audio";
import { verifyMasterAudioObject } from './functions/storage/verifyMasterAudio';
import {
    CanonicalRenderMasterError,
    parseProjectCanonicalMaster,
    parseProjectCanonicalVideoSegments,
    resolveVerifiedRenderMaster,
} from './functions/video/renderMasterContract';


import { executeWorkflowStepFn } from "./functions/agent/executeWorkflowStep";
import { campaignWaterfallFn } from "./lib/campaign_waterfall";
import { canvasRenderFn } from "./lib/canvas_render";
import { LongFormVideoJobSchema, generateLongFormVideoFn, stitchVideoFn } from "./lib/long_form_video";
import { generateVideoDirect } from "./lib/video_generation_direct";
import { executeMilestoneFn } from "./timeline/milestone_execution";
import { editImageFn } from "./lib/image_generation";
export { generateImageV3, generateVideoV3, generateOmniRemixV3, generateAudioV3 } from "./functions/creative/gateway";
import { recordUsage } from "./functions/creative/gateway";
export { getOperationCostHistory, getOperationCostStatus, voidAgentStreamCostReservation, voidVideoCostReservation } from "./functions/billing/enforceOperationCost";
export { cancelVideoJob } from "./functions/creative/gateway";
export { videoJobFirestoreOrchestrator } from "./functions/creative/videoJobOrchestrator";
export { getMediaDuration } from "./functions/creative/getMediaDuration";
export { createVideoSession } from "./functions/video/createVideoSession";
export { queueCloudVideoRender } from "./functions/video/queueCloudVideoRender";
export { dispatchCloudVideoRender } from "./functions/video/dispatchCloudVideoRender";
export { getVideoRenderReceipt } from "./functions/video/getVideoRenderReceipt";
export { cancelVideoSession } from "./functions/video/cancelVideoSession";
export { finalizeVideoSessionUpload } from "./functions/video/finalizeVideoSessionUpload";
export { retrySessionProxyJob } from "./functions/video/retrySessionProxyJob";
export { settleVideoSessionCost } from "./functions/video/settleVideoSessionCost";
export { reclaimStuckVideoJobs } from "./functions/video/reclaimStuckVideoJobs";
export { cleanupExpiredVideoSessions } from "./functions/video/cleanupVideoSessions";
export { alignSessionMaster } from "./functions/video/alignSessionMaster";
export { generateSessionEditPlan } from "./functions/video/generateSessionEditPlan";
export { applyAudioRecipe } from "./functions/video/applyAudioRecipe";
export { approveSessionEditPlan } from "./functions/video/approveSessionEditPlan";
export { createSocialHandoffDraft } from "./functions/video/createSocialHandoffDraft";
import { analyzeAudioFn } from "./lib/audio";
import { assertVideoSessionProjectAccess } from "./functions/video/createVideoSession";
import { FUNCTION_INTELLIGENCE_MODELS } from "./config/models";
import { isApprovedFineTunedTextEndpoint, isApprovedTextStreamModel } from './config/textStreamModels';
import { arcjetKey, clearbitApiKey, apolloApiKey, getClearbitApiKey, getApolloApiKey } from "./config/secrets";

import { estimateTranscoderRenderCost, estimateVideoCost } from "./config/pricing";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
import { requireVerifiedEmailV2, validateAppCheckHttp, validateAppCheckV2 } from "./middleware/appCheck";
import { entitlementTierToBudgetTier, requireVerifiedServerEntitlement } from './functions/auth/entitlements';
import { checkOperationBudget, claimOperationReservation, finalizeOperationReservation } from './functions/billing/enforceOperationCost';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from './functions/security/arcjet';
import { requireVerifiedCreativeAdmission } from './functions/creative/legacyAdmission';
import { clampTextStreamOutputTokens } from './functions/creative/textStreamAdmission';
import { resolveVertexEndpointResource } from './lib/vertexRouting';
import {
    classifySpecialistFailure,
    SpecialistUnavailableError,
} from './lib/specialistAvailability';


// Vertex AI SDK
// import { VertexAI } from "@google-cloud/vertexai";
// Item 335: GoogleGenAI is loaded lazily inside the handler to reduce cold start time
// import { GoogleGenAI } from "@google/genai";

// Polyfill for v1 Firebase Functions migrating to modern Node/Gen 2
if (!process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "indii-music-founder";
}
import * as crypto from "crypto";


// Admin Functions
export { setGodMode } from './functions/admin/setGodMode';

// Auth Handoff Functions (Item 518: Cross-device secure auth)
export { createHandoffCode, redeemHandoffCode } from './functions/auth/handoff';
export { provisionVerifiedFreeEntitlement } from './functions/auth/entitlements';
export { mintElectronAppCheckToken } from './functions/auth/mintElectronAppCheckToken';

// Agent Functions (Bug Reporting)
export { reportBugFn } from './functions/agent/reportBugFn';
export { workflowOrchestrator } from './functions/agent/workflowOrchestrator';
export { manageSemanticMemory, batchEmbedText } from './functions/agent/manageSemanticMemory';
export { agentLoopCron } from './functions/agent/agentLoopCron';
export { getCapabilitySnapshot } from './functions/agent/getCapabilitySnapshot';
export { recordPersonaResponseMeasurement } from './functions/persona/recordPersonaResponseMeasurement';

// Security Functions
export { persistFraudAlert } from './functions/security/persistFraudAlert';
export { logAuditEvent } from './functions/security/logAuditEvent';
export { getOrganizationAccessMatrix, updateOrganizationMemberAccess } from './functions/security/organizationAccess';
export { registerAiContextCache, recordInstrumentUsage } from './functions/security/writeSharedOperationalData';

// REST API Router
export {
    getTrack,
    createTrack,
    queryAnalytics,
    updateTrack,
    deleteTrack,
    listTracks,
    createDistribution,
    getDistribution,
    submitDistribution,
    getProfile,
    health,
} from './functions/api/router';

// Stripe Connect Functions
export { createStripeAccount, createStripeConnectAccount, createTransfer } from './stripe/connect';

// Stripe Split Escrow (Item 135)
export { initiateSplitEscrow, signEscrow, releaseEscrow } from './stripe/splitEscrow';

export { requestTaxForms } from './stripe/taxForms';

// Finance Functions (server-owned DSR/earnings ledger writes)
export { ingestEarningsReport } from './functions/finance/ingestEarningsReport';
export { calculateRoyaltyAllocations } from './functions/finance/calculateRoyaltyAllocations';
export { setRecoupmentBalance } from './functions/finance/setRecoupmentBalance';

// Tax Form Collection (ISSUE-1118 Phase 2: collaborator self-serve upload link)
export { requestTaxFormUpload } from './functions/finance/requestTaxFormUpload';
export { submitTaxForm } from './functions/finance/submitTaxForm';

// Distribution Functions (Item 218: Delivery Status Polling)
export { pollDeliveryStatus } from './distribution/pollDeliveryStatus';

// Distribution Functions (Item 415: DDEX DSP Acknowledgement Processing)
export { processDDEXAck } from './distribution/processDDEXAck';
export {
    assignDistributionIdentifier,
    recordDistributionIdentifier,
    recordDistributionAuditEvent,
    requestDistributionTakedown,
    createSftpIngestionRecord,
    updateSftpIngestionRecord,
} from './functions/distribution/distributionRecords';

// Rights Functions (ISSUE-655: provider registration queued server-side; renderer never touches provider credentials)
export { queueRightsRegistration } from './functions/rights/queueRightsRegistration';

// Legal Functions (Item 412: Split Sheet PDF Export)
export { exportSplitSheet } from './legal/exportSplitSheet';

export { sendForDigitalSignature } from './legal/digitalSignature';
export { verifyMechanicalLicense } from './legal/mechanicalLicense';

// Legal Functions (Item 242: PandaDoc Proxy — API key secured server-side)
export {
    pandadocListTemplates,
    pandadocCreateDocument,
    pandadocSendDocument,
    pandadocGetDocumentStatus,
    pandadocGetSigningLink,
} from './legal/pandadocProxy';

// Legal Functions: PandaDoc Webhook (contract signed → career event → auto-pipeline)
export { pandadocWebhook } from './legal/pandadocWebhook';

// Publishing Functions: ISWC Mapper (PandaDoc → composition registration)
// Re-exported as V2 alias to avoid collision with the old HTTPS-triggered version
// that may still be deployed. Once the old `processISWCMapping` is deleted from GCP
// console (firebase functions:delete processISWCMapping), rename this back.
export { processISWCMapping as processISWCMappingV2 } from './publishing/iswcMapper';

// Social Functions (Item 226: Scheduled Post Background Delivery)
export { deliverScheduledPosts } from './social/deliverScheduledPosts';
export { refreshSocialToken } from './social/refreshTokenCallable';

// Timeline Orchestrator (Progressive Campaign Engine — polls every 15 min for due milestones)
export { pollTimelineMilestones } from './timeline/pollTimelineMilestones';
export { pulseTick } from './orchestration/pulseTick';
export { onMilestoneScheduled } from './timeline/onMilestoneScheduled';
export { retentionDaemon } from './daemons/retention-daemon';

// Email OAuth Token Manager (Gmail / Outlook — server-side token exchange & refresh)
export { emailExchangeToken, emailRefreshToken, emailRevokeToken } from './email/tokenManager';

// Email Delivery Service (Resend — transactional emails, contract PDFs, notifications)
export { sendEmail } from './email/sendEmail';

// Growth Intelligence Engine — Platform Analytics OAuth (Spotify, TikTok, Instagram)
export { analyticsExchangeToken, analyticsFinalizeInstagramConnection, analyticsGetConnectionStatus, analyticsRefreshToken, analyticsRevokeToken, auditInstagramConnectionCallable } from './analytics/platformTokenExchange';
export { sendInstagramMessageCallable, replyInstagramCommentCallable, getInstagramMediaCommentsCallable } from './social/instagramMessaging';
export { syncPlatformStats } from './functions/social-stats-sync';

// Growth Intelligence Engine — Autonomous Marketing Swarm (ClickHouse read path)
export { marketingGetCampaignMetrics } from './marketing/campaignMetricsCallable';

// Attribution spine — smart-link redirect, conversion outbox flusher, presave registration, and webhooks
export { smartLinkRedirect } from './marketing/smartLink';
export { flushConversionEvents } from './marketing/flushConversionEvents';
export { presaveRegister } from './marketing/presaveRegister';
export { createPreSaveCampaign, getPreSaveCampaign, listPreSaveCampaigns } from './marketing/presaveCampaigns';
export { sendWebhookOnEvent, processWebhookQueue, createWebhook } from './functions/webhooks/dispatcher';
export { shopifyWebhook } from './marketing/shopifyWebhook';

// Storage Maintenance (Scheduled — orphan cleanup, quota tracking, archival flagging, temp cleanup)
export { cleanupExpiredVideoTemps, cleanupOrphanedVideos, trackStorageQuotas, flagVideosForArchival } from './devops/storageMaintenance';
export { fetchStorageAssetForCanvas } from './functions/storage/fetchStorageAssetForCanvas';
export { verifyMasterAudio } from './functions/storage/verifyMasterAudio';
export { processAudioIngestion } from './distribution/ingestion';
export { auditReleaseArtworkForDelivery } from './assets/auditReleaseArtwork';

// Remote Relay — Server-Side Agent Processing (replaces desktop-browser-dependent relay)
export { processRelayCommand } from './relay/relayCommandProcessor';
export { issueStudioExecutorLease, publishStudioPresence, releaseStudioPresence, claimStudioCommand, publishStudioResponse, completeStudioCommand } from './functions/remote/issueStudioExecutorLease';

// Billing / Cost Control
export { enforceOperationCost, expireStaleOperationCostReservations } from './functions/billing/enforceOperationCost';

// Telegram Bot Adapter — Phase 2 Multi-Channel (bridges Telegram → Firestore relay)
export { telegramWebhook } from './relay/telegramWebhook';
export { generateTelegramLinkCode, getTelegramLinkStatus } from './relay/telegramLink';

// App Releases (Founder Delivery)
export { generateReleaseDownloadUrl } from './releases/generateDownloadUrl';

// MCP Server Endpoint
export { mcpEndpoint } from './mcp/index';


// App Check enforcement flag — controls whether Firebase App Check tokens are validated.
// PRODUCTION ENABLEMENT (Item 247):
//   1. Set up reCAPTCHA Enterprise in GCP Console for your project.
//   2. Register your app in Firebase Console → App Check → reCAPTCHA Enterprise.
//   3. Add VITE_FIREBASE_APP_CHECK_KEY to your .env and CI secrets.
//   4. App Check is ENFORCED by default in production. To disable in local dev:
//      Set SKIP_APP_CHECK=true in your local .env or GCP Cloud Run environment.
//   5. Deploy: firebase deploy --only functions
//   CAUTION: Requires reCAPTCHA Enterprise configured in Firebase Console for all clients.
/**
 * Security Helper: Validate Organization Access
 *
 * Ensures the authenticated user is a member of the target organization.
 * Prevents IDOR/Injection attacks where users create jobs for orgs they don't belong to.
 */
const validateOrgAccess = async (userId: string, orgId?: string | null) => {
    // 1. Personal workspace and default org are always allowed (scoped to user in logic)
    if (!orgId || orgId === 'personal' || orgId === 'org-default') {
        return;
    }

    // 2. Fetch Organization
    const orgRef = admin.firestore().collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
        throw new HttpsError(
            "not-found",
            `Organization '${orgId}' not found.`
        );
    }

    const orgData = orgDoc.data();
    const members = orgData?.members || [];

    // 3. Verify Membership
    if (!members.includes(userId)) {
        logger.warn(`[Security] User ${userId} attempted to access restricted org ${orgId}`);
        throw new HttpsError(
            "permission-denied",
            "You are not a member of this organization."
        );
    }
};

// Import Shared Secrets
import { inngestEventKey, inngestSigningKey } from "./config/secrets";

// Lazy Initialize Inngest Client — factory lives in lib/inngestClient.ts so
// non-index.ts callers (MCP tools, Inngest step functions) can use it without
// importing this entire file and its admin.initializeApp() side effect.
import { getInngestClient } from "./lib/inngestClient";
export { getInngestClient };

/**
 * Security Helper: Enforce Admin Access
 *
 * Checks if the user has the 'admin' custom claim.
 * If not, logs a warning and throws Permission Denied.
 */
const requireAdmin = (request: CallableRequest) => {
    // 1. Must be authenticated
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated."
        );
    }

    // 2. Must have 'admin' custom claim
    // Note: If no admins exist yet, this securely defaults to deny-all.
    // Use the Firebase Admin SDK or a script to set `admin: true` on specific UIDs.
    if (!request.auth.token.admin) {
        logger.warn(`[Security] Unauthorized access attempt by ${request.auth.uid} (missing admin claim)`);
        throw new HttpsError(
            "permission-denied",
            "Access denied: Admin privileges required."
        );
    }
};

/**
 * CORS Configuration
 *
 * SECURITY: Whitelist specific origins instead of allowing all.
 * This prevents unauthorized websites from calling our Cloud Functions.
 */
const getAllowedOrigins = (): string[] => {
    const origins = [
        'https://indii.music',
        'https://app.indii.music',
        'https://founder.indii.music',
        'https://www.indii.music',
        'https://studio.indii.music',
        'https://indii-music-studio.web.app',
        'https://indii-music-studio.firebaseapp.com',
        'https://indii-music-founder.web.app',
        'https://indii-music-founder.firebaseapp.com',
        'https://indii-studio.firebaseapp.com',
        'app://.',  // Electron app
    ];

    // Add localhost origins in emulator/development mode
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        origins.push(
            'http://localhost:5173',
            'http://localhost:4173',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://localhost:4242'
        );
    }

    return origins;
};

const corsHandler = corsLib({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();

        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        // We rely on ID Token verification (Bearer token) for actual security.
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin is in whitelist
        if (origin && allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Reject unauthorized origins
        logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('CORS not allowed'));
    },
    credentials: true
});

// Polling Constants
// const VIDEO_POLL_INTERVAL_SEC = 5;
// const VIDEO_MAX_POLL_ATTEMPTS = 60;

// ----------------------------------------------------------------------------
// Video Generation (Veo)
// ----------------------------------------------------------------------------

/**
 * Trigger Video Generation Job
 *
 * This callable function acts as the bridge between the Client App (Electron)
 * and the Asynchronous Worker Queue (Inngest).
 */
export const triggerVideoJob = onCall(
    {
        region: "us-central1",
        secrets: [arcjetKey],
        timeoutSeconds: 60,
        memory: "2GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ success: boolean; jobId: string; message: string }> => {
        const data = request.data as unknown;
        const { userId, entitlement } = await requireVerifiedCreativeAdmission(request, 'trigger-video-job');

        // Construct input matching the schema
        const safeData = (typeof data === 'object' && data !== null) ? data : {};
        const inputData: Record<string, unknown> = { ...safeData, userId };

        // Zod Validation
        const validation = VideoJobSchema.safeParse(inputData);
        if (!validation.success) {
            throw new HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        const { prompt, jobId: _clientCorrelationId, orgId, ...options } = validation.data;

        // SECURITY: Verify Org Access
        await validateOrgAccess(userId, orgId);

        // The Firestore-generated ID prevents a browser from selecting or
        // colliding with another artist's worker-triggering record.
        const jobRef = admin.firestore().collection("videoJobs").doc();
        const jobId = jobRef.id;
        let normalizedDuration: ReturnType<typeof normalizeVeoDuration>;
        let normalizedModel: ReturnType<typeof resolveVeoModel>;
        try {
            normalizedDuration = normalizeVeoDuration(options.durationSeconds ?? options.duration);
            normalizedModel = resolveVeoModel(options.model);
        } catch (error) {
            throw new HttpsError(
                "invalid-argument",
                error instanceof Error ? error.message : "Unsupported video generation options.",
            );
        }
        const normalizedOptions = {
            ...options,
            model: normalizedModel.tier,
            durationSeconds: normalizedDuration,
            duration: normalizedDuration,
        };
        const estimatedCost = estimateVideoCost({
            model: normalizedModel.tier,
            durationSeconds: normalizedDuration,
            resolution: (options.resolution as string) ?? undefined,
            generateAudio: (options.generateAudio as boolean) ?? undefined
        });
        const budget = await checkOperationBudget({
            userId,
            entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
            estimatedCost,
            operationType: 'video',
            operationId: `legacy-vertex-video-${jobId}`,
            metadata: { jobId, orgId: orgId || 'personal', source: 'triggerVideoJob' },
        });
        if (!budget.allowed || !budget.operationId) {
            throw new HttpsError(
                'resource-exhausted',
                budget.reason || 'Video generation is unavailable within the current server-side budget.',
            );
        }

        try {
            // This Admin SDK write is the only path that can start the
            // Firestore worker. The reservation is created first and is
            // reconciled by the worker based on provider submission state.
            await jobRef.create({
                id: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompt: prompt,
                status: "queued",
                estimatedCost: estimatedCost,
                costReservationId: budget.operationId,
                options: normalizedOptions,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. That's it — the Firestore document creation above will trigger
            //    executeVideoJob via Firestore onCreate. No self-invocation needed.

            logger.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);

            return { success: true, jobId, message: "Video generation job started." };

        } catch (err: unknown) {
            await finalizeOperationReservation({
                userId,
                operationId: budget.operationId,
                outcome: 'VOIDED',
            }).catch((finalizeError: unknown) => {
                logger.error('[VideoJob] Failed to void an unqueued reservation.', {
                    jobId,
                    message: finalizeError instanceof Error ? finalizeError.message : 'unknown',
                });
            });
            logger.error("[VideoJob] Failed before the worker could start.", {
                jobId,
                message: err instanceof Error ? err.message : 'unknown',
            });
            throw new HttpsError(
                "internal",
                'Failed to queue the video job. No provider work was started.'
            );
        }
    });

/**
 * Execute Video Job (Long-Running)
 *
 * This is the actual video generation worker. It runs the full Vertex AI pipeline
 * directly, bypassing the broken Inngest callback system.
 *
 * Triggered automatically by Firestore onCreate when triggerVideoJob creates
 * a new document in the videoJobs collection.
 * 540s timeout (9 minutes) — enough for Vertex AI video generation + polling.
 */
export const executeVideoJob = onDocumentCreated(
    {
        region: "us-central1",
        document: "videoJobs/{jobId}",
        timeoutSeconds: 540, // 9 minutes
        memory: "2GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (event) => {
        // Gen1 onCreate always delivered a snapshot; Gen2 types it optional.
        if (!event.data) return;
        const snapshot = event.data;
        const context = { params: event.params };
        const jobId = context.params.jobId;
        const data = snapshot.data();

        // Only process documents with status "queued"
        if (data.status !== "queued") {
            logger.log(`[executeVideoJob] Skipping job ${jobId} — status is "${data.status}", not "queued".`);
            return;
        }
        // Typed or versioned jobs are owned by their dedicated workers
        // (videoJobFirestoreOrchestrator for gateway-video-v3, the Inngest
        // daisychain for long_form, the stitch pipeline for render_stitch).
        // The legacy worker handles ONLY untyped, unversioned triggerVideoJob
        // records — anything else it touches it either duplicates (long-form:
        // a second billable Veo run) or auto-fails (render_stitch: no prompt).
        if (data.workerVersion === 'gateway-video-v3' || data.type !== undefined) {
            logger.log(`[executeVideoJob] Skipping job ${jobId} owned by a dedicated worker (type=${String(data.type ?? '')}, version=${String(data.workerVersion ?? '')}).`);
            return;
        }

        const userId = data.userId;
        const prompt = data.prompt;
        const orgId = data.orgId || "personal";
        const options = data.options || {};
        const costReservationId = typeof data.costReservationId === 'string'
            ? data.costReservationId
            : undefined;

        if (!userId || !prompt) {
            logger.error(`[executeVideoJob] Missing required fields for job ${jobId}: userId=${userId}, prompt=${prompt}`);
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: "Missing required fields: userId or prompt",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return;
        }

        logger.log(`[executeVideoJob] Starting video generation for job ${jobId}`);

        // Run the generation
        try {
            await generateVideoDirect({
                jobId,
                userId,
                orgId,
                prompt,
                options,
                costReservationId,
            });
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            // Error is already handled inside generateVideoDirect (Firestore updated to "failed")
            logger.error(`[executeVideoJob] Unhandled error for ${jobId}:`, error);
        }
    });

/**
 * Trigger Long Form Video Generation Job
 *
 * Handles multi-segment video generation (daisychaining) as a background process.
 */
export const triggerLongFormVideoJob = onCall(
    {
        region: "us-central1",
        secrets: [inngestEventKey, arcjetKey],
        timeoutSeconds: 60,
        memory: "2GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ success: boolean; jobId: string; message: string }> => {
        const data = request.data as unknown;
        const { userId, entitlement } = await requireVerifiedCreativeAdmission(request, 'trigger-long-form-video-job');

        // Zod Validation
        const safeData = (typeof data === 'object' && data !== null) ? data : {};
        const jobRef = admin.firestore().collection('videoJobs').doc();
        const jobId = jobRef.id;
        const inputData = { ...safeData, userId, jobId };
        const validation = LongFormVideoJobSchema.safeParse(inputData);

        if (!validation.success) {
            throw new HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        // Destructure validated data
        const { prompts, orgId, startImage, options } = validation.data;

        // SECURITY: Verify Org Access
        await validateOrgAccess(userId, orgId);

        // Additional validation
        if (prompts.length === 0) {
            throw new HttpsError(
                "invalid-argument",
                "Prompts array must not be empty."
            );
        }

        let costReservationId: string | undefined;
        let jobCreated = false;
        let eventDispatchAttempted = false;
        try {
            // The server derives duration from the prompt count. A client
            // cannot understate a long-form request with `totalDuration`.
            const estimatedCostPerSegment = estimateVideoCost({
                model: options.model,
                durationSeconds: 5, // Aligned with DEFAULT_SEGMENT_DURATION_SECONDS in long_form_video.ts
                resolution: options.resolution,
                generateAudio: options.generateAudio
            });
            const totalEstimatedCost = parseFloat((estimatedCostPerSegment * prompts.length).toFixed(4));
            const budget = await checkOperationBudget({
                userId,
                entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
                operationType: 'video',
                estimatedCost: totalEstimatedCost,
                operationId: `long-form-vertex-video-${jobId}`,
                metadata: {
                    jobId,
                    orgId: orgId || 'personal',
                    source: 'triggerLongFormVideoJob',
                    segmentCount: prompts.length,
                    secondsPerSegment: 5,
                },
            });
            if (!budget.allowed || !budget.operationId) {
                throw new HttpsError(
                    'resource-exhausted',
                    budget.reason || 'Long-form video generation is unavailable within the current server-side budget.',
                );
            }
            costReservationId = budget.operationId;

            await jobRef.create({
                id: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompt: prompts[0], // Main prompt
                status: "queued",
                // Typed jobs are excluded from the legacy executeVideoJob
                // worker (see its skip gate); long-form generation is owned
                // exclusively by the Inngest daisychain dispatched below.
                type: "long_form",
                isLongForm: true,
                totalSegments: prompts.length,
                completedSegments: 0,
                estimatedCost: totalEstimatedCost,
                costReservationId,
                options: options,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            jobCreated = true;

            // An interrupted queue acknowledgement may still mean the event
            // was accepted. Record that uncertainty so it is never refunded
            // as if no downstream work could exist.
            eventDispatchAttempted = true;
            const inngest = getInngestClient();
            await inngest.send({
                name: "video/long_form.requested",
                data: {
                    jobId,
                    userId,
                    orgId: orgId || "personal",
                    prompts,
                    totalDuration: prompts.length * 5,
                    startImage,
                    options,
                    costReservationId,
                    timestamp: Date.now(),
                },
                user: { id: userId }
            });

            return { success: true, jobId, message: "Long form video generation started." };

        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            if (jobCreated) {
                await jobRef.set({
                    status: 'failed',
                    error: 'The long-form job could not be queued for processing.',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }).catch(() => undefined);
            }
            if (costReservationId) {
                await finalizeOperationReservation({
                    userId,
                    operationId: costReservationId,
                    outcome: eventDispatchAttempted ? 'SETTLED' : 'VOIDED',
                }).catch(() => undefined);
            }
            logger.error("[LongFormVideoJob] Error:", error);
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError(
                "internal",
                `Failed to queue long form job: ${error.message}`
            );
        }
    });

/**
 * Render Video Composition (Stitching)
 *
 * Receives a project composition from the frontend editor, flattens it,
 * and queues a stitching job via Inngest.
 */
export const renderVideo = onCall(
    {
        region: "us-central1",
        // renderVideo performs a manual Arcjet check after App Check/Auth, so
        // both secrets must be declared on the deployed V1 function. Without
        // ARCJET_KEY this spend-bearing endpoint would correctly fail closed
        // in production, but no authenticated render could ever be admitted.
        secrets: [inngestEventKey, arcjetKey],
        timeoutSeconds: 60,
        memory: "2GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ success: boolean; renderId: string; message: string }> => {
        const data = request.data as unknown;
        validateAppCheckV2(request);

        const userId = requireVerifiedEmailV2(request);
        const entitlement = await requireVerifiedServerEntitlement(userId);
        if (!request.rawRequest) {
            throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
        }
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId,
            policy: policyClassForServerEntitlement({
                tier: entitlement.tier,
                isAdmin: request.auth?.token.admin === true,
            }),
            operationId: `render-video:${Date.now()}`,
        });
        if (!protection.allowed) {
            const code = protection.status === 429
                ? 'resource-exhausted'
                : protection.status === 403
                    ? 'permission-denied'
                    : 'unavailable';
            throw new HttpsError(code, protection.message, {
                code: protection.code,
                ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
            });
        }
        const safeData = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
        const { inputProps } = safeData as { inputProps?: Record<string, unknown> };
        const accessPolicy = safeData.accessPolicy;
        const isPrivateProjectRender = accessPolicy === 'private-project-render.v1';
        if (accessPolicy !== undefined && !isPrivateProjectRender) {
            throw new HttpsError('invalid-argument', 'Unsupported render access policy.');
        }
        const requestedProjectId = isPrivateProjectRender && typeof safeData.projectId === 'string'
            ? safeData.projectId.trim()
            : '';
        const requestedOrganizationId = isPrivateProjectRender && typeof safeData.organizationId === 'string'
            ? safeData.organizationId.trim()
            : '';
        if (
            isPrivateProjectRender
            && (
                !/^[A-Za-z0-9_-]{1,128}$/.test(requestedProjectId)
                || !/^[A-Za-z0-9_-]{1,128}$/.test(requestedOrganizationId)
            )
        ) {
            throw new HttpsError(
                'invalid-argument',
                'Private renders require valid project and organization identities.',
            );
        }
        interface ProjectData {
            width: number;
            height: number;
            fps: number;
            durationInFrames: number;
            tracks: unknown[];
            clips: unknown[];
        }
        const project = inputProps?.project as ProjectData | undefined;

        if (!project || !Array.isArray(project.tracks) || !Array.isArray(project.clips)
            || !Number.isInteger(project.width) || !Number.isInteger(project.height)
            || !Number.isInteger(project.fps) || !Number.isInteger(project.durationInFrames)
            || project.width < 64 || project.width > 4096 || project.height < 64 || project.height > 2160
            || project.fps < 1 || project.fps > 60 || project.durationInFrames < 1) {
            throw new HttpsError(
                "invalid-argument",
                "Invalid project data. Canonical dimensions, frame rate, tracks, and clips are required."
            );
        }

        const jobId = admin.firestore().collection('videoJobs').doc().id;
        const timelineDurationSeconds = project.durationInFrames / project.fps;
        let costReservationId: string | undefined;
        let jobCreated = false;

        try {
            // Project authorization must precede canonical-media inspection,
            // cost reservation, durable queue creation, and provider dispatch.
            if (isPrivateProjectRender) {
                await assertVideoSessionProjectAccess(
                    userId,
                    requestedOrganizationId,
                    requestedProjectId,
                );
            }
            let routeDecision;
            try {
                routeDecision = planRenderRoute({
                    project: project as Pick<IndiiVideoProject, 'clips' | 'tracks'>,
                });
            } catch (error) {
                throw new HttpsError(
                    'invalid-argument',
                    error instanceof Error ? error.message : 'The video project cannot be routed.',
                );
            }
            if (routeDecision.route === 'composed_visual') {
                throw new HttpsError(
                    'failed-precondition',
                    'Cloud composition rendering is not active yet. Use the desktop local renderer or obtain approval to activate the HyperFrames Cloud Run worker.',
                    decisionToJobMetadata(routeDecision),
                );
            }
            if (routeDecision.op === 'trim') {
                throw new HttpsError(
                    'failed-precondition',
                    'Cloud source-range trimming is not active yet. Use the desktop local renderer.',
                    decisionToJobMetadata(routeDecision),
                );
            }
            // Preview URLs are not Transcoder authority. Resolve only canonical
            // project-bucket media owned by this authenticated caller.
            const bucketName = admin.storage().bucket().name;
            const segmentUrls = parseProjectCanonicalVideoSegments(userId, bucketName, project.clips);

            const canonicalMaster = parseProjectCanonicalMaster(userId, project.clips);
            if (isPrivateProjectRender && !canonicalMaster) {
                throw new HttpsError(
                    'failed-precondition',
                    'Private project renders require a verified canonical master.',
                );
            }
            const verifiedMaster = canonicalMaster
                ? await resolveVerifiedRenderMaster(userId, canonicalMaster, {
                    bucketName,
                    verifyMaster: verifyMasterAudioObject,
                })
                : undefined;
            const reservation = await checkOperationBudget({
                userId,
                entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
                operationType: 'video',
                estimatedCost: estimateTranscoderRenderCost({
                    width: project.width,
                    height: project.height,
                    durationSeconds: timelineDurationSeconds,
                    passes: verifiedMaster ? 2 : 1,
                }),
                operationId: `render-stitch-${jobId}`,
                metadata: {
                    renderPasses: verifiedMaster ? 2 : 1,
                    durationSeconds: timelineDurationSeconds,
                    width: project.width,
                    height: project.height,
                    hasCanonicalMaster: !!verifiedMaster,
                },
            });
            if (!reservation.allowed || !reservation.operationId) {
                throw new HttpsError(
                    'resource-exhausted',
                    'Cloud render is unavailable because the account budget or safety limit has been reached.',
                );
            }
            costReservationId = reservation.operationId;

            // 2. Create Job Record (Atomic Create)
            await admin.firestore().collection("videoJobs").doc(jobId).create({
                id: jobId,
                userId: userId,
                orgId: isPrivateProjectRender ? requestedOrganizationId : "personal",
                ...(isPrivateProjectRender ? {
                    projectId: requestedProjectId,
                    accessPolicy: 'private-project-render.v1',
                } : {}),
                status: "queued",
                type: "render_stitch",
                progress: 0,
                clipCount: segmentUrls.length,
                costReservationId,
                timelineDurationSeconds,
                ...decisionToJobMetadata(routeDecision),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            jobCreated = true;

            // 3. Trigger Stitching via Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/stitch.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    segmentUrls: segmentUrls,
                    costReservationId,
                    ...(isPrivateProjectRender ? {
                        privateOutputIdentity: {
                            policy: 'private-project-render.v1',
                            ownerUid: userId,
                            projectId: requestedProjectId,
                            jobId,
                        },
                    } : {}),
                    ...(verifiedMaster ? { masterAudio: verifiedMaster } : {}),
                    audioMix: verifiedMaster
                        ? { mode: 'master_replaces_native', preserveNativeAudio: false }
                        : { mode: 'no_master_audio', preserveNativeAudio: false },
                    options: {
                        resolution: `${project.width}x${project.height}`,
                        timelineDurationSeconds,
                        aspectRatio: project.width > project.height ? "16:9" : "9:16" // Rough approximation
                    },
                    route: decisionToJobMetadata(routeDecision),
                },
                user: { id: userId }
            });

            return { success: true, renderId: jobId, message: "Render job queued." };

        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            if (costReservationId && !jobCreated) {
                try {
                    await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'VOIDED' });
                } catch {
                    logger.warn('[RenderVideo] Reservation reconciliation deferred', { jobId });
                }
            }
            logger.error('[RenderVideo] Failed to queue render', {
                jobId,
                code: error instanceof HttpsError ? error.code : 'internal',
            });
            if (error instanceof HttpsError) throw error;
            if (error instanceof CanonicalRenderMasterError) {
                throw new HttpsError(error.code, error.message);
            }
            throw new HttpsError(
                "internal",
                'Failed to queue the render job. Please retry.'
            );
        }
    });

/**
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
export const inngestApi = onRequest(
    {
        secrets: [inngestSigningKey, inngestEventKey],
        timeoutSeconds: 540, // 9 minutes
        // ffmpeg canvas rendering (canvasRenderFn) needs headroom well beyond
        // the 256MB Gen1 default this function used to inherit.
        memory: "2GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (req, res) => {
        const inngestClient = getInngestClient();

        // 1. Long Form Video Generation Logic (Daisychaining)
        const generateLongFormVideo = generateLongFormVideoFn(inngestClient);

        // 2. Stitching Function (Server-Side using Google Transcoder)
        const stitchVideo = stitchVideoFn(inngestClient);

        // Timeline Orchestrator: Autonomous milestone execution
        const executeMilestone = executeMilestoneFn(inngestClient);

        // Agent Orchestration (offloaded triad execution)
        const executeWorkflowStep = executeWorkflowStepFn(inngestClient);

        // MCP campaign waterfall dispatch (P5, ISSUE-1100)
        const campaignWaterfall = campaignWaterfallFn(inngestClient);

        // MCP canvas render compose (P6, ISSUE-1100)
        const canvasRender = canvasRenderFn(inngestClient);

        const handler = serve({
            client: inngestClient,
            functions: [generateLongFormVideo, stitchVideo, executeMilestone, executeWorkflowStep, campaignWaterfall, canvasRender],
            signingKey: inngestSigningKey.value(),
        });

        return handler(req, res);
    });

// ----------------------------------------------------------------------------
// Image Generation (Gemini)
// ----------------------------------------------------------------------------

// Image Generation v3 (Nano Banana Pro / Gemini 3 Pro Image)
// Deployed to us-central1 with the rest of the Firebase Functions fleet.
export const editImage = editImageFn();
export const analyzeAudio = analyzeAudioFn();

export const generateSpeech = onCall(
    {
        secrets: [arcjetKey], enforceAppCheck: false, timeoutSeconds: 60, memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ audioContent: string }> => {
        const data = request.data as unknown;
        await requireVerifiedCreativeAdmission(request, 'generate-speech');

        const validation = GenerateSpeechRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }
        const { text, voice, model } = validation.data;

        try {
            logger.log(`[generateSpeech] Generating speech with model: ${model}`);
            const modelId = model || FUNCTION_INTELLIGENCE_MODELS.SPEECH.GENERATION;

            // Use Vertex AI SDK (ADC auth, no API key)
            const { getVertexAIClient } = await import('./lib/vertexClient');
            const genai = getVertexAIClient();

            const result = await genai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text }] }],
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice
                        }
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            // Extract audio data from SDK response (direct candidates, no .response wrapper)
            const part = (result?.candidates?.[0]?.content?.parts as unknown[])?.[0] as Record<string, unknown> | undefined;
            const inlineData = part && typeof part === 'object' && 'inlineData' in part ? (part as { inlineData?: { data?: string } }).inlineData : null;
            const b64Data = inlineData?.data || null;

            if (!b64Data) {
                logger.error("[generateSpeech] Unexpected response structure:", JSON.stringify(result));
                throw new Error("No audio content returned from API");
            }

            return { audioContent: b64Data };

        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            logger.error("[generateSpeech] Error:", error);
            throw new HttpsError("internal", error.message || "Speech generation failed");
        }
    });

export const generateContentStream = onRequest(
    {
        secrets: [arcjetKey],
        // CORS preflight must pass; App Check is verified manually below.
        timeoutSeconds: 300,
        // ISSUE-1242: this was the only Arcjet-using function in this file with
        // no explicit `memory`, so it inherited the Gen1 default of 256MB —
        // below the ~259MB shared cold-start bundle. Its outbound HTTPS call to
        // Arcjet then failed under memory pressure, Arcjet returned an errored
        // decision, and the fail-closed gate denied 100% of authenticated AI
        // requests in production. Every sibling here already sets this: the two
        // Inngest+Arcjet functions use "2GiB" and `generateSpeech` — same
        // secrets, same shape — uses "512MiB". This was an omission, not a
        // deliberate tier. The tier stays declared explicitly rather than
        // relying on setGlobalOptions, so the value survives any future change
        // to the global default.
        memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    (req, res) => {
        corsHandler(req, res, async () => {
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return;
            }

            // Verify Authentication
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).send('Unauthorized');
                return;
            }
            const idToken = authHeader.substring(7).trim(); // 'Bearer '.length === 7
            if (!idToken) {
                res.status(401).send('Unauthorized: Missing token');
                return;
            }
            let decodedToken: admin.auth.DecodedIdToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
            } catch (_error) {
                res.status(403).send('Forbidden: Invalid Token');
                return;
            }

            // Streaming text is a paid Vertex operation too. Keep the same
            // verified-email boundary as the media gateway so a disposable,
            // unverified account cannot consume the shared project quota.
            if (decodedToken.email_verified !== true) {
                res.status(403).send('Forbidden: Verify your email before using AI generation.');
                return;
            }

            if (!decodedToken.uid) {
                res.status(403).send('Forbidden: Invalid authenticated user.');
                return;
            }

            // Verify App Check manually after CORS preflight has passed.
            if (!(await validateAppCheckHttp(req, res))) {
                return;
            }

            const rawCostReservationId = req.body?.costReservationId;
            if (typeof rawCostReservationId !== 'string' || !rawCostReservationId.trim() || rawCostReservationId.length > 256) {
                res.status(400).send('Missing or invalid agent-stream cost reservation.');
                return;
            }
            const costReservationId = rawCostReservationId;
            const reservationClaimId = `agent-stream:${crypto.randomUUID()}`;
            try {
                await claimOperationReservation({
                    userId: decodedToken.uid,
                    operationId: costReservationId,
                    operationType: 'agent_stream',
                    claimId: reservationClaimId,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const status = message.includes('owner mismatch') ? 403 : message.startsWith('Missing cost reservation') ? 404 : 409;
                logger.warn('[generateContentStream] Rejected cost reservation', { userId: decodedToken.uid, status, reason: message });
                res.status(status).send(status === 403
                    ? 'Cost reservation does not belong to the authenticated user.'
                    : 'Cost reservation is missing, invalid, or no longer approved.');
                return;
            }

            let reservationFinalized = false;
            let reservationFinalization: Promise<void> | undefined;
            let streamCompleted = false;
            let clientDisconnected = false;
            let cancelProviderStream: (() => void) | undefined;
            res.once?.('close', () => {
                if (!streamCompleted && !res.writableEnded) {
                    clientDisconnected = true;
                    cancelProviderStream?.();
                    void voidAgentStreamReservation('client-cancelled');
                }
            });
            const finalizeAgentStreamReservation = async (outcome: 'SETTLED' | 'VOIDED') => {
                if (reservationFinalization) return reservationFinalization;
                reservationFinalization = (async () => {
                    await finalizeOperationReservation({
                        userId: decodedToken.uid,
                        operationId: costReservationId,
                        outcome,
                        jobId: reservationClaimId,
                        expectedType: 'agent_stream',
                    });
                    reservationFinalized = true;
                })();
                return reservationFinalization;
            };
            const voidAgentStreamReservation = async (reason: string) => {
                if (reservationFinalized) return;
                try {
                    await finalizeAgentStreamReservation('VOIDED');
                } catch (error) {
                    logger.error('[generateContentStream] Failed to void agent-stream reservation', {
                        userId: decodedToken.uid,
                        reason,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            };

            let entitlement: Awaited<ReturnType<typeof requireVerifiedServerEntitlement>>;
            try {
                entitlement = await requireVerifiedServerEntitlement(decodedToken.uid);
                const protection = await protectAuthenticatedApiRequest(req as never, {
                    userId: decodedToken.uid,
                    policy: policyClassForServerEntitlement({
                        tier: entitlement.tier,
                        isAdmin: decodedToken.admin === true,
                    }),
                    operationId: `generate-content-stream:${crypto.randomUUID()}`,
                });
                if (!protection.allowed) {
                    await voidAgentStreamReservation('arcjet-denied');
                    res.status(protection.status).send(protection.message);
                    return;
                }
            } catch (error) {
                // Read the code off the error object rather than narrowing by
                // class. This is robust to any thrown shape that carries a
                // `code`, including non-HttpsError rejections from the
                // admission path.
                //
                // A previous version of this comment attributed the original
                // mislabelling to v1 and v2 having separate HttpsError classes.
                // That is false and was retracted in 94d3a30a6:
                // firebase-functions re-exports ONE class from
                // common/providers/https to both entry points, so
                // `v1.https.HttpsError === v2.HttpsError` and instanceof
                // matches either way.
                const errCode = (error as { code?: unknown })?.code;
                console.error('[generateContentStream] Server admission failed:', error, {
                    code: typeof errCode === 'string' ? errCode : 'internal',
                    err_msg: error instanceof Error ? error.message : String(error),
                    err_stack: error instanceof Error ? error.stack : undefined,
                });
                await voidAgentStreamReservation('server-admission-failed');
                res.status(503).send('AI generation admission is temporarily unavailable.');
                return;
            }

            try {
                await enforceRateLimit(decodedToken.uid, 'generateContentStream', RATE_LIMITS.generation);
            } catch (error) {
                const code = (error as { code?: unknown })?.code;
                if (code === 'resource-exhausted') {
                    logger.warn('[generateContentStream] Application generation limit reached.', {
                        category: 'application_rate_limit',
                        providerSubmitted: false,
                        retryAfterSeconds: 60,
                    });
                    await voidAgentStreamReservation('rate-limited');
                    res.status(429).json({
                        error: {
                            code: 'GENERATION_CAPACITY_LIMITED',
                            // ISSUE-1366: the old message ("Boardroom is temporarily
                            // at capacity") described a rate limit as an outage and
                            // the founder could not tell what went wrong. Say what
                            // actually happened and what to do.
                            message: 'Too many AI requests in the last minute. Please wait about 60 seconds and try again.',
                            retryable: true,
                            retryAfterSeconds: 60,
                            category: 'application_rate_limit',
                            nextActions: ['retry_after_wait'],
                            providerSubmitted: false,
                        },
                    });
                    return;
                }
                logger.error('[generateContentStream] Rate-limit check failed:', error);
                await voidAgentStreamReservation('rate-limit-unavailable');
                res.status(503).send('AI generation admission is temporarily unavailable.');
                return;
            }

            try {
                const { model, contents, config: rawConfig } = req.body ?? {};
                if (!Array.isArray(contents) || contents.length === 0 || contents.length > 32) {
                    await voidAgentStreamReservation('invalid-contents');
                    res.status(400).send('Invalid content payload.');
                    return;
                }
                if (JSON.stringify(contents).length > 200_000) {
                    await voidAgentStreamReservation('oversized-contents');
                    res.status(413).send('Content payload is too large.');
                    return;
                }
                if (rawConfig !== undefined && (typeof rawConfig !== 'object' || rawConfig === null || Array.isArray(rawConfig))) {
                    await voidAgentStreamReservation('invalid-config');
                    res.status(400).send('Invalid generation configuration.');
                    return;
                }
                const config = { ...(rawConfig ?? {}) } as Record<string, unknown>;
                config.maxOutputTokens = clampTextStreamOutputTokens(config.maxOutputTokens, entitlement.tier);
                if (model !== undefined && (typeof model !== 'string' || !model.trim() || model.length > 256)) {
                    await voidAgentStreamReservation('invalid-model');
                    res.status(400).send('Invalid or unauthorized model ID.');
                    return;
                }
                const modelId = model || "gemini-3.1-pro-preview";

                // SECURITY: strict server-owned allowlist. A resource-path
                // regex is not authorization: an altered browser could point
                // at an unrelated Vertex endpoint and spend project capacity.
                if (!isApprovedTextStreamModel(modelId)) {
                    logger.warn(`[Security] Blocked unauthorized model access: ${modelId}`);
                    await voidAgentStreamReservation('unauthorized-model');
                    res.status(400).send('Invalid or unauthorized model ID.');
                    return;
                }

                // Initialize Vertex AI Client lazily (ADC auth, no API key).
                const { getVertexAIClient } = await import("./lib/vertexClient");
                const isFineTunedEndpoint = isApprovedFineTunedTextEndpoint(modelId);
                if (process.env.DISABLE_FINE_TUNED === 'true' && isFineTunedEndpoint) {
                    const unavailable = new SpecialistUnavailableError(
                        'routing_misconfiguration',
                        false,
                        new Error('Specialized routing is disabled by server policy.'),
                    );
                    logger.error('[generateContentStream] Specialist request blocked before provider call.', {
                        category: unavailable.category,
                        code: unavailable.code,
                        reason: 'DISABLE_FINE_TUNED',
                    });
                    await voidAgentStreamReservation('specialist-disabled');
                    res.status(503).json(unavailable.toPublicPayload());
                    return;
                }

                let client: ReturnType<typeof getVertexAIClient>;
                let finalModelId = modelId;
                if (isFineTunedEndpoint) {
                    try {
                        const route = resolveVertexEndpointResource(modelId);
                        client = getVertexAIClient(route.project, route.location);
                        // Preserve the complete resource identity so the SDK does
                        // not rewrite it as a publisher model.
                        finalModelId = route.resourceName;
                        logger.info('[generateContentStream] Specialist route resolved.', {
                            routeKind: route.kind,
                            location: route.location,
                        });
                    } catch (routingError: unknown) {
                        const unavailable = classifySpecialistFailure(routingError);
                        logger.error('[generateContentStream] Specialist routing failed closed.', {
                            category: unavailable.category,
                            code: unavailable.code,
                            causeCode: routingError && typeof routingError === 'object' && 'code' in routingError
                                ? (routingError as { code: unknown }).code
                                : undefined,
                        });
                        await voidAgentStreamReservation('specialist-routing-failed');
                        res.status(503).json(unavailable.toPublicPayload());
                        return;
                    }
                } else {
                    client = getVertexAIClient();
                }

                // Generate Content Stream.
                // Pull the first chunk before sending headers. For a specialized
                // request, every provider failure returns a typed unavailable
                // outcome; the prompt is never sent to a general model.
                const openStream = (modelToUse: string, clientToUse: typeof client) =>
                    clientToUse.models.generateContentStream({
                        model: modelToUse,
                        contents: contents, // SDK accepts standard Content format
                        config: config
                    });

                if (clientDisconnected) throw new Error('Client disconnected before provider submission.');
                type ContentStream = Awaited<ReturnType<typeof openStream>>;
                type ContentChunk = ContentStream extends AsyncIterable<infer C> ? C : never;
                let iterator: AsyncIterator<ContentChunk>;
                let firstResult: IteratorResult<ContentChunk>;
                try {
                    const stream = await openStream(finalModelId, client);
                    iterator = stream[Symbol.asyncIterator]();
                    cancelProviderStream = () => {
                        void iterator.return?.().catch((cancelError: unknown) => {
                            logger.warn('[generateContentStream] Provider stream cancellation failed.', cancelError);
                        });
                    };
                    if (clientDisconnected) {
                        cancelProviderStream();
                        throw new Error('Client disconnected before provider submission.');
                    }
                    firstResult = await iterator.next();
                } catch (streamErr: unknown) {
                    if (isFineTunedEndpoint) {
                        const unavailable = classifySpecialistFailure(streamErr);
                        logger.error('[generateContentStream] Specialist provider request failed closed.', {
                            category: unavailable.category,
                            code: unavailable.code,
                            retryable: unavailable.retryable,
                        });
                        await voidAgentStreamReservation('specialist-provider-failed');
                        res.status(503).json(unavailable.toPublicPayload());
                        return;
                    }
                    throw streamErr;
                }

                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // Replay the already-pulled first chunk, then drain the rest of the stream.
                const replayStream = (async function* () {
                    if (!firstResult.done) yield firstResult.value;
                    while (true) {
                        if (clientDisconnected) {
                            await iterator.return?.();
                            throw new Error('Client disconnected before the stream completed.');
                        }
                        const next = await iterator.next();
                        if (next.done) break;
                        yield next.value;
                    }
                })();

                // ISSUE-1383: the chat meter was stuck at 0 because nothing
                // ever wrote chat_tokens to the usage ledger. The SDK reports
                // cumulative usageMetadata on the final chunk; take the max
                // seen so a partial stream still records what actually ran.
                let streamTotalTokens = 0;
                try {
                    // Iterate over SDK Stream
                    for await (const chunk of replayStream) {
                        const chunkTokens = (chunk as { usageMetadata?: { totalTokenCount?: number } }).usageMetadata?.totalTokenCount ?? 0;
                        if (chunkTokens > streamTotalTokens) streamTotalTokens = chunkTokens;
                        const parts = (chunk.candidates?.[0]?.content?.parts || []) as Record<string, unknown>[];
                        const text = typeof chunk.text === 'string'
                            ? chunk.text
                            : parts
                                .map((part) => typeof part.text === 'string' ? part.text : '')
                                .join('');
                        const functionCalls = parts
                            .filter((part) => Boolean(part.functionCall))
                            .map((part) => part.functionCall);
                        const thoughtSignature = parts.find((part) => Boolean(part.thoughtSignature))?.thoughtSignature as string | undefined;

                        if (text || functionCalls.length > 0 || thoughtSignature) {
                            const payload: { text?: string; functionCalls?: unknown[]; thoughtSignature?: string } = {};
                            if (text) payload.text = text;
                            if (functionCalls.length > 0) payload.functionCalls = functionCalls;
                            if (thoughtSignature) payload.thoughtSignature = thoughtSignature;
                            res.write(JSON.stringify(payload) + '\n');
                        }
                    }
                } catch (streamErr: unknown) {
                    if (isFineTunedEndpoint) {
                        const unavailable = classifySpecialistFailure(streamErr);
                        logger.error('[generateContentStream] Specialist stream interrupted.', {
                            category: unavailable.category,
                            code: unavailable.code,
                            retryable: unavailable.retryable,
                        });
                        // Headers may already be committed, so emit the same typed
                        // contract as a terminal NDJSON record. The renderer rejects
                        // the response instead of claiming partial specialist work.
                        res.write(JSON.stringify(unavailable.toPublicPayload()) + '\n');
                        await voidAgentStreamReservation('specialist-stream-interrupted');
                        res.end();
                        return;
                    }
                    throw streamErr;
                }

                if (clientDisconnected) throw new Error('Client disconnected before the stream completed.');
                await finalizeAgentStreamReservation('SETTLED');
                // ISSUE-1383: record the chat tokens actually consumed into the
                // usage ledger so the meter moves. Non-blocking: a metering
                // failure must never fail a successful stream (recordUsage
                // already swallows and logs its own errors).
                if (streamTotalTokens > 0) {
                    void recordUsage(decodedToken.uid, 'chat_tokens', streamTotalTokens);
                }
                if (clientDisconnected) return;
                res.write(JSON.stringify({ complete: true }) + '\n');
                streamCompleted = true;
                res.end();

            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error("[generateContentStream] Error:", error);
                await voidAgentStreamReservation(clientDisconnected ? 'client-cancelled' : 'stream-failed');
                if (!res.headersSent) {
                    res.status(500).send(error.message);
                } else {
                    res.end();
                }
            }
        });
    });

export const ragProxy = onRequest(
    {
        // App Check is verified manually after corsHandler so the CORS
        // preflight can pass; v2 onRequest has no enforceAppCheck option.
        timeoutSeconds: 60,
        // Declared 512MiB rather than left implicit. The Gen1 original pinned
        // nothing and so ran at 256MB, below this project's cold-start floor
        // (ISSUE-1242).
        memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    (req, res) => {
        corsHandler(req, res, async () => {
            // Verify Authentication
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).send('Unauthorized');
                return;
            }
            const idToken = authHeader.substring(7).trim(); // 'Bearer '.length === 7
            if (!idToken) {
                res.status(401).send('Unauthorized: Missing token');
                return;
            }
            try {
                await admin.auth().verifyIdToken(idToken);
            } catch (_error) {
                res.status(403).send('Forbidden: Invalid Token');
                return;
            }

            // Verify App Check manually after CORS preflight has passed
            if (!(await validateAppCheckHttp(req, res))) {
                return;
            }

            // The old implementation proxied arbitrary File API routes using a
            // Developer API key. That created an unauditable second billing and
            // authorization boundary. It is deliberately disabled until the
            // equivalent owner-scoped Cloud Storage + Vertex RAG service ships.
            res.status(503).send({
                code: 'VERTEX_RAG_MIGRATION_REQUIRED',
                error: 'Document retrieval is temporarily unavailable while it is migrated to the secure Vertex AI pipeline.',
            });
        });
    });

// ----------------------------------------------------------------------------
// DevOps Tools - GKE & GCE Management
// ----------------------------------------------------------------------------

import * as gkeService from './devops/gkeService';
import * as gceService from './devops/gceService';
import * as bigqueryService from './analytics/bigqueryService';
import * as touringService from './lib/touring';
import * as marketingService from './lib/marketing';



/**
 * List GKE Clusters
 */
export const listGKEClusters = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 30, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.listClusters(projectId);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

// ----------------------------------------------------------------------------
// Road Manager (Touring)
// ----------------------------------------------------------------------------

export const generateItinerary = touringService.generateItinerary;
export const checkLogistics = touringService.checkLogistics;
export const findPlaces = touringService.findPlaces;

// Marketing
export const executeCampaign = marketingService.executeCampaign;
export const dispatchSocialPost = marketingService.dispatchSocialPost;
export const createInfluencerBounty = marketingService.createInfluencerBounty;

/**
 * Get GKE Cluster Status
 */
export const getGKEClusterStatus = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 30, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        const data = request.data as { location: string; clusterName: string };
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.getClusterStatus(projectId, data.location, data.clusterName);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

/**
 * Scale GKE Node Pool
 */
export const scaleGKENodePool = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 60, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        const data = request.data as { location: string; clusterName: string; nodePoolName: string; nodeCount: number };
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.scaleNodePool(projectId, data.location, data.clusterName, data.nodePoolName, data.nodeCount);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

/**
 * List GCE Instances
 */
export const listGCEInstances = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 30, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gceService.listInstances(projectId);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

/**
 * Restart GCE Instance
 */
export const restartGCEInstance = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 60, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        const data = request.data as { zone: string; instanceName: string };
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gceService.resetInstance(projectId, data.zone, data.instanceName);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

// ----------------------------------------------------------------------------
// BigQuery Analytics
// ----------------------------------------------------------------------------
export { batchEventsScheduled, streamEventOnCreate } from './functions/analytics/bigquery-pipeline';


/**
 * Execute BigQuery Query
 */
export const executeBigQueryQuery = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 120, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        const data = request.data as { query: string; maxResults?: number };
        validateAppCheckV2(request);
        requireAdmin(request);

        if (!data.query) {
             throw new HttpsError('invalid-argument', 'Query is required.');
        }

        try {
            const bigquery = new BigQuery();
            const [job] = await bigquery.createQueryJob({
                query: data.query,
                maximumBytesBilled: "100000000" // 100MB cost limit
            });
            const [rows] = await job.getQueryResults({
                maxResults: data.maxResults || 100
            });
            return { rows };
        } catch (error: unknown) {
            console.error('[executeBigQueryQuery] failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpsError('internal', `BigQuery execution failed: ${message}`);
        }
    });

/**
 * Get BigQuery Table Schema
 */
export const getBigQueryTableSchema = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 30, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        const data = request.data as { datasetId: string; tableId: string };
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await bigqueryService.getTableSchema(projectId, data.datasetId, data.tableId);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

/**
 * List BigQuery Datasets
 */
export const listBigQueryDatasets = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 30, memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        validateAppCheckV2(request);
        requireAdmin(request);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await bigqueryService.listDatasets(projectId);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new HttpsError('internal', error.message);
        }
    });

// ----------------------------------------------------------------------------
// Subscription Functions (Gen 2)
// ----------------------------------------------------------------------------
import { getSubscription } from "./subscription/getSubscription";
import { createCheckoutSession } from "./subscription/createCheckoutSession";
import { createOneTimeCheckout } from "./subscription/createOneTimeCheckout";
import { generateInvoice } from "./subscription/generateInvoice";
import { cancelSubscription } from "./subscription/cancelSubscription";
import { resumeSubscription } from "./subscription/resumeSubscription";
import { getCustomerPortal } from "./subscription/getCustomerPortal";
import { getUsageStats } from "./subscription/getUsageStats";
import { trackUsage } from "./subscription/trackUsage";
import { stripeWebhook } from "./stripe/webhookHandler";
import { activateFounderPass } from "./subscription/activateFounderPass";
import { createMicroTransaction } from "./subscription/createMicroTransaction";
import { createMarketplaceCheckout } from "./marketplace/createMarketplaceCheckout";
import { getStemDownloadUrl } from "./marketplace/getStemDownloadUrl";

export {
    getSubscription,
    createCheckoutSession,
    createOneTimeCheckout,
    createMarketplaceCheckout,
    getStemDownloadUrl,
    generateInvoice,
    cancelSubscription,
    resumeSubscription,
    getCustomerPortal,
    getUsageStats,
    trackUsage,
    stripeWebhook,
    activateFounderPass,
    createMicroTransaction
};

// ----------------------------------------------------------------------------
// Health Check Endpoint
// ----------------------------------------------------------------------------

/**
 * GDPR Data Export - Returns all user data as a JSON bundle.
 *
 * Collects data from: user profile, projects, history, brand assets,
 * knowledge base entries, and metadata. Does NOT include binary files
 * (images/audio stored in Cloud Storage) - those URLs are included.
 */
export const exportUserData = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 120, memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<Record<string, unknown>> => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Authentication required.");
        }

        const userId = request.auth.uid;
        const db = admin.firestore();
        const exportData: Record<string, unknown> = {
            exportedAt: new Date().toISOString(),
            userId,
            email: request.auth.token.email || null,
        };

        // User profile
        try {
            const profileSnap = await db.collection("users").doc(userId).get();
            exportData.profile = profileSnap.exists ? profileSnap.data() : null;
        } catch {
            exportData.profile = null;
        }

        // Projects
        try {
            const projectsSnap = await db.collection("users").doc(userId).collection("projects").get();
            exportData.projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            exportData.projects = [];
        }

        // History
        try {
            const historySnap = await db.collection("users").doc(userId).collection("history").get();
            exportData.history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            exportData.history = [];
        }

        // Organizations the user belongs to
        try {
            const orgsSnap = await db.collection("organizations")
                .where(`members.${userId}`, "!=", null)
                .get();
            exportData.organizations = orgsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            exportData.organizations = [];
        }

        // Knowledge base
        try {
            const kbSnap = await db.collection("users").doc(userId).collection("knowledge").get();
            exportData.knowledgeBase = kbSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            exportData.knowledgeBase = [];
        }

        logger.info(`[GDPR] Data export completed for user ${userId}`);
        return exportData;
    });

/**
 * GDPR Account Deletion Request - Queues deletion of all user data.
 * Marks the account for deletion and returns a confirmation token.
 * Actual deletion happens asynchronously via a scheduled function.
 */
export const requestAccountDeletion = onCall(
    {
        enforceAppCheck: false, timeoutSeconds: 120, memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ success: boolean; deletedDocs: number; errors: string[]; deletedAt: string }> => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Authentication required.");
        }

        const userId = request.auth.uid;
        const db = admin.firestore();

        // Step 1 — Record the deletion request (audit trail)
        await db.collection("_deletion_requests").doc(userId).set({
            userId,
            email: request.auth.token.email || null,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "processing",
        });

        logger.info(`[GDPR] Starting account deletion for user ${userId}`);

        const errors: string[] = [];
        let deletedDocs = 0;

        // Step 2 — Delete user subcollections
        const subcollections = [
            'releases', 'tracks', 'contracts', 'campaigns', 'analytics',
            'splitSheets', 'generatedImages', 'generatedVideos', 'notifications',
            'invoices', 'auditLogs', 'fanPurchases', 'contacts', 'projects',
            'history', 'knowledge',
        ];
        for (const sub of subcollections) {
            try {
                const snap = await db.collection('users').doc(userId).collection(sub).limit(500).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    deletedDocs += snap.size;
                }
            } catch (err) {
                errors.push(`${sub}: ${err}`);
            }
        }

        // Step 3 — Delete user root document
        try { await db.collection('users').doc(userId).delete(); }
        catch (err) { errors.push(`profile: ${err}`); }

        // Step 4 — Delete Firebase Auth account (signs user out of all devices)
        try {
            await admin.auth().deleteUser(userId);
            logger.info(`[GDPR] Auth account deleted for ${userId}`);
        } catch (err) {
            errors.push(`auth: ${err}`);
        }

        logger.info(`[GDPR] Deletion complete for ${userId}. docs=${deletedDocs} errors=${errors.length}`);

        return {
            success: errors.length === 0,
            deletedDocs,
            errors,
            deletedAt: new Date().toISOString(),
        };
    });

/**
 * Health check endpoint for uptime monitoring.
 * Returns service status and basic diagnostics.
 */
export const healthCheck = onRequest(
    {
        timeoutSeconds: 60, memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (_req, res) => {
        const status: Record<string, unknown> = {
            status: "ok",
            timestamp: new Date().toISOString(),
            version: "0.1.0-beta.2",
            region: process.env.FUNCTION_REGION || "us-central1",
        };

        // Check Firestore connectivity
        try {
            await admin.firestore().collection("_health").doc("ping").set({
                lastCheck: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            status.firestore = "connected";
        } catch (error: unknown) {
            status.firestore = "error";
            status.status = "degraded";
            // Surface the real cause (e.g. IAM permission-denied) instead of
            // silently swallowing it — a bare "error" string was undiagnosable.
            logger.error("[healthCheck] Firestore ping failed:", error);
            status.firestoreErrorCode = error && typeof error === "object" && "code" in error ? (error as { code: unknown }).code : undefined;
        }

        res.status(200).json(status);
    });

/**
 * Health Check (legacy export name).
 * Deployed to us-central1 with the primary Firebase Functions fleet.
 */
export const healthCheckWest1 = onRequest(
    {
        region: "us-central1",
        timeoutSeconds: 60, memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (_req, res) => {
        res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            region: "us-central1",
            purpose: "Primary region health check"
        });
    });

/**
 * Fan Data Enrichment Service
 * Process batches of fans through configured third-party enrichment providers.
 */
export const enrichFanData = onCall(
    {
        region: "us-central1",
        timeoutSeconds: 300,
        memory: "1GiB",
        secrets: [clearbitApiKey, apolloApiKey],
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    // Item 352: Explicit return type annotation
    async (request): Promise<{ results: unknown[]; metadata: { provider: string; count: number; timestamp: string } }> => {
        const data = request.data as Record<string, unknown>;
        validateAppCheckV2(request);
        // 1. Security Check
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "Unauthorized: User session required for data enrichment."
            );
        }

        const { fans, provider, orgId } = data as { fans?: Record<string, unknown>[]; provider?: string; orgId?: string };

        if (!fans || !Array.isArray(fans)) {
            throw new HttpsError("invalid-argument", "Missing fan data array.");
        }

        // 2. Validate Org Access
        await validateOrgAccess(request.auth.uid, orgId);

        const normalizedProvider = String(provider || '').toLowerCase();
        const providerName = normalizedProvider === 'clearbit' ? 'clearbit' : normalizedProvider === 'apollo' ? 'apollo' : null;

        if (!providerName) {
            throw new HttpsError(
                'invalid-argument',
                'Provider must be clearbit or apollo.'
            );
        }

        const apiKey = providerName === 'clearbit' ? getClearbitApiKey() : getApolloApiKey();
        if (!apiKey) {
            logger.warn(`[FanEnrichment] ${providerName} API key missing; refusing to fabricate enrichment results`);
            throw new HttpsError(
                'failed-precondition',
                `${providerName === 'clearbit' ? 'Clearbit' : 'Apollo'} enrichment is unavailable because the API key is not configured.`
            );
        }

        logger.info(`[FanEnrichment] Processing ${fans.length} records via ${normalizedProvider || 'unconfigured'}`);

        let enrichedFans = [...fans];
        const providerUsed = providerName;

        try {
            if (providerName === 'clearbit') {
                // Clearbit Enrichment API batch lookup
                // See https://dashboard.clearbit.com/docs#enrichment-api
                const batchResults = await Promise.all(fans.map(async (fan) => {
                    try {
                        const res = await fetch(`https://person.clearbit.com/v2/combined/find?email=${encodeURIComponent(String(fan.email || ''))}`, {
                            headers: { 'Authorization': `Bearer ${apiKey}` },
                            signal: AbortSignal.timeout(10000)
                        });
                        if (res.status === 404) return { ...fan, enrichedAt: new Date().toISOString(), enrichmentScore: 0, provider: 'clearbit' };
                        if (!res.ok) throw new Error(`Clearbit API status: ${res.status}`);
                        const payload = await res.json() as Record<string, unknown>;
                        const person = (payload.person || {}) as Record<string, unknown>;
                        return {
                            ...fan,
                            city: fan.city || person.location || (person.geo as Record<string, unknown>)?.city || null,
                            country: fan.country || (person.geo as Record<string, unknown>)?.countryCode || null,
                            enrichedAt: new Date().toISOString(),
                            enrichmentScore: person.seniority ? 85 : 50,
                            provider: 'clearbit',
                            bio: person.bio || null,
                            avatar: person.avatar || null,
                        };
                    } catch (err) {
                        logger.warn(`[FanEnrichment] Single Clearbit lookup failed for ${fan.email}:`, err);
                        return { ...fan, enrichedAt: new Date().toISOString(), enrichmentScore: 0, provider: 'clearbit_error' };
                    }
                }));
                enrichedFans = batchResults;
            } else {
                // Apollo People Enrichment API
                // See https://apolloio.github.io/apollo-api-docs/
                const batchResults = await Promise.all(fans.map(async (fan) => {
                    try {
                        const res = await fetch('https://api.apollo.io/v1/people/match', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                            body: JSON.stringify({ api_key: apiKey, email: fan.email, first_name: fan.firstName, last_name: fan.lastName }),
                            signal: AbortSignal.timeout(10000)
                        });
                        if (!res.ok) throw new Error(`Apollo API status: ${res.status}`);
                        const payload = await res.json() as Record<string, unknown>;
                        const person = (payload.person || {}) as Record<string, unknown>;
                        return {
                            ...fan,
                            city: fan.city || person.city || null,
                            country: fan.country || person.country || null,
                            enrichedAt: new Date().toISOString(),
                            enrichmentScore: person.headline ? 75 : 45,
                            provider: 'apollo',
                            title: person.title || null,
                        };
                    } catch (err) {
                        logger.warn(`[FanEnrichment] Single Apollo lookup failed for ${fan.email}:`, err);
                        return { ...fan, enrichedAt: new Date().toISOString(), enrichmentScore: 0, provider: 'apollo_error' };
                    }
                }));
                enrichedFans = batchResults;
            }
        } catch (error) {
            logger.error('[FanEnrichment] Enrichment routine failed completely:', error);
            throw new HttpsError('internal', 'Data enrichment execution failed.');
        }

        return {
            results: enrichedFans,
            metadata: {
                provider: providerUsed,
                count: enrichedFans.length,
                timestamp: new Date().toISOString()
            }
        };
    });

// MCP SSE Server
export * from './mcp';

// Agent Orchestration State Machine
export * from './orchestration';
export * from './pod/printful';

// Payment Links
export { createStripePaymentLinks } from './stripe/paymentLinks';

// Printful POD
export {
    pod_printfulGetProducts,
    pod_printfulGetProduct,
    pod_printfulCalculatePrice,
    pod_printfulGetShippingRates,
    pod_printfulCreateOrder,
    pod_printfulGetOrder,
    pod_printfulCancelOrder,
    pod_printfulGenerateMockup
} from './pod/printful';

// Knowledge Base RAG System (ISSUE-1224)
export { createKnowledgeUpload, finalizeKnowledgeUpload, deleteKnowledgeDocument } from './functions/knowledge/upload';
export { indexKnowledgeDocumentWorker } from './functions/knowledge/indexWorker';
export { queryKnowledgeBase } from './functions/knowledge/query';

// Universal reversible Trash purge gateway
export { createPurgeIntent, purgeTrashItems } from './functions/trash/trashFunctions';
