/**
 * VeoToRemotionBridge.ts
 *
 * Bridges the gap between VideoGenerationService (AI raw output) and the
 * Remotion composition pipeline. Converts completed Veo job segment URLs
 * into VideoClip entries, populates the videoEditorStore, and optionally
 * dispatches a cloud render via VideoRenderOrchestrator.
 *
 * Pipeline:
 *   VideoGenerationService.generateLongFormVideo()
 *     → segmentUrls[] (in Firestore)
 *     → VeoToRemotionBridge.ingestVeoJob()
 *     → videoEditorStore.addClip() per segment
 *     → MyComposition renders via <Sequence> timeline
 *     → VideoRenderOrchestrator.startRender() (optional)
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useVideoEditorStore, VideoProject } from '@/modules/video/store/videoEditorStore';
import { videoRenderOrchestrator } from './VideoRenderOrchestrator';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface VeoIngestOptions {
    /** Veo job ID from VideoGenerationService */
    jobId: string;
    /** Frames per second for the Remotion project (default: 30) */
    fps?: number;
    /** Duration in seconds per Veo segment (default: 8) */
    segmentDurationSeconds?: number;
    /** Target aspect ratio — determines project width/height */
    aspectRatio?: '16:9' | '9:16' | '1:1';
    /** Title for the generated project */
    title?: string;
    /** Auto-dispatch cloud render after clips are assembled? */
    autoRender?: boolean;
}

interface VeoJobDoc {
    id: string;
    prompt: string;
    status: 'processing' | 'completed' | 'failed';
    segmentUrls?: string[];
    videoUrl?: string;
    type?: string;
    totalSegments?: number;
    options?: {
        aspectRatio?: string;
        resolution?: string;
        duration?: number;
    };
}

/** Maps aspect ratio string → pixel dimensions. */
function aspectToDimensions(ratio: string): { width: number; height: number } {
    switch (ratio) {
        case '9:16': return { width: 1080, height: 1920 };
        case '1:1':  return { width: 1080, height: 1080 };
        case '16:9':
        default:     return { width: 1920, height: 1080 };
    }
}

export class VeoToRemotionBridge {

