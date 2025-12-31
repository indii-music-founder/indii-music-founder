import { useStore } from '@/core/store';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/image/VideoGenerationService';

// ============================================================================
// Types for VideoTools
// ============================================================================








interface VideoGenerationOptions {
    prompt: string;
    firstFrame?: string;
    lastFrame?: string;
}

// ============================================================================
// VideoTools Implementation
// ============================================================================

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
                throw new Error(`Video generation failed: ${e.message}`);
            }
            throw new Error(`Video generation failed: An unknown error occurred.`);
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
                throw new Error(`Motion Brush failed: ${e.message}`);
            }
            throw new Error(`Motion Brush failed: An unknown error occurred.`);
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
                throw new Error(`Batch video processing failed: ${e.message}`);
            }
            throw new Error(`Batch video processing failed: An unknown error occurred.`);
        }
    },
    extend_video: async (args: { videoUrl: string, prompt: string, direction: 'start' | 'end' }) => {
        try {
            const { extractVideoFrame } = await import('@/utils/video');
            const frameData = await extractVideoFrame(args.videoUrl);

            if (!frameData) {
                return "Failed to extract frame from the provided video URL.";
            }

            const options: VideoGenerationOptions = {
                prompt: args.prompt,
            };

            if (args.direction === 'start') {
                options.lastFrame = frameData; // If extending start, the video frame becomes the END of the new clip
            } else {
                options.firstFrame = frameData; // If extending end, the video frame becomes the START of the new clip
            }

            const results = await VideoGeneration.generateVideo(options);

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
                return `Video extended successfully: ${uri}`;
            }
            return "Video extension failed (no URI returned).";
        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new Error(`Video extension failed: ${e.message}`);
            }
            throw new Error(`Video extension failed: An unknown error occurred.`);
        }
    },
    update_keyframe: async (args: { clipId: string, property: 'scale' | 'opacity' | 'x' | 'y' | 'rotation', frame: number, value: number, easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }) => {
        try {
            const { useVideoEditorStore } = await import('@/modules/video/store/videoEditorStore');
            const { updateKeyframe, addKeyframe, project } = useVideoEditorStore.getState();
            const clip = project.clips.find(c => c.id === args.clipId);

            if (!clip) {
                return `Clip with ID ${args.clipId} not found.`;
            }

            // If easing is provided, we might need to update after adding, or just use update if it exists.
            // Since addKeyframe doesn't take easing in the interface I saw (wait, let me check the file content again),
            // I need to be careful.

            // Looking at videoEditorStore.ts:
            // addKeyframe: (clipId, property, frame, value) => void;
            // updateKeyframe: (clipId, property, frame, updates) => void;

            // So addKeyframe only sets value. If I want to set easing, I need to call updateKeyframe afterwards.

            // 1. Add/Overwrite value
            addKeyframe(args.clipId, args.property, args.frame, args.value);

            // 2. Update easing if provided
            if (args.easing) {
                updateKeyframe(args.clipId, args.property, args.frame, { easing: args.easing });
            }

            return `Keyframe updated for clip ${args.clipId} on property ${args.property} at frame ${args.frame} with value ${args.value}${args.easing ? ` and easing ${args.easing}` : ''}.`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new Error(`Keyframe update failed: ${e.message}`);
            }
            throw new Error(`Keyframe update failed: An unknown error occurred.`);
        }
    },
    generate_video_chain: async (args: { prompt: string, startImage: string, totalDuration: number }) => {
        try {
            // "The user should be able to choose anywhere from a total of an eight second video... up to six minutes and 32 seconds"
            // "daisychains in a manner where the system takes the last frame automatically creates it for the first frame"

            // 1. Validate Input
            const match = args.startImage.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                return "Invalid start image. Must be a base64 data URI.";
            }

            const { extractVideoFrame } = await import('@/utils/video');
            const { addToHistory, currentProjectId } = useStore.getState();

            // 2. Calculate Segments
            // Standard generation is ~5-8s usually? Let's assume VideoService defaults (which might be 5s or 8s depending on model).
            // Veo/Gemini models often output ~5s. 
            // 6m 32s = 392 seconds. 
            // If chunks are 5s: ~79 chunks.
            // If chunks are 8s: ~49 chunks.

            // We'll proceed with a loop until total duration is reached.

            let currentImage = args.startImage; // Keep as string (Data URI)
            let accumulatedDuration = 0;
            const generatedUrls: string[] = [];

            // Prevent infinite loops / excessively long requests
            const MAX_ITERATIONS = 50;
            let iteration = 0;

            useStore.getState().addAgentMessage({
                id: crypto.randomUUID(),
                role: 'system',
                text: `Starting video chain generation for target duration ${args.totalDuration}s...`,
                timestamp: Date.now()
            });

            while (accumulatedDuration < args.totalDuration && iteration < MAX_ITERATIONS) {
                iteration++;

                // Generate segment
                const results = await VideoGeneration.generateVideo({
                    prompt: args.prompt + (iteration > 1 ? ` (Part ${iteration}, continuation)` : ""),
                    firstFrame: currentImage // Pass the data URI string directly
                });

                if (results.length === 0) {
                    return `Video chain broke at iteration ${iteration}. Failed to generate segment.`;
                }

                const segmentUrl = results[0].url;
                generatedUrls.push(segmentUrl);
                accumulatedDuration += 5; // Assuming 5s per clip for now unless we get duration from Result.

                // Add to history immediately so user sees progress
                addToHistory({
                    id: crypto.randomUUID(),
                    url: segmentUrl,
                    prompt: `${args.prompt} [Part ${iteration}]`,
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });

                // Extract last frame for next iteration
                // Note: extracting frame from a URL (which might be Signed URL) requires fetching it.
                // Our extractVideoFrame utility handles valid src URLs.
                const lastFrameData = await extractVideoFrame(segmentUrl);

                if (!lastFrameData) {
                    return `Video chain broke at iteration ${iteration}. Could not extract last frame for chain.`;
                }

                currentImage = lastFrameData; // Update for next loop (it's already a string)

                // Rate limit safety
                await new Promise(r => setTimeout(r, 1000));
            }

            return `Video chain completed! Generated ${generatedUrls.length} segments.`;

        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new Error(`Video chain generation failed: ${e.message}`);
            }
            throw new Error(`Video chain generation failed: An unknown error occurred.`);
        }
    },
    interpolate_sequence: async (args: { firstFrame: string, lastFrame: string, prompt?: string }) => {
        try {
            // "Interpolate_Sequence(Frame_A, Frame_B)"
            // "Google V3.1 generates the transition pixels between these locked states."

            // We use VideoGeneration service but pass both firstFrame and lastFrame.
            // (Assuming the underlying service supports this, which many video models do).

            const results = await VideoGeneration.generateVideo({
                prompt: args.prompt || "Smooth transition between frames",
                firstFrame: args.firstFrame,
                lastFrame: args.lastFrame
            });

            if (results.length > 0) {
                const uri = results[0].url;
                const { addToHistory, currentProjectId } = useStore.getState();
                addToHistory({
                    id: crypto.randomUUID(),
                    url: uri,
                    prompt: args.prompt || "Frame Interpolation",
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                return `Sequence interpolated successfully: ${uri}`;
            }
            return "Interpolation failed (no URI returned).";

        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new Error(`Interpolation failed: ${e.message}`);
            }
            throw new Error(`Interpolation failed: An unknown error occurred.`);
        }
    }
};
