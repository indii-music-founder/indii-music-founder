import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS, NANO_BANANA_CAPABILITIES, type NanoBananaTier } from "../config/models";
import {
    GenerateImageRequestSchema,
    EditImageRequestSchema,
    type EditImageRequest,
    type GenerateImageRequest,
} from "./image";

import { geminiApiKey, getGeminiApiKey } from "../config/secrets";
import { enforceRateLimit, RATE_LIMITS } from "./rateLimit";

// ============================================================================
// TYPES
// ============================================================================

interface ImageResult {
    bytesBase64Encoded: string;
    mimeType: string;
}

interface GenerateResponse {
    images: ImageResult[];
    textNarration?: string;
    thoughtSignature?: string;
    groundingMetadata?: Record<string, unknown>;
    aiMetadata: Record<string, unknown>;
    aiGenerationInfo: Record<string, unknown>;
}

interface EditResponse {
    base64: string;
    mimeType: string;
    textNarration?: string;
    thoughtSignature?: string;
    groundingMetadata?: Record<string, unknown>;
    aiMetadata: Record<string, unknown>;
    aiGenerationInfo: Record<string, unknown>;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * GeminiImageService
 *
 * Centralized service for Nano Banana image generation and editing.
 * Supports all 3 tiers: Legacy (OG), Fast (Nano Banana 2), Pro (Nano Banana Pro).
 *
 * Full feature support:
 * - Text-to-image with configurable aspect ratio + resolution
 * - Multi-reference images (up to 14)
 * - Google Search + Image Search grounding
 * - Thinking level control + thought signature circulation
 * - Multi-turn conversation history for iterative editing
 * - Interleaved text + image output
 */
export class GeminiImageService {
    private client: GoogleGenAI | null = null;

    /**
     * Lazily initializes and returns the Google Gen AI client.
     * @returns The initialized GoogleGenAI instance.
     * @throws {functions.https.HttpsError} If the API key is missing or invalid.
     */
    private getClient(): GoogleGenAI {
        if (!this.client) {
            const apiKey = getGeminiApiKey();
            if (!apiKey || apiKey.includes("PLACEHOLDER")) {
                console.error("[GeminiImageService] Invalid or missing GEMINI_API_KEY. Operations will fail.");
                throw new functions.https.HttpsError("permission-denied", "Gemini API Key is missing or invalid.");
            }

            console.log(`[GeminiImageService] Initializing Google Gen AI Client (API_KEY: ${apiKey.substring(0, 4)}...)`);
            this.client = new GoogleGenAI({ apiKey });
        }
        return this.client;
    }

    /**
     * Resolves a NanoBananaTier to its corresponding model ID string.
     * @param tier - The tier to resolve.
     * @returns The model ID string (e.g., 'gemini-3.1-flash-image-preview').
     */
    private resolveModelId(tier: NanoBananaTier | undefined | null): string {
        switch (tier) {
            case "pro":
                return FUNCTION_AI_MODELS.IMAGE.GENERATION;
            case "legacy":
                return FUNCTION_AI_MODELS.IMAGE.LEGACY;
            case "fast":
            default:
                return FUNCTION_AI_MODELS.IMAGE.FAST;
        }
    }

