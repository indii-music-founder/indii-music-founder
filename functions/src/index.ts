// indiiOS Cloud Functions - V1.1
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { VideoJobSchema } from "./lib/video";

import { GoogleAuth } from "google-auth-library";

import { LongFormVideoJobSchema, generateLongFormVideoFn, stitchVideoFn } from "./lib/long_form_video";

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

const corsHandler = corsLib({ origin: true });

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

            // 2. Validate Duration Limit
            if (durationNum > limits.maxVideoDuration) {
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

                if (currentUsage >= limits.maxVideoGenerationsPerDay) {
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
        secrets: [inngestSigningKey, inngestEventKey],
        timeoutSeconds: 540 // 9 minutes
    })
    .https.onRequest((req, res) => {
        const inngestClient = getInngestClient();

        // 1. Single Video Generation Logic using Veo
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            async ({ event, step }) => {
                const { jobId, prompt, userId, options } = event.data;

                try {
                    // Update status to processing
                    await step.run("update-status-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // Generate Video via Vertex AI (Veo)
                    const videoUri = await step.run("generate-veo-video", async () => {
                        const auth = new GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });

                        const client = await auth.getClient();
                        const projectId = await auth.getProjectId();
                        const accessToken = await client.getAccessToken();
                        const location = 'us-central1';
                        const modelId = 'veo-3.1-generate-preview';

                        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

                        const requestBody = {
                            instances: [{ prompt: prompt }],
                            parameters: {
                                sampleCount: 1,
                                videoLength: options?.duration || options?.durationSeconds || "5s",
                                aspectRatio: options?.aspectRatio || "16:9"
                            }
                        };

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken.token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Vertex AI Error: ${response.status} ${errorText}`);
                        }

                        const result = await response.json();
                        const predictions = result.predictions;

                        if (!predictions || predictions.length === 0) {
                            throw new Error("No predictions returned from Veo API");
                        }

                        const prediction = predictions[0];

                        // Handle response (Base64 or URI)
                        if (prediction.bytesBase64Encoded) {
                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                            await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                                metadata: { contentType: 'video/mp4' },
                                public: true
                            });
                            return file.publicUrl();
                        }

                        if (prediction.videoUri) return prediction.videoUri;
                        if (prediction.gcsUri) return prediction.gcsUri;
                        throw new Error(`Unknown Veo response format: ` + JSON.stringify(prediction));
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
        const generateLongFormVideo = generateLongFormVideoFn(inngestClient);

        // 3. Stitching Function (Server-Side using Google Transcoder)
        // Register Long Form Functions

        const stitchVideo = stitchVideoFn(inngestClient);

        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn, generateLongFormVideo, stitchVideo],
            signingKey: inngestSigningKey.value(),
        });

        return handler(req, res);
    });

// ----------------------------------------------------------------------------
// Image Generation (Gemini)
// ----------------------------------------------------------------------------

interface GenerateImageRequestData {
    prompt: string;
    aspectRatio?: string;
    count?: number;
    images?: { mimeType: string; data: string }[];
}

export const generateImageV3 = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: GenerateImageRequestData, context) => {
        try {
            const { prompt, aspectRatio, count, images } = data;
            const modelId = "gemini-3-pro-image-preview";

            // Use Vertex AI IAM authentication instead of API key
            // This resolves 403 Permission Denied errors with Gemini 3 Pro Image
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();
            const location = 'us-central1';

            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

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
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        candidateCount: count || 1,
                        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
                        temperature: 1.0,
                        topK: 64,
                        topP: 0.95
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Vertex AI Error:", response.status, errorText);
                throw new functions.https.HttpsError('internal', `Vertex AI Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            // Vertex AI response format differs slightly, handle both formats
            const candidates = result.predictions || result.candidates || [];
            const processedImages = candidates.flatMap((c: any) =>
                (c.content?.parts || c.candidates?.[0]?.content?.parts || [])
                    .filter((p: any) => p.inlineData)
                    .map((p: any) => ({
                        bytesBase64Encoded: p.inlineData.data,
                        mimeType: p.inlineData.mimeType
                    }))
            );

            return { images: processedImages };
        } catch (error: any) {
            console.error("[generateImageV3] Error:", error);
            throw new functions.https.HttpsError('internal', error.message || "Unknown error");
        }
    });

interface EditImageRequestData {
    image: string;
    mask?: string;
    prompt: string;
    referenceImage?: string;
}

export const editImage = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data: EditImageRequestData, context) => {
        try {
            const { image, mask, prompt, referenceImage } = data;
            const modelId = "gemini-3-pro-image-preview";

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;

            const parts: any[] = [
                {
                    inlineData: {
                        mimeType: "image/png",
                        data: image
                    }
                }
            ];

            if (mask) {
                parts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: mask
                    }
                });
                parts.push({ text: "Use the second image as a mask for inpainting." });
            }

            if (referenceImage) {
                parts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: referenceImage
                    }
                });
                parts.push({ text: "Use this third image as a reference." });
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
                    generation_config: {
                        response_modalities: ["IMAGE"],
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new functions.https.HttpsError('internal', errorText);
            }

            const result = await response.json();
            return result;

        } catch (error: unknown) {
            console.error("Function Error:", error);
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
                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path;
                const allowedPrefixes = [
                    '/v1beta/files',
                    '/v1beta/models',
                    '/upload/v1beta/files'
                ];

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
        }

        try {
            return await bigqueryService.executeQuery(data.query, projectId, { maxResults: data.maxResults });
        } catch (error: any) {
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Get BigQuery Table Schema
 */
export const getBigQueryTableSchema = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: { datasetId: string; tableId: string }, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

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
