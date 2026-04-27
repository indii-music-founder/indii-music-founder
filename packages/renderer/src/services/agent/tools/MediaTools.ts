
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
     * Resizes and adapts an image for various social media platforms using AI outpainting.
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
            }, `Successfully generated ${results.length} social media variants using AI outpainting.`);

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
    })
};

// Aliases
export const { resize_image_for_socials, analyze_audio_dna } = MediaTools;
