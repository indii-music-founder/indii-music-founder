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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragProxy = exports.generateContentStream = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.triggerVideoJob = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const video_1 = require("./lib/video");
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
    // Construct input matching the schema
    // The client might pass { jobId, prompt, ... }
    // We ensure defaults are respected via Zod.
    const inputData = Object.assign(Object.assign({}, data), { userId });
    // Zod Validation
    const validation = video_1.VideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
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
    }
    catch (error) {
        console.error("[VideoJob] Error triggering Inngest:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue video job: ${error.message}`);
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
    // Actual Video Generation Logic using Veo
    const generateVideoFn = inngestClient.createFunction({ id: "generate-video-logic" }, { event: "video/generate.requested" }, video_1.generateVideoLogic);
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideoFn],
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