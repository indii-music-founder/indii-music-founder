import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { generateVideoLogic, VideoJobSchema } from "./lib/video";
import { generateLongFormVideoFn, stitchVideoFn, LongFormVideoJobSchema } from "./lib/long_form_video";

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
 *
 * Security: protected by Firebase Auth (onCall).
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
        // The client might pass { jobId, prompt, ... }
        // We ensure defaults are respected via Zod.
        const inputData: any = { ...(data as any), userId };

        // Zod Validation
        const validation = VideoJobSchema.safeParse(inputData);
        if (!validation.success) {
             throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        const jobData = validation.data;

        try {
            // 1. Create Initial Job Record in Firestore
            // We do this BEFORE sending the event to prevent race conditions where
            // the UI subscribes to a doc that doesn't exist yet.
            await admin.firestore().collection("videoJobs").doc(jobData.jobId).set({
                id: jobData.jobId,
                userId: jobData.userId,
                orgId: jobData.orgId,
                prompt: jobData.prompt,
                status: "queued",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Publish Event to Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/generate.requested",
                data: jobData,
                user: {
                    id: jobData.userId,
                }
            });

            console.log(`[VideoJob] Triggered for JobID: ${jobData.jobId}, User: ${jobData.userId}`);

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
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated for long form generation."
            );
        }
        const userId = context.auth.uid;

        // Zod Validation
        const inputData = { ...data, userId };
        const validation = LongFormVideoJobSchema.safeParse(inputData);

        if (!validation.success) {
             throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        const { prompts, jobId, orgId, totalDuration, startImage, options } = validation.data;

        // Additional validation explicitly requested by PR
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

            // 1. Determine User Tier (Fallback to 'free')
            let userTier: MembershipTier = 'free';
            if (orgId && orgId !== 'personal') {
                // Check Organization Plan
                const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    const orgData = orgDoc.data();
                    userTier = (orgData?.plan as MembershipTier) || 'free';
                }
            } else {
                 // Check User Profile (Fallback) - assuming user profile might have plan info
                 // usually stored in organizations or subscriptions. defaulting to free for safety.
            }

            const limits = TIER_LIMITS[userTier];

            // 2. Validate Duration Limit
            const durationNum = parseFloat(totalDuration || "0"); // Assuming string "60" or number
            if (durationNum > limits.maxVideoDuration) {
                 throw new functions.https.HttpsError(
                    "resource-exhausted",
                    `Video duration ${durationNum}s exceeds ${userTier} tier limit of ${limits.maxVideoDuration}s.`
                );
            }

            // 3. Validate Daily Usage Limit (Rate Limiting)
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

                // Increment Usage Optimistically (or wait for job completion? better to reserve slot)
                // We will increment here to prevent burst abuse.
                if (!usageDoc.exists) {
                    transaction.set(usageRef, { videosGenerated: 1, date: today, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                } else {
                    transaction.update(usageRef, { videosGenerated: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                }
            });

            // ------------------------------------------------------------------

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

            // 2. Publish Event to Inngest for Long Form
            const inngest = getInngestClient();
            await inngest.send({
                name: "video/long_form.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    orgId: orgId || "personal",
                    prompts: prompts,
                    totalDuration: totalDuration,
                    startImage: startImage,
                    options: options,
                    timestamp: Date.now(),
                },
                user: { id: userId }
            });

            return { success: true, message: "Long form video generation started." };

        } catch (error: any) {
            console.error("[LongFormVideoJob] Error:", error);
            // Re-throw HttpsErrors directly
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
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
export const inngestApi = functions
    .runWith({
        secrets: [inngestSigningKey, inngestEventKey],
        timeoutSeconds: 540 // 9 minutes, Veo generation can be slow
    })
    .https.onRequest((req, res) => {
        const inngestClient = getInngestClient();

        // Actual Video Generation Logic using Veo
        const generateVideo = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            generateVideoLogic
        );

        // Register Long Form Functions
        const generateLongForm = generateLongFormVideoFn(inngestClient);
        const stitchVideo = stitchVideoFn(inngestClient);

        const handler = serve({
            client: inngestClient,
            functions: [generateVideo, generateLongForm, stitchVideo],
            signingKey: inngestSigningKey.value(),
        });

        return handler(req, res);
    });

// ----------------------------------------------------------------------------
// Image Generation (Gemini)
// Legacy / Shared Gemini Functions
// ----------------------------------------------------------------------------

interface GenerateImageRequestData {
    prompt: string;
    aspectRatio?: string;
    count?: number;
    images?: { mimeType: string; data: string }[];
}

export const generateImageV3 = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data: GenerateImageRequestData, context) => {
        try {
            const { prompt, aspectRatio, count, images } = data;
            const modelId = "gemini-3-pro-image-preview";
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        candidateCount: count || 1,
                        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {})
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new functions.https.HttpsError('internal', errorText);
            }

            const result = await response.json();
            const candidates = result.candidates || [];
            const processedImages = candidates.flatMap((c: any) =>
                (c.content?.parts || [])
                    .filter((p: any) => p.inlineData)
                    .map((p: any) => ({
                        bytesBase64Encoded: p.inlineData.data,
                        mimeType: p.inlineData.mimeType
                    }))
            );

            return { images: processedImages };
        } catch (error: any) {
            console.error("Function Error:", error);
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
            const idToken = authHeader.split('Bearer ')[1];
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
            const idToken = authHeader.split('Bearer ')[1];
            try {
                await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                res.status(403).send('Forbidden: Invalid Token');
                return;
            }

            try {
                const targetPath = req.path;

                // SECURITY: Restrict proxy to allowed RAG paths to prevent abuse of the API key
                // Allows:
                // - /v1beta/files... (Upload/Get/Delete)
                // - /upload/v1beta/files... (Upload Media)
                // - /v1beta/fileSearchStores... (Create/Get Stores)
                // - /v1beta/models... (Generate Content, etc)
                // - /v1beta/operations... (Poll Operations)
                const allowedPrefixes = [
                    '/v1beta/files',
                    '/upload/v1beta/files',
                    '/v1beta/fileSearchStores',
                    '/v1beta/models',
                    '/v1beta/operations'
                ];

                if (!allowedPrefixes.some(prefix => targetPath.startsWith(prefix))) {
                    console.warn(`[ragProxy] Blocked unauthorized path: ${targetPath}`);
                    res.status(403).send({ error: 'Forbidden: Path not allowed via ragProxy.' });
                    return;
                }

                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;

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
