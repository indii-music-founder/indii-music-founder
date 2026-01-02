"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragProxy = exports.generateContentStream = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.triggerLongFormVideoJob = exports.triggerVideoJob = void 0;
// indiiOS Cloud Functions - V1.1
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const google_auth_library_1 = require("google-auth-library");
const video_transcoder_1 = require("@google-cloud/video-transcoder");
// Initialize Firebase Admin
admin.initializeApp();
// Define Secrets
const inngestEventKey = (0, params_1.defineSecret)("INNGEST_EVENT_KEY");
const inngestSigningKey = (0, params_1.defineSecret)("INNGEST_SIGNING_KEY");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
// Lazy Initialize Inngest Client
const getInngestClient = () => {
    return new inngest_1.Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};
const corsHandler = (0, cors_1.default)({ origin: true });
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
exports.triggerVideoJob = functions
    .runWith({
    secrets: [inngestEventKey],
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to trigger video generation.");
    }
    const userId = context.auth.uid;
    const { prompt, jobId, orgId } = data, options = __rest(data, ["prompt", "jobId", "orgId"]);
    if (!prompt || !jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: prompt or jobId.");
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
    }
    catch (error) {
        console.error("[VideoJob] Error triggering Inngest:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue video job: ${error.message}`);
    }
});
/**
 * Trigger Long Form Video Generation Job
 *
 * Handles multi-segment video generation (daisychaining) as a background process.
 */
