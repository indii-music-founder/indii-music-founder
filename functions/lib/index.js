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
exports.ragProxy = exports.generateContentStream = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.triggerVideoJob = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
// GoogleAuth removed as we switched to API Key for Gemini 3 Image models
// Initialize Firebase Admin
admin.initializeApp();
// Define Secrets
const inngestEventKey = (0, params_1.defineSecret)("INNGEST_EVENT_KEY");
const inngestSigningKey = (0, params_1.defineSecret)("INNGEST_SIGNING_KEY");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
// Lazy Initialize Inngest Client
// We use a function factory or lazy initialization inside the handler to ensure secrets are available
const getInngestClient = () => {
    return new inngest_1.Inngest({
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
exports.triggerVideoJob = functions
    .runWith({
    secrets: [inngestEventKey],
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to trigger video generation.");
    }
    const userId = context.auth.uid;
    const { prompt, jobId, orgId } = data, options = __rest(data, ["prompt", "jobId", "orgId"]);
    if (!prompt || !jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: prompt or jobId.");
    }
    try {
        // 2. Publish Event to Inngest
        const inngest = getInngestClient();
        await inngest.send({
            name: "video/generate.requested",
            data: {
                jobId: jobId,
                userId: userId,
                orgId: orgId || "personal", // Default to personal if missing
                prompt: prompt,
                options: options, // Pass through other options (aspect ratio, etc.)
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
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
exports.inngestApi = functions
    .runWith({ secrets: [inngestSigningKey, inngestEventKey] })
    .https.onRequest((req, res) => {
    // Initialize client INSIDE the handler to ensure secrets are available
    const inngestClient = getInngestClient();
    // Placeholder for actual video generation functions
    const generateVideoFn = inngestClient.createFunction({ id: "generate-video-logic" }, { event: "video/generate.requested" }, async ({ event, step }) => {
        return { message: "Placeholder implementation restored." };
    });
    // Create the serve handler dynamically
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideoFn],
        signingKey: inngestSigningKey.value(),
    });
    // Execute the handler
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
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                        role: "user",
                        parts: parts
                    }],
                generationConfig: Object.assign({ responseModalities: ["TEXT", "IMAGE"], candidateCount: count || 1 }, (aspectRatio ? {
                    imageConfig: {
                        aspectRatio: aspectRatio // The API expects literal string like "16:9"
                    }
                } : {}))
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            throw new functions.https.HttpsError('internal', errorText);
        }
        const result = await response.json();
        // Transform Google AI SDK response to match what the client expects
        // Client expects { images: [{ bytesBase64Encoded: string }] }
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
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
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
            console.error("Gemini API Error:", errorText);
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
/**
 * Generate Content Stream Proxy
 * Proxies streaming requests to Gemini API
 */
exports.generateContentStream = functions
    .runWith({
    secrets: [geminiApiKey],
    timeoutSeconds: 300
})
    .https.onRequest((req, res) => {
    cors(req, res, async () => {
        var _a, _b, _c, _d, _e, _f;
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        try {
            const { model, contents, config } = req.body;
            const modelId = model || "gemini-3-pro-preview";
            // Use the streamGenerateContent endpoint with SSE
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
            // Proxy the stream
            res.setHeader('Content-Type', 'text/plain'); // AIService expects text chunks parsed as JSON
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
                                // Send as NDJSON line
                                res.write(JSON.stringify({ text }) + '\n');
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON
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
/**
 * RAG Proxy
 * Proxies requests to Google Generative Language API (Gemini) to hide API Key
 * and handle CORS/Referer restrictions server-side.
 */
// geminiApiKey is now defined at the top
const cors = (0, cors_1.default)({ origin: true });
exports.ragProxy = functions
    .runWith({
    secrets: [geminiApiKey],
    timeoutSeconds: 60
})
    .https.onRequest((req, res) => {
    cors(req, res, async () => {
        // 1. Validate Authentication (Optional but recommended for production)
        // For now, we allow authentic calls or public if strict auth not required yet
        // 2. Proxy Logic
        try {
            const baseUrl = 'https://generativelanguage.googleapis.com';
            const targetPath = req.path; // e.g., /v1beta/corpora
            const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;
            const fetchOptions = {
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                    // Spoof Referer to satisfy API Key restrictions.
                    // Since this is a proxy, we claim to be the allowed client.
                    'Referer': 'http://localhost:3000/'
                },
                body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                    (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                    : undefined
            };
            const response = await fetch(targetUrl, fetchOptions);
            // Read text explicitly to avoid stream issues in standard fetch inside functions environment if any
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
            }
            catch (_a) {
                res.send(data);
            }
        }
        catch (error) {
            console.error("RAG Proxy Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=index.js.map