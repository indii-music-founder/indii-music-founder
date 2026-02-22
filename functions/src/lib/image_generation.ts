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
        let status = error.status;

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
        if (status === 504 || status === 503 || message.includes("deadline") || error.name === 'AbortError') {
            throw new functions.https.HttpsError("deadline-exceeded", "Gemini API timed out during generation. The model may be overloaded.");
        }

        throw new functions.https.HttpsError("internal", `Gemini Image Generation Failed (${context}): ${message}`);
    }

    /**
     * Core Text-to-Image Generation
     * 
     * 'fast' model → Gemini multimodal generateContent with IMAGE modality (instant, no aspect ratio control)
     * 'pro' model  → Vertex AI Imagen REST API (proper aspect ratio, seed control, higher fidelity)
     */
    async generate(data: any): Promise<{ images: any[]; aiMetadata: any; aiGenerationInfo: any }> {
        const isFast = data.model === 'fast';
        const modelId = isFast
            ? FUNCTION_AI_MODELS.IMAGE.FAST
            : FUNCTION_AI_MODELS.IMAGE.GENERATION;

        console.log(`[GeminiImageService:generate] Mode: ${isFast ? 'fast (Gemini)' : 'pro (Imagen)'} | Prompt: "${data.prompt.substring(0, 50)}..."`);

        try {
            if (isFast) {
                // --- Fast Path: Gemini Multimodal (sub-second, no aspect ratio control) ---
                const client = this.getClient();
                const result = await client.models.generateContent({
                    model: modelId,
                    contents: [{ role: "user", parts: [{ text: data.prompt }] }],
                    config: {
                        candidateCount: data.count || 1,
                        responseModalities: ["IMAGE"],
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
                        humanContributionDescription: `Generated via indiiOS using prompt: "${data.prompt.substring(0, 100)}..."`
                    }
                };
            } else {
                // --- Pro Path: Vertex AI Imagen REST API (full aspect ratio, seed, personGeneration) ---
                const { GoogleAuth } = await import("google-auth-library");
                const imagenModel = "imagen-3.0-generate-001";

                const auth = new GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const projectId = await auth.getProjectId();
                const accessToken = await client.getAccessToken();

                const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${imagenModel}:predict`;

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
                        errorText = parsedError.error?.message || errorText;
                    } catch (_e) { /* ignore JSON parse error */ }
                    throw new Error(`Vertex AI Imagen API Error: ${response.status} ${errorText}`);
                }

                const result = await response.json();

                if (!result.predictions || result.predictions.length === 0) {
                    throw new Error("No images returned from Imagen API");
                }

                const images = result.predictions.map((p: any) => ({
                    bytesBase64Encoded: p.bytesBase64Encoded,
                    mimeType: p.mimeType || "image/png"
                }));

                return {
                    images,
                    aiMetadata: {
                        toolName: imagenModel,
                        generationType: 'text-to-image',
                        isAIGenerated: true,
                        timestamp: new Date().toISOString(),
                        promptSnippet: data.prompt.substring(0, 100)
                    },
                    aiGenerationInfo: {
                        isFullyAIGenerated: true,
                        isPartiallyAIGenerated: false,
                        aiToolsUsed: [imagenModel],
                        humanContributionDescription: `Generated via indiiOS Imagen Pro using prompt: "${data.prompt.substring(0, 100)}..."`
                    }
                };
            }
        } catch (error) {
            this.handleApiError(error, "generate");
        }
    }

    /**
     * Advanced Instruction-Based Editing (Dual-View / Ghost Mask)
     */
    async edit(data: any): Promise<{ base64: string; mimeType: string; thoughtSignature?: string; aiMetadata: any; aiGenerationInfo: any }> {
        const { GoogleAuth } = await import("google-auth-library");
        const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION === 'gemini-3-pro-image-preview' ? 'imagen-3.0-capability-001' : FUNCTION_AI_MODELS.IMAGE.GENERATION;

        try {
            console.log(`[GeminiImageService:edit] Model: ${modelId} | Instruction: "${data.prompt.substring(0, 50)}..."`);

            const referenceImages: any[] = [
                {
                    referenceId: 0,
                    referenceType: "REFERENCE_TYPE_RAW",
                    referenceImage: {
                        bytesBase64Encoded: data.image
                    }
                }
            ];

            if (data.mask) {
                referenceImages.push({
                    referenceId: 1,
                    referenceType: "REFERENCE_TYPE_MASK",
                    referenceImage: {
                        bytesBase64Encoded: data.mask
                    }
                });
            }

            // Using pure REST API to Vertex AI instead of Node SDK to bypass 'toReferenceImageAPI' class validation bugs
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();

            const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predict`;

            const requestBody = {
                instances: [
                    {
                        prompt: data.prompt,
                        referenceImages
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    editConfig: {
                        editMode: data.mask ? "EDIT_MODE_INPAINT_INSERTION" : "EDIT_MODE_CONTROLLED_EDITING",
                        numberOfImages: 1,
                        aspectRatio: data.aspectRatio || "1:1"
                    }
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
                    errorText = parsedError.error?.message || errorText;
                } catch (e) { /* ignore JSON parse error */ }
                console.error(`[GeminiImageService:edit] Vertex REST API Error: ${response.status} ${errorText}`);
                throw new Error(`Vertex AI Image Edit API Error: ${response.status} ${errorText}`);
            }

            const result = await response.json();

            if (!result.predictions || result.predictions.length === 0) {
                throw new Error("No images returned from Gemini Edit API");
            }

            const genImg = result.predictions[0];

            if (!genImg.bytesBase64Encoded) {
                throw new Error("Generated image object is missing from Gemini response");
            }

            return {
                base64: genImg.bytesBase64Encoded,
                mimeType: genImg.mimeType || "image/png",
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
        } catch (error: any) {
            return this.handleApiError(error, "edit");
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
