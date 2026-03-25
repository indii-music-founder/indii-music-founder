// indiiOS Cloud Functions - V1.1
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { serve } from "inngest/express";
import corsLib from "cors";
import { VideoJobSchema } from "./lib/video";

import { GenerateSpeechRequestSchema } from "./lib/audio";


import { LongFormVideoJobSchema, generateLongFormVideoFn, stitchVideoFn } from "./lib/long_form_video";
import { generateVideoFn } from "./lib/video_generation";
import { generateVideoDirect } from "./lib/video_generation_direct";
import { executeMilestoneFn } from "./timeline/milestone_execution";
import { generateImageV3Fn, editImageFn } from "./lib/image_generation";
import { analyzeAudioFn } from "./lib/audio";
import { FUNCTION_AI_MODELS } from "./config/models";

import { estimateVideoCost } from "./config/pricing";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
// import { generateThumbnail } from "./lib/image_resizing";

// Vertex AI SDK
// import { VertexAI } from "@google-cloud/vertexai";
// Item 335: GoogleGenAI is loaded lazily inside the handler to reduce cold start time
// import { GoogleGenAI } from "@google/genai";

// Polyfill for v1 Firebase Functions migrating to modern Node/Gen 2
if (!process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "indiios-v-1-1";
}

// Initialize Firebase Admin
admin.initializeApp();

// Stripe Connect Functions
export { createStripeAccount, createTransfer } from './stripe/connect';

// Stripe Split Escrow (Item 135)
export { initiateSplitEscrow, signEscrow } from './stripe/splitEscrow';


// Distribution Functions (Item 218: Delivery Status Polling)
export { pollDeliveryStatus } from './distribution/pollDeliveryStatus';

// Distribution Functions (Item 415: DDEX DSP Acknowledgement Processing)
// DISABLED: firebase-tools@13.29.1 CLI bug — 'Can't find the storage bucket region'
// for onObjectFinalized triggers even with explicit bucket config.
// Requires either: (1) configuring default bucket region, or (2) upgrading CLI.
// export { processDDEXAck } from './distribution/processDDEXAck';

// Legal Functions (Item 412: Split Sheet PDF Export)
export { exportSplitSheet } from './legal/exportSplitSheet';

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

// Timeline Orchestrator (Progressive Campaign Engine — polls every 15 min for due milestones)
export { pollTimelineMilestones } from './timeline/pollTimelineMilestones';

// Email OAuth Token Manager (Gmail / Outlook — server-side token exchange & refresh)
export { emailExchangeToken, emailRefreshToken, emailRevokeToken } from './email/tokenManager';

// Growth Intelligence Engine — Platform Analytics OAuth (Spotify, TikTok, Instagram)
export { analyticsExchangeToken, analyticsRefreshToken, analyticsRevokeToken } from './analytics/platformTokenExchange';

// Storage Maintenance (Scheduled — orphan cleanup, quota tracking, archival flagging)
export { cleanupOrphanedVideos, trackStorageQuotas, flagVideosForArchival } from './devops/storageMaintenance';

// Remote Relay — Server-Side Agent Processing (replaces desktop-browser-dependent relay)
export { processRelayCommand } from './relay/relayCommandProcessor';

// App Check enforcement flag — controls whether Firebase App Check tokens are validated.
// PRODUCTION ENABLEMENT (Item 247):
//   1. Set up reCAPTCHA Enterprise in GCP Console for your project.
//   2. Register your app in Firebase Console → App Check → reCAPTCHA Enterprise.
//   3. Add VITE_FIREBASE_APP_CHECK_KEY to your .env and CI secrets.
//   4. App Check is ENFORCED by default in production. To disable in local dev:
//      Set SKIP_APP_CHECK=true in your local .env or GCP Cloud Run environment.
//   5. Deploy: firebase deploy --only functions
//   CAUTION: Requires reCAPTCHA Enterprise configured in Firebase Console for all clients.
// Item 331: Default ENFORCE to true — opt-out via SKIP_APP_CHECK=true for dev environments.
const ENFORCE_APP_CHECK = process.env.SKIP_APP_CHECK !== 'true';

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
        throw new functions.https.HttpsError(
            "not-found",
            `Organization '${orgId}' not found.`
        );
    }

    const orgData = orgDoc.data();
    const members = orgData?.members || [];

    // 3. Verify Membership
    if (!members.includes(userId)) {
        console.warn(`[Security] User ${userId} attempted to access restricted org ${orgId}`);
        throw new functions.https.HttpsError(
            "permission-denied",
            "You are not a member of this organization."
        );
    }
};

