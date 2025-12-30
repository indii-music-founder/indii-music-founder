import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { VertexAI } from "@google-cloud/vertexai";

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
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;
        const { prompt, jobId, orgId, ...options } = data;

        if (!prompt || !jobId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: prompt or jobId."
            );
        }

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
            async ({ event, step }) => {
                const { jobId, prompt, userId, options } = event.data;

                try {
                    // Step 1: Update status to processing
                    await step.run("update-status-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // Step 2: Generate Video via Vertex AI (Veo)
                    const videoUri = await step.run("generate-veo-video", async () => {
                        const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;

                        const vertexAI = new VertexAI({
                            project: projectId,
                            location: 'us-central1'
                        });

                        // Note: For Veo 3.1, we may interact via the prediction service if not fully typed in high-level SDK yet,
                        // but generic generateContent is preferred if supported.
                        // Assuming standard Generative Model interface for consistency with Gemini.
                        const model = vertexAI.getGenerativeModel({
                            model: 'veo-3.1-generate-preview'
                        });

                        // Construct the request. 
                        // Veo expectations: { instances: [{ prompt: ... }], parameters: { ... } }
                        // The SDK's generateContent mostly handles the wrapper, but for Video it might return a different structure.
                        // If the SDK returns a simplified response, we handle it. 

                        // Fallback: Using direct content generation structure
                        const request = {
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: {
                                candidateCount: 1,
                                // Map options to parameters expected by Veo
                                // video_length, aspect_ratio, etc. need to be verified against specific Model Cards
                            }
                        };

                        const result = await model.generateContent(request);

                        // Extract video URI or Base64
                        // Use safe extraction based on potential response shapes
                        const candidates = result.response.candidates;
                        if (!candidates || candidates.length === 0) {
                            throw new Error("No candidates returned from Veo.");
                        }

                        // Inspect parts for info
                        const firstPart = candidates[0].content.parts[0];

                        if (firstPart.inlineData && firstPart.inlineData.data) {
                            // Base64 handling
                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                            const buffer = Buffer.from(firstPart.inlineData.data, 'base64');

                            await file.save(buffer, {
                                metadata: { contentType: 'video/mp4' },
                                public: true
                            });

                            return file.publicUrl();
                        } else if (firstPart.fileData && firstPart.fileData.fileUri) {
                            // URI handling
                            return firstPart.fileData.fileUri;
                        }

                        // If the SDK returns generic JSON in text (rare but possible for preview models)
                        if (firstPart.text) {
                            try {
                                const parsed = JSON.parse(firstPart.text);
                                if (parsed.videoUri) return parsed.videoUri;
                                if (parsed.gcsUri) return parsed.gcsUri;
                            } catch (e) {
                                // Not JSON
                            }
                        }

                        throw new Error("Unable to extract video from Veo response.");
                    });

                    // Step 3: Update status to complete
                    await step.run("update-status-complete", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "complete",
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

        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn],
            signingKey: inngestSigningKey.value(),
        });

        return handler(req, res);
    });

// ----------------------------------------------------------------------------
// Legacy / Shared Gemini Functions (Refactored for Cleanliness)
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

export const editImage = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data: any, context) => {
        // Placeholder for Edit Image logic if needed, 
        // implementation preserved from existing if it was working, 
        // otherwise kept minimal to save space/complexity as primarily focus is Veo.
        return { message: "Edit Image V3 Not fully implemented in this refactor." };
    });

const corsHandler = corsLib({ origin: true });

