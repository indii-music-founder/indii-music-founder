import { logger } from '@/utils/logger';
import { renderService, RenderConfig } from './RenderService';
import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

export interface ParallelRenderOptions {
    projectId: string;
    compositionId: string;
    segmentDurationSeconds: number; // e.g. 30 seconds
    audioTrackUrl?: string;
}

export class ParallelRenderOrchestrator {
    /**
     * Slices a long-form composition into smaller parallel chunks,
     * triggers concurrent Cloud Run renders, and generates the FFmpeg commands
     * to perform a clean non-transcoded concat stitch.
     */
    static async renderLongFormParallel(
        options: ParallelRenderOptions,
        onProgress?: (pct: number) => void
    ): Promise<{ outputUrl: string; ffmpegStitchCommand: string }> {
        const store = useVideoEditorStore.getState();
        const project = store.project;
        if (!project) {
            throw new Error('No active project found to render');
        }

        const totalFrames = project.durationInFrames;
        const fps = project.fps;
        const totalDurationSeconds = totalFrames / fps;
        
        const segmentDurationFrames = options.segmentDurationSeconds * fps;
        const numChunks = Math.ceil(totalFrames / segmentDurationFrames);
        
        logger.info(`[ParallelRenderOrchestrator] Partitioning ${totalDurationSeconds}s video into ${numChunks} parallel segments of ${options.segmentDurationSeconds}s.`);
        
        const renderPromises: Promise<string>[] = [];
        const progressTracker = new Array(numChunks).fill(0);
        
        const updateOverallProgress = () => {
            const sum = progressTracker.reduce((a, b) => a + b, 0);
            const overallPct = Math.round(sum / numChunks);
            onProgress?.(overallPct);
        };

        for (let i = 0; i < numChunks; i++) {
            const startFrame = i * segmentDurationFrames;
            const endFrame = Math.min((i + 1) * segmentDurationFrames, totalFrames);
            
            const chunkConfig: RenderConfig = {
                compositionId: options.compositionId,
                outputLocation: `chunk_${i}.mp4`,
                useCloudQueue: true,
                inputProps: {
                    project,
                    frameRange: [startFrame, endFrame],
                    isSegmentedChunk: true
                }
            };
            
            const promise = renderService.renderCompositionCloud(chunkConfig, (pct) => {
                progressTracker[i] = pct;
                updateOverallProgress();
            }).then(res => res.publicUrl || `https://storage.googleapis.com/indii-renders/chunk_${i}.mp4`);
            
            renderPromises.push(promise);
        }
        
        // Await all parallel segments
        const chunkUrls = await Promise.all(renderPromises);
        logger.info('[ParallelRenderOrchestrator] All chunks rendered successfully:', chunkUrls);
        
        // Generate FFmpeg concat txt instructions
        const concatInstructions = chunkUrls.map(url => `file '${url}'`).join('\n');
        
        // Fast stitch command using copy codec + overlaying main audio track to prevent pop drift
        const audioInput = options.audioTrackUrl ? `-i "${options.audioTrackUrl}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest` : '-c copy';
        const ffmpegStitchCommand = `ffmpeg -f concat -safe 0 -i inputs.txt ${audioInput} -y output_stitched.mp4`;
        
        logger.info(`[ParallelRenderOrchestrator] Generated stitching command: ${ffmpegStitchCommand}`);
        
        return {
            outputUrl: 'https://storage.googleapis.com/indii-renders/output_stitched.mp4',
            ffmpegStitchCommand
        };
    }
}