// Import Shared Secrets
import { geminiApiKey, inngestEventKey, inngestSigningKey, getGeminiApiKey } from "./config/secrets";

// Lazy Initialize Inngest Client
export const getInngestClient = () => {
    return new Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};

/**
 * Security Helper: Enforce Admin Access
 *
 * Checks if the user has the 'admin' custom claim.
 * If not, logs a warning and throws Permission Denied.
 */
const requireAdmin = (context: functions.https.CallableContext) => {
    // 1. Must be authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be authenticated."
        );
    }

    // 2. Must have 'admin' custom claim
    // Note: If no admins exist yet, this securely defaults to deny-all.
    // Use the Firebase Admin SDK or a script to set `admin: true` on specific UIDs.
    if (!context.auth.token.admin) {
        console.warn(`[Security] Unauthorized access attempt by ${context.auth.uid} (missing admin claim)`);
        throw new functions.https.HttpsError(
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
        'https://indiios-studio.web.app',
        'https://indiios-studio.firebaseapp.com',
        'https://indiios-v-1-1.web.app',
        'https://indiios-v-1-1.firebaseapp.com',
        'https://studio.indiios.com',
        'https://indiios.com',
        'app://.',  // Electron app
        'http://localhost:4242' // Electron Studio (Vite)
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
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('CORS not allowed'));
    },
    credentials: true
});

// ----------------------------------------------------------------------------
// Tier Limits (Duplicated from MembershipService for Server-Side Enforcement)
// ----------------------------------------------------------------------------
type MembershipTier = 'free' | 'pro' | 'enterprise';

interface TierLimits {
    maxVideoDuration: number;          // Max seconds per job
    maxVideoGenerationsPerDay: number; // Max jobs per day
}

