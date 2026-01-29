import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./image";
import { geminiApiKey, getGeminiApiKey } from "../config/secrets";
import * as crypto from "crypto";
import * as fs from 'fs';
import * as path from 'path';

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

        if (status === 400 || message.includes("400")) {
            throw new functions.https.HttpsError("invalid-argument", `Gemini API Request Error: ${message}`);
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
    async generate(data: any): Promise<{ images: any[] }> {
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

            return { images };

        } catch (error) {
            this.handleApiError(error, "generate");
        }
    }

    /**
     * Advanced Instruction-Based Editing (Dual-View / Ghost Mask)
     */
    async edit(data: any): Promise<{ base64: string; mimeType: string; thoughtSignature?: string }> {
        const client = this.getClient();
        const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION; // Prefer Pro for editing fidelity
        const tempFiles: string[] = [];

        try {
            console.log(`[GeminiImageService:edit] Model: ${modelId} | Instruction: "${data.prompt.substring(0, 50)}..."`);

            const userParts: any[] = [{ text: data.prompt }];

            // Helper to handle large images via File API
            const processImage = async (base64: string, mime: string, label: string) => {
                const buffer = Buffer.from(base64, 'base64');
                // Use File API for efficiency if image is large (>10MB) or for high-fidelity PRO usage
                if (buffer.length > 5 * 1024 * 1024) {
                    const tmpName = `${crypto.randomUUID()}.${mime.split('/')[1] || 'png'}`;
                    const tmpPath = path.join('/tmp', tmpName);
                    fs.writeFileSync(tmpPath, buffer);
                    tempFiles.push(tmpPath);

                    const upload = await client.files.upload({
                        file: tmpPath,
                        config: { mimeType: mime, displayName: label }
                    });
                    return { fileData: { fileUri: upload.uri, mimeType: upload.mimeType } };
                }
                return { inlineData: { data: base64, mimeType: mime } };
            };

            // Add layers: 1. Base Image, 2. Ghost Mask, 3. Style Reference (Optional)
            userParts.push(await processImage(data.image, data.imageMimeType || "image/png", "Base Source"));

            if (data.mask) {
                userParts.push(await processImage(data.mask, data.maskMimeType || "image/png", "Ghost Mask Overlay"));
            }

            if (data.referenceImage) {
                userParts.push(await processImage(data.referenceImage, data.refMimeType || "image/png", "Style Reference"));
            }

            const contents: any[] = [];

            // Restore previous logic state via Thought Signature (Multi-Turn)
            if (data.thoughtSignature) {
                contents.push({
                    role: "model",
                    parts: [{
                        text: "Syncing context...",
                        thoughtSignature: data.thoughtSignature
                    } as any]
                });
            }

            contents.push({ role: "user", parts: userParts });

            const result = await client.models.generateContent({
                model: modelId,
                contents,
                config: {
                    responseModalities: ["IMAGE"],
                    candidateCount: 1,
                    temperature: 1.0
                } as any
            });

            if (!result.candidates?.[0]) {
                throw new Error("No candidates returned from Gemini API");
            }

            const candidate = result.candidates![0];
            const imagePart = candidate.content!.parts!.find(p => !!p.inlineData);

            // Extract new Thought Signature from ANY part in the response
            const newSignature = candidate.content!.parts!.find(p => !!(p as any).thoughtSignature) as any;

            if (!imagePart?.inlineData) {
                throw new Error("Resulting candidate does not contain image data");
            }

            return {
                base64: imagePart.inlineData.data as string,
                mimeType: imagePart.inlineData.mimeType || "image/png",
                thoughtSignature: newSignature?.thoughtSignature
            };

        } catch (error) {
            this.handleApiError(error, "edit");
        } finally {
            // Cleanup temp files
            tempFiles.forEach(f => {
                try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { /* ignore cleanup error */ }
            });
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
        return await service.edit(validation.data);
    });