exports.triggerLongFormVideoJob = functions
    .runWith({
    secrets: [inngestEventKey],
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated for long form generation.");
    }
    const userId = context.auth.uid;
    const { prompts, jobId, orgId, totalDuration, startImage } = data, options = __rest(data, ["prompts", "jobId", "orgId", "totalDuration", "startImage"]);
    if (!prompts || !Array.isArray(prompts) || !jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: prompts (array) or jobId.");
    }
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
    }
    catch (error) {
        console.error("[LongFormVideoJob] Error:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue long form job: ${error.message}`);
    }
});
/**
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
exports.inngestApi = functions
    .runWith({
    secrets: [inngestSigningKey, inngestEventKey],
    timeoutSeconds: 540 // 9 minutes, Veo generation can be slow
})
    .https.onRequest((req, res) => {
    const inngestClient = getInngestClient();
    // 1. Single Video Generation Logic using Veo
    const generateVideoFn = inngestClient.createFunction({ id: "generate-video-logic" }, { event: "video/generate.requested" }, async ({ event, step }) => {
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
                const auth = new google_auth_library_1.GoogleAuth({
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
                        videoLength: (options === null || options === void 0 ? void 0 : options.duration) || (options === null || options === void 0 ? void 0 : options.durationSeconds) || "5s",
                        aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9"
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
        }
        catch (error) {
            await step.run("update-status-failed", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "failed",
                    error: error.message || "Unknown error during video generation",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            throw error;
        }
    });
    // 2. Long Form Video Generation Logic (Daisychaining)
    const generateLongFormVideoFn = inngestClient.createFunction({ id: "generate-long-video-logic" }, { event: "video/long_form.requested" }, async ({ event, step }) => {
        const { jobId, prompts, userId, startImage, options } = event.data;
        const segmentUrls = [];
        const currentStartImage = startImage;
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
                    const auth = new google_auth_library_1.GoogleAuth({
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
                            Object.assign({ prompt: prompt }, (currentStartImage ? { image: { bytesBase64Encoded: currentStartImage.split(',')[1] } } : {}))
                        ],
                        parameters: {
                            sampleCount: 1,
                            videoLength: "5s",
                            aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9"
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
                    if (!response.ok)
                        throw new Error(`Veo Segment ${i} failed`);
                    const result = await response.json();
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
                    return prediction.videoUri || prediction.gcsUri || "";
                });
                segmentUrls.push(segmentUrl);
                await step.run(`update-progress-${i}`, async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        completedSegments: i + 1,
                        progress: Math.floor(((i + 1) / prompts.length) * 100),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
                // Note: In real daisychaining we would extract frame here.
                // Integration with separate frame extraction service would go here.
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
        }
        catch (error) {
            await step.run("mark-failed", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "failed",
                    error: error.message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            throw error;
        }
    });
    const stitchVideoFn = inngestClient.createFunction({ id: "stitch-video-segments" }, { event: "video/stitch.requested" }, async ({ event, step }) => {
        const { jobId, userId, segmentUrls } = event.data;
        const transcoder = new video_transcoder_1.TranscoderServiceClient();
        try {
            const projectId = await admin.app().options.projectId;
            const location = 'us-central1';
            const bucket = admin.storage().bucket();
            const outputUri = `gs://${bucket.name}/videos/${userId}/${jobId}_final.mp4`;
            await step.run("create-transcoder-job", async () => {
                const [job] = await transcoder.createJob({
                    parent: transcoder.locationPath(projectId, location),
                    job: {
                        outputUri,
                        config: {
                            inputs: segmentUrls.map((url, index) => ({
                                key: `input${index}`,
                                uri: url.replace('https://storage.googleapis.com/', 'gs://').replace(/\?.+$/, '')
                            })),
                            editList: [
                                {
                                    key: "atom0",
                                    inputs: segmentUrls.map((_, index) => `input${index}`)
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
        }
        catch (error) {
            console.error("Stitching failed:", error);
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                stitchError: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    });
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideoFn, generateLongFormVideoFn, stitchVideoFn],
        signingKey: inngestSigningKey.value(),
    });
    return handler(req, res);
});
exports.generateImageV3 = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
    try {
        const { prompt, aspectRatio, count, images } = data;
        const modelId = "gemini-3-pro-image-preview";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;
        const parts = [{ text: prompt }];
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
                generationConfig: Object.assign({ responseModalities: ["TEXT", "IMAGE"], candidateCount: count || 1 }, (aspectRatio ? { imageConfig: { aspectRatio } } : {}))
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new functions.https.HttpsError('internal', errorText);
        }
        const result = await response.json();
        const candidates = result.candidates || [];
        const processedImages = candidates.flatMap((c) => {
            var _a;
            return (((_a = c.content) === null || _a === void 0 ? void 0 : _a.parts) || [])
                .filter((p) => p.inlineData)
                .map((p) => ({
                bytesBase64Encoded: p.inlineData.data,
                mimeType: p.inlineData.mimeType
            }));
        });
        return { images: processedImages };
    }
    catch (error) {
        console.error("Function Error:", error);
        throw new functions.https.HttpsError('internal', error.message || "Unknown error");
    }
});
exports.editImage = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
    try {
        const { image, mask, prompt, referenceImage } = data;
        const modelId = "gemini-3-pro-image-preview";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;
        const parts = [
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
    }
    catch (error) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});
exports.generateContentStream = functions
    .runWith({
    secrets: [geminiApiKey],
    timeoutSeconds: 300
})
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e, _f;
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
        }
        catch (error) {
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
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            if (!reader) {
                res.status(500).send('No response body');
                return;
            }
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const text = (_f = (_e = (_d = (_c = (_b = data.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text;
                            if (text) {
                                res.write(JSON.stringify({ text }) + '\n');
                            }
                        }
                        catch (_g) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }
            res.end();
        }
        catch (error) {
            console.error("[generateContentStream] Error:", error);
            if (!res.headersSent) {
                res.status(500).send(error.message);
            }
            else {
                res.end();
            }
        }
    });
});
exports.ragProxy = functions
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
        }
        catch (error) {
            res.status(403).send('Forbidden: Invalid Token');
            return;
        }
        try {
            const baseUrl = 'https://generativelanguage.googleapis.com';
            const targetPath = req.path;
            const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;
            const fetchOptions = {
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
            try {
                res.send(JSON.parse(data));
            }
            catch (_a) {
                res.send(data);
            }
        }
        catch (error) {
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=index.js.map