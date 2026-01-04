import { useStore, HistoryItem } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import type { ToolFunctionArgs } from '../types';

/**
 * Extracts a specific frame from a 2x2 grid image using Canvas API.
 * @param imageUrl - The data URL of the grid image
 * @param gridIndex - 0 (top-left), 1 (top-right), 2 (bottom-left), 3 (bottom-right)
 * @returns Data URL of the extracted frame, or null on failure
 */
async function extractFrameFromGrid(imageUrl: string, gridIndex: number): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    console.error('[extractFrameFromGrid] Failed to get canvas context');
                    resolve(null);
                    return;
                }

                // Calculate frame dimensions (2x2 grid)
                const frameWidth = Math.floor(img.width / 2);
                const frameHeight = Math.floor(img.height / 2);

                // Set canvas to frame size
                canvas.width = frameWidth;
                canvas.height = frameHeight;

                // Calculate source position based on grid index
                // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
                const col = gridIndex % 2;
                const row = Math.floor(gridIndex / 2);
                const sx = col * frameWidth;
                const sy = row * frameHeight;

                // Draw the cropped section
                ctx.drawImage(
                    img,
                    sx, sy, frameWidth, frameHeight, // Source rectangle
                    0, 0, frameWidth, frameHeight     // Destination rectangle
                );

                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);

            } catch (error) {
                console.error('[extractFrameFromGrid] Error extracting frame:', error);
                resolve(null);
            }
        };

        img.onerror = () => {
            console.error('[extractFrameFromGrid] Failed to load image');
            resolve(null);
        };

        img.src = imageUrl;
    });
}

interface GenerateImageArgs extends ToolFunctionArgs {
    prompt: string;
    count?: number;
    resolution?: string;
    aspectRatio?: string;
    negativePrompt?: string;
    seed?: string;
    referenceImageIndex?: number;
    referenceAssetIndex?: number;
    uploadedImageIndex?: number;
}

interface GenerateHighResAssetArgs extends ToolFunctionArgs {
    prompt: string;
    templateType: string; // e.g., 'cd_front', 'poster', 'merch'
    style?: string;
}

interface ExtractGridFrameArgs extends ToolFunctionArgs {
    imageId?: string;
    gridIndex: number;
}

interface SetEntityAnchorArgs extends ToolFunctionArgs {
    image: string;
}

