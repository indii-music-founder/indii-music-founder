// Web Speech API type declarations (not in default TS lib)
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
interface SpeechRecognitionConstructor {
    new(): SpeechRecognition;
}
declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Video, Mic, MicOff } from 'lucide-react';

// ── Voice Input Button (Web Speech API) ──────────────────────────────────────

interface VoiceInputButtonProps {
    onTranscript: (text: string) => void;
}

function VoiceInputButton({ onTranscript }: VoiceInputButtonProps) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const startListening = useCallback(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            return; // Browser doesn't support speech recognition
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0]?.[0]?.transcript;
            if (transcript) {
                onTranscript(transcript);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onerror = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [onTranscript]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
        };
    }, []);

    const supported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!supported) return null;

    return (
        <button
            onClick={isListening ? stopListening : startListening}
            className={`p-2 transition-colors rounded-lg hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-dept-creative/50 outline-none ${isListening ? 'text-red-400 animate-pulse' : 'text-gray-500 hover:text-white'
                }`}
            title={isListening ? 'Stop listening' : 'Voice input'}
            aria-label={isListening ? 'Stop listening' : 'Voice input'}
            type="button"
        >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
    );
}

// ── Director Prompt Bar ──────────────────────────────────────────────────────

interface DirectorPromptBarProps {
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onGenerate: (prompt: string) => void;
    isGenerating: boolean;
}

export const DirectorPromptBar: React.FC<DirectorPromptBarProps> = ({
    prompt,
    onPromptChange,
    onGenerate,
    isGenerating
}) => {
    // ⚡ Bolt Optimization: Local state to prevent parent re-renders on every keystroke
    const [localValue, setLocalValue] = useState(prompt);
    const lastEmitted = React.useRef(prompt);

    // Sync from parent (e.g. pendingPrompt or history)
    useEffect(() => {
        if (prompt !== lastEmitted.current && prompt !== localValue) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocalValue(prompt);
            lastEmitted.current = prompt; // Sync ref manually
        }
    }, [prompt, localValue]);

    // Debounce updates to parent
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== lastEmitted.current) {
                lastEmitted.current = localValue;
                onPromptChange(localValue);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localValue, onPromptChange]);

    const handleGenerate = () => {
        onGenerate(localValue);
    };

    return (
        <div className="w-full max-w-2xl mx-auto z-20 relative">
            {/* Glass Container */}
            <div className="glass rounded-xl p-1.5 flex items-center gap-2 shadow-2xl shadow-black/50 border border-white/10 transition-all hover:border-white/20 hover:bg-black/50">
                {/* Icon */}
                <div
                    className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5 text-dept-creative"
                    aria-hidden="true"
                >
                    <Video size={18} />
                </div>

                {/* Input */}
                <input
                    type="text"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    data-testid="director-prompt-input"
                    placeholder="Describe your scene (e.g. 'Cyberpunk street styling, rain, neon lights')..."
                    aria-label="Describe your scene"
                    className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 focus-visible:ring-2 focus-visible:ring-dept-creative/50 rounded-sm text-sm font-medium h-10 px-2"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && localValue.trim()) {
                            handleGenerate();
                        }
                    }}
                />

                {/* Voice Input via Web Speech API */}
                <VoiceInputButton onTranscript={(text) => setLocalValue(prev => prev ? `${prev} ${text}` : text)} />

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    data-testid="video-generate-btn"
                    disabled={!localValue.trim() || isGenerating}
                    aria-label={isGenerating ? "Generating video..." : "Generate video"}
                    className={`
                        h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all focus-visible:ring-2 focus-visible:ring-dept-creative/50 outline-none
                        ${!localValue.trim() || isGenerating
                            ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                            : 'bg-dept-creative text-white hover:shadow-[0_0_15px_var(--color-dept-creative-glow)] border border-dept-creative/30'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <Sparkles size={14} className="animate-spin" aria-hidden="true" />
                            <span>Action...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} aria-hidden="true" />
                            <span>Generate</span>
                        </>
                    )}
                </button>
            </div>

            {/* Helper Text */}
            <div className="mt-2 text-center" aria-live="polite">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-dept-creative animate-pulse" aria-hidden="true"></span>
                    Director Mode Active
                </span>
            </div>
        </div>
    );
};
