import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export class EditingService {

    async editImage(options: {
        image: { mimeType: string; data: string };
        mask?: { mimeType: string; data: string };
        prompt: string;
        negativePrompt?: string;
    }): Promise<{ id: string, url: string, prompt: string } | null> {
        try {
            const parts: any[] = [
                { inlineData: { mimeType: options.image.mimeType, data: options.image.data } }
            ];

            if (options.mask) {
                parts.push({ inlineData: { mimeType: options.mask.mimeType, data: options.mask.data } });
                parts.push({ text: "Use the second image as a mask for inpainting." });
            }

            parts.push({ text: `Edit this image: ${options.prompt}` + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '') });

            const response = await AI.generateContent({
                model: AI_MODELS.IMAGE.GENERATION,
                contents: { parts },
                config: AI_CONFIG.IMAGE.DEFAULT
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
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
                    parts: [
                        { inlineData: { mimeType: options.video.mimeType, data: options.video.data } },
                        { text: `Edit this video: ${options.prompt}` + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '') }
                    ]
                },
                config: {
                    // Video config if needed
                }
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
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
            const contents: any = { parts: [] };
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

            const part = response.candidates?.[0]?.content?.parts?.[0];
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
                contents: { parts: [{ text: plannerPrompt }] },
                config: {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.HIGH
                }
            });
            const plan = AI.parseJSON(planRes.text);
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
                            parts: [
                                { inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } },
                                { text: `You are a Visual Physics Engine. Analyze the scene. Return a concise visual description to guide the next frame generation.` }
                            ]
                        },
                        config: {
                            ...AI_CONFIG.THINKING.LOW
                        }
                    });
                    visualContext = analysisRes.text || "";
                }

                // Step 3: Generate Frame
                const contents: any = { parts: [] };
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

                const part = response.candidates?.[0]?.content?.parts?.[0];
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
