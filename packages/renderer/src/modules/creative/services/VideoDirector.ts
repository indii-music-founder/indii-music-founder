import { logger } from '@/utils/logger';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
const SchemaType = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' } as const;
import { useStore, HistoryItem } from '@/core/store';
import { functionsWest1 as functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { resolveStorageUri } from '@/services/storage/storageUri';
import { normalizeVideoAspectRatio } from '@/services/video/videoAspectRatio';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';

export class VideoDirector {
    static async processGeneratedVideo(uri: string, prompt: string, enableDirectorsCut = false, isRetry = false): Promise<string | null> {
        // Note: In a real scenario, we'd fetch the video blob. 
        // For this demo/port, we assume 'uri' is accessible or a data URI.
        try {
            const url = uri;

            if (enableDirectorsCut && !isRetry) {
                // 2. Extract Frame for Critique
                const frameBase64 = await this.extractFrame(url);
                if (!frameBase64) {
                    return this.saveVideo(url, prompt, isRetry);
                }

                // 3. Critique
                const critiquePrompt = `You are a film director. Rate this video frame 1-10 based on the prompt: "${prompt}". If score < 8, provide a technically improved prompt to fix it.`;


                const schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        score: { type: SchemaType.NUMBER, nullable: false },
                        refined_prompt: { type: SchemaType.STRING, nullable: false }
                    },
                    required: ['score', 'refined_prompt'],
                    nullable: false
                };

                interface DirectorFeedback {
                    score: number;
                    refined_prompt: string;
                }

                // Cast schema to unknown then specific Schema type if needed, or rely on loose matching if allowed.
                // FirebaseIntelligenceService expects Record<string, any> or Schema.
                const feedback = await AutonomousIntelligence.generateStructuredData<DirectorFeedback>(
                    [
                        { inlineData: { mimeType: 'image/jpeg', data: frameBase64.split(',')[1] ?? '' } },
                        { text: critiquePrompt }
                    ],
                    schema,
                    undefined,
                    `You are a master cinematographer. Analyze the provided image.`
                );


                if (typeof feedback.score === 'number' && feedback.score < 8) {
                    // 4. Reshoot
                    // Note: We need to call the generation service again. 
                    // Since this is a service, we might need to pass the generator function or import it.
                    // For now, we'll return a special signal or handle it if we move generation here.

                    // Ideally, this method should be part of the generation flow.
                    // Let's return the refined prompt so the caller can retry.
                    throw { retry: true, refinedPrompt: feedback.refined_prompt };
                }
            }

            return this.saveVideo(url, prompt, isRetry);

        } catch (e: unknown) {
            if (e && typeof e === 'object' && 'retry' in e) throw e; // Propagate retry signal
            return null;
        }
    }

    private static saveVideo(url: string, prompt: string, isRetry: boolean): string {
        const id = crypto.randomUUID();
        const metaLabel = isRetry ? 'DIRECTOR\'S CUT (V2)' : undefined;
        const storageUri = resolveStorageUri(url);

        useStore.getState().addToHistory({
            id,
            url,
            storageUri,
            prompt,
            timestamp: Date.now(),
            type: 'video',
            meta: metaLabel,
            projectId: useStore.getState().currentProjectId
        });

        return id;
    }

    private static async extractFrame(videoUrl: string): Promise<string | null> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.crossOrigin = "anonymous";
            video.src = videoUrl;
            video.muted = true;
            video.onloadeddata = () => {
                video.currentTime = 1.0; // Seek to 1s
            };
            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d')?.drawImage(video, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            video.onerror = () => resolve(null);
        });
    }


    /**
     * Trigger video generation from an image using Veo
     */
    static async triggerAnimation(
        item: HistoryItem,
        options?: { aspectRatio?: string }
    ): Promise<{ success: boolean; jobId?: string; error?: string; video_url?: string }> {
        const prompt = item.prompt || 'Animate this scene';
        const { aspectRatio } = normalizeVideoAspectRatio(options?.aspectRatio);
        const userId = useStore.getState().userProfile?.id;
        if (!userId) {
            return { success: false, error: 'Sign in before generating a video.' };
        }

        // Store the image as an owner-scoped canonical reference before the
        // callable runs. The backend then verifies the bucket and owner rather
        // than fetching a client-supplied URL.
        const firstFrame = await CreativeStorageService.uploadReferenceMedia(userId, item.url, 'image');
        const cloudPayload: Record<string, unknown> = {
            prompt,
            model: INTELLIGENCE_MODELS.VIDEO.GENERATION,
            firstFrame,
            options: { aspectRatio },
        };

        try {
            const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');
            const response = await triggerVideoJob(cloudPayload);
            return response.data as { success: boolean; jobId?: string; error?: string };
        } catch (err: unknown) {
            logger.error('[VideoDirector] Cloud Function Error:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Video generation failed' };
        }
    }
}
