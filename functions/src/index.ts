// indiiOS Cloud Functions - V1.1
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { GoogleAuth } from "google-auth-library";
import { TranscoderServiceClient } from "@google-cloud/video-transcoder";

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
        const { prompts, jobId, orgId, totalDuration, startImage, ...options } = data;

        if (!prompts || !Array.isArray(prompts) || prompts.length === 0 || !jobId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: prompts (non-empty array) or jobId."
            );
        }

        // TODO: Add rate limiting check against user tier
        // Example: const userTier = await getUserTier(userId);
        // if (prompts.length > userTier.maxSegments) throw ...

        try {
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

                        return prediction.videoUri || prediction.gcsUri || "";
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
        const generateLongFormVideoFn = inngestClient.createFunction(
            { id: "generate-long-video-logic" },
            { event: "video/long_form.requested" },
            async ({ event, step }) => {
                const { jobId, prompts, userId, startImage, options } = event.data;
                const segmentUrls: string[] = [];
                // Note: currentStartImage needs to be updated for true daisychaining
                // Currently implementing simplified flow per MVP requirements
                let currentStartImage = startImage;

                try {
                    // Update main job status
                    await step.run("update-parent-processing", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "processing",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    for (let i = 0; i < prompts.length; i++) {
                        const segmentId = `${jobId}_seg_${i}`;
                        const prompt = prompts[i];

                        const segmentUrl = await step.run(`generate-segment-${i}`, async () => {
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
                                instances: [
                                    {
                                        prompt: prompt,
                                        ...(currentStartImage ? {
                                            image: {
                                                bytesBase64Encoded: currentStartImage.includes(',')
                                                    ? currentStartImage.split(',')[1]
                                                    : currentStartImage
                                            }
                                        } : {})
                                    }
                                ],
                                parameters: {
                                    sampleCount: 1,
                                    videoLength: "5s",
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
                                throw new Error(`Veo Segment ${i} failed: ${response.status} ${errorText}`);
                            }

                            const result = await response.json();

                            if (!result.predictions || result.predictions.length === 0) {
                                throw new Error(`Veo Segment ${i}: No predictions returned`);
                            }

                            const prediction = result.predictions[0];

                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);

                            if (prediction.bytesBase64Encoded) {
                                await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                                    metadata: { contentType: 'video/mp4' },
                                    public: true
                                });
                                return file.publicUrl();
                            }

                            if (prediction.videoUri) return prediction.videoUri;
                            if (prediction.gcsUri) return prediction.gcsUri;

                            throw new Error(`Unknown Veo response format for segment ${i}: ` + JSON.stringify(prediction));
                        });

                        segmentUrls.push(segmentUrl);

                        await step.run(`update-progress-${i}`, async () => {
                            await admin.firestore().collection("videoJobs").doc(jobId).set({
                                completedSegments: i + 1,
                                progress: Math.floor(((i + 1) / prompts.length) * 100),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                        });

                        // TODO: Extract last frame from segmentUrl to use as startImage for next segment
                        // This requires a frame extraction service (e.g., FFmpeg Cloud Function)
                        // Without this, segments won't have visual continuity
                        if (i < prompts.length - 1) {
                            console.warn(`[LongForm] Daisychaining not implemented - segment ${i} generated independently`);
                        }
                    }

                    await step.run("trigger-stitch", async () => {
                        await inngestClient.send({
                            name: "video/stitch.requested",
                            data: {
                                jobId,
                                userId,
                                segmentUrls
                            }
                        });
                    });

                } catch (error: any) {
                    await step.run("mark-failed", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "failed",
                            error: error.message,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });
                    throw error;
                }
            }
        );

        const stitchVideoFn = inngestClient.createFunction(
            { id: "stitch-video-segments" },
            { event: "video/stitch.requested" },
            async ({ event, step }) => {
                const { jobId, userId, segmentUrls } = event.data;
                const transcoder = new TranscoderServiceClient();

                try {
                    const projectId = await admin.app().options.projectId;
                    if (!projectId) {
                        throw new Error("Project ID not configured");
                    }
                    const location = 'us-central1';
                    const bucket = admin.storage().bucket();
                    const outputUri = `gs://${bucket.name}/videos/${userId}/${jobId}_final.mp4`;

                    await step.run("create-transcoder-job", async () => {
                        const [job] = await transcoder.createJob({
                            parent: transcoder.locationPath(projectId!, location),
                            job: {
                                outputUri,
                                config: {
                                    inputs: segmentUrls.map((url: string, index: number) => {
                                        let uri = url;
                                        if (uri.startsWith('https://storage.googleapis.com/')) {
                                            uri = uri.replace('https://storage.googleapis.com/', 'gs://').replace(/\?.+$/, '');
                                        } else if (!uri.startsWith('gs://')) {
                                            // Fallback or error, for now we assume it might be convertible or throw
                                            throw new Error(`Invalid storage URL format: ${url}`);
                                        }
                                        return { key: `input${index}`, uri };
                                    }),
                                    editList: [
                                        {
                                            key: "atom0",
                                            inputs: segmentUrls.map((_: any, index: number) => `input${index}`)
                                        }
                                    ],
                                    elementaryStreams: [
                                        {
                                            key: "video_stream0",
                                            videoStream: {
                                                h264: {
                                                    heightPixels: 720,
                                                    widthPixels: 1280,
                                                    bitrateBps: 5000000,
                                                    frameRate: 30,
                                                },
                                            },
                                        }
                                    ],
                                    muxStreams: [
                                        {
                                            key: "final_output",
                                            container: "mp4",
                                            elementaryStreams: ["video_stream0"],
                                        }
                                    ]
                                }
                            }
                        });

                        // Update job with temporary stitching status
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "stitching",
                            transcoderJobName: job.name,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                } catch (error: any) {
                    console.error("Stitching failed:", error);
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        status: "failed",
                        stitchError: error.message,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } finally {
                    await transcoder.close();
                }
            }
        );

        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn, generateLongFormVideoFn, stitchVideoFn],
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
                const allowedPrefixes = [
                    '/v1beta/files',
                    '/v1beta/models',
                    '/upload/v1beta/files'
                ];

                if (!allowedPrefixes.some(prefix => req.path.startsWith(prefix))) {
                    res.status(403).send('Forbidden: Path not allowed');
                    return;
                }

                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path;
                // Preserve query parameters
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
