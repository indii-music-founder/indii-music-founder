/**
 * AudioService handles playback of generated agent speech.
 * It manages a queue to ensure agents speak sequentially and provides a global toggle.
 */

/** Thrown when playback is interrupted by an explicit stop()/mute, so
 *  callers can distinguish "the user stopped me" from real failures. */
export class AudioPlaybackInterruptedError extends Error {
    constructor() {
        super('Audio playback stopped');
        this.name = 'AudioPlaybackInterruptedError';
    }
}

interface QueueItem {
    source: string;
    mimeType: string;
    sourceType: 'base64' | 'url';
    resolve: () => void;
    reject: (err: unknown) => void;
}

export class AudioService {
    private static instance: AudioService;
    private isEnabled: boolean = true;
    private queue: QueueItem[] = [];
    private isProcessing: boolean = false;
    private currentAudio: HTMLAudioElement | null = null;
    private currentItem: QueueItem | null = null;

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
            this.queue.push({ source: base64Data, mimeType, sourceType: 'base64', resolve, reject });
            this.processQueue();
        });
    }

    /** Schedule a resolved Storage/download URL for playback without base64 expansion. */
    async playUrl(url: string, mimeType: string = 'audio/wav'): Promise<void> {
        if (!this.isEnabled) return;
        if (!/^https?:\/\//i.test(url) && !url.startsWith('blob:')) {
            throw new Error('Audio playback URL must use HTTPS or blob protocol');
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ source: url, mimeType, sourceType: 'url', resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Stop current playback and clear queue. Every pending play()/playUrl()
     * promise is rejected with AudioPlaybackInterruptedError so callers are
     * never left awaiting a promise that can never settle.
     */
    stop() {
        const error = new AudioPlaybackInterruptedError();

        const current = this.currentItem;
        this.currentItem = null;

        if (this.currentAudio) {
            const element = this.currentAudio;
            // Detach handlers so the stopped element can never drive the queue.
            element.onended = null;
            element.onerror = null;
            element.pause();
            this.currentAudio = null;
        }

        this.isProcessing = false;

        if (current) {
            current.reject(error);
        }

        const remaining = this.queue;
        this.queue = [];
        for (const item of remaining) {
            item.reject(error);
        }
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue.shift();

        if (!item) {
            this.isProcessing = false;
            return;
        }

        this.currentItem = item;

        try {
            const source = item.sourceType === 'url'
                ? item.source
                : `data:${item.mimeType};base64,${item.source}`;
            const audio = new Audio(source);
            this.currentAudio = audio;

            const settle = (error?: unknown) => {
                if (this.currentItem !== item) return; // Already settled (e.g. by stop()).
                this.currentItem = null;
                this.currentAudio = null;
                this.isProcessing = false;
                if (error) {
                    item.reject(error);
                } else {
                    item.resolve();
                }
                this.processQueue();
            };

            audio.onended = () => settle();
            audio.onerror = (e) => settle(e);

            await audio.play();
        } catch (error: unknown) {
            // If stop() already settled this item, do nothing.
            if (this.currentItem !== item) return;
            this.currentItem = null;
            this.currentAudio = null;
            this.isProcessing = false;
            item.reject(error);
            this.processQueue();
        }
    }
}

export const audioService = AudioService.getInstance();
