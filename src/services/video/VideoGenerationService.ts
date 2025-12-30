import { functions, db } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface VideoJob {
    id: string;
    prompt: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
    createdAt: number;
    updatedAt?: number;
}

export interface VideoGenerationOptions {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: '5s' | '10s';
    style?: string;
}

class VideoGenerationServiceImpl {
    /**
     * Triggers a video generation job via Cloud Functions.
     * Returns the jobId for tracking.
     */
    async generateVideo(prompt: string, options: VideoGenerationOptions = {}): Promise<string> {
        const jobId = uuidv4();
        const triggerFn = httpsCallable(functions, 'triggerVideoJob');

        try {
            await triggerFn({
                jobId,
                prompt,
                ...options
            });
            return jobId;
        } catch (error) {
            console.error('[VideoGenerationService] Failed to trigger job:', error);
            throw error;
        }
    }

    /**
     * Subscribes to the status of a specific video job.
     * Returns an unsubscribe function.
     */
    subscribeToJob(jobId: string, callback: (job: VideoJob | null) => void): Unsubscribe {
        const jobRef = doc(db, 'videoJobs', jobId);

        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                callback({
                    id: snapshot.id,
                    prompt: data.prompt, // Note: Ensure prompt is saved in trigger or update
                    status: data.status,
                    videoUrl: data.videoUrl,
                    error: data.error,
                    createdAt: data.createdAt?.toMillis() || Date.now(),
                    updatedAt: data.updatedAt?.toMillis()
                } as VideoJob);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error(`[VideoGenerationService] Subscription error for ${jobId}:`, error);
        });
    }

    /**
     * One-off check for job status (polling alternative)
     */
    async getJobStatus(jobId: string): Promise<VideoJob | null> {
        return new Promise((resolve, reject) => {
            const unsub = this.subscribeToJob(jobId, (job) => {
                unsub();
                resolve(job);
            });
        });
    }
}

export const VideoGenerationService = new VideoGenerationServiceImpl();
