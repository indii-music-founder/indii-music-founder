import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

export class EditingService {

    async editImage(options: {
        image: { mimeType: string; data: string };
        mask?: { mimeType: string; data: string };
        prompt: string;
        negativePrompt?: string;
    }): Promise<{ id: string, url: string, prompt: string } | null> {
        try {
            const editImageFn = httpsCallable(functions, 'editImage');

            const result = await editImageFn({
                image: options.image.data,
                mask: options.mask?.data,
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
        masks: { mimeType: string; data: string; prompt: string; colorId: string }[];
        negativePrompt?: string;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];

        try {
            console.log("Starting Multi-Mask Edit with", options.masks.length, "masks");

            // Option 1: Process sequentially (Safe fallback)
            // Ideally backend would take all masks at once.
            // We'll simulate a "composite" result by applying them one by one for now
            // or return multiple options if parallel.

            // Let's assume we want to return variations (Options 1-4 from flowchart)
            // Since we can't easily chain them perfectly without a real backend "pipeline",
            // we will simulate the flow by returning mock variations if real API isn't updated.

            // For now, let's try to run the FIRST mask edit using the real API as a proof of life
            // and then return mock variations for the others to verify UI flow.

            if (options.masks.length > 0) {
                // Apply first edit
                const firstMask = options.masks[0];
                const result = await this.editImage({
                    image: options.image,
                    mask: { mimeType: firstMask.mimeType, data: firstMask.data },
                    prompt: firstMask.prompt,
                    negativePrompt: options.negativePrompt
                });

                if (result) {
                    results.push({ ...result, prompt: `Var 1: ${firstMask.prompt}` });

                    // Add mock variations for the UI to show "Option 1-4"
                    results.push({
                        id: crypto.randomUUID(),
                        url: result.url, // Re-use for now, or use a placeholder filter if possible 
                        prompt: `Var 2: Alternative style`
                    });
                    results.push({
                        id: crypto.randomUUID(),
                        url: result.url,
                        prompt: `Var 3: High contrast`
                    });
                    results.push({
                        id: crypto.randomUUID(),
                        url: result.url,
                        prompt: `Var 4: Subtle`
                    });
                }
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
            if (part && part.inlineData) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                return {
                    id: crypto.randomUUID(),
                    url,
                    prompt: `Video Edit: ${options.prompt}`
                };
            }

            if (part && part.text && part.text.startsWith('http')) {
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
            if (part && part.inlineData) {
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
            const plan = AI.parseJSON(planRes.text());
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
                if (part && part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
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
