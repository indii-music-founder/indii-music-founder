import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { SchemaType } from 'firebase/ai';
import { AI } from '@/services/ai/AIService';
import { useStore, HistoryItem } from '@/core/store';
import { functionsWest1 as functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI_MODELS } from '@/core/config/ai-models';
import { agentZeroService } from '@/services/agent/AgentZeroService';

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
    static async triggerAnimation(item: HistoryItem): Promise<{ success: boolean; error?: string; video_url?: string }> {
        const payload: any = {
            jobId: crypto.randomUUID(),
            prompt: item.prompt || 'Animate this scene',
            model: AI_MODELS.VIDEO.GENERATION,
            aspectRatio: '16:9', // Top level for Python API
            options: {
                aspectRatio: '16:9' // For Cloud Function
            }
        };

        let imageBytes = '';
        if (item.url.startsWith('data:')) {
            const parts = item.url.split(',');
            const mimeType = parts[0].split(':')[1].split(';')[0];
            imageBytes = parts[1];
            payload.image = {
                imageBytes: parts[1],
                mimeType: mimeType
            };
        } else {
            // Assume it's a URI
            payload.referenceImages = [
                {
                    image: { uri: item.url },
                    referenceType: "ASSET"
                }
            ];
            payload.imageBytes = item.url; // Use URL as identifier for local if needed
        }

        // --- Rewiring: Use local Python API in Electron ---
        if (typeof window !== 'undefined' && window.electronAPI) {
            console.log('[VideoDirector] Rewiring to local Python API for animation...');
            try {
                const apiPayload = {
                    ...payload,
                    imageBytes: imageBytes || item.url,
                    prompt: payload.prompt,
                    aspectRatio: '16:9',
                    duration: 4
                };

                const response = await agentZeroService.callApi('/video_gen', apiPayload) as any;

                if (response.status === 'ok' || response.success) {
                    return {
                        success: true,
                        video_url: response.video_url
                    };
                } else {
                    return {
                        success: false,
                        error: response.error || 'Local video generation failed'
                    };
                }
            } catch (err: any) {
                console.error('[VideoDirector] Local API Error:', err);
                // Fallback to Cloud Function if local API fails
            }
        }

        // --- Standard Path: Cloud Function ---
        const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');
        const response = await triggerVideoJob(payload);
        return response.data as { success: boolean; error?: string };
    }
}