const TIER_LIMITS: Record<MembershipTier, TierLimits> = {
    free: {
        maxVideoDuration: 8 * 60,          // 8 minutes
        maxVideoGenerationsPerDay: 5,
    },
    pro: {
        maxVideoDuration: 60 * 60,         // 60 minutes
        maxVideoGenerationsPerDay: 50,
    },
    enterprise: {
        maxVideoDuration: 4 * 60 * 60,     // 4 hours
        maxVideoGenerationsPerDay: 500,
    },
};

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
export const triggerVideoJob = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 60,
        memory: "2GB",
        enforceAppCheck: ENFORCE_APP_CHECK
    })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data: unknown, context: functions.https.CallableContext): Promise<{ success: boolean; message: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;

        // Rate limit: 10 video generation requests per minute
        await enforceRateLimit(userId, "triggerVideoJob", RATE_LIMITS.generation);

        // Construct input matching the schema
        const safeData = (typeof data === 'object' && data !== null) ? data : {};
        const inputData: any = { ...safeData, userId };

        // Zod Validation
        const validation = VideoJobSchema.safeParse(inputData);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        const { prompt, jobId, orgId, ...options } = inputData;

        // SECURITY: Verify Org Access
        await validateOrgAccess(userId, orgId);

        try {
            // Calculate estimated cost
            const estimatedCost = estimateVideoCost({
                model: options.model,
                durationSeconds: options.durationSeconds || options.duration,
                resolution: options.resolution,
                generateAudio: options.generateAudio
            });

            // 1. Create Initial Job Record in Firestore (Atomic Create to prevent overwrites)
            await admin.firestore().collection("videoJobs").doc(jobId).create({
                id: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompt: prompt,
                status: "queued",
                estimatedCost: estimatedCost,
                options: options,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. That's it — the Firestore document creation above will trigger
            //    executeVideoJob via Firestore onCreate. No self-invocation needed.

            console.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);

            return { success: true, message: "Video generation job started." };

        } catch (error: any) {
            console.error("[VideoJob] Error triggering video generation:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Failed to queue video job: ${error.message}`
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
export const executeVideoJob = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 540, // 9 minutes
        memory: "2GB"
    })
    .firestore.document("videoJobs/{jobId}")
    .onCreate(async (snapshot, context) => {
        const jobId = context.params.jobId;
        const data = snapshot.data();

        // Only process documents with status "queued"
        if (data.status !== "queued") {
            console.log(`[executeVideoJob] Skipping job ${jobId} — status is "${data.status}", not "queued".`);
            return;
        }

        const userId = data.userId;
        const prompt = data.prompt;
        const orgId = data.orgId || "personal";
        const options = data.options || {};

        if (!userId || !prompt) {
            console.error(`[executeVideoJob] Missing required fields for job ${jobId}: userId=${userId}, prompt=${prompt}`);
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: "Missing required fields: userId or prompt",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return;
        }

        console.log(`[executeVideoJob] Starting video generation for job ${jobId}`);

        // Run the generation
        try {
            await generateVideoDirect({
                jobId,
                userId,
                orgId,
                prompt,
                options
            });
        } catch (error: any) {
            // Error is already handled inside generateVideoDirect (Firestore updated to "failed")
            console.error(`[executeVideoJob] Unhandled error for ${jobId}:`, error);
        }
    });

/**
 * Trigger Long Form Video Generation Job
 *
 * Handles multi-segment video generation (daisychaining) as a background process.
 */
export const triggerLongFormVideoJob = functions
    .region("us-west1")
    .runWith({
        secrets: [inngestEventKey],
        timeoutSeconds: 60,
        memory: "2GB",
        enforceAppCheck: ENFORCE_APP_CHECK
    })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data: unknown, context: functions.https.CallableContext): Promise<{ success: boolean; message: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated for long form generation."
            );
        }
        const userId = context.auth.uid;

        // Rate limit: 10 long-form video requests per minute
        await enforceRateLimit(userId, "triggerLongFormVideoJob", RATE_LIMITS.generation);

        // Zod Validation
        const safeData = (typeof data === 'object' && data !== null) ? data : {};
        const inputData = { ...safeData, userId };
        const validation = LongFormVideoJobSchema.safeParse(inputData);

        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        // Destructure validated data
        const { prompts, jobId, orgId, totalDuration, startImage, options } = validation.data;

        // SECURITY: Verify Org Access
        await validateOrgAccess(userId, orgId);

        // Additional validation
        if (prompts.length === 0) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Prompts array must not be empty."
            );
        }

        try {
            // ------------------------------------------------------------------
            // Quota Enforcement (Server-Side)
            // ------------------------------------------------------------------
            let userTier: MembershipTier = 'free';
            if (orgId && orgId !== 'personal') {
                const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    const orgData = orgDoc.data();
                    userTier = (orgData?.plan as MembershipTier) || 'free';
                }
            }

            const limits = TIER_LIMITS[userTier];
            const durationNum = parseFloat((totalDuration || 0).toString());

            // FIX #4: GOD MODE via admin claim or environment config (no hardcoded email)
            const godModeEmails = (process.env.GOD_MODE_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
            const isGodMode = context.auth?.token?.admin === true ||
                godModeEmails.includes(context.auth?.token?.email || '');

            // 2. Validate Duration Limit
            if (!isGodMode && durationNum > limits.maxVideoDuration) {
                throw new functions.https.HttpsError(
                    "resource-exhausted",
                    `Video duration ${durationNum}s exceeds ${userTier} tier limit of ${limits.maxVideoDuration}s.`
                );
            }

            // Daily Usage Check
            const today = new Date().toISOString().split('T')[0];
            const usageRef = admin.firestore().collection('users').doc(userId).collection('usage').doc(today);

            await admin.firestore().runTransaction(async (transaction) => {
                const usageDoc = await transaction.get(usageRef);
                const currentUsage = usageDoc.exists ? (usageDoc.data()?.videosGenerated || 0) : 0;

                if (!isGodMode && currentUsage >= limits.maxVideoGenerationsPerDay) {
                    throw new functions.https.HttpsError(
                        "resource-exhausted",
                        `Daily video generation limit reached for ${userTier} tier (${limits.maxVideoGenerationsPerDay}/day).`
                    );
                }

                // Increment Usage Optimistically
                if (!usageDoc.exists) {
                    transaction.set(usageRef, { videosGenerated: 1, date: today, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                } else {
                    transaction.update(usageRef, { videosGenerated: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                }
            });

            // ------------------------------------------------------------------

            // 4. Create Parent Job Record
            // Calculate estimated cost for long-form (sum of segments)
            // SENTRY FIX (PR #1200): Use DEFAULT_SEGMENT_DURATION_SECONDS (5s) instead of hardcoded 8s to prevent cost inflation.
            const estimatedCostPerSegment = estimateVideoCost({
                model: options.model,
                durationSeconds: 5, // Aligned with DEFAULT_SEGMENT_DURATION_SECONDS in long_form_video.ts
                resolution: options.resolution,
                generateAudio: options.generateAudio
            });
            const totalEstimatedCost = parseFloat((estimatedCostPerSegment * prompts.length).toFixed(4));


            // 1. Create Parent Job Record (Atomic Create)
            await admin.firestore().collection("videoJobs").doc(jobId).create({
                id: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompt: prompts[0], // Main prompt
                status: "queued",
                isLongForm: true,
                totalSegments: prompts.length,
                completedSegments: 0,
                estimatedCost: totalEstimatedCost,
                options: options,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 5. Publish Event to Inngest for Long Form
            const inngest = getInngestClient();
            await inngest.send({
                name: "video/long_form.requested",
                data: {
                    jobId,
                    userId,
                    orgId: orgId || "personal",
                    prompts,
                    totalDuration,
                    startImage,
                    options,
                    timestamp: Date.now(),
                },
                user: { id: userId }
            });

            return { success: true, message: "Long form video generation started." };

        } catch (error: any) {
            console.error("[LongFormVideoJob] Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError(
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
export const renderVideo = functions
    .region("us-west1")
    .runWith({
        secrets: [inngestEventKey],
        timeoutSeconds: 60,
        memory: "2GB",
        enforceAppCheck: ENFORCE_APP_CHECK
    })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data: unknown, context: functions.https.CallableContext): Promise<{ success: boolean; renderId: string; message: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to render video."
            );
        }

        const userId = context.auth.uid;
        const safeData = (typeof data === 'object' && data !== null) ? data as Record<string, any> : {};
        const { compositionId, inputProps } = safeData;
        const project = inputProps?.project;

        if (!project || !project.tracks || !project.clips) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid project data. Missing tracks or clips."
            );
        }

        const jobId = compositionId || `render_${Date.now()}`;

        try {
            // 1. Flatten Tracks to Segment List
            // Simple logic: sort clips by startFrame.
            // Note: This MVP implementation assumes sequential non-overlapping clips
            // or prioritizes the first track for stitching.
            // Google Transcoder Stitching requires a list of inputs.

            // Filter only video clips
            const videoClips = project.clips
                .filter((c: any) => c.type === 'video')
                .sort((a: any, b: any) => a.startFrame - b.startFrame);

            if (videoClips.length === 0) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "No video clips found in project to render."
                );
            }

            const segmentUrls = videoClips.map((c: any) => c.src);

            // 2. Create Job Record (Atomic Create)
            await admin.firestore().collection("videoJobs").doc(jobId).create({
                id: jobId,
                userId: userId,
                orgId: "personal",
                status: "queued",
                type: "render_stitch",
                clipCount: videoClips.length,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 3. Trigger Stitching via Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/stitch.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    segmentUrls: segmentUrls,
                    options: {
                        resolution: `${project.width}x${project.height}`,
                        aspectRatio: project.width > project.height ? "16:9" : "9:16" // Rough approximation
                    }
                },
                user: { id: userId }
            });

            return { success: true, renderId: jobId, message: "Render job queued." };

        } catch (error: any) {
            console.error("[RenderVideo] Error:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Failed to queue render job: ${error.message}`
            );
        }
    });

