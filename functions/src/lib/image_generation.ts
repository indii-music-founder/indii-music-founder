import * as functions from "firebase-functions/v1";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";
import { GenerateImageRequestSchema, EditImageRequestSchema } from "./image";
import { geminiApiKey, getGeminiApiKey } from "../config/secrets";
import * as crypto from "crypto";

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
        const { image, imageMimeType, mask, maskMimeType, prompt, model, referenceImage, refMimeType } = validation.data;

        // Cleanup tracking
        const tempFiles: string[] = [];

        try {
            console.log(`[editImage] Initializing Gemini Dual-View Pipeline`);
            const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });

            // Use requested model (Pro for high fidelity, Flash for speed)
            const modelId = model || FUNCTION_AI_MODELS.IMAGE.GENERATION;

            // Use File API for large images (e.g. over 15MB) or high fidelity path
            const useFileApi = image.length > 15 * 1024 * 1024 || modelId.includes('pro');

            // 1. Construct the Multimodal Prompt following "Task-Inputs-Instruction" Best Practices
            const isPro = modelId.includes('pro');
            const reasoningLogic = isPro
                ? "Apply advanced spatial reasoning to infer the exact object boundaries within the target region. Even if the IMAGE_MASK is loose or imprecise, look at the IMAGE_SOURCE and refine the edit area to match the object's natural contours. Think through the materials, shadows, and reflection properties before generating."
                : "Modify ONLY the area specified by the white pixels in IMAGE_MASK.";

            const compositePrompt = `
SYSTEM INSTRUCTION: You are the Gemini 3 "Nano Banana Pro" Image Engine. Your primary goal is high-fidelity semantic editing. 
You must analyze the source image's lighting direction, focal length, and texture noise. 
Modified pixels must be indistinguishable from the original camera sensor data.

TASK: Targeted Image Inpainting.
INPUTS: 
1. IMAGE_SOURCE: The original high-resolution photo.
2. IMAGE_MASK: A binary mask where the WHITE area marks the target for editing.

INSTRUCTION: 
Using the context of IMAGE_SOURCE, ${reasoningLogic}
The new content for the target area should be: ${prompt}.

CONSTRAINTS: 
- Maintain consistent lighting, shadows, and resolution.
- Ensure pixel-perfect blending at boundaries.
- Respect the three-dimensional depth of the scene.
            `.trim();

            // 2. Prepare Multimodal Parts
            const contents: any[] = [{
                role: "user",
                parts: [{ text: compositePrompt }]
            }];

            if (useFileApi) {
                console.log(`[editImage] Using File API for payload (Length: ${image.length})`);

                // Helper to upload base64 to File API
                const uploadPart = async (base64: string, mime: string, name: string) => {
                    const tmpPath = `/tmp/${crypto.randomUUID()}.${mime.split('/')[1]}`;
                    require('fs').writeFileSync(tmpPath, base64, 'base64');
                    tempFiles.push(tmpPath);

                    const upload = await client.files.upload({
                        file: tmpPath,
                        config: { mimeType: mime, displayName: name }
                    });
                    return { fileData: { fileUri: upload.uri, mimeType: upload.mimeType } };
                };

                contents[0].parts.push(await uploadPart(image, imageMimeType || "image/png", "Source Image"));
                if (mask) {
                    contents[0].parts.push(await uploadPart(mask, maskMimeType || "image/png", "Edit Mask"));
                }
                if (referenceImage) {
                    contents[0].parts.push(await uploadPart(referenceImage, refMimeType || "image/png", "Style Reference"));
                }
            } else {
                contents[0].parts.push({
                    inlineData: { data: image, mimeType: imageMimeType || "image/png" }
                });
                if (mask) {
                    contents[0].parts.push({
                        inlineData: { data: mask, mimeType: maskMimeType || "image/png" }
                    });
                }
                if (referenceImage) {
                    contents[0].parts.push({
                        inlineData: { data: referenceImage, mimeType: refMimeType || "image/png" }
                    });
                }
            }

            console.log(`[editImage] Model: ${modelId} | Mode: ${useFileApi ? 'FileAPI' : 'Inline'} | Prompt: "${prompt.substring(0, 50)}..."`);

            // 3. Execute Multimodal Generation
            const result = await client.models.generateContent({
                model: modelId,
                contents,
                config: {
                    responseModalities: ["IMAGE"],
                    candidateCount: 1,
                    temperature: 1.0
                } as any
            });

            if (!result.candidates || result.candidates.length === 0) {
                throw new functions.https.HttpsError("internal", "No candidates returned from Gemini API.");
            }

            // Standardize output format
            const candidates = result.candidates.map((cand: any) => ({
                content: cand.content ? {
                    parts: cand.content.parts ? cand.content.parts.filter((p: any) => p.inlineData) : []
                } : { parts: [] }
            }));

            if (!candidates[0] || !candidates[0].content || candidates[0].content.parts.length === 0) {
                console.error("[editImage] No image data in parts:", JSON.stringify(result.candidates[0]?.content?.parts));
                throw new functions.https.HttpsError("internal", "No image data found in result parts.");
            }

            return { candidates };

        } catch (error: any) {
            console.error("[editImage] Pipeline Error:", error);
            throw new functions.https.HttpsError("internal", error.message || "Unknown error");
        } finally {
            // Cleanup temp files
            tempFiles.forEach(f => {
                try { require('fs').unlinkSync(f); } catch (e) { }
            });
        }
    });