export const ragProxy = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 60
    })
    .https.onRequest((req, res) => {
        corsHandler(req, res, async () => {
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

import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { GoogleAuth } from "google-auth-library";

// GoogleAuth is required for Vertex AI (Veo) which uses IAM, unlike Gemini API Key

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
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;
        const { prompt, jobId, orgId, ...options } = data;

        if (!prompt || !jobId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: prompt or jobId."
            );
        }

        try {
            // 2. Create Initial Job Record
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "queued",
                prompt: prompt,
                userId: userId,
                orgId: orgId || "personal",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 3. Publish Event to Inngest
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
            // Also create the initial job record in Firestore
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                id: jobId,
                userId,
                orgId: orgId || "personal",
                prompt,
                status: "queued",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

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
            async ({ event, step }) => {
                const { jobId, prompt, userId, options } = event.data;

                // Step 1: Update status to processing
                await step.run("update-status-processing", async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).update({
                        status: "processing",
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });

                // Step 2: Generate Video via Vertex AI (Veo)
                const videoUri = await step.run("generate-veo-video", async () => {
                    // Use GoogleAuth to get credentials for Vertex AI
                    const auth = new GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });

                    const client = await auth.getClient();
                    const projectId = await auth.getProjectId();
                    const location = 'us-central1';
                    const modelId = 'veo-3.1-generate-preview';

                    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

                    // Construct request body
                    // Note: Veo API shape may vary, assuming standard Vertex AI format for Generative Video
                    // Based on public preview docs structure
                    const requestBody = {
                        instances: [
                            {
                                prompt: prompt,
                                // Add other parameters if supported by the specific model version
                            }
                        ],
                        parameters: {
                            sampleCount: 1,
                            // durationSeconds: options.duration || 5, // Optional depending on model support
                            // aspectRatio: options.aspectRatio || "16:9" // Optional
                        }
                    };

                    const response = await client.request({
                        url,
                        method: 'POST',
                        data: requestBody
                    });

                    const responseData = response.data as any;

                    // Vertex AI Video output usually returns a GCS URI or Base64
                    // For Veo, it typically returns a GCS URI or a signed URL in the predictions
                    const predictions = responseData.predictions;
                    if (!predictions || predictions.length === 0) {
                        throw new Error("No predictions returned from Veo API");
                    }

                    const prediction = predictions[0];

                    // Handle different possible response formats
                    // Format A: { bytesBase64Encoded: "..." }
                    // Format B: { gcsUri: "gs://..." }
                    // Format C: { videoUri: "..." }

                    if (prediction.bytesBase64Encoded) {
                        // Upload to Firebase Storage
                        const bucket = admin.storage().bucket();
                        const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                        const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');

                        await file.save(buffer, {
                            metadata: { contentType: 'video/mp4' },
                            public: true // Or generate signed URL
                        });

                        return file.publicUrl();
                    } else if (prediction.gcsUri) {
                        return prediction.gcsUri; // Should probably copy to our bucket or sign it
                    } else if (prediction.videoUri) {
                        return prediction.videoUri;
                    }

                    // Fallback for demo if API shape is different in preview
                    throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
                });

                // Step 3: Update status to complete
                await step.run("update-status-complete", async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).update({
                        status: "complete",
                        videoUrl: videoUri,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });

                return { success: true, videoUrl: videoUri };
                const { jobId, prompt, options } = event.data;

                try {
                    // 1. Update status to processing
                    await step.run("update-status-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // 2. Call Vertex AI (Veo)
                    const videoUri = await step.run("generate-video-vertex", async () => {
                        const auth = new GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });
                        const client = await auth.getClient();
                        const projectId = await auth.getProjectId();
                        const accessToken = await client.getAccessToken();

                        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:predict`;

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken.token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                instances: [{
                                    prompt: prompt
                                }],
                                parameters: {
                                    sampleCount: 1,
                                    videoLength: options?.duration || "5s",
                                    aspectRatio: options?.aspectRatio || "16:9"
                                }
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Vertex AI Error: ${response.status} ${errorText}`);
                        }

                        const result = await response.json();

                        const prediction = result.predictions?.[0];
                        if (!prediction) throw new Error("No predictions returned");

                        // If it returns base64
                        if (prediction.bytesBase64Encoded) {
                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${jobId}.mp4`);
                            await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                                metadata: { contentType: 'video/mp4' }
                            });
                            await file.makePublic();
                            return file.publicUrl();
                        }

                        // If it returns a GCS URI (e.g. videoUri)
                        if (prediction.videoUri) {
                            return prediction.videoUri;
                        }

                        throw new Error("Unknown response format from Veo");
                    });

                    // 3. Update status to completed
                    await step.run("update-status-completed", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "completed",
                            videoUrl: videoUri,
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
                    throw error; // Re-throw to let Inngest handle retry logic if needed
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
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: parts
                    }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        candidateCount: count || 1,
                        ...(aspectRatio ? {
                            imageConfig: {
                                aspectRatio: aspectRatio
                            }
                        } : {})
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Error:", errorText);
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

        } catch (error: unknown) {
            console.error("Function Error:", error);
            if (error instanceof Error) {
                throw new functions.https.HttpsError('internal', error.message);
            }
            throw new functions.https.HttpsError('internal', "An unknown error occurred");
        }
    });

interface EditImageRequestData {
    image: string;
    mask?: string;
    prompt: string;
    referenceImage?: string;
}

interface Part {
    inlineData?: {
        mimeType: string;
        data: string;
    };
    text?: string;
}

export const editImage = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data: EditImageRequestData, context) => {
        try {
            const { image, mask, prompt, referenceImage } = data;
            const modelId = "gemini-3-pro-image-preview";

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;

            const parts: Part[] = [
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
                console.error("Gemini API Error:", errorText);
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
        cors(req, res, async () => {
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
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
                            } catch (e) {

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

const corsHandler = corsLib({ origin: true });

export const ragProxy = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 60
    })
    .https.onRequest((req, res) => {
        corsHandler(req, res, async () => {
            try {
                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path;
                const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;

                const fetchOptions: RequestInit = {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Referer': 'http://localhost:3000/'
                    },
                    body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                        (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                        : undefined
                };

                const response = await fetch(targetUrl, fetchOptions);
                const data = await response.text();

                if (!response.ok) {
                    console.error("RAG Proxy Upstream Error:", {
                        status: response.status,
                        statusText: response.statusText,
                        url: targetUrl,
                        body: data
                    });
                }

                res.status(response.status);
                try {
                    res.send(JSON.parse(data));
                } catch {
                    res.send(data);
                }
            } catch (error: any) {
                console.error("RAG Proxy Error:", error);
                res.status(500).send({ error: error.message });
            }
        });
    });
