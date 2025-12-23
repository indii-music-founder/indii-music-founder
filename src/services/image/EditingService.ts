import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { isInlineDataPart, isTextPart, type ContentPart } from '@/shared/types/ai.dto';

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

            const data = result.data as any;
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
            console.error("Edit Image Error:", e);
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
            console.log("Starting Multi-Mask Edit with", options.masks.length, "masks. Generating", count, "variations.");

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
            console.error("Multi Mask Edit Error:", e);
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
            console.error("Batch Edit Error:", e);
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
            // Use Veo or Gemini 1.5 Pro for video editing/analysis
            const model = AI_MODELS.VIDEO.EDIT;

            const response = await AI.generateContent({
                model,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: options.video.mimeType, data: options.video.data } },
                        { text: `Edit this video: ${options.prompt}` + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '') }
                    ]
                },
                config: {
                    // Video config if needed
                }
            });

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && isInlineDataPart(part)) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                return {
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Video Edit: ${options.prompt}`
                };
            }

            if (part && isTextPart(part) && part.text.startsWith('http')) {
                return {
                    id: crypto.randomUUID(),
                    url: part.text,
                    prompt: `Video Edit: ${options.prompt}`
                };
            }

            return null;
        } catch (e) {
            console.error("Edit Video Error:", e);
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
            console.error("Batch Video Edit Error:", e);
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
            const contents: any = { role: 'user', parts: [] };
            options.images.forEach((img, idx) => {
                contents.parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                contents.parts.push({ text: `[Reference ${idx + 1}]` });
            });
            contents.parts.push({ text: `Combine these references. ${options.prompt} ${options.projectContext || ''}` });

            const response = await AI.generateContent({
                model: AI_MODELS.IMAGE.GENERATION,
                contents,
                config: AI_CONFIG.IMAGE.DEFAULT
            });

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && isInlineDataPart(part)) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                return {
                    id: crypto.randomUUID(),
                    url,
                    prompt: "Composite"
                };
            }
            return null;
        } catch (e) {
            console.error("Composite Error:", e);
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
            Break this into ${options.count} specific scene descriptions. Return JSON { "scenes": [] }`;

            const planRes = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: plannerPrompt }] },
                config: {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.HIGH
                }
            });
            const plan = AI.parseJSON<{ scenes: string[] }>(planRes.text());
            const scenes = plan.scenes || [];
            while (scenes.length < options.count) scenes.push(`${options.prompt} (${options.timeDeltaLabel} Sequence)`);

            let previousImage = options.startImage;
            let visualContext = "";

            for (let i = 0; i < options.count; i++) {
                // Step 2: Analyze Context (if prev image exists)
                if (previousImage) {
                    const analysisRes = await AI.generateContent({
                        model: AI_MODELS.TEXT.FAST,
                        contents: {
                            role: 'user',
                            parts: [
                                { inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } },
                                { text: `You are a Visual Physics Engine. Analyze the scene. Return a concise visual description to guide the next frame generation.` }
                            ]
                        },
                        config: {
                            ...AI_CONFIG.THINKING.LOW
                        }
                    });
                    visualContext = analysisRes.text() || "";
                }

                // Step 3: Generate Frame
                const contents: any = { role: 'user', parts: [] };
                if (previousImage) {
                    contents.parts.push({ inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } });
                    contents.parts.push({ text: `[Reference Frame]` });
                }

                const promptText = `Next keyframe (Time Delta: ${options.timeDeltaLabel}): ${scenes[i]}. \n\nVisual DNA & Temporal Context: ${visualContext}. \n\n${options.projectContext || ''}`;
                contents.parts.push({ text: promptText });

                const response = await AI.generateContent({
                    model: AI_MODELS.IMAGE.GENERATION,
                    contents,
                    config: AI_CONFIG.IMAGE.DEFAULT
                });

                const part = response.response.candidates?.[0]?.content?.parts?.[0];
                if (part && isInlineDataPart(part) && part.inlineData.mimeType && part.inlineData.data) {
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
            console.error("Story Chain Error:", e);
            throw e;
        }
        return results;
    }
}

export const Editing = new EditingService();
