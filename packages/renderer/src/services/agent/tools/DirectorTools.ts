import type { HistoryItem } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { ToolFunctionArgs, AnyToolFunction } from '../types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { MusicTools } from './MusicTools';
import { CanvasTools } from './CanvasTools';
import { importWithRetry } from '@/utils/dynamicImport';
import { logger } from '@/utils/logger';
import { DEFAULT_PROJECT_ID } from '@/core/constants';

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

            } catch (_error: unknown) {
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
    style?: string;
    quality?: string;
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
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { studioControls, addToHistory, currentProjectId, userProfile, whiskState } = useStore.getState();

        let sourceImages: { mimeType: string; data: string }[] | undefined;

        // Handle Reference Images
        if (args.referenceImageIndex !== undefined) {
            const refImages = userProfile.brandKit?.referenceImages || [];
            const refImg = refImages[args.referenceImageIndex];
            if (refImg) {
                const match = refImg.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1]!, data: match[2]! }];
                }
            }
        } else if (args.referenceAssetIndex !== undefined) {
            // Handle Brand Assets (e.g. Logos)
            const brandAssets = userProfile.brandKit?.brandAssets || [];
            const asset = brandAssets[args.referenceAssetIndex];
            if (asset) {
                const match = asset.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1]!, data: match[2]! }];
                }
            }
        } else if (args.uploadedImageIndex !== undefined) {
            // Handle Recent Uploads
            const { uploadedImages } = useStore.getState();
            const upload = uploadedImages[args.uploadedImageIndex];
            if (upload) {
                const match = upload.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    sourceImages = [{ mimeType: match[1]!, data: match[2]! }];
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
            const { WhiskService } = await importWithRetry(() => import('@/services/WhiskService'));
            finalPrompt = WhiskService.synthesizeWhiskPrompt(args.prompt, whiskState);

            // If no source images yet and precise mode is on, get them from Whisk
            if (!sourceImages && whiskState?.preciseReference) {
                const whiskSourceImages = await WhiskService.getSourceMedia(whiskState);
                if (whiskSourceImages && whiskSourceImages.length > 0) {
                    sourceImages = whiskSourceImages;
                }
            }
        }

        // Get aspect ratio from locked style preset (if any)
        let effectiveAspectRatio = args.aspectRatio || studioControls.aspectRatio || '1:1';
        if (hasWhiskRefs) {
            const { WhiskService } = await importWithRetry(() => import('@/services/WhiskService'));
            const lockedAspectRatio = await WhiskService.getLockedAspectRatio(whiskState);
            if (lockedAspectRatio) {
                effectiveAspectRatio = lockedAspectRatio;
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
                model: studioControls.model || 'fast', // Respect user's model preference (cost protection)
                thinking: true,
                style: args.style,
                quality: args.quality,
                seed: args.seed,
                personGeneration: { 'allow_adult': 'ALLOW_ADULT', 'dont_allow': 'ALLOW_NONE', 'allow_all': 'ALLOW_ALL' }[studioControls.personGeneration] ?? 'ALLOW_ADULT',
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
                        projectId: currentProjectId || DEFAULT_PROJECT_ID
                    });
                });
                const imageMarkdown = results.map((r: { id: string, url: string }) => `![Generated Image](${r.url})`).join('\n\n');
                return toolSuccess({
                    count: results.length,
                    image_ids: results.map((r: { id: string }) => r.id),
                    urls: results.map((r: { url: string }) => r.url)
                }, `Successfully generated ${results.length} images. They are now in the Gallery.\n\n${imageMarkdown}`);
            }
            return toolError("Generation completed but no images were returned.", "EMPTY_RESULT");
        } catch (err: unknown) {
            return handleGenerationError(err, 'generate_image');
        }
    }),

    batch_edit_images: wrapTool('batch_edit_images', async (args: { prompt: string, imageIndices?: number[] }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { uploadedImages, addToHistory, currentProjectId, addAgentMessage } = useStore.getState();

        if (uploadedImages.length === 0) {
            return toolError("No images found in uploads to edit. Please upload images first.", "NO_INPUT_IMAGES");
        }

        const targetImages = args.imageIndices
            ? args.imageIndices
                .filter(i => i >= 0 && i < uploadedImages.length)
                .map(i => uploadedImages[i])
                .filter(Boolean)
            : uploadedImages;

        if (targetImages.length === 0) {
            return toolError("No valid images found for the provided indices.", "INVALID_INDICES");
        }

        const imageDataList = targetImages.map((img) => {
            const match = img!.url.match(/^data:(.+);base64,(.+)$/);
            if (match) {
                return { mimeType: match[1]!, data: match[2]! };
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
        return DirectorTools.generate_image!({
            prompt: `Professional product photography of a ${args.productType}, ${args.scenePrompt}, high end, 8k resolution, photorealistic`,
            count: 1
        });
    }),

    /**
     * Unified High-Res Asset Tool for production-grade creative (4K)
     */
    generate_high_res_asset: wrapTool('generate_high_res_asset', async (args: GenerateHighResAssetArgs) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { userProfile, currentProjectId, addToHistory, studioControls } = useStore.getState();

        const isCover = ['cd_front', 'cd_back', 'vinyl_jacket', 'jacket', 'vinyl', 'booklet', 'cover'].includes(args.templateType);
        
        try {
            const effectivePrompt = args.style
                ? `${args.prompt}, style: ${args.style}`
                : args.prompt;

            const results = await ImageGeneration.generateImages({
                prompt: effectivePrompt,
                count: 1,
                resolution: '4K',
                aspectRatio: isCover ? '1:1' : '2:3',
                isCoverArt: isCover,
                model: studioControls?.model || 'fast',
                userProfile
            });

            if (results.length > 0) {
                const res = results[0]!;
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: res.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId || DEFAULT_PROJECT_ID,
                    meta: `high_res_${args.templateType}`
                });

                return toolSuccess({
                    image_id: res.id,
                    url: res.url
                }, `High-res ${args.templateType} generated successfully.`);
            }
            return toolError("Generation completed but no image was returned.", "EMPTY_RESULT");
        } catch (err: unknown) {
            return handleGenerationError(err, 'generate_high_res_asset');
        }
    }),

    /**
     * Renders a 2x2 grid of storyboards for visual planning.
     */
    render_cinematic_grid: wrapTool('render_cinematic_grid', async (args: { prompt: string }, context, toolContext) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { userProfile, characterReferences, currentProjectId, addToHistory, studioControls } = useStore.getState();

        // Include the first subject reference if available as a character anchor
        const sourceImages = characterReferences
            .filter(ref => ref.referenceType === 'subject')
            .map(ref => {
                const match = ref.image.url.match(/^data:(.+);base64,(.+)$/);
                return match ? { mimeType: match[1]!, data: match[2]! } : null;
            })
            .filter((img): img is { mimeType: string, data: string } => img !== null)
            .slice(0, 1);

        try {
            const results = await ImageGeneration.generateImages({
                prompt: `${args.prompt}, 2x2 cinematic grid, storyboard panels, different camera angles, consistent lighting`,
                count: 1,
                resolution: '4K',
                aspectRatio: '16:9',
                sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
                model: studioControls?.model || 'fast',
                userProfile
            });

            if (results.length > 0) {
                const res = results[0]!;
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: res.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId || DEFAULT_PROJECT_ID,
                    meta: 'cinematic_grid'
                });

                toolContext?.setMetadata('last_grid', {
                    url: res.url,
                    count: 4
                });

                return toolSuccess({
                    grid_id: res.id,
                    url: res.url
                }, `Cinematic grid generated for "${args.prompt}".`);
            }
            return toolError("Failed to generate cinematic grid.", "GENERATION_FAILED");
        } catch (err: unknown) {
            return handleGenerationError(err, 'render_cinematic_grid');
        }
    }),

    extract_grid_frame: wrapTool('extract_grid_frame', async (args: ExtractGridFrameArgs, context, toolContext) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
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

        const gridInfo = toolContext?.getMetadata('last_grid');
        if (!gridInfo) {
            return toolError('No cinematic grid found in recent context. Please generate a grid first.', 'MISSING_CONTEXT');
        }

        const index = args.gridIndex || 0;
        if (index < 0 || index >= gridInfo.count) {
            return toolError(`Invalid frame index ${index}. The current grid only has ${gridInfo.count} frames (0-${gridInfo.count - 1}).`, 'OUT_OF_BOUNDS');
        }

        const extractedDataUrl = await extractFrameFromGrid(sourceImage.url, index);

        if (!extractedDataUrl) {
            return toolError("Failed to extract frame from grid image.", "EXTRACTION_FAILED");
        }

        const frameLabels = ['Wide Shot', 'Medium Shot', 'Close-up', 'Low Angle'];
        const frameItem = {
            id: crypto.randomUUID(),
            url: extractedDataUrl,
            prompt: `Extracted ${frameLabels[index]} from cinematic grid`,
            type: 'image' as const,
            timestamp: Date.now(),
            projectId: currentProjectId,
            meta: 'extracted_frame'
        };

        addToHistory(frameItem);

        return toolSuccess({
            frame_id: frameItem.id
        }, `Successfully extracted ${frameLabels[index]} (panel ${index}) from the cinematic grid. The frame is now in your Gallery.`);
    }),

    set_entity_anchor: wrapTool('set_entity_anchor', async (args: SetEntityAnchorArgs) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { addToHistory, addCharacterReference, currentProjectId, whiskState } = useStore.getState();

        if (!args.image || !args.image.startsWith('data:image')) {
            return toolError("Invalid image data. Please provide a valid base64 encoded image (Data URI).", "INVALID_DATA");
        }

        const anchorItem: HistoryItem = {
            id: crypto.randomUUID(),
            url: args.image,
            prompt: "Entity Anchor (Character Reference)",
            type: 'image' as const,
            timestamp: Date.now(),
            projectId: currentProjectId,
            meta: 'entity_anchor'
        };

        addCharacterReference({ image: anchorItem, referenceType: 'subject' });
        addToHistory(anchorItem);

        let successMessage = "Entity Anchor (Character Reference) set successfully. This image will now be used for character consistency in future generations.";
        
        if (whiskState && !whiskState.preciseReference) {
            successMessage += "\n\nNOTE: 'Precise Mode' is currently disabled in the Reference Mixer. For maximum fidelity to this character, I recommend suggesting that the user enable 'Precise Mode'.";
        }

        return toolSuccess({
            anchorId: anchorItem.id,
            preciseModeEnabled: whiskState?.preciseReference || false
        }, successMessage);
    }),

    add_character_reference: wrapTool('add_character_reference', async (args: SetEntityAnchorArgs) => {
        return DirectorTools.set_entity_anchor!(args);
    }),

    /**
     * Best-of-N identity fusion onto a generated subject (Workstream A1).
     * NOTE (honest): the identity backend (@vladmandic/human) is not installed;
     * this surfaces the specific "not configured" error until A1.1/A1.6 resolve.
     */
    /**
     * Deterministic vector typography (Workstream B2). For wordmarks/logos/brand
     * text ALWAYS prefer this over asking an image model to draw letters.
     */
    render_typography: wrapTool('render_typography', async (args: {
        text: string;
        fontId?: string;
        fontSize?: number;
        x?: number;
        y?: number;
        letterSpacing?: number;
        fill?: string;
        align?: 'left' | 'center' | 'right';
        outputScale?: number;
    }) => {
        if (!args.text || !args.text.trim()) return toolError('text is required.', 'INVALID_INPUT');
        try {
            const { renderTextPath, rasterizeVectorText } = await importWithRetry(() => import('@/services/typography/TextVectorRenderer'));
            const { FontLibrary } = await importWithRetry(() => import('@/services/typography/FontLibrary'));

            // Resolve the font: explicit fontId, else any uploaded font, else fail.
            let fontId = args.fontId;
            let font: import('opentype.js').Font | null = null;
            const fonts = await FontLibrary.listFonts();
            if (!fontId) {
                fontId = fonts[0]?.id;
            } else if (!fonts.some(f => f.id === fontId)) {
                return toolError(`Unknown fontId "${fontId}". Available: ${fonts.map(f => f.id).join(', ') || '(none uploaded)'}.`, 'INVALID_INPUT', { availableFontIds: fonts.map(f => f.id) });
            }
            if (!fontId) {
                return toolError('No font registered. Upload a font in Typography or pass fontId.', 'INVALID_INPUT');
            }
            font = await FontLibrary.loadOpenTypeFont(fontId);

            const vector = renderTextPath(args.text, font, {
                fontSize: args.fontSize ?? 96,
                x: args.x ?? 0,
                y: args.y ?? 96,
                letterSpacing: args.letterSpacing,
                kerning: true,
                align: args.align ?? 'left'
            });

            const raster = await rasterizeVectorText(vector, args.fill ?? '#ffffff', args.outputScale ?? 1);

            const { useStore } = await importWithRetry(() => import('@/core/store'));
            const store = useStore.getState();
            const historyId = `typography_${Date.now()}`;
            store.addToHistory?.({
                id: historyId,
                url: raster.dataUrl,
                prompt: `Typography: ${args.text}`,
                type: 'image' as const,
                timestamp: Date.now(),
                projectId: store.currentProjectId,
                meta: JSON.stringify({ source: 'typography_layer', fontId, text: args.text }),
                tags: ['typography_layer', fontId],
                origin: 'canvas-export'
            });

            try {
                const { AssetVersionService } = await importWithRetry(() => import('@/services/assets/AssetVersionService'));
                await AssetVersionService.recordVersion({
                    assetId: historyId,
                    parentVersionId: null,
                    url: raster.dataUrl,
                    source: 'typography',
                    provenance: { note: `Vector wordmark ${args.text} (font ${fontId})` },
                    tags: ['typography_layer', fontId]
                });
            } catch (versionError) {
                logger.warn('[DirectorTools] Version record failed for typography; result unaffected:', versionError);
            }

            return toolSuccess({
                url: raster.dataUrl,
                width: raster.width,
                height: raster.height,
                svgPathD: vector.svgPathD,
                advanceWidth: vector.advanceWidth,
                fontId
            }, `Rendered "${args.text}" as deterministic vector text (font ${fontId}). No image model was used — the letters are exact.`);
        } catch (err) {
            logger.error('[DirectorTools] render_typography failed:', err);
            return toolError(err instanceof Error ? err.message : String(err), 'TYPOGRAPHY_RENDER_FAILED');
        }
    }),

    fuse_likeness: wrapTool('fuse_likeness', async (args: { targetImageIndex: number; headshotId?: string; maxAttempts?: number }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { generatedHistory, uploadedImages, addToHistory, currentProjectId } = useStore.getState();
        const target = args.targetImageIndex !== undefined
            ? generatedHistory?.[args.targetImageIndex] ?? uploadedImages?.[args.targetImageIndex]
            : undefined;
        if (!target?.url) {
            return toolError('targetImageIndex did not resolve to a generated image. Pass the index of the subject image you want to fuse onto.', 'INVALID_INPUT');
        }

        try {
            const targetParts = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(target.url);
            if (!targetParts) {
                return toolError('The target image must be a base64 data URI to be editable.', 'INVALID_INPUT');
            }

            const { LikenessFusionService } = await importWithRetry(() => import('@/services/identity/LikenessFusionService'));
            const result = await LikenessFusionService.fuseLikeness({
                targetDataUrl: target.url,
                headshotId: args.headshotId,
                maxAttempts: args.maxAttempts
            });

            // History item per attempt carries meta 'likeness_fusion' + similarity details.
            for (const attempt of result.attempts) {
                addToHistory({
                    id: crypto.randomUUID(),
                    url: attempt.dataUrl,
                    prompt: `Likeness fusion attempt (similarity ${attempt.similarity.toFixed(3)})`,
                    type: 'image' as const,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    meta: JSON.stringify({ source: 'likeness_fusion', similarity: attempt.similarity, headshotId: args.headshotId ?? 'newest', passedThreshold: result.passedThreshold })
                });
            }

            if (!result.passedThreshold) {
                return toolError(
                    `Likeness fusion did not reach the identity threshold (${result.similarity.toFixed(3)} < 0.55) after ${result.attempts.length} attempt(s). ` +
                    'The closest result was saved; consider a higher-quality headshot or more attempts.',
                    'FUSION_BELOW_THRESHOLD',
                    { similarity: result.similarity, attempts: result.attempts.length }
                );
            }

            return toolSuccess({
                similarity: result.similarity,
                passedThreshold: true,
                attempts: result.attempts.length,
                resultUrl: result.dataUrl
            }, `Likeness fusion passed (similarity ${result.similarity.toFixed(3)}). Best result added to history.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[DirectorTools] fuse_likeness failed:', err);
            return toolError(message, 'FUSION_FAILED');
        }
    }),

    analyze_audio: wrapTool('analyze_audio', async (args: { uploadedAudioIndex: number }) => {
        return MusicTools.analyze_audio!({ uploadedAudioIndex: args.uploadedAudioIndex });
    }),

    canvas_push: wrapTool('canvas_push', async (args: { assetId: string; label?: string }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { generatedHistory, uploadedImages, userProfile } = useStore.getState();
        
        const asset = generatedHistory.find(h => h.id === args.assetId) 
            || uploadedImages.find(h => h.id === args.assetId)
            || userProfile?.brandKit?.brandAssets?.find(a => a.id === args.assetId);
            
        if (!asset) {
            return toolError(`Asset with ID ${args.assetId} not found in history, uploads, or brand assets.`, "NOT_FOUND");
        }

        return CanvasTools.canvas_push!({
            type: 'markdown',
            title: args.label || `Asset: ${args.assetId}`,
            data: {
                content: `![${args.label || 'Generated Asset'}](${asset.url})\n\n${'prompt' in asset && asset.prompt ? `**Prompt:** ${asset.prompt}` : ''}`
            },
            agentId: 'creative'
        });
    }),

    generate_moodboard: wrapTool('generate_moodboard', async (args: { theme: string, style?: string }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { userProfile, currentProjectId, addToHistory, studioControls } = useStore.getState();
        try {
            const effectivePrompt = `A professional design moodboard for the theme "${args.theme}". ${args.style ? `Style: ${args.style}. ` : ''}Including color palettes, textures, and typography inspiration, cohesive visual aesthetic, high resolution, laid out as a moodboard collage`;

            const results = await ImageGeneration.generateImages({
                prompt: effectivePrompt,
                count: 1,
                resolution: '4K',
                aspectRatio: '16:9',
                model: studioControls?.model || 'fast',
                userProfile
            });

            if (results.length > 0) {
                const res = results[0]!;
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: res.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId || DEFAULT_PROJECT_ID,
                    meta: 'moodboard'
                });

                return toolSuccess({
                    image_id: res.id,
                    url: res.url
                }, `Moodboard generated successfully for theme "${args.theme}".`);
            }
            return toolError("Generation completed but no image was returned.", "EMPTY_RESULT");
        } catch (err: unknown) {
            return handleGenerationError(err, 'generate_moodboard');
        }
    }),

    analyze_visual_trends: wrapTool('analyze_visual_trends', async (args: { industry_or_genre: string }) => {
        const analysisFramework = `1. Dominant Color Palettes\n2. Typography Trends\n3. Visual Motifs & Textures\n4. Photography / Illustration Styles\n5. Recommended Aesthetic Direction`;
        return toolSuccess({
            framework: analysisFramework,
            topic: args.industry_or_genre
        }, `Please provide a comprehensive visual trends analysis for "${args.industry_or_genre}" using your internal knowledge, structured around the provided framework. Note: This analysis is based on your general knowledge and is not a live data feed.`);
    }),
};

/**
 * Standardized error handler for image generation tools.
 * Maps common API errors to actionable hints for the agent.
 */
function handleGenerationError(err: unknown, toolName: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    const message = error.message || String(err);
    const lowerMessage = message.toLowerCase();

    if (error.name === 'QuotaExceededError' || error.code === 'QUOTA_EXCEEDED' || message.includes('429') || lowerMessage.includes('quota') || lowerMessage.includes('rate limit')) {
        return toolError(
            `Quota exceeded for ${toolName}. Please wait a moment or try a lower-resolution setting.`,
            'QUOTA_EXCEEDED',
            { hint: "Suggest the user try again in 1 minute or switch to 'fast' model." }
        );
    }

    // Check for Authentication/Subscription
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('subscription')) {
        return toolError(
            `Authentication or subscription error during ${toolName}.`,
            'AUTH_REQUIRED',
            { hint: "Check user subscription status. If they are on a free tier, they may have hit a hard limit." }
        );
    }

    // Fallback
    return toolError(`Image generation failed during ${toolName}: ${message}`, 'GENERATION_ERROR');
}