export const DirectorTools = {
    generate_image: async (args: GenerateImageArgs) => {
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
                        console.log(`[DirectorTools] Using reference image: ${refImg.description || 'Untitled'}`);
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
                        console.log(`[DirectorTools] Using brand asset: ${asset.description || 'Untitled'}`);
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
                        console.log(`[DirectorTools] Using upload: ${upload.prompt || 'Untitled'}`);
                    }
                }
            }

            // Use the Unified ImageGenerationService
            // This handles persistence, quotas, and distributor constraints awareness
            const results = await ImageGeneration.generateImages({
                prompt: args.prompt,
                count: args.count || 1,
                resolution: args.resolution || studioControls.resolution,
                aspectRatio: args.aspectRatio || studioControls.aspectRatio,
                negativePrompt: args.negativePrompt || studioControls.negativePrompt,
                seed: args.seed ? parseInt(args.seed) : (studioControls.seed ? parseInt(studioControls.seed) : undefined),
                sourceImages: sourceImages,
                userProfile: userProfile,
                // If the director is "generating an image", it might be for a cover, but generic 'generate_image' 
                // is usually for ideation. If strict cover art is needed, we'd use generate_high_res_asset or a flag.
                // For now, we pass profile so constraints *can* be checked if logic dictates, but we don't enforce isCoverArt=true here.
            });

            if (results.length > 0) {
                results.forEach((res: { id: string, url: string, prompt: string }) => {
                    addToHistory({
                        id: res.id,
                        url: res.url, // Service returns data URI
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
                console.error("[DirectorTools] generate_image failed:", e);
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
            const imageDataList = targetImages.map((img) => {
                const match = img.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
                return null;
            }).filter((img): img is { mimeType: string, data: string } => img !== null);

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
                results.forEach((res: { id: string, url: string, prompt: string }) => {
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

    run_showroom_mockup: async (args: { productType: string, scenePrompt: string }) => {
        // Implementation for Showroom Mockup (Placeholder for now, but routed correctly)
        // In a real implementation, this would likely use ImageGeneration with a specific controlnet or template
        return DirectorTools.generate_image({
            prompt: `Professional product photography of a ${args.productType}, ${args.scenePrompt}, high end, 8k resolution, photorealistic`,
            count: 1
        });
    },

    generate_high_res_asset: async (args: GenerateHighResAssetArgs) => {
        try {
            // 120s timeout wrapper provided by keeping the structure simple
            // We can just rely on the Service's async nature, but the user might want a specific feedback about slowness.
            const { userProfile, currentProjectId, addToHistory } = useStore.getState();

            // Nano Banana Pro simulation via High-Fidelity params
            const fullPrompt = `${args.templateType} design: ${args.prompt}. ${args.style || ''} --quality high --v 6.0`;

            // Use generateImages with high-res settings
            const results = await ImageGeneration.generateImages({
                prompt: fullPrompt,
                count: 1,
                resolution: '4K',
                aspectRatio: args.templateType.includes('jacket') || args.templateType.includes('vinyl') ? '1:1' : '2:3',
                userProfile: userProfile,
                // Note: We could set isCoverArt=true if it matches cover art types
                isCoverArt: args.templateType.includes('jacket') || args.templateType.includes('vinyl')
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        meta: 'high_res_asset'
                    });
                });
                return `High-resolution asset (${args.templateType}) generated successfully.`;
            }
            return "Failed to generate high-resolution asset.";

        } catch (e: unknown) {
            if (e instanceof Error) {
                return `High-res generation failed: ${e.message}`;
            }
            return `High-res generation failed: An unknown error occurred.`;
        }
    },

    render_cinematic_grid: async (args: { prompt: string }) => {
        try {
            const { entityAnchor, addToHistory, currentProjectId } = useStore.getState();

            let fullPrompt = `Create a cinematic grid of shots (Wide, Medium, Close-up, Low Angle) for: ${args.prompt}.`;
            let sourceImages = undefined;

            if (entityAnchor) {
                const match = entityAnchor.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1], data: match[2] }];
                    fullPrompt += " Maintain strict character consistency with the provided reference.";
                }
            }

            const results = await ImageGeneration.generateImages({
                prompt: fullPrompt,
                count: 1,
                resolution: '4K',
                aspectRatio: '16:9',
                sourceImages: sourceImages
            });

            if (results.length > 0) {
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

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            return `Render cinematic grid failed: ${errorMessage}`;
        }
    },

    extract_grid_frame: async (args: ExtractGridFrameArgs) => {
        try {
            const { generatedHistory, addToHistory, currentProjectId } = useStore.getState();

            // Find the source image - either by ID or get the most recent cinematic_grid
            let sourceImage;
            if (args.imageId) {
                sourceImage = generatedHistory.find((h: HistoryItem) => h.id === args.imageId);
            } else {
                // Find the most recent cinematic grid
                sourceImage = [...generatedHistory]
                    .reverse()
                    .find((h: HistoryItem) => h.meta === 'cinematic_grid' || h.prompt?.includes('cinematic grid'));
            }

            if (!sourceImage) {
                return "No grid image found. Please generate a cinematic grid first using render_cinematic_grid.";
            }

            // Validate grid index (0-3 for 2x2 grid)
            const gridIndex = args.gridIndex;
            if (gridIndex < 0 || gridIndex > 3) {
                return "Invalid grid index. Use 0 (top-left), 1 (top-right), 2 (bottom-left), or 3 (bottom-right).";
            }

            // Extract the frame using Canvas API
            const extractedDataUrl = await extractFrameFromGrid(sourceImage.url, gridIndex);

            if (!extractedDataUrl) {
                return "Failed to extract frame from grid image.";
            }

            // Add extracted frame to history
            const frameLabels = ['Wide Shot', 'Medium Shot', 'Close-up', 'Low Angle'];
            const frameItem = {
                id: crypto.randomUUID(),
                url: extractedDataUrl,
                prompt: `Extracted ${frameLabels[gridIndex]} from cinematic grid`,
                type: 'image' as const,
                timestamp: Date.now(),
                projectId: currentProjectId,
                meta: 'extracted_frame'
            };

            addToHistory(frameItem);

            return `Successfully extracted ${frameLabels[gridIndex]} (panel ${gridIndex}) from the cinematic grid. The frame is now in your Gallery.`;

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            return `Extract grid frame failed: ${errorMessage}`;
        }
    },

    set_entity_anchor: async (args: SetEntityAnchorArgs) => {
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
                type: 'image' as const,
                timestamp: Date.now(),
                projectId: currentProjectId,
                category: 'headshot' as const
            };

            setEntityAnchor(anchorItem);
            addToHistory(anchorItem);

            return "Entity Anchor set successfully. Character consistency is now locked.";
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            return `Failed to set Entity Anchor: ${errorMessage}`;
        }
    }
};
