import { GenAI } from '../ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { functionsWest1 as functions, auth } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { InputSanitizer } from '../ai/utils/InputSanitizer';
import { PromptBuilder } from './PromptBuilderService';
import { logger } from '@/utils/logger';


// Data URI regex - strict pattern for image MIME types
const DATA_URI_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

export interface BatchEditResult {
    results: { id: string; url: string; prompt: string }[];
    failures: { index: number; error: string }[];
}

export class EditingService {

    /**
     * Retry logic with exponential backoff for rate-limited requests.
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        retries = 3,
        delay = 1000
    ): Promise<T> {
        try {
            return await operation();
        } catch (error: unknown) {
            const errOpts = {
                code: (error as { code?: string })?.code,
                message: error instanceof Error ? error.message : String(error)
            };
            const isRetryable =
                errOpts.code === 'resource-exhausted' ||
                errOpts.message.includes('429') ||
                errOpts.message.includes('quota') ||
                errOpts.message.includes('rate');

            if (retries > 0 && isRetryable) {
                await new Promise(r => setTimeout(r, delay));
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    /**
     * Edit a single image using the Dual-View Pipeline (original + binary mask).
     * 
     * Pro (High Fidelity): Uses gemini-2.5-pro with IMAGE responseModality.
     * Flash (High Speed): Uses gemini-2.5-flash with IMAGE responseModality.
     */
    async editImage(options: {
        image: { mimeType: string; data: string };
        mask?: { mimeType: string; data: string };
        decoratedImage?: { mimeType: string; data: string }; // Legacy/Flattened
        referenceImage?: { mimeType: string; data: string };
        prompt: string;
        forceHighFidelity?: boolean;
        model?: 'pro' | 'flash' | string;
        thoughtSignature?: string;
        useSemanticMap?: boolean;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string } | null> {
        // Auth pre-flight: fail fast with a clear message instead of a 401 from the Cloud Function
        if (!auth.currentUser) {
            throw new Error('Your session has expired. Please sign in again to edit images.');
        }
        try {
            await auth.currentUser.getIdToken(true);
        } catch {
            throw new Error('Your session could not be refreshed. Please sign out and sign back in.');
        }

        const editImageFn = httpsCallable(functions, 'editImage');

        // Determine Task Label
        let taskLabel = "Object Modification via Visual Prompt";
        if (options.useSemanticMap) taskLabel = "Semantic Image Editing";
        else if (options.mask) taskLabel = "Targeted Image Inpainting";

        // Generate structured prompt using PromptBuilder
        const structuredPrompt = PromptBuilder.build({
            userPrompt: options.prompt,
            useDualView: !!options.mask,
            useSemanticMap: !!options.useSemanticMap,
            task: taskLabel
        });

        // Selection Logic: use DIRECT image models (NOT text models)
        const useHighFidelity = options.model === 'pro' || options.forceHighFidelity || !!options.decoratedImage;
        const modelId = useHighFidelity ? AI_MODELS.IMAGE.DIRECT_PRO : AI_MODELS.IMAGE.DIRECT_FAST;

        // Call backend via Firebase Cloud Function
        const result = await this.withRetry(() => editImageFn({
            image: options.image.data,
            imageMimeType: options.image.mimeType,
            mask: options.mask?.data,
            maskMimeType: options.mask?.mimeType,
            referenceImage: options.referenceImage?.data,
            refMimeType: options.referenceImage?.mimeType,
            prompt: structuredPrompt,
            model: modelId,
            thoughtSignature: options.thoughtSignature
        }));

        const data = result.data as unknown as {
            base64?: string;
            mimeType?: string;
            thoughtSignature?: string;
            candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[]
        };

        // Handle flattened response (base64) or nested candidate structure
        let url = "";
        const newSignature: string | undefined = data.thoughtSignature;

        if (data.base64) {
            url = `data:${data.mimeType || 'image/png'};base64,${data.base64}`;
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
            const part = data.candidates[0].content.parts[0];
            if (part && part.inlineData) {
                url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        if (url) {
            return {
                id: crypto.randomUUID(),
                url,
                prompt: `Edit (${useHighFidelity ? 'Pro' : 'Flash'}): ${options.prompt}`,
                thoughtSignature: newSignature
            };
        }
        return null;
    }

    /**
     * Sequential multi-mask editing pipeline.
     * Chains multiple edits: Base → Mask 1 → Result 1 → Mask 2 → Final
     */
    async multiMaskEdit(options: {
        image: { mimeType: string; data: string };
        masks: { mimeType: string; data: string; prompt: string; colorId: string; referenceImage?: { mimeType: string; data: string } }[];
        variationCount?: number;
        model?: string;
    }): Promise<{ id: string; url: string; prompt: string }[]> {
        const results: { id: string; url: string; prompt: string }[] = [];
        const count = options.variationCount || 4;

        for (let i = 0; i < count; i++) {
            let currentImageData = options.image;
            const compositePromptParts: string[] = [];
            let currentThoughtSignature: string | undefined;

            // Sequential Pipeline: Base -> Mask 1 -> Result 1 -> Mask 2 -> ... -> Final
            for (const mask of options.masks) {
                // Add variation hint to prompt for diversity
                const variedPrompt = count > 1
                    ? `${mask.prompt} (variation ${i + 1} of ${count})`
                    : mask.prompt;

                const result = await this.editImage({
                    image: currentImageData,
                    mask: { mimeType: mask.mimeType, data: mask.data },
                    referenceImage: mask.referenceImage,
                    prompt: variedPrompt,
                    model: options.model,
                    thoughtSignature: currentThoughtSignature, // Circulate through chain
                });

                if (result) {
                    // Extract data for next step using strict regex
                    const match = result.url.match(DATA_URI_REGEX);
                    if (match) {
                        currentImageData = { mimeType: match[1]!, data: match[2]! };
                        compositePromptParts.push(mask.prompt);
                        // Carry thought signature forward through the chain
                        currentThoughtSignature = result.thoughtSignature;
                    } else {
                        throw new Error("Failed to parse intermediate result data URI");
                    }
                } else {
                    throw new Error(`Failed to generate step for mask: ${mask.prompt}`);
                }
            }

            // Push the final composite result
            results.push({
                id: crypto.randomUUID(),
                url: `data:${currentImageData.mimeType};base64,${currentImageData.data}`,
                prompt: `Composite ${i + 1}: ${compositePromptParts.join(', ')}`
            });
        }

        return results;
    }

    /**
     * Batch edit multiple images with the same prompt.
     * Returns both successful results and failure information.
     */
    async batchEdit(options: {
        images: { mimeType: string; data: string }[];
        prompt: string;
        onProgress?: (current: number, total: number) => void;
    }): Promise<BatchEditResult> {
        const results: { id: string; url: string; prompt: string }[] = [];
        const failures: { index: number; error: string }[] = [];

        for (let i = 0; i < options.images.length; i++) {
            const img = options.images[i];

            if (options.onProgress) {
                options.onProgress(i + 1, options.images.length);
            }

            try {
                const result = await this.editImage({
                    image: img!,
                    prompt: options.prompt
                });
                if (result) {
                    results.push(result);
                } else {
                    failures.push({ index: i, error: 'No result returned from API' });
                }
            } catch (error: unknown) {
                failures.push({ index: i, error: error instanceof Error ? error.message : String(error) });
            }
        }

        return { results, failures };
    }

    /**
     * @deprecated Video editing via Gemini multimodal is not supported.
     * Gemini can analyze videos but cannot edit them.
     * Use VideoGenerationService for video creation instead.
     */
    async editVideo(_options: {
        video: { mimeType: string; data: string };
        prompt: string;
    }): Promise<{ id: string; url: string; prompt: string } | null> {
        logger.warn('[EditingService] editVideo is deprecated - Gemini cannot edit videos. Use VideoGenerationService instead.');
        return null;
    }

    /**
     * @deprecated Video editing via Gemini multimodal is not supported.
     * Use VideoGenerationService for video creation instead.
     */
    async batchEditVideo(_options: {
        videos: { mimeType: string; data: string }[];
        prompt: string;
        onProgress?: (current: number, total: number) => void;
    }): Promise<{ id: string; url: string; prompt: string }[]> {
        logger.warn('[EditingService] batchEditVideo is deprecated - Gemini cannot edit videos. Use VideoGenerationService instead.');
        return [];
    }

    /**
     * Generate a composite image by blending multiple reference images.
     */
    async generateComposite(options: {
        images: { mimeType: string; data: string }[];
        prompt: string;
        projectContext?: string;
    }): Promise<{ id: string; url: string; prompt: string } | null> {
        const parts: import('firebase/ai').Part[] = [];
        options.images.forEach((img, idx) => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            parts.push({ text: `[Reference ${idx + 1}]` });
        });

        // Sanitize prompt
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);
        const sanitizedContext = options.projectContext ? InputSanitizer.sanitize(options.projectContext) : '';
        parts.push({ text: `Combine these references. ${sanitizedPrompt} ${sanitizedContext}` });

        // Use rawGenerateContent with DIRECT image model (NOT text model)
        const response = await GenAI.rawGenerateContent(
            [{ role: 'user', parts }],
            AI_MODELS.IMAGE.DIRECT_PRO,
            { responseModalities: ['IMAGE'] }
        );

        const part = response.response.candidates?.[0]?.content?.parts?.[0];
        if (part && 'inlineData' in part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return {
                id: crypto.randomUUID(),
                url,
                prompt: "Composite"
            };
        }
        return null;
    }

    /**
     * Generate a sequence of images with temporal progression.
     * Uses Visual Physics Engine concept for frame continuity.
     */
    async generateStoryChain(options: {
        prompt: string;
        count: number;
        timeDeltaLabel: string;
        startImage?: { mimeType: string; data: string };
        projectContext?: string;
    }): Promise<{ id: string; url: string; prompt: string }[]> {
        const results: { id: string; url: string; prompt: string }[] = [];

        // Sanitize inputs
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);
        const sanitizedContext = options.projectContext ? InputSanitizer.sanitize(options.projectContext) : '';

        // Step 1: Plan Scenes
        const plannerPrompt = `We are generating a sequence of ${options.count} images with a time jump of ${options.timeDeltaLabel} per frame based on: "${sanitizedPrompt}".
            Break this into ${options.count} specific scene descriptions.`;

        const planSchema = {
            type: 'object',
            properties: {
                scenes: { type: 'array', items: { type: 'string' } }
            },
            required: ['scenes']
        };

        const plan = await GenAI.generateStructuredData<{ scenes: string[] }>(plannerPrompt, planSchema);
        const scenes = plan.scenes || [];
        while (scenes.length < options.count) scenes.push(`${sanitizedPrompt} (${options.timeDeltaLabel} Sequence)`);

        let previousImage = options.startImage;
        let visualContext = "";

        for (let i = 0; i < options.count; i++) {
            // Step 2: Analyze Context (if prev image exists)
            if (previousImage) {
                visualContext = await GenAI.analyzeImage(
                    `You are a Visual Physics Engine. Analyze the scene. Return a concise visual description to guide the next frame generation.`,
                    previousImage.data,
                    previousImage.mimeType
                );
            }

            // Step 3: Generate Frame
            const parts: import('firebase/ai').Part[] = [];
            if (previousImage) {
                parts.push({ inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } });
                parts.push({ text: `[Reference Frame]` });
            }

            const promptText = `Next keyframe (Time Delta: ${options.timeDeltaLabel}): ${scenes[i]}. \n\nVisual DNA & Temporal Context: ${visualContext}. \n\n${sanitizedContext}`;
            parts.push({ text: promptText });

            // Use rawGenerateContent with DIRECT image model (NOT text model)
            const response = await GenAI.rawGenerateContent(
                [{ role: 'user', parts }],
                AI_MODELS.IMAGE.DIRECT_PRO,
                { responseModalities: ['IMAGE'] }
            );

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && 'inlineData' in part && part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                previousImage = { mimeType: part.inlineData.mimeType, data: part.inlineData.data };
                results.push({
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Chain (${options.timeDeltaLabel}): ${scenes[i]}`
                });
            }
        }
        return results;
    }
    /**
     * Transfer the artistic style from one image to another.
     * Uses the Nano Banana reference image capability.
     */
    async transferStyle(options: {
        contentImage: { mimeType: string; data: string };
        styleImage: { mimeType: string; data: string };
        prompt?: string;
        model?: 'pro' | 'flash';
    }): Promise<{ id: string; url: string; prompt: string } | null> {
        const modelId = options.model === 'pro'
            ? AI_MODELS.IMAGE.DIRECT_PRO
            : AI_MODELS.IMAGE.DIRECT_FAST;

        const parts: import('firebase/ai').Part[] = [
            { text: options.prompt || 'Render the content image in the artistic style of the style reference. Preserve the subject and composition from the content image. Apply the colors, textures, lighting, and mood from the style reference.' },
            { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } },
            { text: '[Content Image - preserve this subject/composition]' },
            { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } },
            { text: '[Style Reference - apply this visual style]' },
        ];

        const response = await GenAI.rawGenerateContent(
            [{ role: 'user', parts }],
            modelId,
            { responseModalities: ['IMAGE'] }
        );

        const part = response.response.candidates?.[0]?.content?.parts?.[0];
        if (part && 'inlineData' in part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return {
                id: crypto.randomUUID(),
                url,
                prompt: `Style Transfer: ${options.prompt || 'Applied style reference'}`
            };
        }
        return null;
    }
}

export const Editing = new EditingService();
