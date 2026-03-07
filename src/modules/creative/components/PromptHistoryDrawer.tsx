import React, { useMemo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, Search, RotateCw, Copy, Clock } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export default function PromptHistoryDrawer({ onClose }: { onClose: () => void }) {
    const { generatedHistory, setPrompt, setViewMode } = useStore(useShallow(state => ({
        generatedHistory: state.generatedHistory,
        setPrompt: state.setPrompt,
        setViewMode: state.setViewMode
    })));
    const toast = useToast();

    // Get unique prompts from history
    const uniquePrompts = useMemo(() => {
        const prompts = new Map<string, { text: string; timestamp: number; type: string }>();
        generatedHistory.forEach(item => {
            if (item.prompt && !prompts.has(item.prompt)) {
                prompts.set(item.prompt, {
                    text: item.prompt,
                    timestamp: item.timestamp,
                    type: item.type
                });
            }
        });
        return Array.from(prompts.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [generatedHistory]);

    const handleUsePrompt = (promptText: string) => {
        setPrompt(promptText);
        setViewMode('direct'); // Go to direct generation mode for easy re-rolling
        toast.success("Prompt loaded! Ready to re-roll.");
        onClose();
    };

    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#0f0f0f]/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={16} className="text-purple-400" />
                    Prompt History
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 pb-24">
                {uniquePrompts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-xs">
                        <Clock size={32} className="mb-2 opacity-10" />
                        No prompts in history
                    </div>
                ) : (
                    uniquePrompts.map((p, i) => (
                        <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-purple-500/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { navigator.clipboard.writeText(p.text); toast.success("Copied to clipboard"); }}
                                    className="p-1.5 bg-black/40 hover:bg-black/60 rounded text-gray-400 hover:text-white transition-colors"
                                    title="Copy Prompt"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>

                            <p className="text-xs text-gray-300 line-clamp-4 mb-4 leading-relaxed pr-6">
                                {p.text}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-gray-500 font-mono uppercase tracking-widest">{p.type}</span>
                                    <span className="text-[9px] text-gray-600 font-mono italic">
                                        {new Date(p.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleUsePrompt(p.text)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-dept-creative/20 hover:bg-dept-creative/30 text-dept-creative border border-dept-creative/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                                >
                                    <RotateCw size={12} /> Use Prompt
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