    /**
     * Build the SDK config object from request parameters.
     * Maps our schema fields to the exact Gemini SDK config shape.
     * 
     * @param data - The raw request data from the client.
     * @param modelId - The resolved model ID string.
     * @returns A configuration object compatible with the Google Gen AI SDK.
     */
    private buildConfig(data: {
        aspectRatio?: string | null;
        imageSize?: string | null;
        thinkingLevel?: string | null;
        includeThoughts?: boolean | null;
        useGoogleSearch?: boolean | null;
        useImageSearch?: boolean | null;
        responseFormat?: string | null;
        count?: number | null;
        // Legacy compat
        thinking?: boolean | null;
        useGrounding?: boolean | null;
    }, modelId: string): Record<string, unknown> {
        const capabilities = NANO_BANANA_CAPABILITIES[modelId as keyof typeof NANO_BANANA_CAPABILITIES];
        const isPro = capabilities?.tier === "pro";

        // Response modalities
        const wantsText = data.responseFormat === "image_and_text";
        const responseModalities = wantsText ? ["TEXT", "IMAGE"] : ["IMAGE"];

        // Image config — always pass when we have values
        const imageConfig: Record<string, unknown> = {};
        if (data.aspectRatio) {
            imageConfig.aspectRatio = data.aspectRatio;
        }
        if (data.imageSize) {
            // Ensure uppercase K (API rejects lowercase)
            imageConfig.imageSize = data.imageSize.toUpperCase();
        }

        // Thinking config — Flash supports level control; Pro always thinks
        const thinkingConfig: Record<string, unknown> = {};
        const effectiveThinkingLevel = data.thinkingLevel || (data.thinking ? "high" : null);
        if (effectiveThinkingLevel && capabilities?.supportsThinkingControl) {
            // Flash: capitalize first letter for API ("minimal" → "Minimal", "high" → "High")
            thinkingConfig.thinkingLevel = effectiveThinkingLevel.charAt(0).toUpperCase() + effectiveThinkingLevel.slice(1);
        }
        if (data.includeThoughts) {
            thinkingConfig.includeThoughts = true;
        }

        // Grounding tools — use `tools` array (NOT deprecated `groundingConfig`)
        const effectiveUseSearch = data.useGoogleSearch || data.useGrounding;
        let tools: Record<string, unknown>[] | undefined;
        if (effectiveUseSearch) {
            if (data.useImageSearch && !isPro) {
                // Image Search: Flash only. Build searchTypes with both web + image.
                tools = [{
                    googleSearch: {
                        searchTypes: {
                            webSearch: {},
                            imageSearch: {},
                        },
                    },
                }];
            } else {
                // Standard Google Search grounding
                tools = [{ googleSearch: {} }];
            }
        }

        // Assemble config
        const config: Record<string, unknown> = {
            responseModalities,
        };

        // Pro only supports 1 candidate
        if (!isPro && data.count && data.count > 1) {
            config.candidateCount = data.count;
        }

        if (Object.keys(imageConfig).length > 0) {
            config.imageConfig = imageConfig;
        }

        if (Object.keys(thinkingConfig).length > 0) {
            config.thinkingConfig = thinkingConfig;
        }

        if (tools) {
            config.tools = tools;
        }

        return config;
    }

