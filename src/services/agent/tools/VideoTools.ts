import { useStore } from '@/core/store';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/image/VideoGenerationService';

export const VideoTools = {
    generate_video: async (args: { prompt: string, image?: string, duration?: number }) => {
        try {
            let imageInput;
            if (args.image) {
                const match = args.image.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    imageInput = { mimeType: match[1], data: match[2] };
                }
            }

            const results = await VideoGeneration.generateVideo({
                prompt: args.prompt,
                firstFrame: args.image,
            });

            if (results.length > 0) {
                const uri = results[0].url;
                const { addToHistory, currentProjectId } = useStore.getState();
                addToHistory({
                    id: crypto.randomUUID(),
                    url: uri,
                    prompt: args.prompt,
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                return `Video generated successfully: ${uri}`;
            }
            return "Video generation failed (no URI returned).";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Video generation failed: ${e.message}`;
            }
            return `Video generation failed: An unknown error occurred.`;
        }
    },
    generate_motion_brush: async (args: { image: string, mask: string, prompt?: string }) => {
        try {
            const { Video } = await import('@/services/video/VideoService');

            const imgMatch = args.image.match(/^data:(.+);base64,(.+)$/);
            const maskMatch = args.mask.match(/^data:(.+);base64,(.+)$/);

            if (!imgMatch || !maskMatch) {
                return "Invalid image or mask data. Must be base64 data URIs.";
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
                return `Motion Brush video generated successfully: ${uri}`;
            }
            return "Motion Brush generation failed.";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Motion Brush failed: ${e.message}`;
            }
            return `Motion Brush failed: An unknown error occurred.`;
        }
    },
    batch_edit_videos: async (args: { prompt: string, videoIndices?: number[] }) => {
        try {
            const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();

            const allVideos = uploadedImages.filter(img => img.type === 'video');

            if (allVideos.length === 0) {
                return "No videos found in uploads to edit. Please upload videos first.";
            }

            const targetVideos = args.videoIndices
                ? args.videoIndices.map(i => allVideos[i]).filter(Boolean)
                : allVideos;

            if (targetVideos.length === 0) {
                return "No valid videos found for the provided indices.";
            }

            const videoDataList = targetVideos.map(vid => {
                const match = vid.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
                return null;
            }).filter(vid => vid !== null) as { mimeType: string; data: string }[];

            if (videoDataList.length === 0) {
                return "Could not process video data from uploads. Ensure they are valid data URIs.";
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
                return `Successfully processed ${results.length} videos based on instruction: "${args.prompt}".`;
            }
            return "Batch video processing completed but no videos were returned.";

        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Batch video processing failed: ${e.message}`;
            }
            return `Batch video processing failed: An unknown error occurred.`;
        }
    }
};
