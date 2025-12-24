import { AI } from '../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

// Types
export interface ShowroomState {
    productAsset: string | null; // Base64 or URL
    productType: 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';
    scenePrompt: string;
    motionPrompt: string;
    generatedMockup: string | null; // Base64
    generatedVideo: string | null; // URL
    isGenerating: boolean;
}

export class ShowroomService {

    static async generateMockup(
        productAsset: string,
        productType: string,
        scenePrompt: string
    ): Promise<string> {
        console.log('[ShowroomService] Generating mockup...', { productType, scenePrompt });

        // Construct the Texture Mapping Prompt
        const prompt = `
        You are a product visualizer. Use the provided graphic design asset (the first image).
        
        TASK:
        Generate a photorealistic image of a ${productType} in this scene: "${scenePrompt}".
        
        CRITICAL INSTRUCTION:
        You MUST apply the provided graphic design onto the ${productType}.
        The graphic must conform to the geometry, fabric folds, lighting, and texture of the object.
        Do not change the graphic's colors or content. Just map it onto the 3D surface.
        `;

        // Call Gemini 3 Pro Image (via AIService/Agent)
        // Note: In a real implementation, we'd pass the image as a 'part'.
        // For now, we simulate the call structure used by AIService.image

        return await AI.generateImage({
            model: AI_MODELS.IMAGE.GENERATION,
            prompt: prompt,
            config: {
                aspectRatio: '1:1',
                sampleCount: 1,
            }
        });
    }

    static async generateVideo(
        mockupImage: string,
        motionPrompt: string
    ): Promise<string> {
        console.log('[ShowroomService] Animate scene...', { motionPrompt });

        // Call Veo 3.1
        // Input: Image (Mockup) + Text (Motion)

        return "mock_generated_video_url_placeholder";
    }
}