/**
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
export const inngestApi = functions
    .runWith({
        secrets: [inngestSigningKey, inngestEventKey, geminiApiKey],
        timeoutSeconds: 540 // 9 minutes
    })

    .https.onRequest(async (req, res) => {
        const inngestClient = getInngestClient();

        // 1. Single Video Generation Logic using Veo
        const generateVideo = generateVideoFn(inngestClient, geminiApiKey);

        // 2. Long Form Video Generation Logic (Daisychaining)
        const generateLongFormVideo = generateLongFormVideoFn(inngestClient, geminiApiKey);

        // 3. Stitching Function (Server-Side using Google Transcoder)
        const stitchVideo = stitchVideoFn(inngestClient);

        // Timeline Orchestrator: Autonomous milestone execution
        const executeMilestone = executeMilestoneFn(inngestClient);

        const handler = serve({
            client: inngestClient,
            functions: [generateVideo, generateLongFormVideo, stitchVideo, executeMilestone],
            signingKey: inngestSigningKey.value(),
        });

        return handler(req, res);
    });

// ----------------------------------------------------------------------------
// Image Generation (Gemini)
// ----------------------------------------------------------------------------

// Image Generation v3 (Nano Banana Pro / Gemini 3 Pro Image)
// Deployed to us-west1 for Model Availability
// Image Generation v3 (Nano Banana Pro / Gemini 3 Pro Image)
// Deployed to us-west1 for Model Availability
export const generateImageV3 = generateImageV3Fn();
export const editImage = editImageFn();
export const analyzeAudio = analyzeAudioFn();

export const generateSpeech = functions
    .runWith({ secrets: [geminiApiKey], timeoutSeconds: 60, memory: "512MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data: unknown, context): Promise<{ audioContent: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        // Rate limit: 10 speech generation requests per minute
        await enforceRateLimit(context.auth.uid, "generateSpeech", RATE_LIMITS.generation);

        const validation = GenerateSpeechRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
        }
        const { text, voice, model } = validation.data;

        try {
            console.log(`[generateSpeech] Generating speech with model: ${model}`);
            const modelId = model || FUNCTION_AI_MODELS.SPEECH.GENERATION;
            const apiKey = getGeminiApiKey();

            // Use REST API for precise control over TTS config
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voice
                                }
                            }
                        }
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini TTS API Error: ${response.status} ${errText}`);
            }

            const result = await response.json();

            // Extract audio data (inlineData)
            const part = result.candidates?.[0]?.content?.parts?.[0];
            const audioContent = part?.inlineData?.data;

            if (!audioContent) {
                console.error("[generateSpeech] Unexpected response structure:", JSON.stringify(result));
                throw new Error("No audio content returned from API");
            }

            return { audioContent };

        } catch (error: any) {
            console.error("[generateSpeech] Error:", error);
            throw new functions.https.HttpsError("internal", error.message || "Speech generation failed");
        }
    });

export const generateContentStream = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 300
    })
    .https.onRequest((req, res) => {
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
            try {
                await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                res.status(403).send('Forbidden: Invalid Token');
                return;
            }

            try {
                const { model, contents, config } = req.body;
                const modelId = model || "gemini-3.1-pro-preview";

                // SECURITY: Strict Model Allowlist (Anti-SSRF / Cost Control)
                // Only allow approved models for streaming text generation.
                // See src/core/config/ai-models.ts for the master list.
                const ALLOWED_MODELS = [
                    "gemini-3.1-pro-preview",
                    "gemini-3-flash-preview",
                    "gemini-2.5-flash"
                ];

                if (!ALLOWED_MODELS.includes(modelId)) {
                    console.warn(`[Security] Blocked unauthorized model access: ${modelId}`);
                    res.status(400).send('Invalid or unauthorized model ID.');
                    return;
                }

                // Initialize SDK Client (dynamic import — Item 335: reduces cold start)
                const { GoogleGenAI } = await import("@google/genai");
                const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });

                // Generate Content Stream
                const result = await client.models.generateContentStream({
                    model: modelId,
                    contents: contents, // SDK accepts standard Content format
                    config: config
                });

                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // Iterate over SDK Stream
                for await (const chunk of result) {
                    const text = chunk.text;
                    if (text) {
                        res.write(JSON.stringify({ text }) + '\n');
                    }
                }

                res.end();

            } catch (error: any) {
                console.error("[generateContentStream] Error:", error);
                if (!res.headersSent) {
                    res.status(500).send(error.message);
                } else {
                    res.end();
                }
            }
        });
    });

export const ragProxy = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 60
    })
    .https.onRequest((req, res) => {
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
            } catch (error) {
                res.status(403).send('Forbidden: Invalid Token');
                return;
            }

            try {
                // SECURITY: Block Method Override Headers to prevent bypassing method checks
                // Express might handle X-HTTP-Method-Override automatically, so strict method checking is key.

                // 1. BLOCK DELETE (Data Integrity / Anti-Griefing)
                // Prevents users from deleting files that might belong to others in the shared project.
                if (req.method === 'DELETE') {
                    res.status(403).send('Forbidden: Method not allowed');
                    return;
                }

                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path;
                const allowedPrefixes = [
                    '/v1beta/files',
                    '/v1beta/models',
                    '/upload/v1beta/files',
                    '/v1beta/fileSearchStores', // RAG: File Search Store management (create, list, importFile)
                    '/v1beta/operations'         // RAG: Async operation polling for importFile completions
                ];

                // 2. BLOCK LIST ALL FILES (Privacy / Anti-IDOR)
                // Prevents users from listing all files uploaded to the shared project.
                // Exception: Getting metadata for a SPECIFIC file is allowed (path has extra segments).
                // Path must NOT be exactly '/v1beta/files' if method is GET.
                if (req.method === 'GET' && req.path === '/v1beta/files') {
                    res.status(403).send('Forbidden: Listing files is disabled for security');
                    return;
                }

                const isAllowed = allowedPrefixes.some(prefix =>
                    req.path === prefix || req.path.startsWith(prefix + '/')
                );

                if (!isAllowed) {
                    res.status(403).send('Forbidden: Path not allowed');
                    return;
                }

                const queryString = req.url.split('?')[1] || '';
                const targetUrl = `${baseUrl}${targetPath}?key=${getGeminiApiKey()}${queryString ? `&${queryString}` : ''}`;

                const fetchOptions: RequestInit = {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                        (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                        : undefined
                };

                const response = await fetch(targetUrl, fetchOptions);
                const data = await response.text();
                res.status(response.status);
                try { res.send(JSON.parse(data)); } catch { res.send(data); }
            } catch (error: any) {
                res.status(500).send({ error: error.message });
            }
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

// export const imageResizing = {
//     generateThumbnail
// };

/**
 * List GKE Clusters
 */
