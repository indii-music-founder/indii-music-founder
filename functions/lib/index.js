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
exports.ragProxy = exports.generateContentStream = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.triggerLongFormVideoJob = exports.triggerVideoJob = exports.getInngestClient = void 0;
// indiiOS Cloud Functions - V1.1
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const video_1 = require("./lib/video");
const google_auth_library_1 = require("google-auth-library");
const long_form_video_1 = require("./lib/long_form_video");
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
exports.getInngestClient = getInngestClient;
const corsHandler = (0, cors_1.default)({ origin: true });
const TIER_LIMITS = {
    free: {
        maxVideoDuration: 8 * 60, // 8 minutes
        maxVideoGenerationsPerDay: 5,
    },
    pro: {
        maxVideoDuration: 60 * 60, // 60 minutes
        maxVideoGenerationsPerDay: 50,
    },
    enterprise: {
        maxVideoDuration: 4 * 60 * 60, // 4 hours
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
    // Construct input matching the schema
    const inputData = Object.assign(Object.assign({}, data), { userId });
    // Zod Validation
    const validation = video_1.VideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`);
    }
    const { prompt, jobId, orgId } = inputData, options = __rest(inputData, ["prompt", "jobId", "orgId"]);
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
        const inngest = (0, exports.getInngestClient)();
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
    // Zod Validation
    const inputData = Object.assign(Object.assign({}, data), { userId });
    const validation = long_form_video_1.LongFormVideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    // Destructure validated data
    const _a = validation.data, { prompts, jobId, orgId, totalDuration, startImage } = _a, options = __rest(_a, ["prompts", "jobId", "orgId", "totalDuration", "startImage"]);
    // Additional validation
    if (prompts.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Prompts array must not be empty.");
    }
    try {
        // ------------------------------------------------------------------
        // Quota Enforcement (Server-Side)
        // ------------------------------------------------------------------
        // 1. Determine User Tier (Fallback to 'free')
        let userTier = 'free';
        if (orgId && orgId !== 'personal') {
            const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();
                userTier = (orgData === null || orgData === void 0 ? void 0 : orgData.plan) || 'free';
            }
        }
        const limits = TIER_LIMITS[userTier];
        // 2. Validate Duration Limit
        const durationNum = parseFloat(totalDuration || "0");
        if (durationNum > limits.maxVideoDuration) {
            throw new functions.https.HttpsError("resource-exhausted", `Video duration ${durationNum}s exceeds ${userTier} tier limit of ${limits.maxVideoDuration}s.`);
        }
        // 3. Validate Daily Usage Limit (Rate Limiting)
        const today = new Date().toISOString().split('T')[0];
        const usageRef = admin.firestore().collection('users').doc(userId).collection('usage').doc(today);
        await admin.firestore().runTransaction(async (transaction) => {
            var _a;
            const usageDoc = await transaction.get(usageRef);
            const currentUsage = usageDoc.exists ? (((_a = usageDoc.data()) === null || _a === void 0 ? void 0 : _a.videosGenerated) || 0) : 0;
            if (currentUsage >= limits.maxVideoGenerationsPerDay) {
                throw new functions.https.HttpsError("resource-exhausted", `Daily video generation limit reached for ${userTier} tier (${limits.maxVideoGenerationsPerDay}/day).`);
            }
            // Increment Usage Optimistically
            if (!usageDoc.exists) {
                transaction.set(usageRef, { videosGenerated: 1, date: today, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            else {
                transaction.update(usageRef, { videosGenerated: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        });
        // ------------------------------------------------------------------
        // 4. Create Parent Job Record
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
        const inngest = (0, exports.getInngestClient)();
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
    }
    catch (error) {
        console.error("[LongFormVideoJob] Error:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
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
    timeoutSeconds: 540 // 9 minutes
})
    .https.onRequest((req, res) => {
    const inngestClient = (0, exports.getInngestClient)();
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
                if (prediction.videoUri)
                    return prediction.videoUri;
                if (prediction.gcsUri)
                    return prediction.gcsUri;
                throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
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
    const generateLongFormVideo = (0, long_form_video_1.generateLongFormVideoFn)(inngestClient);
    // 3. Stitching Function (Server-Side using Google Transcoder)
    const stitchVideo = (0, long_form_video_1.stitchVideoFn)(inngestClient);
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideoFn, generateLongFormVideo, stitchVideo],
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
            const allowedPrefixes = [
                '/v1beta/files',
                '/v1beta/models',
                '/upload/v1beta/files'
            ];
            if (!allowedPrefixes.some(prefix => req.path.startsWith(prefix))) {
                res.status(403).send('Forbidden: Path not allowed');
                return;
            }
            const queryString = req.url.split('?')[1] || '';
            const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}${queryString ? `&${queryString}` : ''}`;
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