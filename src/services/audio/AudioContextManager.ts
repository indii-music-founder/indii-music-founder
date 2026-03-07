import { logger } from '@/utils/logger';

/**
 * Requirement 164: Mobile Web Audio Context Fixes
 * Deep optimizations to ensure `Essentia.js` and AudioContext don't kill mobile browser threads.
 * Uses a singleton pattern to aggressively suspend/resume contexts when inactive.
 */

export class AudioContextManager {
    private static instance: AudioContextManager;
    private context: AudioContext | null = null;
    private isInitialized = false;

    private constructor() {
        // Handle background/foreground visibility changes
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
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
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
            } catch (error) {
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
            } catch (error) {
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

    /**
     * Automatically suspend AudioContext when the user tabs away,
     * and resume when they come back (if it was previously running).
     */
    private handleVisibilityChange() {
        if (!this.isInitialized || !this.context) return;

        if (document.visibilityState === 'hidden') {
            // Only suspend if we aren't currently playing background audio via other means
            // If the user is actively playing a song, we might want to skip this.
            // For analysis tasks (Essentia), we always suspend.
            logger.debug('[AudioContextManager] Page hidden, suspending AudioContext...');
            this.suspend();
        } else if (document.visibilityState === 'visible') {
            logger.debug('[AudioContextManager] Page visible, resuming AudioContext...');
            this.resume();
        }
    }
}

export const audioContextManager = AudioContextManager.getInstance();