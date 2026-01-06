import { AI } from '@/services/ai/AIService';
import { audioService } from '@/services/audio/AudioService';

export class VoiceService {
    private recognition: any | null = null;
    private isListening: boolean = false;

    private get synthesis(): SpeechSynthesis | null {
        if (typeof window === 'undefined') return null;
        const globalSynthesis = (global as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
        return window.speechSynthesis || globalSynthesis || null;
    }

    constructor() {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as unknown as { SpeechRecognition: new () => any }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: new () => any }).webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
        } else {
            // Speech Recognition API not supported in this browser
        }
    }

    startListening(onResult: (text: string) => void, onError?: (error: any) => void) {
        if (!this.recognition) return;

        if (this.isListening) {
            this.stopListening();
        }

        this.isListening = true;

        this.recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
            this.isListening = false;
        };

        this.recognition.onerror = (event: any) => {
            if (onError) onError(event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        try {
            this.recognition.start();
        } catch (e) {
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
            const response = await AI.generateSpeech(text, voiceName || 'Kore');
            await audioService.play(response.audio.inlineData.data, response.audio.inlineData.mimeType);
        } catch {
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
