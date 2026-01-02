import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { generateVideoLogic } from "./lib/video";
import { generateVideoWithVeo, VideoJobSchema } from "./lib/video";

// Initialize Firebase Admin
admin.initializeApp();

// Define Secrets
const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Lazy Initialize Inngest Client
const getInngestClient = () => {
    return new Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};

const corsHandler = corsLib({ origin: true });

// ----------------------------------------------------------------------------
// Shared Gemini Functions
// ----------------------------------------------------------------------------

// Video Generation (Veo)
// ----------------------------------------------------------------------------

// Validation Schemas
const VideoJobSchema = z.object({
    jobId: z.string().uuid().or(z.string().min(1)), // UUID preferred but string allowed for backward compat
    prompt: z.string().min(1).max(5000),
    orgId: z.string().optional().default("personal"),
    aspectRatio: z.string().optional().default("16:9"),
    duration: z.string().optional(),
    durationSeconds: z.number().optional(),
    resolution: z.string().optional(),
    fps: z.number().optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().optional(),
    // Advanced Options
    seed: z.number().optional(),
    negativePrompt: z.string().optional(),
    model: z.string().optional(),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    timeOffset: z.number().optional(),
    ingredients: z.array(z.string()).optional(),
    shotList: z.array(z.any()).optional() // Allow shotList as any array for now
});

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

        // Zod Validation
        const validation = VideoJobSchema.safeParse(data);
        if (!validation.success) {
             throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        const { jobId, prompt, orgId, ...options } = validation.data;

        try {
            // 1. Create Initial Job Record in Firestore
            // We do this BEFORE sending the event to prevent race conditions where
            // the UI subscribes to a doc that doesn't exist yet.
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                id: jobId,
                userId: userId,
                orgId: orgId,
                prompt: prompt,
        // Use Zod for validation
        const result = VideoJobSchema.safeParse({
            jobId: data.jobId,
            userId: userId,
            orgId: data.orgId,
            prompt: data.prompt,
            options: data.options || {
                duration: data.duration, // Backward compatibility
                aspectRatio: data.aspectRatio
            }
        });

        if (!result.success) {
             throw new functions.https.HttpsError(
                "invalid-argument",
                `Invalid input: ${result.error.message}`
            );
        }

        const jobData = result.data;

        try {
            // 1. Create Initial Job Record in Firestore
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
                data: {
                    jobId: jobId,
                    userId: userId,
                    orgId: orgId,
                    prompt: prompt,
                    options: options,
                    timestamp: Date.now(),
                },
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
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            generateVideoLogic
            async ({ event, step }) => {
                // Ensure typed access or validation here as well
                const eventData = event.data;
                // Double check critical fields
                if (!eventData.jobId || !eventData.prompt || !eventData.userId) {
                    throw new Error("Missing critical event data (jobId, prompt, userId)");
                }

                const { jobId, prompt, userId, options } = eventData;
                const { jobId, userId } = event.data;

                try {
                     const videoUrl = await step.run("generate-veo-video", async () => {
                        return await generateVideoWithVeo(
                            event.data,
                            async (status: string, data: any = {}) => {
                                await admin.firestore().collection("videoJobs").doc(jobId).set({
                                    status: status,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    ...data
                                }, { merge: true });
                            }
                        );
                     });

                    return { success: true, videoUrl };

                } catch (error: any) {
                    await step.run("update-status-failed", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "failed",
                            error: error.message || "Unknown error during video generation",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });
                    // Re-throw to allow Inngest to handle retries if configured
                    throw error;
                }
            }
        );

        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn],
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
                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path;
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
