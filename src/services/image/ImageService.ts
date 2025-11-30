import { AI } from '../ai/AIService';
import { extractVideoFrame } from '@/utils/video';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

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
            ...AI_CONFIG.IMAGE.DEFAULT,
            imageConfig: {
                ...AI_CONFIG.IMAGE.DEFAULT.imageConfig,
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
                    model: AI_MODELS.IMAGE.GENERATION,
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
                model: AI_MODELS.IMAGE.GENERATION,
                contents: {
                    parts: [
                        { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } }, { text: "Content Ref" },
                        { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } }, { text: "Style Ref" },
                        { text: `Generate: ${options.prompt || "Fusion"}` }
                    ]
                },
                config: AI_CONFIG.IMAGE.DEFAULT
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
                model: AI_MODELS.TEXT.FAST,
                contents: {
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
    private async analyzeTemporalContext(image: string, offset: number, basePrompt: string): Promise<string> {
        try {
            const direction = offset > 0 ? 'future' : 'past';
            const duration = Math.abs(offset);

            const analysisPrompt = `You are a master cinematographer and physics engine. 
            Analyze this image frame which represents the ${offset > 0 ? 'START' : 'END'} of a video sequence.
            Context: "${basePrompt}"
            
            Task: Predict exactly what happens ${duration} seconds into the ${direction}.
            Describe the motion, physics, lighting changes, and character actions that bridge this gap.
            Focus on continuity and logical progression.
            
            Return a concise but descriptive paragraph (max 50 words) describing the video sequence.`;

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: {
                    parts: [
                        { inlineData: { mimeType: image.split(';')[0].split(':')[1], data: image.split(',')[1] } },
                        { text: analysisPrompt }
                    ]
                },
                config: {
                    ...AI_CONFIG.THINKING.HIGH
                }
            });

            return response.text || "";
        } catch (e) {
            console.warn("Temporal Analysis Failed:", e);
            return "";
        }
    }

    async generateVideo(options: {
        prompt: string;
        aspectRatio?: string;
        resolution?: string;
        seed?: number;
        negativePrompt?: string;
        model?: string;
        firstFrame?: string; // Data URI
        lastFrame?: string; // Data URI
        timeOffset?: number;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const model = options.model || AI_MODELS.VIDEO.GENERATION;
        let fullPrompt = options.negativePrompt
            ? `${options.prompt} --negative_prompt ${options.negativePrompt}`
            : options.prompt;

        // AI Temporal Analysis
        if (options.timeOffset && options.timeOffset !== 0) {
            const referenceFrame = options.firstFrame || options.lastFrame;
            if (referenceFrame && referenceFrame.startsWith('data:')) {
                console.log(`Analyzing temporal context for ${options.timeOffset}s offset...`);
                const temporalContext = await this.analyzeTemporalContext(referenceFrame, options.timeOffset, options.prompt);
                if (temporalContext) {
                    fullPrompt += `\n\nVisual Sequence: ${temporalContext}`;
                }
            }
        }

        const timeContext = options.timeOffset
            ? ` (Time Offset: ${options.timeOffset > 0 ? '+' : ''}${options.timeOffset}s)`
            : '';

        const finalPrompt = fullPrompt + timeContext;

        try {
            const videoUri = await AI.generateVideo({
                model,
                prompt: finalPrompt,
                image: (options.firstFrame && options.firstFrame.startsWith('data:'))
                    ? { mimeType: options.firstFrame.split(';')[0].split(':')[1], imageBytes: options.firstFrame.split(',')[1] }
                    : undefined,
                config: {
                    lastFrame: (options.lastFrame && options.lastFrame.startsWith('data:'))
                        ? { mimeType: options.lastFrame.split(';')[0].split(':')[1], imageBytes: options.lastFrame.split(',')[1] }
                        : undefined
                }
            });

            if (videoUri) {
                return [{
                    id: crypto.randomUUID(),
                    url: videoUri,
                    prompt: options.prompt
                }];
            }

            // Fallback: Generate a Storyboard Preview using Gemini 3 Pro Image
            console.log("Video API unavailable, generating Storyboard Preview...");

            const storyboardPrompt = `Create a 2x2 storyboard grid showing the sequence of: ${options.prompt}. 
            ${options.firstFrame ? 'The sequence starts with the provided reference image.' : ''}
            ${options.lastFrame ? 'The sequence ends with the provided reference image.' : ''}
            Cinematic lighting, 8k resolution, consistent character and style.`;

            // Reuse generateImages to create the storyboard
            const storyboardImages = await this.generateImages({
                prompt: storyboardPrompt,
                count: 1,
                resolution: '2K',
                aspectRatio: '16:9', // Keep 16:9 for the grid itself
                sourceImages: options.firstFrame ? [{ mimeType: 'image/png', data: options.firstFrame.split(',')[1] }] : undefined
            });

            if (storyboardImages.length > 0) {
                return [{
                    id: crypto.randomUUID(),
                    url: storyboardImages[0].url,
                    prompt: `[Storyboard Preview] ${options.prompt}`
                }];
            }

            // Ultimate fallback if even image gen fails
            return [{
                id: crypto.randomUUID(),
                url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                prompt: `[SIMULATION] ${options.prompt}`
            }];
        } catch (e: any) {
            console.error("Video Generation Error:", e);

            // Attempt Storyboard Fallback
            try {
                console.log("Attempting Storyboard Fallback...");
                const storyboardPrompt = `Create a cinematic storyboard sequence for: ${options.prompt}. 
                ${options.firstFrame ? 'The sequence starts with the provided reference image.' : ''}
                ${options.lastFrame ? 'The sequence ends with the provided reference image.' : ''}
                High resolution, consistent style.`;

                const storyboardImages = await this.generateImages({
                    prompt: storyboardPrompt,
                    count: 1,
                    resolution: '2K',
                    aspectRatio: '16:9',
                    sourceImages: options.firstFrame ? [{ mimeType: 'image/png', data: options.firstFrame.split(',')[1] }] : undefined
                });

                if (storyboardImages.length > 0) {
                    return [{
                        id: crypto.randomUUID(),
                        url: storyboardImages[0].url,
                        prompt: `[Storyboard Fallback] ${options.prompt}`
                    }];
                }
            } catch (fallbackErr) {
                console.error("Fallback failed:", fallbackErr);
            }

            // Ultimate fallback
            const errorMessage = e.message || e.toString();
            return [{
                id: crypto.randomUUID(),
                url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                prompt: `[ERROR: ${errorMessage}] ${options.prompt}`
            }];
        }
    }
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
    async generateLongFormVideo(options: {
        prompt: string;
        totalDuration: number; // in seconds
        aspectRatio?: string;
        resolution?: string;
        seed?: number;
        negativePrompt?: string;
        firstFrame?: string;
        onProgress?: (current: number, total: number) => void;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const BLOCK_DURATION = 8; // seconds
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const results: { id: string, url: string, prompt: string }[] = [];
        let currentFirstFrame = options.firstFrame;

        try {
            for (let i = 0; i < numBlocks; i++) {
                if (options.onProgress) {
                    options.onProgress(i + 1, numBlocks);
                }

                // Generate 8s block
                const blockResults = await this.generateVideo({
                    prompt: `${options.prompt} (Part ${i + 1}/${numBlocks})`,
                    aspectRatio: options.aspectRatio,
                    resolution: options.resolution,
                    seed: options.seed ? options.seed + i : undefined,
                    negativePrompt: options.negativePrompt,
                    firstFrame: currentFirstFrame,
                    // We don't set lastFrame here as we are generating *forward*
                });

                if (blockResults.length > 0) {
                    const video = blockResults[0];
                    results.push(video);

                    // Extract last frame for next iteration
                    // We need to wait for the video to be "ready" to extract frame.
                    // Since generateVideo returns a URL, we can try to extract.
                    try {
                        // Note: This might fail if the URL is not immediately accessible or CORS issues.
                        // In a real app, we might need a backend service to do this or wait.
                        // For simulation, BigBuckBunny works.
                        const lastFrameData = await extractVideoFrame(video.url);
                        currentFirstFrame = lastFrameData;
                    } catch (err) {
                        console.warn(`Failed to extract frame from video ${video.id}, breaking chain.`, err);
                        break; // Stop if we can't chain
                    }
                } else {
                    break; // Stop if generation failed
                }
            }
        } catch (e) {
            console.error("Long Form Generation Error:", e);
            throw e;
        }

        return results;
    }
}

export const Image = new ImageService();
