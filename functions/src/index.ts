import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { GoogleAuth } from "google-auth-library";

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
            // 1. Create Initial Job Record in Firestore
            // We do this BEFORE sending the event to prevent race conditions where
            // the UI subscribes to a doc that doesn't exist yet.
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
                    // 1. Update status to processing
                    // Step 1: Update status to processing
                    await step.run("update-status-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // Step 2: Generate Video via Vertex AI (Veo)
                    const videoUri = await step.run("generate-veo-video", async () => {
                        // Use GoogleAuth to get credentials for Vertex AI
                        const auth = new GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });

                        const client = await auth.getClient();
                        const projectId = await auth.getProjectId();
                        const accessToken = await client.getAccessToken();
                        const location = 'us-central1';
                        // Using the Veo 3.1 Preview model
                        const modelId = 'veo-3.1-generate-preview';

                        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

                        // Construct request body for Veo
                        const requestBody = {
                            instances: [
                                {
                                    prompt: prompt,
                                }
                            ],
                            parameters: {
                                sampleCount: 1,
                                // Map options to Veo parameters
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

                        // Handle different possible response formats

                        // Case A: Base64 Encoded Video
                        if (prediction.bytesBase64Encoded) {
                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                            await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                                metadata: { contentType: 'video/mp4' },
                                public: true
                            });
                            // await file.makePublic(); // Optional depending on bucket config
                            // Save to a public path or user-specific path
                            const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                            const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');

                            await file.save(buffer, {
                                metadata: { contentType: 'video/mp4' },
                                public: true // Make public for easy access in prototype
                            });

                            return file.publicUrl();
                        }

                        // Case B: GCS URI
                        if (prediction.gcsUri) {
                             // Note: GCS URIs (gs://) are not directly accessible via HTTP.
                             // Ideally we would sign this URL or copy it to our bucket.
                             // For now, we return it as is, or we could copy it.
                             return prediction.gcsUri;
                        }

                        // Case C: Video URI (Direct HTTP link if supported)
                        if (prediction.videoUri) {
                            return prediction.videoUri;
                        }

                        // If it returns a GCS URI in gcsUri
                        if (prediction.gcsUri) {
                             return prediction.gcsUri;
                        }

                        throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
                    });

                    // Step 3: Update status to complete
                    await step.run("update-status-complete", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "completed", // Aligning with 'completed' vs 'complete' inconsistency - defaulting to 'completed'
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

const corsHandler = corsLib({ origin: true });

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
