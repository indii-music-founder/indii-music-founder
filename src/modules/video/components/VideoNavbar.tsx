import React from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { Film, Clapperboard, Scissors, MonitorPlay } from 'lucide-react';
import { ScreenControl } from '@/services/screen/ScreenControlService';

export default function VideoNavbar() {
    const { viewMode, setViewMode } = useVideoEditorStore();

    return (
        <div className="flex flex-col z-20 relative bg-[#0a0a0a] border-b border-white/5 select-none text-gray-200">
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-4 py-2 h-14">
                {/* Left: Branding & Title */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Clapperboard size={16} className="text-blue-500" />
                        <h1 className="text-sm font-bold text-gray-200 tracking-tight">Video Producer</h1>
                    </div>
                    {/* Divider */}
                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    {/* View Mode Switcher (Compact Segmented Control) */}
                    <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                        <button
                            onClick={() => setViewMode('director')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'director' ? 'bg-blue-500/20 text-blue-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Film size={12} /> Director
                        </button>
                        <button
                            onClick={() => setViewMode('editor')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'editor' ? 'bg-blue-500/20 text-blue-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Scissors size={12} /> Editor
                        </button>
                    </div>
                </div>

                {/* Right: Context Controls & Utilities */}
                <div className="flex items-center gap-3">
                    {/* Divider */}
                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    {/* Projector */}
                    <button
                        onClick={async () => {
                            const granted = await ScreenControl.requestPermission();
                            if (granted) {
                                ScreenControl.openProjectorWindow(window.location.href);
                            } else {
                                alert("Screen Control API not supported or permission denied.");
                            }
                        }}
                        title="Open Projector"
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                    >
                        <MonitorPlay size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