    /**
     * Ingests a completed Veo job from Firestore and populates the
     * videoEditorStore with clip entries for each segment.
     *
     * For single-segment jobs (atomic generation), creates one clip.
     * For long-form daisychained jobs, creates sequential clips across
     * the full timeline.
     *
     * @returns The assembled VideoProject ready for preview or render.
     */
    async ingestVeoJob(options: VeoIngestOptions): Promise<VideoProject> {
        const {
            jobId,
            fps = 30,
            segmentDurationSeconds = 8,
            title,
            autoRender = false,
        } = options;

        logger.info(`[VeoToRemotionBridge] Ingesting Veo job: ${jobId}`);

        // 1. Fetch job from Firestore
        const jobRef = doc(db, 'videoJobs', jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error(`[VeoToRemotionBridge] Veo job not found: ${jobId}`);
        }

        const jobData = jobSnap.data() as VeoJobDoc;

        if (jobData.status !== 'completed') {
            throw new Error(`[VeoToRemotionBridge] Veo job is not completed (status: ${jobData.status}). Wait for completion before ingesting.`);
        }

        // 2. Collect segment URLs
        const segmentUrls: string[] = [];

        if (jobData.type === 'long_form' && jobData.segmentUrls && jobData.segmentUrls.length > 0) {
            segmentUrls.push(...jobData.segmentUrls);
        } else if (jobData.videoUrl) {
            // Single-segment job
            segmentUrls.push(jobData.videoUrl);
        }

        if (segmentUrls.length === 0) {
            throw new Error(`[VeoToRemotionBridge] No video URLs found in Veo job: ${jobId}`);
        }

        // 3. Determine project dimensions from aspect ratio
        const aspectRatio = options.aspectRatio || jobData.options?.aspectRatio || '16:9';
        const { width, height } = aspectToDimensions(aspectRatio);

        // 4. Calculate total duration
        const framesPerSegment = segmentDurationSeconds * fps;
        const totalDurationInFrames = framesPerSegment * segmentUrls.length;

        // 5. Build VideoProject
        const projectId = `veo_project_${uuidv4()}`;
        const videoTrackId = `track_video_${uuidv4()}`;
        const projectTitle = title || `AI Video — ${jobData.prompt.substring(0, 50)}...`;

        const project: VideoProject = {
            id: projectId,
            name: projectTitle,
            fps,
            durationInFrames: totalDurationInFrames,
            width,
            height,
            tracks: [
                {
                    id: videoTrackId,
                    name: 'AI Generated Video',
                    type: 'video',
                },
            ],
            clips: segmentUrls.map((url, index) => ({
                id: `clip_veo_${uuidv4()}`,
                type: 'video' as const,
                src: url,
                startFrame: index * framesPerSegment,
                durationInFrames: framesPerSegment,
                trackId: videoTrackId,
                name: segmentUrls.length > 1
                    ? `Segment ${index + 1}/${segmentUrls.length}`
                    : 'AI Video',
                // Cross-dissolve between segments for smooth daisychain joins
                ...(index > 0 && {
                    transitionIn: { type: 'fade' as const, duration: Math.round(fps * 0.5) }, // 0.5s fade
                }),
                ...(index < segmentUrls.length - 1 && {
                    transitionOut: { type: 'fade' as const, duration: Math.round(fps * 0.5) },
                }),
            })),
        };

        // 6. Push into Zustand store
        const store = useVideoEditorStore.getState();
        store.setProject(project);

        logger.info(
            `[VeoToRemotionBridge] ✅ Project assembled: ${segmentUrls.length} clips, ` +
            `${totalDurationInFrames} frames (${(totalDurationInFrames / fps).toFixed(1)}s), ` +
            `${width}×${height} @ ${fps}fps`
        );

        // 7. Optionally dispatch cloud render
        if (autoRender) {
            try {
                const renderId = await videoRenderOrchestrator.startRender(
                    {
                        compositionId: 'VideoProject', // Matches Root.tsx registration
                        outputLocation: `renders/${projectId}.mp4`,
                        inputProps: { project },
                        codec: 'h264',
                        useCloudQueue: true,
                    },
                    projectTitle
                );
                logger.info(`[VeoToRemotionBridge] Cloud render dispatched: ${renderId}`);
            } catch (renderError: unknown) {
                logger.error('[VeoToRemotionBridge] Auto-render failed (non-blocking):', renderError);
                // Non-blocking: user can still trigger manual render from the editor
            }
        }

        return project;
    }

    /**
     * Convenience method: builds a project from raw segment URLs without
     * needing a Firestore job. Useful for in-memory video assembly.
     */
    buildProjectFromUrls(
        segmentUrls: string[],
        options: {
            fps?: number;
            segmentDurationSeconds?: number;
            aspectRatio?: '16:9' | '9:16' | '1:1';
            title?: string;
        } = {}
    ): VideoProject {
        const fps = options.fps || 30;
        const segmentDuration = options.segmentDurationSeconds || 8;
        const { width, height } = aspectToDimensions(options.aspectRatio || '16:9');
        const framesPerSegment = segmentDuration * fps;
        const videoTrackId = `track_video_${uuidv4()}`;

        return {
            id: `veo_project_${uuidv4()}`,
            name: options.title || 'AI Video Project',
            fps,
            durationInFrames: framesPerSegment * segmentUrls.length,
            width,
            height,
            tracks: [{ id: videoTrackId, name: 'AI Generated Video', type: 'video' }],
            clips: segmentUrls.map((url, index) => ({
                id: `clip_veo_${uuidv4()}`,
                type: 'video' as const,
                src: url,
                startFrame: index * framesPerSegment,
                durationInFrames: framesPerSegment,
                trackId: videoTrackId,
                name: `Segment ${index + 1}`,
                ...(index > 0 && {
                    transitionIn: { type: 'fade' as const, duration: Math.round(fps * 0.5) },
                }),
                ...(index < segmentUrls.length - 1 && {
                    transitionOut: { type: 'fade' as const, duration: Math.round(fps * 0.5) },
                }),
            })),
        };
    }
}

export const veoToRemotionBridge = new VeoToRemotionBridge();
