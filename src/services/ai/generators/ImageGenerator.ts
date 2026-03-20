/**
 * ImageGenerator — Extracted image generation logic from FirebaseAIService.
 *
 * Handles Gemini 3 native image generation via `rawGenerateContent` with
 * IMAGE response modality. Uses the existing content pipeline (circuit
 * breakers, retry, etc.) through the AIContext.
 */

import type { Tool } from 'firebase/ai';
import type { AIContext } from '../AIContext';
import type { GenerationConfig, GenerateImageOptions } from '@/shared/types/ai.dto';
import { AI_CONFIG } from '@/core/config/ai-models';

/**
 * Generate an image using the Gemini 3 native image generation model.
 *
 * This uses rawGenerateContent with IMAGE response modality — the model
 * returns inline image data in the response parts.
 */
export async function generateImage(
    ctx: AIContext,
    promptOrOptions: string | GenerateImageOptions,
    modelOverride?: string,
    configOverride?: GenerationConfig
): Promise<string> {
    return ctx.mediaBreaker.execute(async () => {
        await ctx.ensureInitialized();

        let prompt: string;
        let model = modelOverride || 'gemini-3-pro-image-preview';
        let config = configOverride;

        if (typeof promptOrOptions === 'object' && 'prompt' in promptOrOptions) {
            prompt = promptOrOptions.prompt;
            model = promptOrOptions.model || model;
            config = promptOrOptions.config || config;
        } else {
            prompt = promptOrOptions as string;
        }

        // 1. Setup Tools (Enable Google Search for grounding by default, aka "Nano Banana Pro" logic)
        const tools: Tool[] = [{ googleSearch: {} }];

        // 2. Setup Config
        const generationConfig: GenerationConfig = {
            responseModalities: ['IMAGE'], // Specific to Gemini 3 Image
            mediaResolution: AI_CONFIG.IMAGE.DEFAULT.mediaResolution as GenerationConfig['mediaResolution'],
            imageConfig: {
                aspectRatio: config?.aspectRatio || '1:1',
                imageSize: '4K', // "Perfect" quality
                personGenerationConfig: config?.imageConfig?.personGenerationConfig
            }
        };

        if (config?.numberOfImages) {
            generationConfig.candidateCount = config.numberOfImages as number;
        }

        // 3. Generate
        const result = await ctx.rawGenerateContent(
            prompt,
            model,
            generationConfig,
            undefined,
            tools
        );

        // 4. Extract Image
        // Gemini 3 returns images as inlineData in the parts
        const candidates = result.response.candidates;
        if (!candidates || candidates.length === 0) throw new Error('No candidates returned');

        const imagePart = candidates[0]!.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image/'));

        if (!imagePart || !imagePart.inlineData) {
            // Check if it was blocked or just text returned (e.g. "I cannot generate that")
            const textPart = candidates[0]!.content?.parts?.find(p => 'text' in p);
            if (textPart && 'text' in textPart) {
                throw new Error(`Generation blocked or failed: ${textPart.text}`);
            }
            throw new Error('No image data found in response');
        }

        return imagePart.inlineData.data;
    });
}
