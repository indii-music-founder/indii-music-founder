
import { Editing } from '@/services/image/EditingService';
import { PLATFORM_DIMENSIONS } from '@/services/image/CanvasBatchService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

// ============================================================================
// MediaTools Implementation
// ============================================================================

export const MediaTools = {
    /**
     * Resizes and adapts an image for various social media platforms using Autonomous outpainting.
     */
    resize_image_for_socials: wrapTool('resize_image_for_socials', async (args: { imageUrl: string, platforms?: string[], promptOverride?: string }) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;

        const imgMatch = args.imageUrl.match(/^data:(image\/.+);base64,(.+)$/);
        if (!imgMatch) {
            return toolError("Invalid imageUrl data. Must be a base64 image data URI.", 'INVALID_INPUT');
        }

        const image = { mimeType: imgMatch[1]!, data: imgMatch[2]! };
        const targets = args.platforms 
            ? PLATFORM_DIMENSIONS.filter(d => args.platforms?.includes(d.platform || d.id))
            : PLATFORM_DIMENSIONS;

        if (targets.length === 0) {
            return toolError("No valid platforms selected. Available: " + PLATFORM_DIMENSIONS.map(d => d.platform || d.id).join(', '), 'INVALID_INPUT');
        }

        const results: Array<{ id: string, url: string, platform: string, label: string }> = [];
        const jobId = `resize_${Date.now()}`;

        store.addJob({
            id: jobId,
            title: `Resizing image for ${targets.length} socials...`,
            progress: 0,
            status: 'running',
            type: 'ai_generation'
        });

        try {
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i]!;
                const aspect = target.width / target.height;
                const aspectLabel = aspect > 1 ? 'landscape' : aspect < 1 ? 'vertical' : 'square';
                
                const prompt = args.promptOverride || 
                    `Rescale and outpaint this image to fit a ${target.label} (${target.width}x${target.height}) aspect ratio. 
                    Preserve the main subject in the center. Fill the background naturally to match the existing style, lighting, and textures. 
                    Do not stretch or distort the subject.`;

                logger.info(`[MediaTools] Resizing for ${target.label}...`);

                const result = await Editing.editImage({
                    image,
                    prompt,
                    model: 'pro', // Use Pro for higher quality social assets
                    forceHighFidelity: true
                });

                if (result) {
                    addToHistory({
                        id: result.id,
                        url: result.url,
                        prompt: `Resized for ${target.label}`,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });

                    results.push({
                        id: result.id,
                        url: result.url,
                        platform: target.platform || target.id,
                        label: target.label
                    });
                }

                store.updateJobProgress(jobId, ((i + 1) / targets.length) * 100);
            }

            store.updateJobStatus(jobId, 'success');

            return toolSuccess({
                count: results.length,
                variants: results
            }, `Successfully generated ${results.length} social media variants using Autonomous outpainting.`);

        } catch (error: unknown) {
            const err = error as Error;
            logger.error('[MediaTools] Resize failed:', err);
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to resize image: ${err.message}`);
        }
    }),

    /**
     * Extracts Audio DNA from a track - BPM, Key, Mood, Genre, and Energy.
     */
    analyze_audio_dna: wrapTool('analyze_audio_dna', async (args: { audioUrl: string }) => {
        try {
            const { audioIntelligence } = await import('@/services/audio/AudioIntelligenceService');
            
            // AudioIntelligenceService.analyze requires a File/Blob.
            // Since we have a URL, we must fetch it.
            logger.info(`[MediaTools] Fetching audio for DNA extraction: ${args.audioUrl}`);
            const response = await fetch(args.audioUrl);
            if (!response.ok) throw new Error(`Failed to fetch audio from ${args.audioUrl}`);
            const blob = await response.blob();
            
            // Try to get filename from URL or default
            const fileName = args.audioUrl.split('/').pop() || 'analyzing_track.mp3';
            const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });

            // Start analysis
            const profile = await audioIntelligence.analyze(file);
            
            const { useStore } = await import('@/core/store');
            const { currentProjectId, updateProjectMetadata } = useStore.getState();

            // Structure 'dna' for UI consumption based on legacy expectations
            const dna = {
                bpm: profile.technical.bpm,
                key: profile.technical.key,
                mood: profile.semantic.mood.join(', '),
                energy: profile.technical.energy,
                genre: profile.semantic.genre.join(', ')
            };

            if (currentProjectId && profile) {
                // Update project metadata with the DNA info
                updateProjectMetadata(currentProjectId, {
                    audioDna: profile
                });
            }

            return toolSuccess({
                dna,
                profile // Return full profile for advanced tools
            }, `Audio DNA extracted successfully:\nBPM: ${dna.bpm}\nKey: ${dna.key}\nMood: ${dna.mood}\nEnergy: ${dna.energy}\nGenre: ${dna.genre}`);
            
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[MediaTools] Audio analysis failed:', error);
            return toolError(`Failed to analyze audio: ${error.message}`);
        }
    }),

    /**
     * Crops an image to a specific aspect ratio or focus point using Autonomous reframing.
     */
    crop_image: wrapTool('crop_image', async (args: { imageUrl: string, aspect: string, focusPoint?: string }) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;

        const imgMatch = args.imageUrl.match(/^data:(image\/.+);base64,(.+)$/);
        if (!imgMatch) return toolError("Invalid imageUrl data. Must be a base64 image data URI.", 'INVALID_INPUT');
        const image = { mimeType: imgMatch[1]!, data: imgMatch[2]! };

        const jobId = `crop_${Date.now()}`;
        store.addJob({ id: jobId, title: `Cropping image to ${args.aspect}...`, progress: 0, status: 'running', type: 'ai_generation' });

        try {
            const prompt = `Crop and reframe this image to a ${args.aspect} aspect ratio. Ensure the main subject ${args.focusPoint ? `(focusing on ${args.focusPoint})` : ''} remains perfectly framed. Do not distort the image.`;
            
            const result = await Editing.editImage({
                image,
                prompt,
                model: 'pro',
                forceHighFidelity: true
            });

            if (result) {
                addToHistory({ id: result.id, url: result.url, prompt: `Cropped to ${args.aspect}`, type: 'image', timestamp: Date.now(), projectId: currentProjectId });
                store.updateJobStatus(jobId, 'success');
                return toolSuccess({ id: result.id, url: result.url, aspect: args.aspect }, `Successfully cropped image to ${args.aspect}.`);
            }
            store.updateJobStatus(jobId, 'error', 'Failed to crop image');
            return toolError("Failed to generate cropped image.");
        } catch (error: unknown) {
            const err = error as Error;
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to crop image: ${err.message}`);
        }
    }),

    /**
     * Generates a high-CTR thumbnail for YouTube or TikTok using AI orchestration.
     */
    generate_thumbnail: wrapTool('generate_thumbnail', async (args: { topic: string, platform?: 'youtube' | 'tiktok', referenceImageUrl?: string }) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;
        const jobId = `thumbnail_${Date.now()}`;
        
        store.addJob({ id: jobId, title: `Designing thumbnail for ${args.platform || 'youtube'}...`, progress: 0, status: 'running', type: 'ai_generation' });

        try {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            const { INTELLIGENCE_MODELS } = await import('@/core/config/intelligence-models');
            
            store.updateJobProgress(jobId, 10);
            
            // Step 1: Ideation
            const platform = args.platform || 'youtube';
            const aspect = platform === 'youtube' ? '16:9' : '9:16';
            
            const promptStr = `You are an expert YouTube/TikTok thumbnail designer. 
            The video topic is: "${args.topic}". 
            Generate a JSON object with:
            {
                "imagePrompt": "A highly detailed, cinematic prompt for an AI image generator to create the background plate without any text. Include lighting, mood, and visual hook.",
                "suggestedText": "1-3 words of high-impact overlay text",
                "textPlacement": "left",
                "colorPalette": ["#FF0000", "#FFFFFF"]
            }`;
            
            const aiResponse = await AutonomousIntelligence.generateContent(
                [{ role: 'user', parts: [{ text: promptStr }] }],
                INTELLIGENCE_MODELS.TEXT.FAST,
                { responseMimeType: 'application/json' }
            );
            
            const concept = AutonomousIntelligence.parseJSON(aiResponse.response.text()) as {
                imagePrompt: string;
                suggestedText: string;
                textPlacement: string;
                colorPalette: string[];
            };
            
            store.updateJobProgress(jobId, 40);
            
            // Step 2: Generation
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            
            let sourceImages;
            if (args.referenceImageUrl) {
                try {
                    const imgMatch = args.referenceImageUrl.match(/^data:(image\/.+);base64,(.+)$/);
                    if (imgMatch) {
                        sourceImages = [{ mimeType: imgMatch[1]!, data: imgMatch[2]! }];
                    } else {
                        // Fetch URL
                        const res = await fetch(args.referenceImageUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            const buffer = await blob.arrayBuffer();
                            // In browser, Buffer might not be available, use FileReader or btoa
                            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                            sourceImages = [{ mimeType: blob.type, data: base64 }];
                        }
                    }
                } catch (e) {
                    logger.warn('[MediaTools] Failed to load reference image for thumbnail:', e);
                }
            }
            
            const results = await ImageGeneration.generateImages({
                prompt: concept.imagePrompt,
                aspectRatio: aspect,
                model: 'pro',
                sourceImages,
                quality: 'hd'
            });
            
            store.updateJobProgress(jobId, 90);
            
            if (results && results.length > 0) {
                const imgResult = results[0]!;
                store.updateJobStatus(jobId, 'success');
                
                const finalPayload = {
                    id: imgResult.id,
                    backgroundUrl: imgResult.url,
                    concept
                };
                
                addToHistory({ 
                    id: imgResult.id, 
                    url: imgResult.url, 
                    prompt: `Thumbnail background for: ${args.topic}`, 
                    type: 'image', 
                    timestamp: Date.now(), 
                    projectId: currentProjectId
                });
                
                return toolSuccess(finalPayload, `Successfully generated thumbnail concept and background plate for ${platform}.`);
            }
            
            store.updateJobStatus(jobId, 'error', 'Failed to generate background image.');
            return toolError("Failed to generate background image.");
        } catch (error: unknown) {
            const err = error as Error;
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to generate thumbnail: ${err.message}`);
        }
    }),

    /**
     * Resolves the URLs for deterministic image resizes (like posters, thumbnails) 
     * automatically generated by the Firebase storage-resize-images extension.
     * Use this instead of AI-based resizing when you just need scaled down variants 
     * (e.g. 1080x1080 for a post, 1080x1920 for a poster).
     */
    get_resized_image_variants: wrapTool('get_resized_image_variants', async (args: { sourceUrl: string, dimensions: string[] }) => {
        try {
            const { getStorage, ref, getDownloadURL } = await import('firebase/storage');
            const storage = getStorage();

            const results: Record<string, string> = {};
            
            let path = args.sourceUrl;
            if (path.startsWith('gs://')) {
                path = path.split('/').slice(3).join('/'); // Remove gs://bucket-name/
            } else if (path.includes('firebasestorage.googleapis.com')) {
                const urlObj = new URL(path);
                const pathParts = urlObj.pathname.split('/o/');
                if (pathParts.length > 1) {
                    path = decodeURIComponent(pathParts[1]!.split('?')[0]!);
                }
            }

            const dotIndex = path.lastIndexOf('.');
            const basePath = dotIndex !== -1 ? path.substring(0, dotIndex) : path;
            const ext = dotIndex !== -1 ? path.substring(dotIndex) : '';

            for (const dim of args.dimensions) {
                const variantPath = `${basePath}_${dim}${ext}`;
                try {
                    const url = await getDownloadURL(ref(storage, variantPath));
                    results[dim] = url;
                } catch (e) {
                    results[dim] = `gs://${storage.app.options.storageBucket}/${variantPath}`;
                }
            }

            return toolSuccess({ variants: results }, `Resolved Firebase Extension resized variants for ${args.dimensions.join(', ')}.`);
        } catch (error: unknown) {
            const err = error as Error;
            return toolError(`Failed to resolve resized images: ${err.message}`);
        }
    })
};

// Aliases
export const { resize_image_for_socials, analyze_audio_dna, crop_image, generate_thumbnail, get_resized_image_variants } = MediaTools;
