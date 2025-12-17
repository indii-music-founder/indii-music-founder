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
            } else if (args.referenceAssetIndex !== undefined) {
                // Handle Brand Assets (e.g. Logos)
                const brandAssets = userProfile.brandKit?.brandAssets || [];
                const asset = brandAssets[args.referenceAssetIndex];
                if (asset) {
                    const match = asset.url.match(/^data:(.+);base64,(.+)$/);
                    if (match) {
                        sourceImages = [{ mimeType: match[1], data: match[2] }];
                        console.log(`[ImageTools] Using brand asset: ${asset.description || 'Untitled'}`);
                    }
                }
            } else if (args.uploadedImageIndex !== undefined) {
                // Handle Recent Uploads
                const { uploadedImages } = useStore.getState();
                const upload = uploadedImages[args.uploadedImageIndex];
                if (upload) {
                    const match = upload.url.match(/^data:(.+);base64,(.+)$/);
                    if (match) {
                        sourceImages = [{ mimeType: match[1], data: match[2] }];
                        console.log(`[ImageTools] Using upload: ${upload.prompt || 'Untitled'}`);
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
    },
    render_cinematic_grid: async (args: { prompt: string }) => {
        try {
            // In a real implementation, this would call Nano Banana Pro
            // For now, we simulate a grid generation request to the existing image generator
            // asking it to compose a grid.
            // We also check for an entity anchor.
            const { entityAnchor } = useStore.getState();

            let fullPrompt = `Create a cinematic grid of shots (Wide, Medium, Close-up, Low Angle) for: ${args.prompt}.`;
            let sourceImages = undefined;

            if (entityAnchor) {
                const match = entityAnchor.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1], data: match[2] }];
                    fullPrompt += " Maintain strict character consistency with the provided reference.";
                }
            }

            // Re-use generate_image logic internally or call the service
            // Since we don't have a dedicated grid service yet, we wrap the standard generation
            // assuming the model can handle "split screen" or "grid" prompts.
            const results = await ImageGeneration.generateImages({
                prompt: fullPrompt,
                count: 1, // We want 1 image that IS a grid
                resolution: '4K', // High res for grid details
                aspectRatio: '16:9',
                sourceImages: sourceImages
            });

            if (results.length > 0) {
                const { addToHistory, currentProjectId } = useStore.getState();
                const res = results[0];
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: fullPrompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    meta: 'cinematic_grid'
                });
                return `Cinematic grid generated for "${args.prompt}".`;
            }
            return "Failed to generate cinematic grid.";

        } catch (e: any) {
            return `Render cinematic grid failed: ${e.message}`;
        }
    },
    extract_grid_frame: async (args: { imageId?: string, gridIndex: number }) => {
        // Placeholder: In a real system this would use OpenCV or AI segmentation to crop the specific panel
        // For now, we'll just acknowledge the request.
        return "Extract grid frame not fully implemented. (Simulated success: Framed extracted)";
    },
    set_entity_anchor: async (args: { image: string }) => {
        try {
            const { setEntityAnchor, addToHistory, currentProjectId } = useStore.getState();

            // Validate image data
            const match = args.image.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                return "Invalid image data. Must be base64 data URI.";
            }

            // Create a history item for the anchor so it can be stored/referenced
            const anchorItem = {
                id: crypto.randomUUID(),
                url: args.image,
                prompt: "Entity Anchor (Global Reference)",
                type: 'image' as const, // explicitly Typed
                timestamp: Date.now(),
                projectId: currentProjectId,
                category: 'headshot' as const
            };

            setEntityAnchor(anchorItem);

            // Optionally add to history if not already there, but strictly it's a state setting.
            // Let's add it to history so the user can see it in the gallery.
            addToHistory(anchorItem);

            return "Entity Anchor set successfully. Character consistency is now locked.";
        } catch (e: any) {
            return `Failed to set Entity Anchor: ${e.message}`;
        }
    }
};
