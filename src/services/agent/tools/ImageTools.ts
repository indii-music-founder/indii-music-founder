import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';

export const ImageTools = {
    generate_image: async (args: any) => {
        try {
            const { studioControls, addToHistory, currentProjectId, userProfile } = useStore.getState();

            let sourceImages: { mimeType: string; data: string }[] | undefined;

            // Handle Reference Images
            if (args.referenceImageIndex !== undefined) {
                const refImages = userProfile.brandKit?.referenceImages || [];
                const refImg = refImages[args.referenceImageIndex];
                if (refImg) {
                    const match = refImg.url.match(/^data:(.+);base64,(.+)$/);
                    if (match) {
                        sourceImages = [{ mimeType: match[1], data: match[2] }];
                        console.log(`[ImageTools] Using reference image: ${refImg.description || 'Untitled'}`);
                    }
                }
            }

            const results = await ImageGeneration.generateImages({
                prompt: args.prompt || "A creative scene",
                count: args.count || 1,
                resolution: args.resolution || studioControls.resolution,
                aspectRatio: args.aspectRatio || studioControls.aspectRatio,
                negativePrompt: args.negativePrompt || studioControls.negativePrompt,
                seed: args.seed ? parseInt(args.seed) : (studioControls.seed ? parseInt(studioControls.seed) : undefined),
                sourceImages: sourceImages
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                return `Successfully generated ${results.length} images. They are now in the Gallery.`;
            }
            return "Generation completed but no images were returned.";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Image generation failed: ${e.message}`;
            }
            return `Image generation failed: An unknown error occurred.`;
        }
    },
    batch_edit_images: async (args: { prompt: string, imageIndices?: number[] }) => {
        try {
            const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();

            if (uploadedImages.length === 0) {
                return "No images found in uploads to edit. Please upload images first.";
            }

            // Filter images if indices provided, otherwise use all
            const targetImages = args.imageIndices
                ? args.imageIndices.map(i => uploadedImages[i]).filter(Boolean)
                : uploadedImages;

            if (targetImages.length === 0) {
                return "No valid images found for the provided indices.";
            }

            // Convert HistoryItem to { mimeType, data } format
            // Assuming url is data:image/png;base64,...
            const imageDataList = targetImages.map(img => {
                const match = img.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
                return null;
            }).filter(img => img !== null) as { mimeType: string; data: string }[];

            if (imageDataList.length === 0) {
                return "Could not process image data from uploads.";
            }

            const results = await Editing.batchEdit({
                images: imageDataList,
                prompt: args.prompt,
                onProgress: (current, total) => {
                    useStore.getState().addAgentMessage({
                        id: crypto.randomUUID(),
                        role: 'system',
                        text: `Processing image ${current} of ${total}...`,
                        timestamp: Date.now()
                    });
                }
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                return `Successfully edited ${results.length} images based on instruction: "${args.prompt}".`;
            }
            return "Batch edit completed but no images were returned.";

        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Batch edit failed: ${e.message}`;
            }
            return `Batch edit failed: An unknown error occurred.`;
        }
    }
};
