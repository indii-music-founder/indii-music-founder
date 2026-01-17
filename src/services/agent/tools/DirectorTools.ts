import { useStore, type HistoryItem } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { ToolFunctionArgs, AnyToolFunction } from '../types';

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
                resolve(null);
            }
        };

        img.onerror = () => {
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

export const DirectorTools: Record<string, AnyToolFunction> = {
    generate_image: wrapTool('generate_image', async (args: GenerateImageArgs) => {
        console.log("DirectorTools: generate_image called with args", args);
        const { studioControls, addToHistory, currentProjectId, userProfile, whiskState } = useStore.getState();

        let sourceImages: { mimeType: string; data: string }[] | undefined;

        // Handle Reference Images
        if (args.referenceImageIndex !== undefined) {
            const refImages = userProfile.brandKit?.referenceImages || [];
            const refImg = refImages[args.referenceImageIndex];
            if (refImg) {
                const match = refImg.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1], data: match[2] }];
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
                }
            }
        }

        // Synthesize Whisk references into the prompt if any are checked
        let finalPrompt = args.prompt;
        const hasWhiskRefs = whiskState && (
            whiskState.subjects.some(s => s.checked) ||
            whiskState.scenes.some(s => s.checked) ||
            whiskState.styles.some(s => s.checked)
        );

        if (hasWhiskRefs) {
            const { WhiskService } = await import('@/services/WhiskService');
            finalPrompt = WhiskService.synthesizeWhiskPrompt(args.prompt, whiskState);
            console.log("DirectorTools: Synthesized Whisk prompt:", finalPrompt);

            // If no source images yet and precise mode is on, get them from Whisk
            if (!sourceImages && whiskState.preciseReference) {
                const whiskSourceImages = WhiskService.getSourceImages(whiskState);
                if (whiskSourceImages && whiskSourceImages.length > 0) {
                    sourceImages = whiskSourceImages;
                    console.log("DirectorTools: Using Whisk source images for precise mode");
                }
            }
        }

        // Get aspect ratio from locked style preset (if any)
        let effectiveAspectRatio = args.aspectRatio || studioControls.aspectRatio || '1:1';
        if (hasWhiskRefs) {
            const { WhiskService } = await import('@/services/WhiskService');
            const lockedAspectRatio = await WhiskService.getLockedAspectRatio(whiskState);
            if (lockedAspectRatio) {
                effectiveAspectRatio = lockedAspectRatio;
                console.log("DirectorTools: Using locked style aspect ratio:", lockedAspectRatio);
            }
        }

        // Use the Unified ImageGenerationService
        try {
            const results = await ImageGeneration.generateImages({
                prompt: finalPrompt,
                count: args.count || 1,
                resolution: args.resolution || studioControls.resolution,
                aspectRatio: effectiveAspectRatio,
                negativePrompt: args.negativePrompt || studioControls.negativePrompt,
                seed: args.seed ? parseInt(args.seed) : (studioControls.seed ? parseInt(studioControls.seed) : undefined),
                sourceImages,
                userProfile
            });

            if (results.length > 0) {
                results.forEach((res: { id: string, url: string, prompt: string }) => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId || 'default-project'
                    });
                });
                return toolSuccess({
                    count: results.length,
                    image_ids: results.map(r => r.id)
                }, `Successfully generated ${results.length} images. They are now in the Gallery.`);
            }
            return toolError("Generation completed but no images were returned.", "EMPTY_RESULT");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            // CRITICAL FIX: Prevent infinite retry loops on subscription errors
            if (errorMessage.includes("Failed to fetch subscription")) {
                return toolError(
                    "Subscription verification failed. Please check your network connection or subscription status. Do not retry immediately.",
                    "SUBSCRIPTION_ERROR"
                );
            }

            throw err; // Re-throw other errors to be handled by wrapTool
        }
    }),

    batch_edit_images: wrapTool('batch_edit_images', async (args: { prompt: string, imageIndices?: number[] }) => {
        const { uploadedImages, addToHistory, currentProjectId, addAgentMessage } = useStore.getState();

        if (uploadedImages.length === 0) {
            return toolError("No images found in uploads to edit. Please upload images first.", "NO_INPUT_IMAGES");
        }

        const targetImages = args.imageIndices
            ? args.imageIndices.map(i => uploadedImages[i]).filter(Boolean)
            : uploadedImages;

        if (targetImages.length === 0) {
            return toolError("No valid images found for the provided indices.", "INVALID_INDICES");
        }

        const imageDataList = targetImages.map((img) => {
            const match = img.url.match(/^data:(.+);base64,(.+)$/);
            if (match) {
                return { mimeType: match[1], data: match[2] };
            }
            return null;
        }).filter((img): img is { mimeType: string, data: string } => img !== null);

        if (imageDataList.length === 0) {
            return toolError("Could not process image data from uploads.", "PROCESS_FAILED");
        }

        const { results, failures } = await Editing.batchEdit({
            images: imageDataList,
            prompt: args.prompt,
            onProgress: (current, total) => {
                addAgentMessage({
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

            const failureInfo = failures.length > 0
                ? ` (${failures.length} failed: ${failures.map(f => `image ${f.index + 1}: ${f.error}`).join(', ')})`
                : '';

            return toolSuccess({
                count: results.length,
                image_ids: results.map(r => r.id),
                failures: failures.length > 0 ? failures : undefined
            }, `Successfully edited ${results.length} images based on instruction: "${args.prompt}"${failureInfo}.`);
        }
        return toolError("Batch edit completed but no images were returned.", "EMPTY_RESULT");
    }),

    /**
     * Specialized tool for rendering high-res showroom mockups
     */
    run_showroom_mockup: wrapTool('run_showroom_mockup', async (args: { productType: string, scenePrompt: string }) => {
        return DirectorTools.generate_image({
            prompt: `Professional product photography of a ${args.productType}, ${args.scenePrompt}, high end, 8k resolution, photorealistic`,
            count: 1
        });
    }),

    /**
     * Unified High-Res Asset Tool
     */
    generate_high_res_asset: wrapTool('generate_high_res_asset', async (args: GenerateHighResAssetArgs) => {
        const { userProfile, currentProjectId, addToHistory } = useStore.getState();

        const fullPrompt = `${args.templateType} design: ${args.prompt}. ${args.style || ''} --quality high --v 6.0`;

        const results = await ImageGeneration.generateImages({
            prompt: fullPrompt,
            count: 1,
            resolution: '4K',
            aspectRatio: args.templateType.includes('jacket') || args.templateType.includes('vinyl') ? '1:1' : '2:3',
            userProfile,
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
            return toolSuccess({
                asset_id: results[0].id
            }, `High-resolution asset (${args.templateType}) generated successfully.`);
        }
        return toolError("Failed to generate high-resolution asset.", "GENERATION_FAILED");
    }),

    render_cinematic_grid: wrapTool('render_cinematic_grid', async (args: { prompt: string }) => {
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
            return toolSuccess({
                grid_id: res.id
            }, `Cinematic grid generated for "${args.prompt}".`);
        }
        return toolError("Failed to generate cinematic grid.", "GENERATION_FAILED");
    }),

    extract_grid_frame: wrapTool('extract_grid_frame', async (args: ExtractGridFrameArgs) => {
        const { generatedHistory, addToHistory, currentProjectId } = useStore.getState();

        let sourceImage;
        if (args.imageId) {
            sourceImage = generatedHistory.find((h: HistoryItem) => h.id === args.imageId);
        } else {
            sourceImage = [...generatedHistory]
                .reverse()
                .find((h: HistoryItem) => h.meta === 'cinematic_grid' || h.prompt?.includes('cinematic grid'));
        }

        if (!sourceImage) {
            return toolError("No grid image found. Please generate a cinematic grid first using render_cinematic_grid.", "NOT_FOUND");
        }

        const gridIndex = args.gridIndex;
        if (gridIndex < 0 || gridIndex > 3) {
            return toolError("Invalid grid index. Use 0 (top-left), 1 (top-right), 2 (bottom-left), or 3 (bottom-right).", "INVALID_INDEX");
        }

        const extractedDataUrl = await extractFrameFromGrid(sourceImage.url, gridIndex);

        if (!extractedDataUrl) {
            return toolError("Failed to extract frame from grid image.", "EXTRACTION_FAILED");
        }

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

        return toolSuccess({
            frame_id: frameItem.id
        }, `Successfully extracted ${frameLabels[gridIndex]} (panel ${gridIndex}) from the cinematic grid. The frame is now in your Gallery.`);
    }),

    set_entity_anchor: wrapTool('set_entity_anchor', async (args: SetEntityAnchorArgs) => {
        const { setEntityAnchor, addToHistory, currentProjectId } = useStore.getState();

        const match = args.image.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
            return toolError("Invalid image data. Must be base64 data URI.", "INVALID_INPUT");
        }

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

        return toolSuccess({
            anchorId: anchorItem.id
        }, "Entity Anchor set successfully. Character consistency is now locked.");
    }),

    analyze_audio: wrapTool('analyze_audio', async (args: { uploadedAudioIndex: number }) => {
        const { uploadedAudio } = useStore.getState();

        const audioItem = uploadedAudio[args.uploadedAudioIndex];
        if (!audioItem) {
            return toolError(`No audio found at index ${args.uploadedAudioIndex}. Please upload audio first.`, "NOT_FOUND");
        }

        try {
            // Convert Data URI to File/Blob
            const fetchRes = await fetch(audioItem.url);
            const blob = await fetchRes.blob();
            const file = new File([blob], "audio_track.mp3", { type: blob.type });

            const profile = await audioIntelligence.analyze(file);

            return toolSuccess(
                profile,
                `Audio analysis complete for "${audioItem.prompt || 'Track'}". Semantic Vibe: ${profile.semantic.mood.join(', ')}`
            );
        } catch (error: any) {
            return toolError(`Failed to analyze audio: ${error.message}`, "ANALYSIS_FAILED");
        }
    })
};
