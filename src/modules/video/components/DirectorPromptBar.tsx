import React, { useState, useEffect } from 'react';
import { Sparkles, Video, Mic } from 'lucide-react';

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

    // Sync from parent (e.g. pendingPrompt or history) — deferred to avoid cascading renders
    useEffect(() => {
        if (prompt !== lastEmitted.current && prompt !== localValue) {
            queueMicrotask(() => {
                setLocalValue(prompt);
                lastEmitted.current = prompt; // Sync ref manually
            });
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
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-20">
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

                {/* Microphone (Visual Only for now) */}
                <button
                    className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-dept-creative/50 outline-none"
                    title="Voice Input (Coming Soon)"
                    aria-label="Voice Input (Coming Soon)"
                    type="button"
                >
                    <Mic size={16} />
                </button>

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
