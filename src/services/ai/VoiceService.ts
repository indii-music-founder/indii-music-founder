import { AI } from '@/services/ai/AIService';
import { audioService } from '@/services/audio/AudioService';

export class VoiceService {
    private recognition: any | null = null;
    private isListening: boolean = false;

    private get synthesis(): SpeechSynthesis | null {
        return typeof window !== 'undefined' ? (window.speechSynthesis || (global as any).speechSynthesis) : null;
    }

    constructor() {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
        } else {
            console.warn('Speech Recognition API not supported in this browser.');
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
            console.error('Speech recognition error', event.error);
            if (onError) onError(event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start speech recognition", e);
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
            console.log(`[VoiceService] Generating high-quality speech for: "${text.substring(0, 30)}..." with voice: ${voiceName || 'Kore'}`);
            const response = await AI.generateSpeech(text, voiceName || 'Kore');
            await audioService.play(response.audio.inlineData.data, response.audio.inlineData.mimeType);
        } catch (error) {
            console.error('[VoiceService] Gemini TTS failed, falling back to browser:', error);
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
