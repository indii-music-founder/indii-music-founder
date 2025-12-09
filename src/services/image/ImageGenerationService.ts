import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

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

export class ImageGenerationService {

    async generateImages(options: ImageGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        const count = options.count || 1;

        try {
            const generateImage = httpsCallable(functions, 'generateImage');

            const fullPrompt = options.prompt + (options.projectContext || '') + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '');

            const result = await generateImage({
                prompt: fullPrompt,
                aspectRatio: options.aspectRatio,
                count: count,
                images: options.sourceImages
            });

            const data = result.data as any;

            if (!data.candidates || data.candidates.length === 0) {
                console.warn("No candidates in response");
                return [];
            }

            for (const candidate of data.candidates) {
                for (const part of candidate.content?.parts || []) {
                    if (part.inlineData) {
                        const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        results.push({
                            id: crypto.randomUUID(),
                            url,
                            prompt: options.prompt
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Image Generation Error:", err);
            throw err;
        }
        return results;
    }

    async remixImage(options: RemixOptions): Promise<{ url: string } | null> {
        try {
            const response = await AI.generateContent({
                model: AI_MODELS.IMAGE.GENERATION,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } }, { text: "Content Ref" },
                        { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } }, { text: "Style Ref" },
                        { text: `Generate: ${options.prompt || "Fusion"}` }
                    ]
                },
                config: AI_CONFIG.IMAGE.DEFAULT
            });

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
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
                model: AI_MODELS.TEXT.FAST,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
                    ]
                },
                config: {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.LOW
                }
            });

            return AI.parseJSON(response.text());
        } catch (e) {
            console.error("Style Extraction Error:", e);
            throw e;
        }
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
                    model: AI_MODELS.IMAGE.GENERATION,
                    contents: {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: target.mimeType, data: target.data } },
                            { text: "[Content Reference]" },
                            { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } },
                            { text: "[Style Reference]" },
                            { text: `Render the Content image exactly in the style of the Reference image. ${options.prompt || "Restyle"}` }
                        ]
                    },
                    config: AI_CONFIG.IMAGE.DEFAULT
                });

                const part = response.response.candidates?.[0]?.content?.parts?.[0];
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
}

export const ImageGeneration = new ImageGenerationService();
