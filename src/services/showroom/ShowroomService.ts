import { VideoGeneration } from '@/services/image/VideoGenerationService';
import { Editing } from '@/services/image/EditingService';

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

        // Extract mimeType and data from Data URL
        const match = productAsset.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new Error("Invalid asset data format. Expected Data URL.");

        const assetImage = { mimeType: match[1], data: match[2] };

        // Construct the Texture Mapping Prompt
        const prompt = `
        PRODUCT VISUALIZATION TASK:
        Product Type: ${productType.toUpperCase()}
        Scene Context: ${scenePrompt}

        CRITICAL INSTRUCTIONS:
        1. You are a professional product visualizer.
        2. Apply the provided graphic design (Reference Image 1) onto the ${productType} with photorealistic accuracy.
        3. The graphic MUST conform perfectly to the surface geometry, fabric folds, and lighting of the ${productType}.
        4. Preserve exact colors and details of the original graphic design.
        5. Final image should be a high-end commercial product photograph.
        `;

        const result = await Editing.generateComposite({
            images: [assetImage],
            prompt: prompt,
            projectContext: "Premium commercial product visualization with accurate texture mapping."
        });

        if (!result) {
            throw new Error("Failed to generate mockup image.");
        }

        return result.url;
    }

    static async generateVideo(
        mockupImage: string,
        motionPrompt: string
    ): Promise<string> {
        console.log('[ShowroomService] Animate scene...', { motionPrompt });

        const enhancedPrompt = `CINEMATIC PRODUCT VIDEO:
        Motion: ${motionPrompt}
        
        REQUIREMENTS:
        - Smooth, professional camera movement
        - Maintain consistent lighting and product details
        - High production value, commercial quality
        - Natural motion physics
        `;

        const results = await VideoGeneration.generateVideo({
            prompt: enhancedPrompt,
            firstFrame: mockupImage,
            resolution: '720p',
            aspectRatio: '16:9'
        });

        if (!results || results.length === 0) {
            throw new Error("Failed to animate scene.");
        }

        return results[0].url;
    }
}
