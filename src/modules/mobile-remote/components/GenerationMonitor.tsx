/**
 * GenerationMonitor — Wired to real creative store state.
 * Shows the current generation status from creativeControlsSlice (isGenerating)
 * and the creative prompt when generating.
 */

import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Image, Loader2, Sparkles } from 'lucide-react';

export default function GenerationMonitor() {
    const {
        isGenerating,
        prompt,
        currentModule,
        isAgentProcessing,
    } = useStore(
        useShallow(state => ({
            isGenerating: state.isGenerating,
            prompt: state.prompt,
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
        }))
    );

    // Active generation in progress
    if (isGenerating) {
        return (
            <div className="space-y-3">
                <div className="flex items-start gap-3 px-3 py-4 rounded-xl bg-[#161b22]/60 border border-blue-600/30">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium">Generating…</p>
                        {prompt && (
                            <p className="text-[10px] text-[#8b949e] mt-1 truncate">
                                &ldquo;{prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt}&rdquo;
                            </p>
                        )}
                        <div className="mt-2 h-1 rounded-full bg-[#21262d] overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse w-2/3" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Agent processing in creative module (might produce a generation)
    if (isAgentProcessing && currentModule === 'creative') {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-900/20 border border-purple-600/30 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                </div>
                <p className="text-sm text-purple-400">Creative Director working…</p>
                <p className="text-xs text-[#484f58] mt-1">A generation may start soon</p>
            </div>
        );
    }

    // Empty state
    return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d]/40 flex items-center justify-center mb-3">
                <Image className="w-6 h-6 text-[#484f58]" />
            </div>
            <p className="text-sm text-[#6e7681]">No active generations</p>
            <p className="text-xs text-[#484f58] mt-1">
                Start one from the Creative module or use the Generate button
            </p>
        </div>
    );
}
