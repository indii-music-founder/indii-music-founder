/**
 * AudioService handles playback of generated agent speech.
 * It manages a queue to ensure agents speak sequentially and provides a global toggle.
 */
export class AudioService {
    private static instance: AudioService;
    private isEnabled: boolean = true;
    private queue: Array<{ data: string; mimeType: string; resolve: () => void; reject: (err: any) => void }> = [];
    private isProcessing: boolean = false;
    private currentAudio: HTMLAudioElement | null = null;

    private constructor() {
        // Set volume and initial state
    }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    /**
     * Enable or disable all audio playback
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.stop();
            this.queue = [];
        }
    }

    /**
     * Schedule audio for playback. Returns a promise that resolves when playback finishes.
     */
    async play(base64Data: string, mimeType: string = 'audio/mp3'): Promise<void> {
        if (!this.isEnabled) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ data: base64Data, mimeType, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Stop current playback and clear queue
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.isProcessing = false;
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue.shift();

        if (!item) {
            this.isProcessing = false;
            return;
        }

        try {
            const audio = new Audio(`data:${item.mimeType};base64,${item.data}`);
            this.currentAudio = audio;

            audio.onended = () => {
                this.currentAudio = null;
                this.isProcessing = false;
                item.resolve();
                this.processQueue();
            };

            audio.onerror = (e) => {
                console.error('[AudioService] Playback error:', e);
                this.currentAudio = null;
                this.isProcessing = false;
                item.reject(e);
                this.processQueue();
            };

            await audio.play();
        } catch (error) {
            console.error('[AudioService] Failed to play audio:', error);
            this.isProcessing = false;
            item.reject(error);
            this.processQueue();
        }
    }
}

export const audioService = AudioService.getInstance();