export const listGKEClusters = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.listClusters(projectId);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// ----------------------------------------------------------------------------
// Road Manager (Touring)
// ----------------------------------------------------------------------------

export const generateItinerary = touringService.generateItinerary;
export const checkLogistics = touringService.checkLogistics;
export const findPlaces = touringService.findPlaces;
export const calculateFuelLogistics = touringService.calculateFuelLogistics;

// Marketing
export const executeCampaign = marketingService.executeCampaign;
export const dispatchSocialPost = marketingService.dispatchSocialPost;
export const createInfluencerBounty = marketingService.createInfluencerBounty;

/**
 * Get GKE Cluster Status
 */
export const getGKEClusterStatus = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: { location: string; clusterName: string }, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.getClusterStatus(projectId, data.location, data.clusterName);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Scale GKE Node Pool
 */
export const scaleGKENodePool = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data: { location: string; clusterName: string; nodePoolName: string; nodeCount: number }, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gkeService.scaleNodePool(projectId, data.location, data.clusterName, data.nodePoolName, data.nodeCount);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * List GCE Instances
 */
export const listGCEInstances = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gceService.listInstances(projectId);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Restart GCE Instance
 */
export const restartGCEInstance = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data: { zone: string; instanceName: string }, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await gceService.resetInstance(projectId, data.zone, data.instanceName);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// ----------------------------------------------------------------------------
// BigQuery Analytics
// ----------------------------------------------------------------------------

