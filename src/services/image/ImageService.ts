import { AI } from '../ai/AIService';

export interface ImageGenerationOptions {
    prompt: string;
    count?: number;
    aspectRatio?: string;
    resolution?: string;
    seed?: number;
    negativePrompt?: string;
    sourceImages?: { mimeType: string; data: string }[]; // For edit/reference modes
    projectContext?: string;
}

export interface RemixOptions {
    contentImage: { mimeType: string; data: string };
    styleImage: { mimeType: string; data: string };
    prompt?: string;
}

export class ImageService {

    async generateImages(options: ImageGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        const count = options.count || 1;

        const baseConfig: any = {
            imageConfig: {
                imageSize: options.resolution || '2K',
                aspectRatio: options.aspectRatio
            }
        };

        for (let i = 0; i < count; i++) {
            try {
                const iterConfig = JSON.parse(JSON.stringify(baseConfig));
                if (options.seed !== undefined) iterConfig.seed = options.seed + i;

                const contents: any = { parts: [] };

                // Add Reference Images
                if (options.sourceImages) {
                    options.sourceImages.forEach(img => {
                        contents.parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                    });
                }

                const fullPrompt = options.prompt + (options.projectContext || '') + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '');
                contents.parts.push({ text: fullPrompt });

                const response = await AI.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents,
                    config: iterConfig
                });

                console.log("AI Response:", response);

                if (!response.candidates || response.candidates.length === 0) {
                    console.warn("No candidates in response");
                }

                for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) {
                        const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        // ID generation should ideally happen here or in the store. 
                        // We'll return the data and let the caller handle ID/Store.
                        results.push({
                            id: crypto.randomUUID(),
                            url,
                            prompt: options.prompt
                        });
                    } else {
                        console.warn("Part has no inlineData:", part);
                    }
                }
            } catch (err) {
                console.error("Image Generation Error:", err);
                throw err;
            }
        }
        return results;
    }

    async remixImage(options: RemixOptions): Promise<{ url: string } | null> {
        try {
            const response = await AI.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: {
                    parts: [
                        { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } }, { text: "Content Ref" },
                        { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } }, { text: "Style Ref" },
                        { text: `Generate: ${options.prompt || "Fusion"}` }
                    ]
                },
                config: { imageConfig: { imageSize: '2K' } }
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) {
                return { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
            }
            return null;
        } catch (e) {
            console.error("Remix Error:", e);
            throw e;
        }
    }

    async extractStyle(image: { mimeType: string; data: string }): Promise<{ prompt_desc?: string, style_context?: string, negative_prompt?: string }> {
        try {
            const response = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: {
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
                    ]
                },
                config: { responseMimeType: 'application/json' }
            });

            return AI.parseJSON(response.text);
        } catch (e) {
            console.error("Style Extraction Error:", e);
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
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: plannerPrompt }] },
                config: { responseMimeType: 'application/json' }
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
                        model: 'gemini-3-pro-preview',
                        contents: {
                            parts: [
                                { inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } },
                                { text: `You are a Visual Physics Engine. Analyze the scene. Return a concise visual description to guide the next frame generation.` }
                            ]
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
                    model: 'gemini-3-pro-image-preview',
                    contents,
                    config: { imageConfig: { imageSize: '2K' } }
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

    async batchRemix(options: {
        styleImage: { mimeType: string; data: string };
        targetImages: { mimeType: string; data: string; width?: number; height?: number }[];
        prompt?: string;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        try {
            for (const target of options.targetImages) {
                const response = await AI.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: target.mimeType, data: target.data } },
                            { text: "[Content Reference]" },
                            { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } },
                            { text: "[Style Reference]" },
                            { text: `Render the Content image exactly in the style of the Reference image. ${options.prompt || "Restyle"}` }
                        ]
                    },
                    config: { imageConfig: { imageSize: '2K' } }
                });

                const part = response.candidates?.[0]?.content?.parts?.[0];
                if (part && part.inlineData) {
                    const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    results.push({
                        id: crypto.randomUUID(),
                        url,
                        prompt: `Batch Style: ${options.prompt || "Restyle"}`
                    });
                }
            }
        } catch (e) {
            console.error("Batch Remix Error:", e);
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
                model: 'gemini-3-pro-image-preview',
                contents,
                config: { imageConfig: { imageSize: '2K' } }
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
}

export const Image = new ImageService();
