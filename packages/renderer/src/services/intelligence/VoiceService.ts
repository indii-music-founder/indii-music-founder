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
    onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
    onerror: ((event: { error: unknown }) => void) | null;
    onend: (() => void) | null;
}

export class VoiceService {
    private recognition: SpeechRecognitionInstance | null = null;
    private isListening: boolean = false;

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

        this.recognition.onresult = (event: { results: { transcript: string }[][] }) => {
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
