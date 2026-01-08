import React from 'react';
import { StudioToolbar } from '@/components/studio/StudioToolbar';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { Film, Clapperboard, Scissors } from 'lucide-react';

export default function VideoNavbar() {
    const { viewMode, setViewMode } = useVideoEditorStore();

    return (
        <div className="flex flex-col z-20 relative bg-[#0a0a0a] border-b border-white/5">
            <StudioToolbar
                className="bg-[#0a0a0a]"
                left={
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-bold text-blue-500 tracking-widest uppercase whitespace-nowrap flex items-center gap-2">
                            <Clapperboard size={14} /> indiiOS Video
                        </h1>
                        <div className="h-4 w-px bg-white/10"></div>
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                            Production Studio
                        </span>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        {/* Future controls for export/settings could go here */}
                    </div>
                }
            >
                <div
                    className="flex bg-white/5 p-1 rounded-lg border border-white/5 mx-auto"
                    role="group"
                    aria-label="View Mode"
                >
                    <button
                        onClick={() => setViewMode('director')}
                        aria-pressed={viewMode === 'director'}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'director'
                                ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Film size={12} /> Director
                    </button>
                    <button
                        onClick={() => setViewMode('editor')}
                        aria-pressed={viewMode === 'editor'}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'editor'
                                ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Scissors size={12} /> Editor
                    </button>
                </div>
            </StudioToolbar>
        </div>
    );
}
