import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { audioService } from '@/services/audio/AudioService';
import { logger } from '@/utils/logger';

interface VoiceContextType {
    isVoiceEnabled: boolean;
    setVoiceEnabled: (enabled: boolean) => void;
    isListening: boolean;
    toggleListening: () => void;
    transcript: string;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    readonly length: number;
    [index: number]: {
        transcript: string;
        confidence: number;
    };
}

interface SpeechRecognitionEvent {
    resultIndex: number;
    results: {
        length: number;
        [index: number]: SpeechRecognitionResult;
    };
}

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: () => void;
    onend: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: { error: string }) => void;
    start: () => void;
    stop: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVoiceEnabled, setVoiceEnabledState] = useState(() => {
        // Voice is disabled by default for fresh sessions unless explicitly enabled
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('voice_enabled') === 'true';
    });

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    const setVoiceEnabled = (enabled: boolean) => {
        setVoiceEnabledState(enabled);
        localStorage.setItem('voice_enabled', enabled ? 'true' : 'false');
        audioService.setEnabled(enabled);
    };

    useEffect(() => {
        audioService.setEnabled(isVoiceEnabled);
    }, [isVoiceEnabled]);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognitionInstance = new SpeechRecognition() as SpeechRecognitionInstance;
                recognitionInstance.continuous = true;
                recognitionInstance.interimResults = true;
                recognitionInstance.lang = 'en-US';

                recognitionInstance.onstart = () => setIsListening(true);
                recognitionInstance.onend = () => setIsListening(false);
                recognitionInstance.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i]!.isFinal) {
                            finalTranscript += event.results[i]![0]!.transcript;
                        } else {
                            interimTranscript += event.results[i]![0]!.transcript;
                        }
                    }
                    setTranscript(finalTranscript || interimTranscript);
                };

                recognitionInstance.onerror = (event) => {
                    logger.error('Speech recognition error', event.error);
                    setIsListening(false);
                };

                recognitionRef.current = recognitionInstance;
            }
        }
    }, []);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) {
            logger.warn('Speech recognition not supported in this browser.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setTranscript('');
            recognitionRef.current.start();
        }
    }, [isListening]);

    return (
        <VoiceContext.Provider value={{
            isVoiceEnabled,
            setVoiceEnabled,
            isListening,
            toggleListening,
            transcript
        }}>
            {children}
        </VoiceContext.Provider>
    );
};

export const useVoice = () => {
    const context = useContext(VoiceContext);
    if (!context) throw new Error('useVoice must be used within VoiceProvider');
    return context;
};
