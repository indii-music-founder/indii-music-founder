
export class VoiceService {
    private recognition: any | null = null;
    private synthesis: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
    private isListening: boolean = false;

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
            this.isListening = false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    speak(text: string, voiceName?: string) {
        if (!this.synthesis) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Select voice if available
        const voices = this.synthesis.getVoices();
        // Prefer a natural sounding English voice
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha')) || voices[0];

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    isSupported() {
        return !!this.recognition;
    }
}

export const voiceService = new VoiceService();
