import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./image";
import { geminiApiKey, getGeminiApiKey } from "../config/secrets";
import * as crypto from "crypto";
import * as fs from 'fs';

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
        console.log("!!! generateImageV3Fn: START !!!");
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

            // 4. Call Model via REST with AbortController timeout
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            // AbortController with 90s timeout (leaving 30s buffer for function's 120s timeout)
            const FETCH_TIMEOUT_MS = 90000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.error(`[generateImageV3] Fetch timeout after ${FETCH_TIMEOUT_MS}ms`);
            }, FETCH_TIMEOUT_MS);

            const startTime = Date.now();
            console.log(`[generateImageV3] Starting API call at ${new Date().toISOString()}`);

            let response: Response;
            try {
                response = await fetch(apiUrl, {
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
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log(`[generateImageV3] API response received in ${Date.now() - startTime}ms, status: ${response.status}`);
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new functions.https.HttpsError(
                        "deadline-exceeded",
                        "Image generation timed out after 90 seconds. The API may be overloaded. Please try again."
                    );
                }
                throw fetchError;
            }

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
        const { image, imageMimeType, mask, maskMimeType, prompt, model, referenceImage, refMimeType, thoughtSignature } = validation.data;

        // Cleanup tracking
        const tempFiles: string[] = [];

        try {
            console.log(`[editImage] Initializing Gemini Dual-View Pipeline`);
            const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });

            // Use requested model
            const modelId = (model === 'flash' || model === 'fast')
                ? FUNCTION_AI_MODELS.IMAGE.FAST
                : FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // Use File API for large images or high fidelity
            const useFileApi = image.length > 15 * 1024 * 1024 || modelId.includes('pro');

            // 1. Prepare User Content Parts
            const userParts: any[] = [{ text: prompt }];

            // Helper to upload or inline
            const addImagePart = async (base64: string, mime: string, name: string) => {
                if (useFileApi) {
                    const tmpPath = `/tmp/${crypto.randomUUID()}.${mime.split('/')[1]}`;
                    fs.writeFileSync(tmpPath, base64, 'base64');
                    tempFiles.push(tmpPath);
                    const upload = await client.files.upload({
                        file: tmpPath,
                        config: { mimeType: mime, displayName: name }
                    });
                    return { fileData: { fileUri: upload.uri, mimeType: upload.mimeType } };
                } else {
                    return { inlineData: { data: base64, mimeType: mime } };
                }
            };

            // Add Source Image (Part 2)
            userParts.push(await addImagePart(image, imageMimeType || "image/png", "Source Image"));

            // Add Mask (Part 3) - Dual-View Ghost Mask
            if (mask) {
                userParts.push(await addImagePart(mask, maskMimeType || "image/png", "Edit Mask"));
            }

            // Add Reference (Optional)
            if (referenceImage) {
                userParts.push(await addImagePart(referenceImage, refMimeType || "image/png", "Style Reference"));
            }

            // 2. Construct Conversation History (Thought Signature)
            const contents: any[] = [];

            if (thoughtSignature) {
                console.log("[editImage] Restoring Context via Thought Signature");
                contents.push({
                    role: "model",
                    parts: [{
                        // The string must be passed exactly as received in the `thought_signature` field?
                        // The SDK types might require `thoughtSignature` property on the Part object.
                        // We use `as any` to bypass strict typing if the SDK definitions lag behind the preview features.
                        text: "Restoring Context",
                        thoughtSignature: thoughtSignature
                    }]
                });
            }

            contents.push({ role: "user", parts: userParts });

            console.log(`[editImage] Model: ${modelId} | History: ${!!thoughtSignature} | Prompt: "${prompt.substring(0, 50)}..."`);

            // 3. Execute Generation
            const result = await client.models.generateContent({
                model: modelId,
                contents,
                config: {
                    responseModalities: ["IMAGE"],
                    candidateCount: 1,
                    temperature: 1.0 // High fidelity requires 1.0? Guide says "Temperature... Set to 1.0".
                } as any
            });

            if (!result.candidates || result.candidates.length === 0) {
                throw new functions.https.HttpsError("internal", "No candidates returned from Gemini API.");
            }

            const candidate = result.candidates[0];
            const contentPart = candidate.content?.parts?.find((p: any) => p.inlineData);
            const signaturePart = candidate.content?.parts?.find((p: any) => (p as any).thoughtSignature);

            // Extract Thought Signature for next turn
            // It can be on the text part (first) or image part (inlineData).
            // We check the first part likely.
            const newSignature = (signaturePart as any)?.thoughtSignature || (candidate.content?.parts?.[0] as any)?.thoughtSignature;

            if (!contentPart || !contentPart.inlineData) {
                throw new functions.https.HttpsError("internal", "No image data found in result.");
            }

            return {
                base64: contentPart.inlineData.data,
                mimeType: contentPart.inlineData.mimeType,
                thoughtSignature: newSignature
            };

        } catch (error: any) {
            console.error("[editImage] Pipeline Error:", error);

            if (error.message?.includes("400")) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    `Gemini API Error: 400. This usually means the mask or payload format is rejected. Details: ${error.message}`
                );
            }

            throw new functions.https.HttpsError("internal", error.message || "Unknown error");
        } finally {
            // Cleanup temp files
            tempFiles.forEach(f => {
                try { fs.unlinkSync(f); } catch (e) { /* ignore cleanup errors */ }
            });
        }
    });
