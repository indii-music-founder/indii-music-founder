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
import { generateImageV3Fn, editImageFn } from "./lib/image_generation";
import { FUNCTION_AI_MODELS } from "./config/models";

// Vertex AI SDK
// import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenAI } from "@google/genai"; // Keep for specific legacy/stream if needed, but primary is Vertex

// Initialize Firebase Admin
admin.initializeApp();

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
        'https://indiios-v-1-1.web.app',
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
        secrets: [inngestEventKey],
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;
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
            // 1. Create Initial Job Record in Firestore (Atomic Create to prevent overwrites)
            await admin.firestore().collection("videoJobs").doc(jobId).create({
                id: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompt: prompt,
                status: "queued",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Publish Event to Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/generate.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    orgId: orgId || "personal",
                    prompt: prompt,
                    options: options,
                    timestamp: Date.now(),
                },
                user: {
                    id: userId,
                }
            });

            console.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);

            return { success: true, message: "Video generation job queued." };

        } catch (error: any) {
            console.error("[VideoJob] Error triggering Inngest:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Failed to queue video job: ${error.message}`
            );
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
        memory: "256MB"
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated for long form generation."
            );
        }
        const userId = context.auth.uid;

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
        const { prompts, jobId, orgId, totalDuration, startImage, ...options } = validation.data;

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
        memory: "256MB"
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
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

        const handler = serve({
            client: inngestClient,
            functions: [generateVideo, generateLongFormVideo, stitchVideo],
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

export const generateSpeech = functions
    .runWith({ secrets: [geminiApiKey], timeoutSeconds: 60, memory: "512MB" })
    .https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

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
                const modelId = model || "gemini-3-pro-preview";

                // SECURITY: Strict Model Allowlist (Anti-SSRF / Cost Control)
                // Only allow approved models for streaming text generation.
                // See src/core/config/ai-models.ts for the master list.
                const ALLOWED_MODELS = [
                    "gemini-3-pro-preview",
                    "gemini-3-flash-preview",
                    "gemini-2.5-flash"
                ];

                if (!ALLOWED_MODELS.includes(modelId)) {
                    console.warn(`[Security] Blocked unauthorized model access: ${modelId}`);
                    res.status(400).send('Invalid or unauthorized model ID.');
                    return;
                }

                // Initialize SDK Client
                // Initialize SDK Client
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
                    '/upload/v1beta/files'
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
import { getSubscription } from './subscription/getSubscription';
import { createCheckoutSession } from './subscription/createCheckoutSession';
import { getCustomerPortal } from './subscription/getCustomerPortal';
import { cancelSubscription } from './subscription/cancelSubscription';
import { resumeSubscription } from './subscription/resumeSubscription';
import { getUsageStats } from './subscription/getUsageStats';
import { trackUsage } from './subscription/trackUsage';

export { getSubscription, createCheckoutSession, getCustomerPortal, cancelSubscription, resumeSubscription, getUsageStats, trackUsage };
