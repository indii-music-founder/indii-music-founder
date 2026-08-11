import React from 'react';
import { useStore } from '@/core/store';
import { ImageIcon, Video } from 'lucide-react';

const MODES = [
    { id: 'canvas', label: 'Image Studio', icon: ImageIcon, gen: 'image' as const },
    { id: 'video_production', label: 'Video Studio', icon: Video, gen: 'video' as const },
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
        <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full border border-white/10 p-0.5 md:p-1 shadow-md shrink-0">
            {MODES.map((mode) => {
                const isActive = viewMode === mode.id;
                const Icon = mode.icon;
                return (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleSelectMode(mode)}
                        aria-pressed={isActive}
                        data-testid={`canvas-mode-${mode.id}`}
                        className={`flex items-center gap-1.5 px-2.5 md:px-3.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all ${
                            isActive 
                                ? 'bg-white/20 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Icon size={13} className={isActive ? 'text-green-400' : 'opacity-70'} />
                        <span className={isActive ? 'block' : 'hidden sm:block'}>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
