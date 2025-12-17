import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFrame } from '@/utils/video';

export class VideoGenerationService {

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
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.split(';')[0].split(':')[1], data: image.split(',')[1] } },
                        { text: analysisPrompt }
                    ]
                },
                config: {
                    ...AI_CONFIG.THINKING.HIGH
                }
            });

            return response.text() || "";
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
        ingredients?: string[]; // Data URIs (Ingredients to Video)
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

        const ingredientsContext = options.ingredients && options.ingredients.length > 0
            ? `\n\n[Reference Ingredients: The video should incorporate the style/characters from the provided ${options.ingredients.length} reference images.]`
            : '';

        const finalPrompt = fullPrompt + timeContext + ingredientsContext;

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

        if (!videoUri) {
            throw new Error('Video generation returned no result');
        }

        return [{
            id: crypto.randomUUID(),
            url: videoUri,
            prompt: options.prompt
        }];
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
                    try {
                        const lastFrameData = await extractVideoFrame(video.url);
                        currentFirstFrame = lastFrameData;
                    } catch (err: unknown) {
                        console.warn(`Failed to extract frame from video ${video.id}, breaking chain.`, err);
                        break; // Stop if we can't chain
                    }
                } else {
                    break; // Stop if generation failed
                }
            }
        } catch (e: unknown) {
            console.error("Long Form Generation Error:", e);
            throw e;
        }

        return results;
    }
    async triggerVideoGeneration(options: VideoGenerationOptions & { orgId: string }): Promise<{ jobId: string }> {
        try {
            const { functions } = await import('../firebase');
            const { httpsCallable } = await import('firebase/functions');

            const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

            const jobId = uuidv4();

            await triggerVideoJob({
                ...options,
                jobId,
                // userId is handled by context.auth in the backend
            });

            return { jobId };
        } catch (error) {
            console.error("Failed to trigger video generation:", error);
            throw error;
        }
    }
}

export interface VideoGenerationOptions {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    seed?: number;
    negativePrompt?: string;
    model?: string;
    firstFrame?: string;
    lastFrame?: string;
    timeOffset?: number;
    ingredients?: string[];
    duration?: number;
    fps?: number;
}

export const VideoGeneration = new VideoGenerationService();
