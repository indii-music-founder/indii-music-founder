// indiiOS Cloud Functions - V1.1
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { VideoJobSchema } from "./lib/video";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./lib/image";


import { LongFormVideoJobSchema, generateLongFormVideoFn, stitchVideoFn } from "./lib/long_form_video";
import { generateVideoFn } from "./lib/video_generation";
import { FUNCTION_AI_MODELS } from "./config/models";

// Initialize Firebase Admin
admin.initializeApp();

// Define Secrets
const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

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
        'app://.'  // Electron app
    ];

    // Add localhost origins in emulator/development mode
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        origins.push(
            'http://localhost:5173',
            'http://localhost:4173',
            'http://localhost:3000',
            'http://127.0.0.1:5173'
        );
    }

    return origins;
};

const corsHandler = corsLib({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();

        // Allow requests with no origin (mobile apps, Postman) only in emulator
        if (!origin && process.env.FUNCTIONS_EMULATOR === 'true') {
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
const VIDEO_POLL_INTERVAL_SEC = 5;
const VIDEO_MAX_POLL_ATTEMPTS = 60;

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

        try {
            // 1. Create Initial Job Record in Firestore
            await admin.firestore().collection("videoJobs").doc(jobId).set({
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

            // GOD MODE: Bypass for Builder
            const isGodMode = context.auth?.token?.email === 'the.walking.agency.det@gmail.com';
            // FIX #4: GOD MODE via admin claim or environment config (no hardcoded email)
            const godModeEmails = (process.env.GOD_MODE_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
            const isGodMode = context.auth?.token?.admin === true ||
                              godModeEmails.includes(context.auth?.token.email || '');

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
            // 1. Create Parent Job Record
            await admin.firestore().collection("videoJobs").doc(jobId).set({
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

            // 2. Create Job Record
            await admin.firestore().collection("videoJobs").doc(jobId).set({
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
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            async ({ event, step }) => {
                const { jobId, prompt, userId, options } = event.data;
                console.log(`[Inngest] Starting video generation for Job: ${jobId}`);

                try {
                    // Update status to processing
                    await step.run("update-status-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // Start Video Generation Operation
                    const operation = await step.run("trigger-google-ai-video", async () => {
                        const modelId = FUNCTION_AI_MODELS.VIDEO.GENERATION;
                        const apiKey = geminiApiKey.value();
                        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`;

                        const requestBody = {
                            instances: [{ prompt: prompt }],
                            parameters: {
                                sampleCount: 1,
                                videoLength: options?.duration || options?.durationSeconds || "5s",
                                aspectRatio: options?.aspectRatio || "16:9",
                                ...(options?.generateAudio ? { generateAudio: true } : {})
                            },
                        };

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Google AI Trigger Error: ${response.status} ${errorText}`);
                        }

                        const result = await response.json();
                        if (!result.name) throw new Error("No operation name returned from Google AI");
                        return result;
                    });

                    const operationName = operation.name;
                    console.log(`[Inngest] Operation started: ${operationName}`);

                    // Polling Loop
                    let isCompleted = false;
                    let attempts = 0;
                    const maxAttempts = VIDEO_MAX_POLL_ATTEMPTS; // 5 minutes
                    let finalResult = null;

                    while (!isCompleted && attempts < maxAttempts) {
                        attempts++;

                        // Wait using Inngest sleep (better than setTimeout)
                        await step.sleep(`wait-${VIDEO_POLL_INTERVAL_SEC}s-${attempts}`, `${VIDEO_POLL_INTERVAL_SEC}s`);

                        finalResult = await step.run(`check-status-${attempts}`, async () => {
                            const apiKey = geminiApiKey.value();
                            const statusEndpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;

                            const statusResponse = await fetch(statusEndpoint);
                            if (!statusResponse.ok) return null;

                            const statusData = await statusResponse.json();
                            if (statusData.done) return statusData;
                            return null;
                        });

                        if (finalResult && finalResult.done) {
                            isCompleted = true;
                        }
                    }

                    if (!isCompleted || !finalResult || !finalResult.response) {
                        throw new Error(`Video generation timed out after ${attempts} attempts`);
                    }

                    // Process Result
                    const videoUri = await step.run("process-video-output", async () => {
                        const responseData = finalResult.response;
                        const outputs = responseData.outputs;

                        if (!outputs || outputs.length === 0) {
                            throw new Error("No outputs found in operation response");
                        }

                        const output = outputs[0];

                        // If it returns bytes
                        if (output.video && output.video.bytesBase64Encoded) {
                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                            await file.save(Buffer.from(output.video.bytesBase64Encoded, 'base64'), {
                                metadata: { contentType: 'video/mp4' },
                                public: true
                            });
                            return file.publicUrl();
                        }

                        // If it returns a URI directly
                        if (output.videoUri) return output.videoUri;
                        if (output.gcsUri) return output.gcsUri;

                        throw new Error("Could not find video data or URI in output: " + JSON.stringify(output));
                    });

                    // Update status to complete
                    await step.run("update-status-complete", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "completed",
                            videoUrl: videoUri,
                            progress: 100,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    return { success: true, videoUrl: videoUri };

                } catch (error: any) {
                    console.error(`[Inngest] Error in Video Generation (${jobId}):`, error);
                    await step.run("update-status-failed", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "failed",
                            error: error.message || "Unknown error during video generation",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });
                    throw error;
                }
            }
        );

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

export const generateImageV3 = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to generate images."
            );
        }

        // Zod Validation
        const validation = GenerateImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const { prompt, aspectRatio, count, images } = validation.data;

        try {
            const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION;
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;

            const parts: any[] = [{ text: prompt }];
            if (images) {
                images.forEach(img => {
                    parts.push({
                        inlineData: {
                            mimeType: img.mimeType || "image/png",
                            data: img.data
                        }
                    });
                });
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        candidateCount: count || 1,
                        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Google AI Error:", response.status, errorText);
                throw new functions.https.HttpsError('internal', `Google AI Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const processedImages = (result.candidates?.[0]?.content?.parts || [])
                .filter((p: any) => p.inlineData)
                .map((p: any) => ({
                    bytesBase64Encoded: p.inlineData.data,
                    mimeType: p.inlineData.mimeType || "image/png"
                }));

            return { images: processedImages };
        } catch (error: any) {
            console.error("[generateImageV3] Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError('internal', error.message || "Unknown error");
        }
    });

export const editImage = functions
    .runWith({ secrets: [geminiApiKey], timeoutSeconds: 120, memory: "512MB" })
    .https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to edit images."
            );
        }

        // Zod Validation
        const validation = EditImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const { image, imageMimeType, mask, maskMimeType, prompt, referenceImage, refMimeType } = validation.data;

        try {
            const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION;

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;

            const parts: any[] = [
                {
                    inlineData: {
                        mimeType: imageMimeType || "image/png",
                        data: image
                    }
                }
            ];

            // Track image count for correct position reference
            let imageCount = 1;

            if (mask) {
                parts.push({
                    inlineData: {
                        mimeType: maskMimeType || "image/png",
                        data: mask
                    }
                });
                parts.push({ text: "Use the second image as a mask for inpainting." });
                imageCount = 2;
            }

            if (referenceImage) {
                const position = imageCount === 1 ? "second" : "third";
                parts.push({
                    inlineData: {
                        mimeType: refMimeType || "image/png",
                        data: referenceImage
                    }
                });
                parts.push({ text: `Use this ${position} image as a reference.` });
            }

            parts.push({ text: prompt });

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: parts
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        temperature: 1.0
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new functions.https.HttpsError('internal', `Google AI Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            return { candidates: result.candidates };

        } catch (error: unknown) {
            console.error("Function Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new functions.https.HttpsError('internal', error.message);
            }
            throw new functions.https.HttpsError('internal', "An unknown error occurred");
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
                    "gemini-2.0-flash-exp" // Retained for backward compatibility if needed, otherwise remove
                ];

                if (!ALLOWED_MODELS.includes(modelId)) {
                    console.warn(`[Security] Blocked unauthorized model access: ${modelId}`);
                    res.status(400).send('Invalid or unauthorized model ID.');
                    return;
                }

                if (!Array.isArray(contents)) {
                    res.status(400).send('Invalid input: contents must be an array.');
                    return;
                }

                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${geminiApiKey.value()}`;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: config
                    })
                });

                if (!response.ok) {
                    const error = await response.text();
                    res.status(response.status).send(error);
                    return;
                }

                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                const reader = response.body?.getReader();
                if (!reader) {
                    res.status(500).send('No response body');
                    return;
                }

                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    res.write(JSON.stringify({ text }) + '\n');
                                }
                            } catch {
                                // Ignore parse errors for partial chunks
                            }
                        }
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
                const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}${queryString ? `&${queryString}` : ''}`;

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
