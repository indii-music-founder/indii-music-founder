import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { SchemaType } from 'firebase/ai';
import { AI } from '@/services/ai/AIService';
import { useStore, HistoryItem } from '@/core/store';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI_MODELS } from '@/core/config/ai-models';

export class VideoDirector {
    static async processGeneratedVideo(uri: string, prompt: string, enableDirectorsCut = false, isRetry = false, retryCount = 0): Promise<string | null> {
        // ... (existing logic)
        const MAX_DIRECTORS_CUT_RETRIES = 2;

        try {
            // ... (existing logic)
            if (enableDirectorsCut && !isRetry && retryCount < MAX_DIRECTORS_CUT_RETRIES) {
                // ... (existing logic)
                if (typeof feedback.score === 'number' && feedback.score < 8) {
                    throw { retry: true, refinedPrompt: feedback.refined_prompt, nextRetryCount: retryCount + 1 };
                }
            }

            return this.saveVideo(url, prompt, isRetry);

        } catch (e: any) {
            if (e.retry) throw e; // Propagate retry signal
            return null;
        }
    }

    private static saveVideo(url: string, prompt: string, isRetry: boolean): string {
        const id = crypto.randomUUID();
        const metaLabel = isRetry ? 'DIRECTOR\'S CUT (V2)' : undefined;

        useStore.getState().addToHistory({
            id,
            url,
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
    static async triggerAnimation(item: HistoryItem): Promise<{ success: boolean; error?: string }> {
        const triggerVideoGeneration = httpsCallable(functions, 'triggerVideoGeneration');
        const response = await triggerVideoGeneration({
            image: item.url,
            prompt: item.prompt || 'Animate this scene',
            model: AI_MODELS.VIDEO.GENERATION
        });
        return response.data as { success: boolean; error?: string };
    }
}
