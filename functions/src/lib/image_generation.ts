import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./image";
import { geminiApiKey, getGeminiApiKey } from "../config/secrets";

/**
 * Generate Image V3 (Nano Banana Pro)
 * 
 * Uses the global GoogleGenAI SDK (AI Studio) to access `gemini-3-pro-image-preview`.
 * Deployed to us-west1 for model availability.
 */
export const generateImageV3Fn = () => functions
    .region("us-west1")
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Auth Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to generate images."
            );
        }

        // 2. Validation
        const validation = GenerateImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const { prompt, aspectRatio, count, model, imageSize, images, useGrounding } = validation.data;

        try {
            console.log(`[generateImageV3] Using REST API for key preservation`);
            const apiKey = getGeminiApiKey();

            // Select Model (Pro vs Fast)
            const modelId = model === 'fast'
                ? FUNCTION_AI_MODELS.IMAGE.FAST
                : FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // 3. Construct Payload
            const parts: any[] = [{ text: prompt }];

            if (images && images.length > 0) {
                images.forEach((img: any) => {
                    parts.push({
                        inlineData: {
                            mimeType: img.mimeType || "image/png",
                            data: img.data
                        }
                    });
                });
            }

            console.log(`[generateImageV3] Model: ${modelId} | Prompt: "${prompt}"`);

            // 4. Call Model via REST
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts }],
                    generationConfig: {
                        temperature: 1.0,
                        candidateCount: count || 1,
                        responseModalities: ["IMAGE"],
                        ...(aspectRatio || imageSize ? {
                            imageConfig: {
                                ...(aspectRatio ? { aspectRatio } : {}),
                                ...(imageSize ? { imageSize } : {})
                            }
                        } : {}),
                        // Thinking is not yet supported for gemini-3-image in us-west1 preview
                        // ...(thinking ? { thinkingConfig: { thinkingLevel: "HIGH" as any } } : {}),
                        ...(useGrounding ? { groundingConfig: { searchGrounding: { enableSearch: true } } } : {})
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini API Error: ${response.status} ${errText}`);
            }

            const result = await response.json();

            // 5. Process Results
            if (!result.candidates || result.candidates.length === 0) {
                throw new functions.https.HttpsError("internal", "No candidates returned from Gemini API");
            }

            // Map candidates to internal format
            // REST Structure: candidates[0].content.parts[...].inlineData
            const processedImages: any[] = [];

            if (result.candidates?.[0]?.content?.parts) {
                result.candidates[0].content.parts.forEach((p: any) => {
                    if (p.inlineData) {
                        processedImages.push({
                            bytesBase64Encoded: p.inlineData.data,
                            mimeType: p.inlineData.mimeType || "image/png"
                        });
                    }
                });
            }

            if (processedImages.length === 0) {
                console.error("[generateImageV3] Raw result:", JSON.stringify(result, null, 2));
                throw new functions.https.HttpsError("internal", "No image data found in candidates");
            }

            return { images: processedImages };

        } catch (error: any) {
            console.error("[generateImageV3] Error:", error);

            // Pass through existing HttpsErrors
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            // Handle API specific errors or general failures
            const message = error.message || "Unknown internal error";
            throw new functions.https.HttpsError("internal", `Image Generation Failed: ${message}`);
        }
    });

/**
 * Edit Image (Inpainting/Editing)
 * 
 * Uses Gemini 3 Pro Image capabilities for instruction-based editing.
 */
export const editImageFn = () => functions
    .region("us-west1")
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Auth Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to edit images."
            );
        }

        // 2. Validation
        const validation = EditImageRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const { image, imageMimeType, mask, maskMimeType, prompt, referenceImage, refMimeType } = validation.data;

        try {
            console.log(`[editImage] Initializing Gemini 3 Client`);
            const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });
            const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // 3. Construct Payload
            const parts: any[] = [
                {
                    inlineData: {
                        mimeType: imageMimeType || "image/png",
                        data: image
                    }
                }
            ];

            // Add Mask (if present)
            if (mask) {
                parts.push({
                    inlineData: {
                        mimeType: maskMimeType || "image/png",
                        data: mask
                    }
                });
                parts.push({ text: "Use the second image as a mask for inpainting." });
            }

            // Add Reference Image (if present)
            if (referenceImage) {
                const position = mask ? "third" : "second";
                parts.push({
                    inlineData: {
                        mimeType: refMimeType || "image/png",
                        data: referenceImage
                    }
                });
                parts.push({ text: `Use this ${position} image as a reference.` });
            }

            // Prompt
            parts.push({ text: prompt });

            console.log(`[editImage] Model: ${modelId} | Prompt: "${prompt}"`);

            // 4. Call Model
            const result = await client.models.generateContent({
                model: modelId,
                contents: [{ role: "user", parts }],
                config: {
                    responseModalities: ["IMAGE"],
                }
            });

            if (!result.candidates || result.candidates.length === 0) {
                throw new functions.https.HttpsError("internal", "No candidates returned from Gemini API.");
            }

            return { candidates: result.candidates };

        } catch (error: any) {
            console.error("[editImage] Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", error.message || "Unknown error");
        }
    });
