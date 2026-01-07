import { useStore } from '@/core/store';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration, VideoGenerationOptions } from '@/services/video/VideoGenerationService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// VideoTools Implementation
// ============================================================================

export const VideoTools: Record<string, AnyToolFunction> = {
    generate_video: wrapTool('generate_video', async (args: { prompt: string, image?: string, duration?: number }) => {
        const { userProfile } = useStore.getState();
        const results = await VideoGeneration.generateVideo({
            prompt: args.prompt,
            firstFrame: args.image,
            userProfile
        });

        if (results.length > 0) {
            const videoJob = results[0];

            // WAIT for job if URL is missing
            let finalUrl = videoJob.url;
            if (!finalUrl) {
                const completedJob = await VideoGeneration.waitForJob(videoJob.id);
                finalUrl = completedJob.videoUrl;
            }

            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: videoJob.id,
                url: finalUrl,
                prompt: args.prompt,
                type: 'video',
                timestamp: Date.now(),
                projectId: currentProjectId
            });

            return toolSuccess({
                id: videoJob.id,
                url: finalUrl,
                prompt: args.prompt
            }, `Video generated successfully: ${finalUrl}`);
        }
        return toolError('Video generation failed (no result returned).', 'GENERATION_FAILED');
    }),

    generate_motion_brush: wrapTool('generate_motion_brush', async (args: { image: string, mask: string, prompt?: string }) => {
        const { Video } = await import('@/services/video/VideoService');

        const imgMatch = args.image.match(/^data:(.+);base64,(.+)$/);
        const maskMatch = args.mask.match(/^data:(.+);base64,(.+)$/);

        if (!imgMatch || !maskMatch) {
            return toolError("Invalid image or mask data. Must be base64 data URIs.", 'INVALID_INPUT');
        }

        const image = { mimeType: imgMatch[1], data: imgMatch[2] };
        const mask = { mimeType: maskMatch[1], data: maskMatch[2] };

        const uri = await Video.generateMotionBrush(image, mask);

        if (uri) {
            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: crypto.randomUUID(),
                url: uri,
                prompt: args.prompt || "Motion Brush",
                type: 'video',
                timestamp: Date.now(),
                projectId: currentProjectId
            });
            return toolSuccess({
                url: uri
            }, `Motion Brush video generated successfully: ${uri}`);
        }
        return toolError("Motion Brush generation failed.", 'GENERATION_FAILED');
    }),

    batch_edit_videos: wrapTool('batch_edit_videos', async (args: { prompt: string, videoIndices?: number[] }) => {
        const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();
        const allVideos = uploadedImages.filter(img => img.type === 'video');

        if (allVideos.length === 0) {
            return toolError("No videos found in uploads to edit. Please upload videos first.", 'NOT_FOUND');
        }

        const targetVideos = args.videoIndices
            ? args.videoIndices.map(i => allVideos[i]).filter(Boolean)
            : allVideos;

        if (targetVideos.length === 0) {
            return toolError('INVALID_INDEX', "No valid videos found for the provided indices.");
        }

        const videoDataList = targetVideos.map(vid => {
            const match = vid.url.match(/^data:(.+);base64,(.+)$/);
            if (match) {
                return { mimeType: match[1], data: match[2] };
            }
            return null;
        }).filter(vid => vid !== null) as { mimeType: string; data: string }[];

        if (videoDataList.length === 0) {
            return toolError("Could not process video data from uploads. Ensure they are valid data URIs.", 'PROCESSING_FAILED');
        }

        const results = await Editing.batchEditVideo({
            videos: videoDataList,
            prompt: args.prompt,
            onProgress: (current, total) => {
                useStore.getState().addAgentMessage({
                    id: crypto.randomUUID(),
                    role: 'system',
                    text: `Processing video ${current} of ${total}...`,
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
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
            });
            return toolSuccess({
                processedCount: results.length,
                results
            }, `Successfully processed ${results.length} videos based on instruction: "${args.prompt}".`);
        }
        return toolError("Batch video processing completed but no videos were returned.", 'PROCESSING_FAILED');
    }),

    extend_video: wrapTool('extend_video', async (args: { videoUrl: string, prompt: string, direction: 'start' | 'end' }) => {
        const { extractVideoFrame } = await import('@/utils/video');
        const frameData = await extractVideoFrame(args.videoUrl);

        if (!frameData) {
            return toolError("Failed to extract frame from the provided video URL.", 'EXTRACTION_FAILED');
        }

        const options: VideoGenerationOptions = {
            prompt: args.prompt,
        };

        if (args.direction === 'start') {
            options.lastFrame = frameData;
        } else {
            options.firstFrame = frameData;
        }

        const { userProfile } = useStore.getState();
        options.userProfile = userProfile;

        const results = await VideoGeneration.generateVideo(options);

        if (results.length > 0) {
            const videoJob = results[0];

            let finalUrl = videoJob.url;
            if (!finalUrl) {
                const completedJob = await VideoGeneration.waitForJob(videoJob.id);
                finalUrl = completedJob.videoUrl;
            }

            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: videoJob.id,
                url: finalUrl,
                prompt: args.prompt,
                type: 'video',
                timestamp: Date.now(),
                projectId: currentProjectId
            });

            return toolSuccess({
                id: videoJob.id,
                url: finalUrl
            }, `Video extended successfully: ${finalUrl}`);
        }
        return toolError("Video extension failed (no result returned).", 'GENERATION_FAILED');
    }),

    update_keyframe: wrapTool('update_keyframe', async (args: { clipId: string, property: 'scale' | 'opacity' | 'x' | 'y' | 'rotation', frame: number, value: number, easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }) => {
        const { useVideoEditorStore } = await import('@/modules/video/store/videoEditorStore');
        const { updateKeyframe, addKeyframe, project } = useVideoEditorStore.getState();
        const clip = project.clips.find(c => c.id === args.clipId);

        if (!clip) {
            return toolError(`Clip with ID ${args.clipId} not found.`, 'NOT_FOUND');
        }

        addKeyframe(args.clipId, args.property, args.frame, args.value);

        if (args.easing) {
            updateKeyframe(args.clipId, args.property, args.frame, { easing: args.easing });
        }

        return toolSuccess({
            clipId: args.clipId,
            property: args.property,
            frame: args.frame,
            value: args.value,
            easing: args.easing
        }, `Keyframe updated for clip ${args.clipId} on property ${args.property} at frame ${args.frame} with value ${args.value}${args.easing ? ` and easing ${args.easing}` : ''}.`);
    }),

    generate_video_chain: wrapTool('generate_video_chain', async (args: { prompt: string, startImage: string, totalDuration: number }) => {
        useStore.getState().addAgentMessage({
            id: crypto.randomUUID(),
            role: 'system',
            text: `Queuing long-form background job for ${args.totalDuration}s...`,
            timestamp: Date.now()
        });

        const { userProfile } = useStore.getState();

        const results = await VideoGeneration.generateLongFormVideo({
            prompt: args.prompt,
            totalDuration: args.totalDuration,
            firstFrame: args.startImage,
            userProfile
        });

        const jobId = results[0]?.id;
        return toolSuccess({
            jobId
        }, `Long-form generation job started. Job ID: ${jobId}. You will see segments appear in your history as they are generated.`);
    }),

    interpolate_sequence: wrapTool('interpolate_sequence', async (args: { firstFrame: string, lastFrame: string, prompt?: string }) => {
        const { userProfile } = useStore.getState();
        const results = await VideoGeneration.generateVideo({
            prompt: args.prompt || "Smooth transition between frames",
            firstFrame: args.firstFrame,
            lastFrame: args.lastFrame,
            userProfile
        });

        if (results.length > 0) {
            const videoJob = results[0];
            let finalUrl = videoJob.url;

            if (!finalUrl) {
                const completedJob = await VideoGeneration.waitForJob(videoJob.id);
                finalUrl = completedJob.videoUrl;
            }

            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: videoJob.id,
                url: finalUrl,
                prompt: args.prompt || "Frame Interpolation",
                type: 'video',
                timestamp: Date.now(),
                projectId: currentProjectId
            });

            return toolSuccess({
                id: videoJob.id,
                url: finalUrl
            }, `Sequence interpolated successfully: ${finalUrl}`);
        }
        return toolError('GENERATION_FAILED', "Interpolation failed (no result returned).");
    })
};

// Aliases
export const {
    generate_video,
    generate_motion_brush,
    batch_edit_videos,
    extend_video,
    update_keyframe,
    generate_video_chain,
    interpolate_sequence
} = VideoTools;
