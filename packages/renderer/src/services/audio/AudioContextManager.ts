import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';

/**
 * Requirement 164: Mobile Web Audio Context Fixes
 * Deep optimizations to ensure `Essentia.js` and AudioContext don't kill mobile browser threads.
 * Uses a singleton pattern to aggressively suspend/resume contexts when inactive.
 */

export class AudioContextManager {
    private static instance: AudioContextManager;
    private context: AudioContext | null = null;
    private isInitialized = false;
    private resumeAfterVisibility = false;
    private readonly visibilityChangeHandler = () => { void this.handleVisibilityChange(); };

    private constructor() {
        // Handle background/foreground visibility changes
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        }
    }

    public static getInstance(): AudioContextManager {
        if (!AudioContextManager.instance) {
            AudioContextManager.instance = new AudioContextManager();
        }
        return AudioContextManager.instance;
    }

    /**
     * Lazily initializes the AudioContext. Must be called upon user interaction.
     */
    public initialize(): AudioContext {
        if (this.context) {
            if (this.context.state === 'suspended') {
                this.context.resume().catch(e => logger.warn('[AudioContextManager] Failed to resume on initialize', e));
            }
            return this.context;
        }

        logger.info('[AudioContextManager] Initializing shared AudioContext...');

        // Use standard or prefixed AudioContext (for Safari)
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContextClass();
        this.isInitialized = true;

        return this.context;
    }

    /**
     * Aggressively suspends the audio context.
     * Crucial for mobile iOS where active contexts drain battery and lock threads.
     */
    public async suspend(): Promise<void> {
        if (this.context && this.context.state === 'running') {
            try {
                await this.context.suspend();
                logger.debug('[AudioContextManager] AudioContext suspended to save resources.');
            } catch (error: unknown) {
                logger.error('[AudioContextManager] Failed to suspend context', error);
            }
        }
    }

    /**
     * Resumes the audio context when playback/analysis is needed again.
     */
    public async resume(): Promise<void> {
        if (this.context && this.context.state === 'suspended') {
            try {
                await this.context.resume();
                logger.debug('[AudioContextManager] AudioContext resumed.');
            } catch (error: unknown) {
                logger.error('[AudioContextManager] Failed to resume context', error);
            }
        }
    }

    /**
     * Returns the active context, or throws if not initialized.
     */
    public getContext(): AudioContext {
        if (!this.context) {
            throw new Error('AudioContext has not been initialized. Call initialize() first upon user interaction.');
        }
        return this.context;
    }

    /** Remove global resources during HMR/tests or an explicit app teardown. */
    public async dispose(): Promise<void> {
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        }
        this.resumeAfterVisibility = false;
        if (this.context && this.context.state !== 'closed') {
            try {
                await this.context.close();
            } catch (error) {
                logger.warn('[AudioContextManager] Failed to close context during teardown', error);
            }
        }
        this.context = null;
        this.isInitialized = false;
    }

    /**
     * Automatically suspend AudioContext when the user tabs away,
     * and resume when they come back (if it was previously running).
     */
    private async handleVisibilityChange(): Promise<void> {
        if (!this.isInitialized || !this.context) return;

        if (document.visibilityState === 'hidden') {
            // The PIP player routes its media element through this context's
            // graph, so suspending here would silently mute music that the
            // user is actively playing. Background playback keeps running;
            // only idle contexts are suspended.
            if (useStore.getState().isPlaying) return;

            // Only suspend if we aren't currently playing background audio via other means
            // If the user is actively playing a song, we might want to skip this.
            // For analysis tasks (Essentia), we always suspend.
            this.resumeAfterVisibility = this.context.state === 'running';
            if (this.resumeAfterVisibility) {
                logger.debug('[AudioContextManager] Page hidden, suspending AudioContext...');
                await this.suspend();
            }
        } else if (document.visibilityState === 'visible' && this.resumeAfterVisibility) {
            this.resumeAfterVisibility = false;
            logger.debug('[AudioContextManager] Page visible, resuming AudioContext...');
            await this.resume();
        }
    }
}

export const audioContextManager = AudioContextManager.getInstance();

if (import.meta.hot) {
    import.meta.hot.dispose(() => { void audioContextManager.dispose(); });
}
