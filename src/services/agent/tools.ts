import { useStore } from '@/core/store';
import { Image } from '@/services/image/ImageService';

export const TOOL_REGISTRY: Record<string, (args: any) => Promise<string>> = {
    set_mode: async (args) => {
        // In a real implementation, this would switch the module or UI state
        return `Switched to ${args.mode} mode (Simulation).`;
    },
    update_prompt: async (args) => {
        return `Prompt updated to: "${args.text}"`;
    },
    generate_image: async (args) => {
        try {
            const { studioControls, addToHistory, currentProjectId } = useStore.getState();

            const results = await Image.generateImages({
                prompt: args.prompt || "A creative scene",
                count: args.count || 1,
                resolution: args.resolution || studioControls.resolution,
                aspectRatio: args.aspectRatio || studioControls.aspectRatio,
                negativePrompt: args.negativePrompt || studioControls.negativePrompt,
                seed: args.seed ? parseInt(args.seed) : (studioControls.seed ? parseInt(studioControls.seed) : undefined)
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
        } catch (e: any) {
            return `Image generation failed: ${e.message}`;
        }
    },
    read_history: async () => {
        const history = useStore.getState().agentHistory;
        return history.slice(-5).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n');
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

            const results = await Image.batchEdit({
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

        } catch (e: any) {
            return `Batch edit failed: ${e.message}`;
        }
    },
    batch_edit_videos: async (args: { prompt: string, videoIndices?: number[] }) => {
        try {
            const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();

            // Filter for videos
            const allVideos = uploadedImages.filter(img => img.type === 'video');

            if (allVideos.length === 0) {
                return "No videos found in uploads to edit. Please upload videos first.";
            }

            // Filter videos if indices provided (indices refer to the filtered video list)
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

            const results = await Image.batchEditVideo({
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

        } catch (e: any) {
            return `Batch video processing failed: ${e.message}`;
        }
    }
};

export const BASE_TOOLS = `
AVAILABLE TOOLS:
1. set_mode(mode: string) - Switch studio mode.
2. update_prompt(text: string) - Write text into the prompt box.
3. generate_image(prompt: string, count: number) - Generate images.
4. read_history() - Read recent chat history.
5. batch_edit_images(prompt: string, imageIndices?: number[]) - Edit uploaded images with an instruction.
6. batch_edit_videos(prompt: string, videoIndices?: number[]) - Edit/Grade uploaded videos with an instruction.
`;
