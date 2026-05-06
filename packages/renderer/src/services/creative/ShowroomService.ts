import { logger } from '@/utils/logger';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGenerationService } from '@/services/video/VideoGenerationService';
import { AI_MODELS } from '@/core/config/ai-models';
import { HistoryItem } from '@/core/types/history';

/**
 * ShowroomService
 * 
 * Orchestrates the Stage 1 (Virtual Compositor) and Stage 2 (Demo Director)
 * pipelines for the Product Showroom mode.
 */
export class ShowroomService {
    private videoService = new VideoGenerationService();

    /**
     * Stage 1: Virtual Compositor
     * Uses Gemini 3 Pro (Nano Banana Pro) to perform photorealistic geometric 
     * texture mapping of a graphic onto a product base.
     * 
     * @param options - Configuration for the mockup generation
     * @returns A promise resolving to the generated HistoryItem
     */
    async runShowroomMockup(options: {
        asset: HistoryItem;
        productType: string;
        sceneDescription: string;
        placementHint?: string;
    }): Promise<HistoryItem> {
        logger.info('[Showroom] Stage 1: Virtual Compositor starting', {
            productType: options.productType,
            scene: options.sceneDescription
        });

        const prompt = `
            SYSTEM INSTRUCTION: You are a Virtual Compositor specializing in geometric texture mapping and photorealistic product visualization.
            
            TASK: Take the provided graphic (Asset) and photorealistically map it onto a high-quality ${options.productType}.
            
            SPECIFICATIONS:
            - PLACEMENT: ${options.placementHint || 'Center Chest'}.
            - SCENE: ${options.sceneDescription}.
            - LIGHTING: Dynamic commercial studio lighting that creates depth and highlights.
            
            CORE REQUIREMENTS:
            - GEOMETRY: Respect the physical geometry, folds, wrinkles, and shadows of the ${options.productType}.
            - TEXTURE: Ensure the graphic follows the contours of the fabric/material perfectly. It should not look "flat" or overlaid.
            - REALISM: The final output must look like a high-end, professional commercial photograph.
            - ENVIRONMENT: The background and atmosphere should match: ${options.sceneDescription}.
            
            Output a single, perfect composition.
        `.trim();

        // Extract raw base64 data from data URI if present
        const assetData = options.asset.url.includes(',') 
            ? options.asset.url.split(',')[1] 
            : options.asset.url;

        const results = await ImageGeneration.generateImages({
            prompt,
            model: 'pro', // Nano Banana Pro (gemini-3-pro-image-preview)
            sourceImages: [{
                mimeType: 'image/png', // Most showroom assets are transparent PNGs
                data: assetData as any
            }],
            imageSize: '2k',
            aspectRatio: '16:9'
        });

        if (!results || results.length === 0) {
            throw new Error('Failed to generate showroom mockup.');
        }

        const result = results[0];
        if (!result) {
            throw new Error('Failed to generate showroom mockup result.');
        }
        return {
            id: result.id,
            type: 'image',
            url: result.url,
            prompt: result.prompt,
            timestamp: Date.now(),
            origin: 'generated',
            projectId: options.asset.projectId
        };
    }

    /**
     * Stage 2: Demo Director
     * Uses Veo 3.1 to animate the mockup generated in Stage 1,
     * creating a cinematic product demonstration.
     * 
     * @param options - Configuration for the video generation
     * @returns A promise resolving to the generated video HistoryItem
     */
    async runShowroomVideo(options: {
        mockup: HistoryItem;
        motionDescription: string;
    }): Promise<HistoryItem> {
        logger.info('[Showroom] Stage 2: Demo Director starting', {
            motion: options.motionDescription
        });

        const prompt = `
            Cinematic product demonstration video. ${options.motionDescription}. 
            The video should focus on the product and its details.
            Subject: The ${options.mockup.prompt}. 
            Lighting: High-end commercial lighting, consistent with the source image.
            Physics: Realistic fabric and surface motion as the subject or camera moves.
            Atmosphere: Premium, professional, and visually stunning.
        `.trim();

        const results = await this.videoService.generateVideo({
            prompt,
            firstFrame: options.mockup.url, // Seed the video with the mockup from Stage 1
            model: AI_MODELS.VIDEO.PRO, // Veo 3.1
            duration: 8,
            resolution: '1080p',
            aspectRatio: '16:9'
        });

        if (!results || results.length === 0) {
            throw new Error('Failed to generate showroom video.');
        }

        const result = results[0];
        if (!result) {
            throw new Error('Failed to generate showroom video result.');
        }
        return {
            id: result.id,
            type: 'video',
            url: result.url,
            prompt: result.prompt,
            timestamp: Date.now(),
            origin: 'generated',
            projectId: options.mockup.projectId
        };
    }
}

export const showroomService = new ShowroomService();
