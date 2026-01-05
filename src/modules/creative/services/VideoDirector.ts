import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI } from '@/services/ai/AIService';
import { useStore, HistoryItem } from '@/core/store';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI_MODELS } from '@/core/config/ai-models';

export class VideoDirector {
    static async processGeneratedVideo(uri: string, prompt: string, enableDirectorsCut = false, isRetry = false): Promise<string | null> {
        // Note: In a real scenario, we'd fetch the video blob. 
        // For this demo/port, we assume 'uri' is accessible or a data URI.
        // If it's a remote URL, we might need a proxy or CORS handling if not on same origin.

        try {
            // 1. Fetch Video
            // const res = await fetch(uri); // Assuming URI is fetchable
            // const blob = await res.blob();
            // const url = URL.createObjectURL(blob);

            // SIMPLIFICATION: We'll assume 'uri' is the URL we can use directly for now.
            const url = uri;

            if (enableDirectorsCut && !isRetry) {
                console.info("🎬 Director QA Started...");

                // 2. Extract Frame for Critique
                const frameBase64 = await this.extractFrame(url);
                if (!frameBase64) {
                    console.warn("Could not extract frame for QA.");
                    return this.saveVideo(url, prompt, isRetry);
                }

                // 3. Critique
                const critiquePrompt = `You are a film director. Rate this video frame 1-10 based on the prompt: "${prompt}". If score < 8, provide a technically improved prompt to fix it.`;
                import { SchemaType } from 'firebase/ai';

                // ... existing code ...

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
                // FirebaseAIService expects Record<string, any> or Schema.
                const feedback = await firebaseAI.generateStructuredData<DirectorFeedback>(
                    [
                        { inlineData: { mimeType: 'image/jpeg', data: frameBase64.split(',')[1] } },
                        { text: critiquePrompt }
                    ],
                    schema,
                    undefined,
                    `You are a master cinematographer. Analyze the provided image.`
                );

                console.info("🎬 Director Feedback:", feedback);

                if (typeof feedback.score === 'number' && feedback.score < 8) {
                    console.info("🎬 Director Rejected. Reshooting...");
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

        } catch (e: any) {
            if (e.retry) throw e; // Propagate retry signal
            console.error("Video Processing Error:", e);
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
