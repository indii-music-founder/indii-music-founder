import React, { useState, useEffect } from 'react';
import { Sparkles, Video, Mic } from 'lucide-react';
import { useStore } from '@/core/store';

interface DirectorPromptBarProps {
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
}

export const DirectorPromptBar: React.FC<DirectorPromptBarProps> = ({
    prompt,
    onPromptChange,
    onGenerate,
    isGenerating
}) => {
    return (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-20">
            {/* Glass Container */}
            <div className="glass rounded-xl p-1.5 flex items-center gap-2 shadow-2xl shadow-black/50 border border-white/10 transition-all hover:border-white/20 hover:bg-black/50">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5 text-yellow-400">
                    <Video size={18} />
                </div>

                {/* Input */}
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder="Describe your scene (e.g. 'Cyberpunk street styling, rain, neon lights')..."
                    className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-sm font-medium h-10 px-2"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
                            onGenerate();
                        }
                    }}
                />

                {/* Microphone (Visual Only for now) */}
                <button
                    className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    title="Voice Input (Coming Soon)"
                >
                    <Mic size={16} />
                </button>

                {/* Generate Button */}
                <button
                    onClick={onGenerate}
                    disabled={!prompt.trim() || isGenerating}
                    className={`
                        h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${!prompt.trim() || isGenerating
                            ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-[0_0_15px_rgba(147,51,234,0.5)] border border-purple-500/30'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <Sparkles size={14} className="animate-spin" />
                            <span>Action...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} />
                            <span>Generate</span>
                        </>
                    )}
                </button>
            </div>

            {/* Helper Text */}
            <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                    Director Mode Active
                </span>
            </div>
        </div>
    );
};
