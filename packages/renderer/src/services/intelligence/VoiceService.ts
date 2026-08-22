import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { audioService, AudioPlaybackInterruptedError } from '@/services/audio/AudioService';
import { useStore } from '@/core/store';
import { PersistedAudioMetadata } from '@/services/audio/AudioPersistenceService';

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error: unknown }) => void) | null;
    onend: (() => void) | null;
}

interface SpeechRecognitionResultLike {
    0: { transcript: string };
    isFinal: boolean;
}

interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface DictationHandlers {
    /** Cumulative FINAL transcript recognized so far (stable prefix). */
    onFinal?: (finalTranscript: string) => void;
    /** Unstable in-progress tail for the current phrase (empty when none). */
    onInterim?: (interimTranscript: string) => void;
    /** Recognition session ended (stop requested, silence timeout, or error). */
    onEnd?: () => void;
    onError?: (error: unknown) => void;
    /** Another surface started dictating and took over the shared engine. */
    onSuperseded?: () => void;
}

export class VoiceService {
    private recognition: SpeechRecognitionInstance | null = null;
    private isListening: boolean = false;
    private isDictating: boolean = false;
    private stopRequested: boolean = false;
    private activeHandlers: DictationHandlers | null = null;

    private get synthesis(): SpeechSynthesis | null {
        if (typeof window === 'undefined') return null;
        const globalSynthesis = (global as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
        return window.speechSynthesis || globalSynthesis || null;
    }

    constructor() {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as unknown as { SpeechRecognition: new () => SpeechRecognitionInstance }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            if (this.recognition) {
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.lang = 'en-US';
            }
        } else {
            // Speech Recognition API not supported in this browser
        }
    }

    startListening(onResult: (text: string) => void, onError?: (error: unknown) => void) {
        if (!this.recognition) return;

        if (this.isListening) {
            this.stopListening();
        }

        this.isListening = true;

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
            const transcript = event.results[0]![0]!.transcript;
            onResult(transcript);
            this.isListening = false;
        };

        this.recognition.onerror = (event: { error: unknown }) => {
            if (onError) onError(event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        try {
            this.recognition.start();
        } catch (e: unknown) {
            if (onError) onError(e);
            this.isListening = false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    /**
     * Continuous talkback-style dictation: keeps listening across phrases and
     * streams interim results while the user speaks. Unlike startListening
     * (single-shot, final-only), this session stays open until stopDictation()
     * or a recognition timeout — the TalkButton release model depends on it.
     *
     * Returns false when speech recognition is unavailable in this browser.
     */
    startDictation(handlers: DictationHandlers): boolean {
        if (!this.recognition) return false;

        // Session-owner model: several chat surfaces can mount a TalkButton at
        // once (floating overlay + docked panel). The newest click owns the
        // shared engine; the previous owner is told to stand down.
        if (this.isDictating && this.activeHandlers && this.activeHandlers !== handlers) {
            this.activeHandlers.onSuperseded?.();
        }
        this.activeHandlers = handlers;
        this.stopRequested = false;

        // Reuse the single recognition instance; flip it into continuous mode
        // for the session. The legacy single-shot path restores its own config.
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        let finalTranscript = '';
        // Chrome fires onerror('aborted') as a normal consequence of stop() —
        // and 'no-speech' when the user stays quiet. Neither is a failure.

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]!;
                const transcript = result[0]!.transcript;
                if (result.isFinal) {
                    finalTranscript += transcript;
                } else {
                    interim += transcript;
                }
            }
            handlers.onFinal?.(finalTranscript);
            handlers.onInterim?.(interim.trim());
        };
        this.recognition.onerror = (event: { error: unknown }) => {
            const code = String(event.error ?? '');
            if (this.stopRequested && code === 'aborted') return; // expected after stop()
            if (code === 'no-speech' || code === 'aborted') return; // silence ends via onend
            handlers.onError?.(event.error);
        };
        this.recognition.onend = () => {
            const wasDictating = this.isDictating;
            this.isDictating = false;
            this.activeHandlers = null;
            if (wasDictating) handlers.onEnd?.();
        };

        if (!this.isDictating) {
            this.isDictating = true;
            try {
                this.recognition.start();
            } catch (e: unknown) {
                this.isDictating = false;
                this.activeHandlers = null;
                handlers.onError?.(e);
                return false;
            }
        }
        return true; // engine running with THIS session's handlers bound
    }

    /**
     * Gracefully ends dictation: stop() lets the engine flush any pending final
     * result, and the onend handler clears the flag and notifies subscribers.
     */
    stopDictation() {
        if (this.recognition && this.isDictating) {
            this.stopRequested = true;
            this.recognition.stop();
        }
    }

    isDictatingActive() {
        return this.isDictating;
    }

    async speak(text: string, voiceName?: string) {
        // Stop current audio first
        audioService.stop();

        try {
            const response = await AutonomousIntelligence.generateSpeech(text, voiceName || 'Kore');
            await audioService.playUrl(response.audio.playbackUrl, response.audio.mimeType);

            // Persist generated audio to library if backend provided it
            if ('persistedAsset' in response && response.persistedAsset) {
                const asset: PersistedAudioMetadata = {
                    id: response.persistedAsset.id,
                    userId: '', // Will be set by service
                    type: 'tts',
                    prompt: text,
                    mimeType: response.audio.mimeType,
                    estimatedDuration: 0, // Will be calculated by backend
                    generatedAt: new Date().toISOString(),
                    storageUrl: response.persistedAsset.storageUrl,
                };
                const store = useStore.getState();
                await store.persistGeneratedAsset(asset);
            }
        } catch (err) {
            // User-initiated stop/mute is not a failure: stay silent instead
            // of falling back to system TTS the user just tried to silence.
            if (err instanceof AudioPlaybackInterruptedError) return;
            this.fallbackSpeak(text);
        }
    }

    private fallbackSpeak(text: string) {
        if (!this.synthesis) return;
        this.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        audioService.stop();
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    isSupported() {
        return !!this.recognition;
    }
}

export const voiceService = new VoiceService();
