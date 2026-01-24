import * as functions from "firebase-functions/v1";

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
        const { prompt, aspectRatio, count, images, model: requestedModel, mediaResolution, thinking } = validation.data;

        try {
            console.log(`[generateImageV3] Using REST API for key preservation`);
            const apiKey = getGeminiApiKey();


            // Select Model (Pro vs Fast)
            const modelId = requestedModel === 'fast'
                ? FUNCTION_AI_MODELS.IMAGE.FAST
                : FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // 3. Construct Payload
            let contents: any[] = [];

            // If we have history, use it. Otherwise, build the initial user message.
            if (validation.data.history && validation.data.history.length > 0) {
                contents = validation.data.history.map((c: any) => ({
                    role: c.role,
                    parts: c.parts.map((p: any) => ({
                        ...(p.text ? { text: p.text } : {}),
                        ...(p.inlineData ? { inlineData: p.inlineData } : {}),
                        ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {})
                    }))
                }));

                // Append new prompt if it's not the last message in history
                const lastMsg = contents[contents.length - 1];
                if (lastMsg.role !== "user" || !lastMsg.parts.some((p: any) => p.text === prompt)) {
                    contents.push({ role: "user", parts: [{ text: prompt }] });
                }
            } else {
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
                contents = [{ role: "user", parts }];
            }

            console.log(`[generateImageV3] Model: ${modelId} | Prompt: "${prompt}"`);

            // 4. Call Model via REST
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            // Map resolution to proper enum name for REST
            const resLevel = mediaResolution ? `media_resolution_${mediaResolution}` : undefined;

            const payload = {
                contents,
                generationConfig: {
                    candidateCount: count || 1,
                    responseModalities: ["IMAGE"],
                    ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
                    ...(resLevel ? { mediaResolution: resLevel as any } : {}),
                    ...(thinking ? { thinkingConfig: { thinkingLevel: "HIGH" as any } } : {}),
                }
            };

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
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
            const processedImages: any[] = [];

            if (result.candidates?.[0]?.content?.parts) {
                result.candidates[0].content.parts.forEach((p: any) => {
                    if (p.inlineData) {
                        processedImages.push({
                            bytesBase64Encoded: p.inlineData.data,
                            mimeType: p.inlineData.mimeType || "image/png",
                            thoughtSignature: p.thoughtSignature // Crucial for editing
                        });
                    } else if (p.text && p.thoughtSignature) {
                        // Sometimes the text part contains the root signature
                        processedImages.push({
                            text: p.text,
                            thoughtSignature: p.thoughtSignature
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

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

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
        const { image, imageMimeType, mask, maskMimeType, prompt, referenceImage, refMimeType, history } = validation.data;

        try {
            console.log(`[editImage] Initializing Gemini 3 Client via REST`);
            const apiKey = getGeminiApiKey();
            const modelId = FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // 3. Construct Payload (Conversation Mode)
            let contents: any[] = [];

            if (history && history.length > 0) {
                // Use History + Prompt
                contents = history.map((c: any) => ({
                    role: c.role,
                    parts: c.parts.map((p: any) => ({
                        ...(p.text ? { text: p.text } : {}),
                        ...(p.inlineData ? { inlineData: p.inlineData } : {}),
                        ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {})
                    }))
                }));

                // Append new edit prompt
                contents.push({ role: "user", parts: [{ text: prompt }] });
            } else if (image) {
                // Legacy / Direct Image Mode (Single Turn)
                const parts: any[] = [
                    {
                        inlineData: {
                            mimeType: imageMimeType || "image/png",
                            data: image
                        },
                        // If we have an image part but no history/signature, use the dummy signature for Gemini 3
                        thoughtSignature: "context_engineering_is_the_way_to_go"
                    }
                ];

                if (mask) {
                    parts.push({
                        inlineData: { mimeType: maskMimeType || "image/png", data: mask }
                    });
                    parts.push({ text: "Use the second image as a mask for inpainting." });
                }

                if (referenceImage) {
                    const position = mask ? "third" : "second";
                    parts.push({
                        inlineData: { mimeType: refMimeType || "image/png", data: referenceImage }
                    });
                    parts.push({ text: `Use this ${position} image as a reference.` });
                }

                parts.push({ text: prompt });
                contents = [{ role: "user", parts }];
            } else {
                throw new functions.https.HttpsError("invalid-argument", "Either 'image' or 'history' must be provided.");
            }

            console.log(`[editImage] Model: ${modelId} | Prompt: "${prompt}"`);

            // 4. Call Model via REST
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini API Error: ${response.status} ${errText}`);
            }

            const result = await response.json();

            if (!result.candidates || result.candidates.length === 0) {
                throw new functions.https.HttpsError("internal", "No candidates returned from Gemini API.");
            }

            // Map candidates to internal format
            const processedImages: any[] = [];
            if (result.candidates?.[0]?.content?.parts) {
                result.candidates[0].content.parts.forEach((p: any) => {
                    if (p.inlineData) {
                        processedImages.push({
                            bytesBase64Encoded: p.inlineData.data,
                            mimeType: p.inlineData.mimeType || "image/png",
                            thoughtSignature: p.thoughtSignature
                        });
                    } else if (p.text && p.thoughtSignature) {
                        processedImages.push({
                            text: p.text,
                            thoughtSignature: p.thoughtSignature
                        });
                    }
                });
            }

            return { images: processedImages };

        } catch (error: any) {
            console.error("[editImage] Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", error.message || "Unknown error");
        }
    });