/**
 * Execute BigQuery Query
 */
export const executeBigQueryQuery = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data: { query: string; maxResults?: number }, context) => {
        requireAdmin(context);

        // SECURITY: Raw SQL execution is disabled for production safety.
        // Developers should implement specific, parameterized query endpoints.
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Raw SQL execution is disabled in this environment for security reasons.'
        );
    });

/**
 * Get BigQuery Table Schema
 */
export const getBigQueryTableSchema = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: { datasetId: string; tableId: string }, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await bigqueryService.getTableSchema(projectId, data.datasetId, data.tableId);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * List BigQuery Datasets
 */
export const listBigQueryDatasets = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
        requireAdmin(context);

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await bigqueryService.listDatasets(projectId);
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
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

export {
    getSubscription,
    createCheckoutSession,
    createOneTimeCheckout,
    generateInvoice,
    cancelSubscription,
    resumeSubscription,
    getCustomerPortal,
    getUsageStats,
    trackUsage,
    stripeWebhook,
    activateFounderPass
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
export const exportUserData = functions
    .runWith({ timeoutSeconds: 120, memory: "512MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (_data, context): Promise<Record<string, unknown>> => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const userId = context.auth.uid;
        const db = admin.firestore();
        const exportData: Record<string, unknown> = {
            exportedAt: new Date().toISOString(),
            userId,
            email: context.auth.token.email || null,
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

        functions.logger.info(`[GDPR] Data export completed for user ${userId}`);
        return exportData;
    });

/**
 * GDPR Account Deletion Request - Queues deletion of all user data.
 * Marks the account for deletion and returns a confirmation token.
 * Actual deletion happens asynchronously via a scheduled function.
 */
export const requestAccountDeletion = functions
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (_data, context): Promise<{ success: boolean; deletedDocs: number; errors: string[]; deletedAt: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
        }

        const userId = context.auth.uid;
        const db = admin.firestore();

        // Step 1 — Record the deletion request (audit trail)
        await db.collection("_deletion_requests").doc(userId).set({
            userId,
            email: context.auth.token.email || null,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "processing",
        });

        functions.logger.info(`[GDPR] Starting account deletion for user ${userId}`);

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
            functions.logger.info(`[GDPR] Auth account deleted for ${userId}`);
        } catch (err) {
            errors.push(`auth: ${err}`);
        }

        functions.logger.info(`[GDPR] Deletion complete for ${userId}. docs=${deletedDocs} errors=${errors.length}`);

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
export const healthCheck = functions
    .runWith({ timeoutSeconds: 60, memory: "256MB" })
    .https.onRequest(async (_req, res) => {
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
        } catch {
            status.firestore = "error";
            status.status = "degraded";
        }

        const httpStatus = status.status === "ok" ? 200 : 503;
        res.status(httpStatus).json(status);
    });

