import { AI } from '../ai/AIService';
import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { isInlineDataPart } from '@/shared/types/ai.dto';

export class EditingService {

    async editImage(options: {
        image: { mimeType: string; data: string };
        mask?: { mimeType: string; data: string };
        referenceImage?: { mimeType: string; data: string }; // New support for reference ingredients
        prompt: string;
        negativePrompt?: string;
    }): Promise<{ id: string, url: string, prompt: string } | null> {
        try {
            const editImageFn = httpsCallable(functions, 'editImage');

            // Pass reference image to backend function
            const result = await editImageFn({
                image: options.image.data,
                mask: options.mask?.data,
                referenceImage: options.referenceImage?.data,
                // Only passing data bytes, assuming mimtype is inferred or standard, 
                // or backend expects just base64. 
                // Previous code passed `image: options.image.data` (bytes), so we follow that pattern.
                prompt: options.prompt + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '')
            });

            const data = result.data as unknown as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
            const part = data.candidates?.[0]?.content?.parts?.[0];

            if (part && part.inlineData) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                return {
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Edit: ${options.prompt}`
                };
            }
            return null;
        } catch (e) {
            throw e;
        }
    }

    async multiMaskEdit(options: {
        image: { mimeType: string; data: string };
        masks: { mimeType: string; data: string; prompt: string; colorId: string; referenceImage?: { mimeType: string; data: string } }[];
        negativePrompt?: string;
        variationCount?: number; // Default to 4
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        const count = options.variationCount || 4;

        try {
            // We generate 'count' variations.
            // For each variation, we strip the 'composite' image through the mask pipeline.
            // Note: Parallelizing variations is possible but heavy on rate limits. Sequential for safety now.

            for (let i = 0; i < count; i++) {
                let currentImageData = options.image;
                const compositePromptParts = [];

                // Sequential Pipeline: Base -> Mask 1 -> Result 1 -> Mask 2 -> ... -> Final
                for (const mask of options.masks) {
                    // Apply edit
                    const result = await this.editImage({
                        image: currentImageData,
                        mask: { mimeType: mask.mimeType, data: mask.data },
                        referenceImage: mask.referenceImage, // Pass specific reference for this mask
                        prompt: mask.prompt, // We rely on the model's randomness for different results if called multiple times
                        negativePrompt: options.negativePrompt
                    });

                    if (result) {
                        // Extract data for next step
                        // result.url is base64 data URI
                        const match = result.url.match(/^data:(.+);base64,(.+)$/);
                        if (match) {
                            currentImageData = { mimeType: match[1], data: match[2] };
                            compositePromptParts.push(mask.prompt);
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
        } catch (e) {
            throw e;
        }
    }

    async batchEdit(options: {
        images: { mimeType: string; data: string }[];
        prompt: string;
        negativePrompt?: string;
        onProgress?: (current: number, total: number) => void;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        try {
            // Process sequentially to avoid rate limits or manage concurrency
            for (let i = 0; i < options.images.length; i++) {
                const img = options.images[i];

                if (options.onProgress) {
                    options.onProgress(i + 1, options.images.length);
                }

                const result = await this.editImage({
                    image: img,
                    prompt: options.prompt,
                    negativePrompt: options.negativePrompt
                });
                if (result) {
                    results.push(result);
                }
            }
        } catch (e) {
            throw e;
        }
        return results;
    }

    async editVideo(options: {
        video: { mimeType: string; data: string };
        prompt: string;
        negativePrompt?: string;
    }): Promise<{ id: string, url: string, prompt: string } | null> {
        try {
            // Use firebaseAI for video editing/analysis
            const response = await firebaseAI.generateContent([{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: options.video.mimeType, data: options.video.data } },
                    { text: `Edit this video: ${options.prompt}` + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '') }
                ]
            }]);

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && 'inlineData' in part && part.inlineData) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                return {
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Video Edit: ${options.prompt}`
                };
            }

            const text = response.response.text();
            if (text && text.startsWith('http')) {
                return {
                    id: crypto.randomUUID(),
                    url: text,
                    prompt: `Video Edit: ${options.prompt}`
                };
            }

            return null;
        } catch (e) {
            throw e;
        }
    }

    async batchEditVideo(options: {
        videos: { mimeType: string; data: string }[];
        prompt: string;
        negativePrompt?: string;
        onProgress?: (current: number, total: number) => void;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        try {
            for (let i = 0; i < options.videos.length; i++) {
                const vid = options.videos[i];

                if (options.onProgress) {
                    options.onProgress(i + 1, options.videos.length);
                }

                const result = await this.editVideo({
                    video: vid,
                    prompt: options.prompt,
                    negativePrompt: options.negativePrompt
                });
                if (result) {
                    results.push(result);
                }
            }
        } catch (e) {
            throw e;
        }
        return results;
    }

    async generateComposite(options: {
        images: { mimeType: string; data: string }[];
        prompt: string;
        projectContext?: string;
    }): Promise<{ id: string, url: string, prompt: string } | null> {
        try {

            const parts: import('firebase/ai').Part[] = [];
            options.images.forEach((img, idx) => {
                parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                parts.push({ text: `[Reference ${idx + 1}]` });
            });
            parts.push({ text: `Combine these references. ${options.prompt} ${options.projectContext || ''}` });

            const response = await firebaseAI.generateContent([{ role: 'user', parts }]);

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
        } catch (e) {
            throw e;
        }
    }

    async generateStoryChain(options: {
        prompt: string;
        count: number;
        timeDeltaLabel: string;
        startImage?: { mimeType: string; data: string };
        projectContext?: string;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        try {
            // Step 1: Plan Scenes
            const plannerPrompt = `We are generating a sequence of ${options.count} images with a time jump of ${options.timeDeltaLabel} per frame based on: "${options.prompt}". 
            Break this into ${options.count} specific scene descriptions.`;

            const planSchema = {
                type: 'object',
                properties: {
                    scenes: { type: 'array', items: { type: 'string' } }
                },
                required: ['scenes']
            };

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - Schema typing mismatch
            const plan = await firebaseAI.generateStructuredData<{ scenes: string[] }>(plannerPrompt, planSchema);
            const scenes = plan.scenes || [];
            while (scenes.length < options.count) scenes.push(`${options.prompt} (${options.timeDeltaLabel} Sequence)`);

            let previousImage = options.startImage;
            let visualContext = "";

            for (let i = 0; i < options.count; i++) {
                // Step 2: Analyze Context (if prev image exists)
                if (previousImage) {
                    visualContext = await firebaseAI.analyzeImage(
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

                const promptText = `Next keyframe (Time Delta: ${options.timeDeltaLabel}): ${scenes[i]}. \n\nVisual DNA & Temporal Context: ${visualContext}. \n\n${options.projectContext || ''}`;
                parts.push({ text: promptText });

                const response = await firebaseAI.rawGenerateContent([{ role: 'user', parts }]);

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
        } catch (e) {
            throw e;
        }
        return results;
    }
}

export const Editing = new EditingService();
