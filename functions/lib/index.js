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
exports.ragProxy = exports.editImage = exports.generateImage = exports.inngestApi = exports.triggerVideoJob = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const google_auth_library_1 = require("google-auth-library");
// Initialize Firebase Admin
admin.initializeApp();
// Define Secrets
const inngestEventKey = (0, params_1.defineSecret)("INNGEST_EVENT_KEY");
const inngestSigningKey = (0, params_1.defineSecret)("INNGEST_SIGNING_KEY");
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
exports.generateImage = functions.https.onCall(async (data, context) => {
    try {
        const { prompt, aspectRatio, count, images } = data;
        const projectId = process.env.GCLOUD_PROJECT || "indiios-v-1-1";
        const location = "us-central1";
        const modelId = "gemini-3-pro-image-preview"; // Updated to latest Gemini 3 Image model
        // Note: Using the API Key provided by client? Or using Vertex AI IAM?
        // Client service passes apiKey, but we are in Cloud Functions effectively as a service account (if we init GoogleAuth).
        // Let's use Vertex AI IAM as it's more secure for backend.
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
        const parts = [{ text: prompt + (aspectRatio ? ` --aspect_ratio ${aspectRatio}` : '') }];
        if (images) {
            images.forEach(img => {
                parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            });
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                        role: "user",
                        parts: parts
                    }],
                generationConfig: {
                    responseMimeType: "application/json",
                    candidateCount: count || 1
                }
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vertex API Error:", errorText);
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
exports.editImage = functions.https.onCall(async (data, context) => {
    try {
        const { image, mask, prompt, referenceImage } = data;
        const projectId = process.env.GCLOUD_PROJECT || "indiios-v-1-1";
        const location = "us-central1";
        const modelId = "gemini-3-pro-image-preview";
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
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
        parts.push({ text: `Edit this image: ${prompt}` });
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: {
                    responseMimeType: "application/json"
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vertex API Error:", errorText);
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
 * RAG Proxy
 * Proxies requests to Google Generative Language API (Gemini) to hide API Key
 * and handle CORS/Referer restrictions server-side.
 */
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
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