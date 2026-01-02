import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";
import { generateVideoLogic, VideoJobSchema } from "./lib/video";
import { TranscoderServiceClient } from "@google-cloud/video-transcoder";
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
        const { prompts, jobId, orgId, totalDuration, startImage, ...options } = data;

        // Validation: Ensure prompts is a non-empty array
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
        timeoutSeconds: 540 // 9 minutes
    })
    .https.onRequest((req, res) => {
        const inngestClient = getInngestClient();

        // 1. Standard Video Generation
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            generateVideoLogic
        );

        // 2. Long Form Video Generation (Daisychaining)
        const generateLongFormVideoFn = inngestClient.createFunction(
            { id: "generate-long-form-video" },
            { event: "video/long_form.requested" },
            async ({ event, step }) => {
                const { jobId, prompts, userId, orgId, startImage, options } = event.data;
                const segmentUrls: string[] = [];
                // Defensively declare as let to support future daisy-chaining implementation
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

                            // Check output format
                            if (!prediction.bytesBase64Encoded && !prediction.videoUri && !prediction.gcsUri) {
                                throw new Error(`Unknown Veo response format for segment ${i}: ` + JSON.stringify(prediction));
                            }

                            const bucket = admin.storage().bucket();
                            const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);

                            // If bytes returned, save to storage
                            if (prediction.bytesBase64Encoded) {
                                await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                                    metadata: { contentType: 'video/mp4' },
                                    public: true
                                });
                                return file.publicUrl();
                            }

                            // If URI returned (Video/GCS), return it directly (it's already a URL)
                            return prediction.videoUri || prediction.gcsUri;
                        });

                        segmentUrls.push(segmentUrl);

                        // Update progress
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
                        // For now, we reuse initial startImage or fail to update it, breaking daisy chain visual continuity.
                        // currentStartImage = ...
                    }

                    // 3. Trigger Stitching
                    await step.sendEvent({
                        name: "video/stitch.requested",
                        data: { jobId, userId, segmentUrls, options },
                        user: { id: userId }
                    });

                } catch (error: any) {
                    console.error("Long Form Logic Error:", error);
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        status: "failed",
                        error: error.message,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    throw error;
                }
            }
        );

        // 3. Stitching Function (Server-Side using Google Transcoder)
        const stitchVideoFn = inngestClient.createFunction(
            { id: "stitch-video-segments" },
            { event: "video/stitch.requested" },
            async ({ event, step }) => {
                const { jobId, userId, segmentUrls, options } = event.data;
                const transcoder = new TranscoderServiceClient();

                try {
                    const projectId = await admin.app().options.projectId;
                    if (!projectId) {
                        throw new Error("Project ID not configured");
                    }

                    const location = 'us-central1';
                    const bucket = admin.storage().bucket();
                    const outputUri = `gs://${bucket.name}/videos/${userId}/${jobId}_final.mp4`;

                    // Dynamic Resolution Logic
                    let width = 1280;
                    let height = 720;

                    if (options?.aspectRatio) {
                        switch (options.aspectRatio) {
                            case "9:16":
                                width = 720;
                                height = 1280;
                                break;
                            case "1:1":
                                width = 1080;
                                height = 1080;
                                break;
                            case "21:9":
                                width = 1920;
                                height = 822; // Approx for cinema scope
                                break;
                            case "16:9":
                            default:
                                width = 1280;
                                height = 720;
                                break;
                        }
                    } else if (options?.resolution) {
                        // Parse resolution string if provided (e.g. "1080p", "4k")
                        // For now default to 720p logic above if not explicit
                    }

                    // Create Transcoder Job
                    const transcoderJobName = await step.run("create-transcoder-job", async () => {
                        const [job] = await transcoder.createJob({
                            parent: transcoder.locationPath(projectId, location),
                            job: {
                                outputUri,
                                config: {
                                    inputs: segmentUrls.map((url: string, index: number) => {
                                        let uri = url;
                                        if (uri.startsWith('https://storage.googleapis.com/')) {
                                             uri = uri.replace('https://storage.googleapis.com/', 'gs://').replace(/\?.+$/, '');
                                        } else if (!uri.startsWith('gs://')) {
                                             // If it's a signed URL or other HTTP URL, we might need to download it or fail?
                                             // For now assuming storage.googleapis.com or gs://
                                             // If it comes from Veo as https uri, we hope it is accessible or convertible.
                                             // If Veo returns arbitrary public URL, Transcoder might not access it without gs://
                                             // Let's assume standard behavior for now.
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
                                                    heightPixels: height,
                                                    widthPixels: width,
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
                        return job.name;
                    });

                    // Update job with stitching status
                    await step.run("update-stitching-status", async () => {
                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                            status: "stitching",
                            transcoderJobName,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });

                    // Wait for completion (Polling)
                    // We poll every 5 seconds for up to 5 minutes
                    let finalState = 'PROCESSING';
                    for (let i = 0; i < 60; i++) {
                         await step.sleep("5s");
                         const status = await step.run(`check-job-status-${i}`, async () => {
                             const [job] = await transcoder.getJob({ name: transcoderJobName });
                             return job.state;
                         });

                         if (status === 'SUCCEEDED' || status === 'FAILED') {
                             finalState = status as string;
                             break;
                         }
                    }

                    if (finalState === 'SUCCEEDED') {
                         // Get Signed URL for final output
                         const videoUrl = await step.run("get-final-url", async () => {
                             const file = bucket.file(`videos/${userId}/${jobId}_final.mp4`);
                             const [url] = await file.getSignedUrl({
                                 action: 'read',
                                 expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                             });
                             return url;
                         });

                         await step.run("mark-completed", async () => {
                             await admin.firestore().collection("videoJobs").doc(jobId).set({
                                 status: "completed",
                                 videoUrl,
                                 progress: 100,
                                 updatedAt: admin.firestore.FieldValue.serverTimestamp()
                             }, { merge: true });
                         });

                    } else {
                        throw new Error(`Transcoding job failed or timed out with state: ${finalState}`);
                    }

                } catch (error: any) {
                    console.error("Stitching failed:", error);
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        status: "failed",
                        stitchError: error.message,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    throw error;
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
