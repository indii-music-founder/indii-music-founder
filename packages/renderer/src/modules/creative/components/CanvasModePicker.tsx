import React from 'react';
import { useStore } from '@/core/store';
import { ImageIcon, Video, Sparkles } from 'lucide-react';

const MODES = [
    { id: 'canvas', label: 'Image Studio', icon: ImageIcon, gen: 'image' as const },
    { id: 'video_production', label: 'Video Studio', icon: Video, gen: 'video' as const },
    { id: 'omni', label: 'Omni Remix', icon: Sparkles, gen: 'video' as const },
] as const;

export default function CanvasModePicker() {
    const viewMode = useStore(state => state.viewMode);
    const setViewMode = useStore(state => state.setViewMode);
    const setGenerationMode = useStore(state => state.setGenerationMode);

    const handleSelectMode = (mode: typeof MODES[number]) => {
        setViewMode(mode.id);
        setGenerationMode(mode.gen);
    };

    return (
        <div
            className="flex shrink-0 items-center rounded-xl border border-white/8 bg-black/60 p-0.5 shadow-lg backdrop-blur-md"
            data-testid="canvas-mode-picker"
            role="group"
            aria-label="Creative studio mode"
        >
            {MODES.map((mode) => {
                const isActive = viewMode === mode.id;
                const Icon = mode.icon;
                return (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleSelectMode(mode)}
                        aria-label={mode.label}
                        aria-pressed={isActive}
                        data-testid={`canvas-mode-${mode.id}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                            isActive 
                                ? 'bg-dept-creative/20 text-white border border-dept-creative/40 shadow-[0_0_12px_rgba(var(--color-dept-creative-rgb),0.15)]' 
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        <Icon size={13} className={isActive ? 'text-dept-creative' : 'opacity-70'} />
                        <span className={isActive ? 'block' : 'hidden sm:block'}>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