    /**
     * Build the contents array for the API call.
     * Handles: plain text, reference images, and conversation history.
     * 
     * @param modelId - The Gemini model ID being used.
     * @returns An array of content objects for the Gemini model.
     */
    private buildContents(
        data: {
            prompt: string;
            images?: { mimeType: string; data: string }[] | null;
            conversationHistory?: { role: string; parts: Record<string, unknown>[] }[] | null;
            thoughtSignature?: string | null;
        },
        modelId: string
    ): Record<string, unknown>[] {
        const caps = NANO_BANANA_CAPABILITIES[modelId as keyof typeof NANO_BANANA_CAPABILITIES];
        const maxRefImages = caps?.maxReferenceImages ?? 0;

        // Multi-turn: if conversation history is provided, use it as the base
        // and append the new user message at the end
        if (data.conversationHistory && data.conversationHistory.length > 0) {
            const contents = [...data.conversationHistory];

            // Build the new user turn
            const userParts: Record<string, unknown>[] = [];

            // Add reference images first (if supported)
            if (maxRefImages > 0 && data.images && data.images.length > 0) {
                const imagesToAdd = data.images.slice(0, maxRefImages);
                for (const img of imagesToAdd) {
                    userParts.push({
                        inlineData: {
                            mimeType: img.mimeType,
                            data: img.data,
                        },
                    });
                }
            }

            // Text prompt
            userParts.push({ text: data.prompt });

            contents.push({ role: "user", parts: userParts });
            return contents;
        }

        // Single-turn: build a flat contents array
        const parts: Record<string, unknown>[] = [];

        // Text prompt first
        parts.push({ text: data.prompt });

        // Reference images (if supported)
        if (maxRefImages > 0 && data.images && data.images.length > 0) {
            const imagesToAdd = data.images.slice(0, maxRefImages);
            for (const img of imagesToAdd) {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data,
                    },
                });
            }
        }

        return [{ role: "user", parts }];
    }

    /**
     * Extracts results (images, text, thoughts) from the generic model response object.
     * 
     * @param result - The raw JSON result from the Gemini API.
     * @returns Extracted data including images, narrative text, and grounding metadata.
     * @throws {Error} If no candidates or content parts are found in the response.
     */
    private extractResults(result: Record<string, unknown>): {
        images: ImageResult[];
        textParts: string[];
        thoughtSignature?: string;
        groundingMetadata?: Record<string, unknown>;
    } {
        const candidates = result.candidates as any[];
        if (!candidates || candidates.length === 0) {
            throw new Error("No candidates returned from Gemini API");
        }

        const candidate = candidates[0];
        const parts = candidate?.content?.parts;
        if (!parts || parts.length === 0) {
            throw new Error("No content parts in response");
        }

        const images: ImageResult[] = [];
        const textParts: string[] = [];
        let thoughtSignature: string | undefined;

        for (const part of parts) {
            // Skip thinking parts (thought: true) — they don't contain final output
            if (part.thought === true) {
                continue;
            }

            // Extract thought signature from non-thought parts
            if (part.thought_signature || part.thoughtSignature) {
                thoughtSignature = part.thought_signature || part.thoughtSignature;
            }

            // Image data
            if (part.inlineData) {
                images.push({
                    bytesBase64Encoded: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "image/png",
                });
            }

            // Text narration
            if (part.text && !part.thought) {
                textParts.push(part.text);
            }
        }

        // Extract grounding metadata (search results, source URLs)
        const groundingMetadata = candidate.groundingMetadata || undefined;

        return { images, textParts, thoughtSignature, groundingMetadata };
    }

    /**
     * Maps low-level Gemini API errors to structured Firebase Cloud Function errors.
     * 
     * @param error - The raw error object caught from the SDK.
     * @param context - Descriptive context (e.g., 'generate' or 'edit') for logging.
     * @returns This method never returns normally; it always throws.
     * @throws {functions.https.HttpsError} Structured error for the client.
     */
    private handleApiError(error: unknown, context: string): never {
        const err = error as any;
        console.error(`[GeminiImageService:${context}] Error:`, err);

        const message = err.message || "Unknown Gemini API error";
        let status = err.status;

        // Handle fetch errors where we manually added status to the error message
        if (!status && message.includes("Vertex AI Image Edit API Error:")) {
            const match = message.match(/Error: (\d+)/);
            if (match) status = parseInt(match[1]);
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
        if (status === 504 || status === 503 || message.includes("deadline") || err.name === 'AbortError') {
            throw new functions.https.HttpsError("deadline-exceeded", "Gemini API timed out during generation. The model may be overloaded.");
        }

        throw new functions.https.HttpsError("internal", `Gemini Image Generation Failed (${context}): ${message}`);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Core Text-to-Image Generation
     *
     * Supports all 3 Nano Banana tiers with full feature passthrough:
     * - imageConfig (aspectRatio, imageSize)
     * - thinkingConfig (thinkingLevel, includeThoughts)
     * - tools (googleSearch, imageSearch)
     * - reference images (up to 14)
     * - multi-turn conversation history
     * - interleaved text + image output
     */
    async generate(data: GenerateImageRequest): Promise<GenerateResponse> {
        const tier = (data.model || "fast") as NanoBananaTier;
        const modelId = this.resolveModelId(tier);

        console.log(`[GeminiImageService:generate] Tier: ${tier} | Model: ${modelId} | Prompt: "${data.prompt.substring(0, 50)}..."`);

        try {
            const client = this.getClient();
            const config = this.buildConfig(data, modelId);
            const contents = this.buildContents(data, modelId);

            console.log(`[GeminiImageService:generate] Config:`, JSON.stringify({
                model: modelId,
                responseModalities: config.responseModalities,
                hasImageConfig: !!config.imageConfig,
                hasThinkingConfig: !!config.thinkingConfig,
                hasTools: !!config.tools,
                contentsTurns: contents.length,
                refImageCount: data.images?.length || 0,
            }));

            const result = await client.models.generateContent({
                model: modelId,
                contents: contents as any,
                config: config as any,
            });

            const extracted = this.extractResults(result as any);

            if (extracted.images.length === 0) {
                throw new Error("No image data found in response");
            }

            return {
                images: extracted.images,
                textNarration: extracted.textParts.length > 0
                    ? extracted.textParts.join("\n\n")
                    : undefined,
                thoughtSignature: extracted.thoughtSignature,
                groundingMetadata: extracted.groundingMetadata,
                aiMetadata: {
                    toolName: modelId,
                    tier,
                    generationType: "text-to-image",
                    isAIGenerated: true,
                    timestamp: new Date().toISOString(),
                    promptSnippet: data.prompt.substring(0, 100),
                    aspectRatio: data.aspectRatio || "1:1",
                    imageSize: data.imageSize || "1K",
                    referenceImageCount: data.images?.length || 0,
                    hasGrounding: !!(data.useGoogleSearch || data.useGrounding),
                    hasThinking: !!(data.thinkingLevel || data.thinking),
                    isMultiTurn: !!(data.conversationHistory && data.conversationHistory.length > 0),
                },
                aiGenerationInfo: {
                    isFullyAIGenerated: true,
                    isPartiallyAIGenerated: false,
                    aiToolsUsed: [modelId],
                    humanContributionDescription: `Generated via indiiOS ${tier} using prompt: "${data.prompt.substring(0, 100)}..."`,
                },
            };
        } catch (error) {
            this.handleApiError(error, "generate");
        }
    }

    /**
     * Image Editing via Gemini generateContent
     *
     * Supports:
     * - Source image + text instruction
     * - Binary mask for inpainting
     * - Multiple reference images for composition
     * - Multi-turn conversation history for iterative editing
     * - Full config passthrough (imageConfig, thinkingConfig, tools)
     * - Thought signature circulation
     * 
     * @param data - The edit request containing source image, mask, and instructions.
     * @returns A promise resolving to the edited image and narration.
     */
    async edit(data: EditImageRequest): Promise<EditResponse> {
        // Resolve model — accept tier string or full model ID
        let modelId: string;
        if (data.model === "pro" || data.model === "fast" || data.model === "legacy") {
            modelId = this.resolveModelId(data.model as NanoBananaTier);
        } else if (data.model) {
            modelId = data.model;
        } else {
            modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION; // Default to Pro for editing
        }

        console.log(`[GeminiImageService:edit] Model: ${modelId} | Prompt: "${data.prompt.substring(0, 50)}..."`);

        try {
            const client = this.getClient();

            // Build config with edit-specific fields
            const config = this.buildConfig({
                aspectRatio: data.aspectRatio,
                imageSize: data.imageSize,
                thinkingLevel: data.thinkingLevel,
                includeThoughts: data.includeThoughts,
                useGoogleSearch: data.useGoogleSearch,
                responseFormat: data.responseFormat,
            }, modelId);

            // Build contents for edit: text + source image + mask + reference images
            let contents: Record<string, unknown>[];

            if (data.conversationHistory && data.conversationHistory.length > 0) {
                // Multi-turn edit: history + new turn
                contents = [...data.conversationHistory];

                const newParts: Record<string, unknown>[] = [];

                // Source image
                if (data.image) {
                    newParts.push({
                        inlineData: {
                            mimeType: data.imageMimeType || "image/png",
                            data: data.image,
                        },
                    });
                }

                // Mask
                if (data.mask) {
                    newParts.push({
                        inlineData: {
                            mimeType: data.maskMimeType || "image/png",
                            data: data.mask,
                        },
                    });
                }

                // Reference images (new array field)
                if (data.referenceImages && data.referenceImages.length > 0) {
                    for (const ref of data.referenceImages) {
                        newParts.push({
                            inlineData: {
                                mimeType: ref.mimeType,
                                data: ref.data,
                            },
                        });
                    }
                }

                // Legacy single reference image
                if (data.referenceImage && !data.referenceImages?.length) {
                    newParts.push({
                        inlineData: {
                            mimeType: data.refMimeType || "image/png",
                            data: data.referenceImage,
                        },
                    });
                }

                // Prompt text
                const promptText = data.mask
                    ? `Edit the masked region of this image according to this instruction: ${data.prompt}`
                    : data.prompt;
                newParts.push({ text: promptText });

                contents.push({ role: "user", parts: newParts });
            } else {
                // Single-turn edit
                const parts: Record<string, unknown>[] = [];

                // Prompt first
                const promptText = data.mask
                    ? `Edit the masked region of this image according to this instruction: ${data.prompt}`
                    : data.prompt;
                parts.push({ text: promptText });

                // Source image
                if (data.image) {
                    parts.push({
                        inlineData: {
                            mimeType: data.imageMimeType || "image/png",
                            data: data.image,
                        },
                    });
                }

                // Mask
                if (data.mask) {
                    parts.push({
                        inlineData: {
                            mimeType: data.maskMimeType || "image/png",
                            data: data.mask,
                        },
                    });
                }

                const caps = NANO_BANANA_CAPABILITIES[modelId as keyof typeof NANO_BANANA_CAPABILITIES];
                const maxRefs = caps?.maxReferenceImages ?? 0;

                // Reference images (new array field)
                if (maxRefs > 0 && data.referenceImages && data.referenceImages.length > 0) {
                    const imagesToAdd = data.referenceImages.slice(0, maxRefs);
                    for (const ref of imagesToAdd) {
                        parts.push({
                            inlineData: {
                                mimeType: ref.mimeType,
                                data: ref.data,
                            },
                        });
                    }
                }

                // Legacy single reference image
                if (maxRefs > 1 && data.referenceImage && !data.referenceImages?.length) {
                    parts.push({
                        inlineData: {
                            mimeType: data.refMimeType || "image/png",
                            data: data.referenceImage,
                        },
                    });
                }

                contents = [{ role: "user", parts }];
            }

            const result = await client.models.generateContent({
                model: modelId,
                contents: contents as any,
                config: config as any,
            });

            const extracted = this.extractResults(result as any);

            if (extracted.images.length === 0) {
                throw new Error("No image data found in edit response");
            }

            const primary = extracted.images[0]!;

            return {
                base64: primary.bytesBase64Encoded,
                mimeType: primary.mimeType,
                textNarration: extracted.textParts.length > 0
                    ? extracted.textParts.join("\n\n")
                    : undefined,
                thoughtSignature: extracted.thoughtSignature,
                groundingMetadata: extracted.groundingMetadata,
                aiMetadata: {
                    toolName: modelId,
                    generationType: "image-to-image",
                    isAIGenerated: true,
                    timestamp: new Date().toISOString(),
                    promptSnippet: data.prompt.substring(0, 100),
                    hasMultipleReferences: !!(data.referenceImages && data.referenceImages.length > 0),
                    hasMask: !!data.mask,
                    isMultiTurn: !!(data.conversationHistory && data.conversationHistory.length > 0),
                },
                aiGenerationInfo: {
                    isFullyAIGenerated: false,
                    baseModel: modelId,
                    generatorType: "cloud_function",
                },
            };
        } catch (error: any) {
            return this.handleApiError(error, "edit");
        }
    }
}

/** Singleton instance of GeminiImageService used by Cloud Functions */
const service = new GeminiImageService();

/**
 * Cloud Function: Text-to-Image Generation (V3)
 * 
 * Scalable entry point for generating images with Gemini 3.1+.
 * Enforces authentication, rate limits, and schema validation.
 */
export const generateImageV3Fn = () => functions
    .region("us-west1")
    .runWith({
        enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        // Pro needs more overhead for 4K and long-context history
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Authenticate
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        // 1b. Rate limit — image generation is the highest-cost endpoint
        await enforceRateLimit(context.auth.uid, "generateImageV3", RATE_LIMITS.generation);

        // 2. Validate Input
        const validation = GenerateImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }

        // 3. Delegate to Service
        return await service.generate(validation.data);
    });

/**
 * Cloud Function: Image Editing (Inpainting/Outpainting)
 * 
 * Scalable entry point for editing images using Gemini.
 * Supports reference images, masks, and iterative turns.
 */
export const editImageFn = () => functions
    .region("us-west1")
    .runWith({
        enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "1GB" // Bumped from 512MB — editing with references + 4K can exceed 512MB
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Authenticate
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        // 1b. Rate limit — image editing is a high-cost operation
        await enforceRateLimit(context.auth.uid, "editImage", RATE_LIMITS.generation);

        // 2. Validate Input
        const validation = EditImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
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
            textNarration: result.textNarration,
            thoughtSignature: result.thoughtSignature,
            groundingMetadata: result.groundingMetadata,
            aiMetadata: result.aiMetadata,
            aiGenerationInfo: result.aiGenerationInfo
        };
    });
