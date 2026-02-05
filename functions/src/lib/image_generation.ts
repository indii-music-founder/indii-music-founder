import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./image";
import { geminiApiKey, getGeminiApiKey } from "../config/secrets";

/**
 * GeminiImageService
 * 
 * Centralized service for interacting with Gemini 3 Pro and Flash image models.
 * Manages SDK client lifecycle, error mapping, and dual-view editing pipelines.
 */
class GeminiImageService {
    private client: GoogleGenAI | null = null;

    private getClient(): GoogleGenAI {
        if (!this.client) {
            const apiKey = getGeminiApiKey();
            this.client = new GoogleGenAI({ apiKey });
        }
        return this.client;
    }

    /**
     * Map Gemini API errors to Firebase HTTPS Errors
     */
    private handleApiError(error: any, context: string): never {
        console.error(`[GeminiImageService:${context}] Error:`, error);

        const message = error.message || "Unknown Gemini API error";
        const status = error.status || (error.response?.status);
        const errorData = error.response?.data;

        console.error(`[GeminiImageService:${context}] Full Error Payload:`, JSON.stringify(errorData, null, 2));

        if (status === 400 || message.includes("400")) {
            throw new functions.https.HttpsError("invalid-argument", `Gemini API Request Error: ${message}${errorData ? ` - Details: ${JSON.stringify(errorData)}` : ""}`);
        }
        if (status === 401 || status === 403 || message.includes("401") || message.includes("403")) {
            throw new functions.https.HttpsError("permission-denied", `Gemini API Authentication Error: ${message}`);
        }
        if (status === 429 || message.includes("429")) {
            throw new functions.https.HttpsError("resource-exhausted", "Gemini API rate limit exceeded. Please try again later.");
        }
        if (status === 504 || message.includes("deadline") || error.name === 'AbortError') {
            throw new functions.https.HttpsError("deadline-exceeded", "Gemini API timed out during generation. The model may be overloaded.");
        }

        throw new functions.https.HttpsError("internal", `Gemini Image Generation Failed (${context}): ${message}`);
    }

    /**
     * Core Text-to-Image Generation (Gemini 3 Pro Image)
     */
    async generate(data: any): Promise<{ images: any[]; aiMetadata: any; aiGenerationInfo: any }> {
        const client = this.getClient();
        const modelId = data.model === 'fast'
            ? FUNCTION_AI_MODELS.IMAGE.FAST
            : FUNCTION_AI_MODELS.IMAGE.GENERATION;

        console.log(`[GeminiImageService:generate] Model: ${modelId} | Prompt: "${data.prompt.substring(0, 50)}..."`);

        try {
            const result = await client.models.generateContent({
                model: modelId,
                contents: [{ role: "user", parts: [{ text: data.prompt }] }],
                config: {
                    candidateCount: data.count || 1,
                    responseModalities: ["IMAGE"],
                    ...(data.aspectRatio ? { imageConfig: { aspectRatio: data.aspectRatio } } : {}),
                    ...(data.useGrounding ? { groundingConfig: { searchGrounding: { enableSearch: true } } } : {})
                } as any
            });

            if (!result.candidates || result.candidates.length === 0) {
                throw new Error("No candidates returned from Gemini API");
            }

            const images = result.candidates![0].content!.parts!
                .filter(p => !!p.inlineData)
                .map(p => ({
                    bytesBase64Encoded: p.inlineData!.data as string,
                    mimeType: p.inlineData!.mimeType || "image/png"
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
                    humanContributionDescription: `Generated via indiiOS Concept Art Node using prompt: "${data.prompt.substring(0, 100)}..."`
                }
            };

        } catch (error) {
            this.handleApiError(error, "generate");
        }
    }

    /**
     * Advanced Instruction-Based Editing (Dual-View / Ghost Mask)
     */
    async edit(data: any): Promise<{ base64: string; mimeType: string; thoughtSignature?: string; aiMetadata: any; aiGenerationInfo: any }> {
        const client = this.getClient();
        const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION; // Prefer Pro for editing fidelity

        try {
            console.log(`[GeminiImageService:edit] Model: ${modelId} | Instruction: "${data.prompt.substring(0, 50)}..."`);

            const referenceImages: any[] = [
                {
                    referenceId: 0,
                    referenceType: "REFERENCE_TYPE_RAW",
                    referenceImage: {
                        imageBytes: data.image,
                        mimeType: data.imageMimeType || "image/png"
                    }
                }
            ];

            if (data.mask) {
                referenceImages.push({
                    referenceId: 1,
                    referenceType: "REFERENCE_TYPE_MASK",
                    referenceImage: {
                        imageBytes: data.mask,
                        mimeType: "image/png"
                    },
                    config: {
                        maskMode: "MASK_MODE_USER_PROVIDED"
                    }
                });
            }

            const result = await client.models.editImage({
                model: modelId === 'gemini-3-pro-image-preview' ? 'imagen-3.0-capability-001' : modelId,
                prompt: data.prompt,
                referenceImages,
                config: {
                    editMode: (data.mask ? 'EDIT_MODE_INPAINT_INSERTION' : 'EDIT_MODE_CONTROLLED_EDITING') as any,
                    numberOfImages: 1,
                    aspectRatio: data.aspectRatio || "1:1"
                }
            });

            if (!result.generatedImages || result.generatedImages.length === 0) {
                throw new Error("No images returned from Gemini Edit API");
            }

            const genImg = result.generatedImages[0];

            if (!genImg.image) {
                throw new Error("Generated image object is missing from Gemini response");
            }

            return {
                base64: genImg.image.imageBytes as string,
                mimeType: genImg.image.mimeType || "image/png",
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
                    isPartiallyAIGenerated: true,
                    aiToolsUsed: [modelId],
                    humanContributionDescription: `Edited via indiiOS Concept Art Node. Original human-provided image modified using instruction: "${data.prompt.substring(0, 100)}..."`
                }
            };

        } catch (error) {
            this.handleApiError(error, "edit");
        }
    }
}

const service = new GeminiImageService();

/**
 * Cloud Function Entry Points
 */

export const generateImageV3Fn = () => functions
    .region("us-west1")
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Authenticate
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

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

export const editImageFn = () => functions
    .region("us-west1")
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Authenticate
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

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
            aiMetadata: result.aiMetadata,
            aiGenerationInfo: result.aiGenerationInfo
        };
    });