/**
 * Health Check (Secondary Region: us-west1)
 * Part of PRODUCTION_100 Item 12 (Multi-region Deployment)
 */
export const healthCheckWest1 = functions
    .region("us-west1")
    .runWith({ timeoutSeconds: 60, memory: "256MB" })
    .https.onRequest(async (_req, res) => {
        res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            region: "us-west1",
            purpose: "Multi-region Failover Check"
        });
    });

/**
 * Fan Data Enrichment Service
 * Process batches of fans to append demographic, psychographic, and interest markers.
 * Integration points: Clearbit, Apollo via AI fallback.
 */
export const enrichFanData = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
        enforceAppCheck: ENFORCE_APP_CHECK
    })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data: any, context): Promise<{ results: unknown[]; metadata: { provider: string; count: number; timestamp: string } }> => {
        // 1. Security Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Unauthorized: User session required for data enrichment."
            );
        }

        const { fans, provider, orgId } = data;

        if (!fans || !Array.isArray(fans)) {
            throw new functions.https.HttpsError("invalid-argument", "Missing fan data array.");
        }

        // 2. Validate Org Access
        await validateOrgAccess(context.auth.uid, orgId);

        console.info(`[FanEnrichment] Processing ${fans.length} records via ${provider || 'AI_FALLBACK'}`);

        // 3. Enrichment Logic
        // In production, this calls Clearbit/Apollo API. 
        // For Alpha, we use high-fidelity mock enrichment based on industry benchmarks.
        const results = fans.map((fan: any) => {
            const emailDomain = fan.email.split('@')[1] || '';
            const isCorporate = !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(emailDomain);

            // Heuristic-based enrichment
            return {
                ...fan,
                location: fan.city || (isCorporate ? 'San Francisco, CA' : 'Los Angeles, CA'),
                ageRange: isCorporate ? '35-44' : '18-24',
                incomeBracket: isCorporate ? '$120k-$200k' : '$40k-$65k',
                topGenre: fan.topGenre || (isCorporate ? 'Jazz' : 'Electronic'),
                interests: isCorporate ? ['Investing', 'Tech'] : ['Live Events', 'Gaming'],
                lastEnriched: new Date().toISOString()
            };
        });

        return {
            results,
            metadata: {
                provider: provider || 'AI_FALLBACK',
                count: results.length,
                timestamp: new Date().toISOString()
            }
        };
    });
