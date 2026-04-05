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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editImageFn = exports.generateImageV3Fn = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const genai_1 = require("@google/genai");
const models_1 = require("../config/models");
const image_1 = require("./image");
const secrets_1 = require("../config/secrets");
const rateLimit_1 = require("./rateLimit");
/**
 * GeminiImageService
 *
 * Centralized service for interacting with Gemini 3 Pro and Flash image models.
 * Manages SDK client lifecycle, error mapping, and dual-view editing pipelines.
 */
class GeminiImageService {
    constructor() {
        this.client = null;
    }
    getClient() {
        if (!this.client) {
            const apiKey = (0, secrets_1.getGeminiApiKey)();
            this.client = new genai_1.GoogleGenAI({ apiKey });
        }
        return this.client;
    }
    /**
     * Map Gemini API errors to Firebase HTTPS Errors
     */
    handleApiError(error, context) {
        console.error(`[GeminiImageService:${context}] Error:`, error);
        const message = error.message || "Unknown Gemini API error";
        let status = error.status;
        // Handle fetch errors where we manually added status to the error message
        if (!status && message.includes("Vertex AI Image Edit API Error:")) {
            const match = message.match(/Error: (\d+)/);
            if (match)
                status = parseInt(match[1]);
        }
        console.error(`[GeminiImageService:${context}] Extracted Status: ${status} | Message: ${message}`);
        if (status === 400 || message.includes("400")) {
            throw new functions.https.HttpsError("invalid-argument", `Gemini API Request Error: ${message}`);
        }
        if (status === 401 || status === 403 || message.includes("401") || message.includes("403")) {
            throw new functions.https.HttpsError("permission-denied", `Gemini API Authentication Error: ${message}`);
        }
        if (status === 404 || message.includes("404")) {
            throw new functions.https.HttpsError("not-found", `Gemini API Resource Not Found: ${message}`);
        }
        if (status === 429 || message.includes("429")) {
            throw new functions.https.HttpsError("resource-exhausted", "Gemini API rate limit exceeded. Please try again later.");
        }
        if (status === 504 || status === 503 || message.includes("deadline") || error.name === 'AbortError') {
            throw new functions.https.HttpsError("deadline-exceeded", "Gemini API timed out during generation. The model may be overloaded.");
        }
        throw new functions.https.HttpsError("internal", `Gemini Image Generation Failed (${context}): ${message}`);
    }
    /**
     * Core Text-to-Image Generation
     *
     * 'fast' model → Gemini multimodal generateContent with IMAGE modality (instant, no aspect ratio control)
     * 'pro' model  → Vertex AI Gemini Image REST API (proper aspect ratio, seed control, higher fidelity)
     */
    async generate(data) {
        var _a;
        const isFast = data.model === 'fast';
        const modelId = isFast
            ? models_1.FUNCTION_AI_MODELS.IMAGE.FAST
            : models_1.FUNCTION_AI_MODELS.IMAGE.GENERATION;
        console.log(`[GeminiImageService:generate] Mode: ${isFast ? 'fast (Gemini)' : 'pro (Gemini Image)'} | Prompt: "${data.prompt.substring(0, 50)}..."`);
        try {
            if (isFast) {
                // --- Fast Path: Gemini Multimodal (sub-second, no aspect ratio control) ---
                const client = this.getClient();
                const result = await client.models.generateContent({
                    model: modelId,
                    contents: [{ role: "user", parts: [{ text: data.prompt }] }],
                    config: Object.assign({ candidateCount: data.count || 1, responseModalities: ["IMAGE"] }, (data.useGrounding ? { groundingConfig: { searchGrounding: { enableSearch: true } } } : {}))
                });
                if (!result.candidates || result.candidates.length === 0) {
                    throw new Error("No candidates returned from Gemini API");
                }
                const images = result.candidates[0].content.parts
                    .filter(p => !!p.inlineData)
                    .map(p => ({
                    bytesBase64Encoded: p.inlineData.data,
                    mimeType: p.inlineData.mimeType || "image/png"
                }));
                if (images.length === 0) {
                    throw new Error("No image data found in candidates");
                }
                return {
                    images,
                    aiMetadata: {
                        toolName: modelId,
                        generationType: 'text-to-image',
                        isAIGenerated: true,
                        timestamp: new Date().toISOString(),
                        promptSnippet: data.prompt.substring(0, 100)
                    },
                    aiGenerationInfo: {
                        isFullyAIGenerated: true,
                        isPartiallyAIGenerated: false,
                        aiToolsUsed: [modelId],
                        humanContributionDescription: `Generated via indiiOS using prompt: "${data.prompt.substring(0, 100)}..."`
                    }
                };
            }
            else {
                // --- Pro Path: Vertex AI Gemini Image REST API (full aspect ratio, seed, personGeneration) ---
                const { GoogleAuth } = await Promise.resolve().then(() => __importStar(require("google-auth-library")));
                const proModel = models_1.FUNCTION_AI_MODELS.IMAGE.GENERATION;
                const auth = new GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const projectId = await auth.getProjectId();
                const accessToken = await client.getAccessToken();
                const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${proModel}:predict`;
                const requestBody = {
                    instances: [
                        { prompt: data.prompt }
                    ],
                    parameters: {
                        sampleCount: Math.min(data.count || 1, 4),
                        aspectRatio: data.aspectRatio || "1:1",
                        personGeneration: "allow_adult",
                        addWatermark: false
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
                    let errorText = await response.text();
                    try {
                        const parsedError = JSON.parse(errorText);
                        errorText = ((_a = parsedError.error) === null || _a === void 0 ? void 0 : _a.message) || errorText;
                    }
                    catch (_e) { /* ignore JSON parse error */ }
                    throw new Error(`Vertex AI Image API Error: ${response.status} ${errorText}`);
                }
                const result = await response.json();
                if (!result.predictions || result.predictions.length === 0) {
                    throw new Error("No images returned from Image API");
                }
                const images = result.predictions.map((p) => ({
                    bytesBase64Encoded: p.bytesBase64Encoded,
                    mimeType: p.mimeType || "image/png"
                }));
                return {
                    images,
                    aiMetadata: {
                        toolName: proModel,
                        generationType: 'text-to-image',
                        isAIGenerated: true,
                        timestamp: new Date().toISOString(),
                        promptSnippet: data.prompt.substring(0, 100)
                    },
                    aiGenerationInfo: {
                        isFullyAIGenerated: true,
                        isPartiallyAIGenerated: false,
                        aiToolsUsed: [proModel],
                        humanContributionDescription: `Generated via indiiOS Gemini Image Pro using prompt: "${data.prompt.substring(0, 100)}..."`
                    }
                };
            }
        }
        catch (error) {
            this.handleApiError(error, "generate");
        }
    }
    /**
     * Advanced Instruction-Based Editing via Gemini generateContent
     * Sends the source image + text instruction as multimodal parts.
     */
    async edit(data) {
        const modelId = models_1.FUNCTION_AI_MODELS.IMAGE.GENERATION;
        try {
            console.log(`[GeminiImageService:edit] Model: ${modelId} | Instruction: "${data.prompt.substring(0, 50)}..."`);
            const client = this.getClient();
            // Build multimodal parts: source image + text instruction
            const parts = [];
            // Add the source image as inline data
            if (data.image) {
                parts.push({
                    inlineData: {
                        mimeType: data.imageMimeType || "image/png",
                        data: data.image
                    }
                });
            }
            // Add mask image if provided
            if (data.mask) {
                parts.push({
                    inlineData: {
                        mimeType: data.maskMimeType || "image/png",
                        data: data.mask
                    }
                });
                // When mask is provided, instruct the model to edit within the masked region
                parts.push({ text: `Edit the masked region of this image: ${data.prompt}` });
            }
            else {
                parts.push({ text: data.prompt });
            }
            const result = await client.models.generateContent({
                model: modelId,
                contents: [{ role: "user", parts }],
                config: {
                    responseModalities: ["IMAGE"],
                }
            });
            if (!result.candidates || result.candidates.length === 0) {
                throw new Error("No candidates returned from Gemini Edit API");
            }
            const imageParts = result.candidates[0].content.parts
                .filter(p => !!p.inlineData);
            if (imageParts.length === 0) {
                throw new Error("No image data found in edit response");
            }
            const genImg = imageParts[0];
            return {
                base64: genImg.inlineData.data,
                mimeType: genImg.inlineData.mimeType || "image/png",
                thoughtSignature: undefined, // Not provided by editImage response
                aiMetadata: {
                    toolName: modelId,
                    generationType: 'image-to-image',
                    isAIGenerated: true,
                    timestamp: new Date().toISOString(),
                    promptSnippet: data.prompt.substring(0, 100)
                },
                aiGenerationInfo: {
                    isFullyAIGenerated: false,
                    baseModel: modelId,
                    generatorType: "cloud_function"
                }
            };
        }
        catch (error) {
            return this.handleApiError(error, "edit");
        }
    }
}
const service = new GeminiImageService();
/**
 * Cloud Function Entry Points
 */
const generateImageV3Fn = () => functions
    .region("us-west1")
    .runWith({
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [secrets_1.geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MB"
})
    .https.onCall(async (data, context) => {
    // 1. Authenticate
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    // 1b. Item 326: Rate limit — image generation is the highest-cost endpoint
    await (0, rateLimit_1.enforceRateLimit)(context.auth.uid, "generateImageV3", rateLimit_1.RATE_LIMITS.generation);
    // 2. Validate Input
    const validation = image_1.GenerateImageRequestSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    // 3. Delegate to Service
    return await service.generate(validation.data);
});
exports.generateImageV3Fn = generateImageV3Fn;
const editImageFn = () => functions
    .region("us-west1")
    .runWith({
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [secrets_1.geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MB"
})
    .https.onCall(async (data, context) => {
    // 1. Authenticate
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    // 1b. Item 326: Rate limit — image editing is a high-cost operation
    await (0, rateLimit_1.enforceRateLimit)(context.auth.uid, "editImage", rateLimit_1.RATE_LIMITS.generation);
    // 2. Validate Input
    const validation = image_1.EditImageRequestSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    // 3. Delegate to Service
    const result = await service.edit(validation.data);
    // Map to candidates format for frontend compatibility
    const candidates = [
        {
            content: {
                parts: [
                    {
                        inlineData: {
                            mimeType: result.mimeType,
                            data: result.base64
                        }
                    }
                ]
            }
        }
    ];
    return {
        candidates,
        aiMetadata: result.aiMetadata,
        aiGenerationInfo: result.aiGenerationInfo
    };
});
exports.editImageFn = editImageFn;
//# sourceMappingURL=image_generation.js.map