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
    onstart: (() => void) | null;
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

/** Joins two recognized fragments, keeping Chrome's usual trailing space but never fusing words. */
function joinTranscripts(a: string, b: string): string {
    if (!a) return b;
    if (!b) return a;
    return /\s$/.test(a) ? a + b : `${a} ${b}`;
}

export class VoiceService {
    private recognition: SpeechRecognitionInstance | null = null;
    private isListening: boolean = false;
    private isDictating: boolean = false;
    private stopRequested: boolean = false;
    private engineRunning: boolean = false;
    private activeHandlers: DictationHandlers | null = null;
    private pendingHandlers: DictationHandlers | null = null;

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

        // A live dictation session owns the shared engine. A legacy single-shot
        // listen supersedes it so the two modes can never cross-wire handlers
        // (previously this silently detached the dictation session and left its
        // UI "listening" forever).
        if (this.isDictating || this.pendingHandlers) {
            const owner = this.activeHandlers ?? this.pendingHandlers;
            owner?.onSuperseded?.();
            this.activeHandlers = null;
            this.pendingHandlers = null;
            this.isDictating = false;
            this.stopRequested = false;
            if (this.engineRunning) {
                try { this.recognition.stop(); } catch { /* already stopping */ }
            }
        }

        if (this.isListening) {
            this.stopListening();
        }

        // Single-shot config: a previous dictation session may have left the
        // engine in continuous mode, which would keep firing after the first
        // result and never self-end.
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.isListening = true;

        this.recognition.onstart = () => {
            this.engineRunning = true;
        };
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
            this.engineRunning = false;
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
        if ((this.isDictating || this.pendingHandlers) && this.activeHandlers !== handlers) {
            const previous = this.activeHandlers ?? this.pendingHandlers;
            previous?.onSuperseded?.();
        }

        // Stop-in-flight window: a release calls stop(), and Chrome resolves it
        // asynchronously through onend. A start() issued before that throws
        // InvalidStateError, and a rebind would make the OLD session's onend
        // fire into the NEW session (natural-end for a session that never ran —
        // the classic release-then-quickly-talk-again dead mic). Queue instead:
        // onend starts this session the moment the engine is free.
        if (this.isDictating && this.stopRequested) {
            this.pendingHandlers = handlers;
            this.stopRequested = false;
            return true;
        }

        // Engine already live: rebind handlers to the newest owner without
        // restarting (never call start() on a running engine).
        if (this.isDictating) {
            this.activeHandlers = handlers;
            this.bindRecognition(handlers);
            return true;
        }

        return this.beginSession(handlers);
    }

    /** Starts (or restarts) the engine for a fresh dictation session. */
    private beginSession(handlers: DictationHandlers): boolean {
        const recognition = this.recognition;
        if (!recognition) return false;

        this.activeHandlers = handlers;
        this.pendingHandlers = null;
        this.stopRequested = false;
        this.isDictating = true;

        // Continuous talkback-style dictation: keeps listening across phrases
        // and streams interim results while the user speaks. The legacy
        // single-shot path restores its own config.
        recognition.continuous = true;
        recognition.interimResults = true;
        this.bindRecognition(handlers);

        try {
            recognition.start();
        } catch (e: unknown) {
            this.isDictating = false;
            this.engineRunning = false;
            this.activeHandlers = null;
            handlers.onError?.(e);
            return false;
        }
        return true;
    }

    /** Binds the shared instance's event handlers to the given session. */
    private bindRecognition(handlers: DictationHandlers) {
        const recognition = this.recognition;
        if (!recognition) return;

        let finalTranscript = '';
        // Chrome fires onerror('aborted') as a normal consequence of stop() —
        // and 'no-speech' when the user stays quiet. Neither is a failure.

        recognition.onstart = () => {
            this.engineRunning = true;
        };
        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]!;
                const transcript = result[0]!.transcript;
                if (result.isFinal) {
                    finalTranscript = joinTranscripts(finalTranscript, transcript);
                } else {
                    interim = joinTranscripts(interim, transcript);
                }
            }
            handlers.onFinal?.(finalTranscript);
            handlers.onInterim?.(interim.trim());
        };
        recognition.onerror = (event: { error: unknown }) => {
            const code = String(event.error ?? '');
            if (this.stopRequested && code === 'aborted') return; // expected after stop()
            if (code === 'no-speech' || code === 'aborted') return; // silence ends via onend
            handlers.onError?.(event.error);
        };
        recognition.onend = () => {
            this.engineRunning = false;
            const wasDictating = this.isDictating;
            const ended = this.activeHandlers;
            this.isDictating = false;
            this.activeHandlers = null;

            // A session queued during the stop-in-flight window now gets the
            // freed engine. The deposed session's onEnd is intentionally not
            // reported: its owner was already superseded.
            if (this.pendingHandlers) {
                const next = this.pendingHandlers;
                this.pendingHandlers = null;
                this.beginSession(next);
                return;
            }

            if (wasDictating) ended?.onEnd?.();
        };
    }

    /**
     * Gracefully ends dictation: stop() lets the engine flush any pending final
     * result, and the onend handler clears the flag and notifies subscribers.
     */
    stopDictation() {
        // A queued (not yet started) session is discarded too — it never owned
        // a live mic and must not start after the caller asked to stop.
        this.pendingHandlers = null;
        if (!this.recognition) return;
        if (this.isDictating && this.engineRunning) {
            this.stopRequested = true;
            this.recognition.stop();
        }
    }

    /**
     * Owner-scoped stop: only ends the session if the given handlers still own
     * the engine. Unmounting an idle TalkButton must never kill another
     * surface's live session.
     */
    stopDictationIfOwner(handlers: DictationHandlers) {
        if (this.activeHandlers === handlers || this.pendingHandlers === handlers) {
            this.stopDictation();
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
