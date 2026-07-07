import { AutonomousIntelligence } from '../intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { InputSanitizer } from '../intelligence/utils/InputSanitizer';
import { logger } from '@/utils/logger';
import { ContentPart, Part } from '@/shared/types/ai.dto';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { normalizeEditImageResult } from './editResponse';
// Data URI regex - strict pattern for image MIME types
const DATA_URI_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

export interface BatchEditResult {
    results: { id: string; url: string; prompt: string }[];
    failures: { index: number; error: string }[];
}

function normalizeEditFailure(error: unknown): Error {
    const maybe = error as { code?: string; message?: string; details?: unknown };
    const code = maybe?.code || '';
    const message = error instanceof Error ? error.message : maybe?.message || String(error);
    const details = typeof maybe?.details === 'string' ? maybe.details : '';
    const raw = `${code} ${message} ${details}`.toLowerCase();

    if (raw.includes('unauthenticated')) {
        return new Error('Sign in again to edit this image.');
    }
    if (raw.includes('app-check') || raw.includes('appcheck')) {
        return new Error('Creative edit is blocked by App Check. Refresh the app and try again.');
    }
    if (raw.includes('rate') || raw.includes('quota') || raw.includes('resource-exhausted')) {
        return new Error('Creative edit is temporarily rate limited. Wait a moment and try again.');
    }
    if (raw.includes('permission-denied') || raw.includes('forbidden')) {
        return new Error('Creative edit was denied by the backend. Check access and try again once the service is reachable.');
    }
    if (raw.includes('invalid-argument') || raw.includes('validation failed')) {
        return new Error(message && message !== 'internal' ? message : 'Creative edit rejected the mask or reference payload.');
    }
    if (!message || message === 'internal' || code.includes('internal')) {
        return new Error('Creative edit could not finish because the backend returned an internal error. Your annotations are still on the canvas; try again after the service recovers.');
    }

    return new Error(message);
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
     * Edit a single image through the secured Cloud Function pipeline.
     */
    async editImage(options: {
        image: { mimeType: string; data: string };
        mask?: { mimeType: string; data: string };
        decoratedImage?: { mimeType: string; data: string }; // Legacy/Flattened
        referenceImage?: { mimeType: string; data: string };
        referenceImages?: { mimeType: string; data: string }[];
        prompt: string;
        forceHighFidelity?: boolean;
        model?: 'pro' | 'flash' | string;
        thoughtSignature?: string;
        useSemanticMap?: boolean;
        sessionId?: string;
        routeId?: string;
        routeLabel?: string;
        routeReason?: string;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string } | null> {
        logger.info('[EditingService] editImage called — using secured backend path', {
            hasMask: !!options.mask,
            hasReference: !!options.referenceImage || !!options.referenceImages?.length,
            model: options.model,
            useSemanticMap: !!options.useSemanticMap,
        });

        return this.withRetry(async () => {
            const firebaseModule = await import('@/services/firebase');
            const { functions } = firebaseModule;
            const { httpsCallable } = await import('firebase/functions');
            const editImageFn = httpsCallable(functions, 'editImage');

            const userId = firebaseModule.auth.currentUser?.uid;
            if (!userId) {
                throw new Error('User must be authenticated to edit images.');
            }

            const imageUri = await CreativeStorageService.uploadReferenceMedia(
                userId,
                `data:${options.image.mimeType};base64,${options.image.data}`,
                'image',
                { scope: 'objects' }
            );
            const maskUri = options.mask
                ? await CreativeStorageService.uploadReferenceMedia(
                    userId,
                    `data:${options.mask.mimeType};base64,${options.mask.data}`,
                    'image',
                    { scope: 'masks' }
                )
                : undefined;
            const referenceImageUri = options.referenceImage
                ? await CreativeStorageService.uploadReferenceMedia(
                    userId,
                    `data:${options.referenceImage.mimeType};base64,${options.referenceImage.data}`,
                    'image',
                    { scope: 'objects' }
                )
                : undefined;
            const referenceImageUris = options.referenceImages?.length
                ? await Promise.all(options.referenceImages.map((referenceImage) => CreativeStorageService.uploadReferenceMedia(
                    userId,
                    `data:${referenceImage.mimeType};base64,${referenceImage.data}`,
                    'image',
                    { scope: 'objects' }
                )))
                : undefined;

            const payload = {
                imageUri,
                maskUri,
                referenceImageUri,
                referenceImageUris,
                prompt: options.prompt,
                forceHighFidelity: options.forceHighFidelity || !!options.decoratedImage,
                model: options.model,
                thoughtSignature: options.thoughtSignature,
                useSemanticMap: options.useSemanticMap,
                sessionId: options.sessionId,
                routeId: options.routeId,
                routeLabel: options.routeLabel,
                routeReason: options.routeReason,
            };

            try {
                const result = await editImageFn(payload);
                return normalizeEditImageResult(result.data, options.prompt);
            } catch (error: unknown) {
                throw normalizeEditFailure(error);
            }
        });
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
        sessionId?: string;
        routeId?: string;
        routeLabel?: string;
        routeReason?: string;
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
                    sessionId: options.sessionId,
                    routeId: options.routeId,
                    routeLabel: options.routeLabel,
                    routeReason: options.routeReason,
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
     * Specialized macro for AI Face Swap (Likeness).
     * Extracts the face mask from the generated image and performs a targeted edit
     * using the user's real face as the reference image to correct generation errors.
     */
    async faceSwap(options: {
        generatedImage: { mimeType: string; data: string };
        likenessImage: { mimeType: string; data: string };
        model?: string;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string } | null> {
        const { ImageAnalysisService } = await import('./ImageAnalysisService');
        const analysis = new ImageAnalysisService();
        
        logger.info('[EditingService] Extracting face mask for Likeness Face Swap');
        const faceMaskBase64 = await analysis.extractSegmentationMask(
            `data:${options.generatedImage.mimeType};base64,${options.generatedImage.data}`,
            'The person\'s face'
        );

        logger.info('[EditingService] Executing Likeness Face Swap');
        return this.editImage({
            image: options.generatedImage,
            mask: { mimeType: 'image/png', data: faceMaskBase64 },
            referenceImage: options.likenessImage,
            prompt: 'Seamlessly blend the reference face onto this person, matching lighting and skin tone exactly.',
            model: options.model || 'pro',
            forceHighFidelity: true
        });
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
        thoughtSignature?: string;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string } | null> {
        const parts: Part[] = [];
        options.images.forEach((img, idx) => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            parts.push({ text: `[Reference ${idx + 1}]` });
        });

        // Sanitize prompt
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);
        const sanitizedContext = options.projectContext ? InputSanitizer.sanitize(options.projectContext) : '';
        parts.push({ text: `Combine these references. ${sanitizedPrompt} ${sanitizedContext}` });

        // Use rawGenerateContent with DIRECT image model (NOT text model)
        const response = await AutonomousIntelligence.rawGenerateContent(
            [{ role: 'user', parts }],
            INTELLIGENCE_MODELS.IMAGE.DIRECT_PRO,
            { responseModalities: ['IMAGE'] },
            undefined,
            undefined,
            { thoughtSignature: options.thoughtSignature || "context_engineering_is_the_way_to_go" }
        );

        const part = response.response.candidates?.[0]?.content?.parts?.[0];
        if (part && 'inlineData' in part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            const signature = (part as ContentPart).thoughtSignature;
            return {
                id: crypto.randomUUID(),
                url,
                prompt: "Composite",
                thoughtSignature: signature
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
        thoughtSignature?: string;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string }[]> {
        const results: { id: string; url: string; prompt: string; thoughtSignature?: string }[] = [];

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

        const plan = await AutonomousIntelligence.generateStructuredData<{ scenes: string[] }>(plannerPrompt, planSchema);
        const scenes = plan.scenes || [];
        while (scenes.length < options.count) scenes.push(`${sanitizedPrompt} (${options.timeDeltaLabel} Sequence)`);

        let previousImage = options.startImage;
        let visualContext = "";

        for (let i = 0; i < options.count; i++) {
            // Step 2: Analyze Context (if prev image exists)
            if (previousImage) {
                visualContext = await AutonomousIntelligence.analyzeImage(
                    `You are a Visual Physics Engine. Analyze the scene. Return a concise visual description to guide the next frame generation.`,
                    previousImage.data,
                    previousImage.mimeType
                );
            }

            // Step 3: Generate Frame
            const parts: Part[] = [];
            if (previousImage) {
                parts.push({ inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } });
                parts.push({ text: `[Reference Frame]` });
            }

            const promptText = `Next keyframe (Time Delta: ${options.timeDeltaLabel}): ${scenes[i]}. \n\nVisual DNA & Temporal Context: ${visualContext}. \n\n${sanitizedContext}`;
            parts.push({ text: promptText });

            // Use rawGenerateContent with DIRECT image model (NOT text model)
            const response = await AutonomousIntelligence.rawGenerateContent(
                [{ role: 'user', parts }],
                INTELLIGENCE_MODELS.IMAGE.DIRECT_PRO,
                { responseModalities: ['IMAGE'] },
                undefined,
                undefined,
                { thoughtSignature: options.thoughtSignature || "context_engineering_is_the_way_to_go" }
            );

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && 'inlineData' in part && part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                const signature = (part as ContentPart).thoughtSignature;
                previousImage = { mimeType: part.inlineData.mimeType, data: part.inlineData.data };
                results.push({
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Chain (${options.timeDeltaLabel}): ${scenes[i]}`,
                    thoughtSignature: signature
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
        thoughtSignature?: string;
    }): Promise<{ id: string; url: string; prompt: string; thoughtSignature?: string } | null> {
        const modelId = options.model === 'pro'
            ? INTELLIGENCE_MODELS.IMAGE.DIRECT_PRO
            : INTELLIGENCE_MODELS.IMAGE.DIRECT_FAST;

        const parts: Part[] = [
            { text: options.prompt || 'Render the content image in the artistic style of the style reference. Preserve the subject and composition from the content image. Apply the colors, textures, lighting, and mood from the style reference.' },
            { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } },
            { text: '[Content Image - preserve this subject/composition]' },
            { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } },
            { text: '[Style Reference - apply this visual style]' },
        ];

        const response = await AutonomousIntelligence.rawGenerateContent(
            [{ role: 'user', parts }],
            modelId,
            { responseModalities: ['IMAGE'] },
            undefined,
            undefined,
            { thoughtSignature: options.thoughtSignature || "context_engineering_is_the_way_to_go" }
        );

        const part = response.response.candidates?.[0]?.content?.parts?.[0];
        if (part && 'inlineData' in part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            const signature = (part as ContentPart).thoughtSignature;
            return {
                id: crypto.randomUUID(),
                url,
                prompt: `Style Transfer: ${options.prompt || 'Applied style reference'}`,
                thoughtSignature: signature
            };
        }
        return null;
    }
}

export const Editing = new EditingService();
