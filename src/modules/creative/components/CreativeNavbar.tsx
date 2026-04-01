import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ScreenControl } from '@/services/screen/ScreenControlService';
import { Sparkles, Image as ImageIcon, Video, MonitorPlay, MessageSquare, Palette, PanelLeftClose, PanelRightClose, Maximize2, Clock } from 'lucide-react';
import PromptBuilder from './PromptBuilder';
import ImageSubMenu from './ImageSubMenu';
import DaisyChainControls from './DaisyChainControls';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import PromptHistoryDrawer from './PromptHistoryDrawer';
import FrameSelectionModal from '../../video/components/FrameSelectionModal';

interface CreativeNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function CreativeNavbar(props: CreativeNavbarProps) {
    const {
        setVideoInput,
        prompt,
        setPrompt,
        generationMode,
        viewMode,
        setViewMode
    } = useStore(useShallow(state => ({
        setVideoInput: state.setVideoInput,
        prompt: state.prompt,
        setPrompt: state.setPrompt,
        generationMode: state.generationMode,
        viewMode: state.viewMode,
        setViewMode: state.setViewMode
    })));
    const toast = useToast();
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showBrandAssets, setShowBrandAssets] = useState(false);
    const [showPromptHistory, setShowPromptHistory] = useState(false);
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    return (
        <div {...props} className={`flex flex-col z-20 relative bg-[#0a0a0a] border-b border-white/5 select-none ${props.className || ''}`}>
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 h-14 gap-2">
                {/* Left: Branding & Title */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
                        <Palette size={16} className="text-purple-400" />
                        <h1 className="text-sm font-bold text-gray-200 tracking-tight hidden sm:block">Creative Director</h1>
                    </div>
                    {/* Divider */}
                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    {/* View Mode Switcher (Compact Segmented Control) */}
                    <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setViewMode('gallery')}
                            data-testid="gallery-view-btn"
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'gallery' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Gallery
                        </button>
                        <button
                            onClick={() => setViewMode('canvas')}
                            data-testid="canvas-view-btn"
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'canvas' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Canvas
                        </button>
                        {generationMode === 'video' && (
                            <button
                                onClick={() => setViewMode('video_production')}
                                data-testid="director-view-btn"
                                className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'video_production' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Director
                            </button>
                        )}
                        <button
                            onClick={() => setViewMode('direct')}
                            data-testid="direct-view-btn"
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'direct' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Direct
                        </button>
                        <button
                            onClick={() => setViewMode('lab')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'lab' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Lab
                        </button>
                        <button
                            onClick={() => setViewMode('release')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'release' ? 'bg-emerald-500/20 text-emerald-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Release
                        </button>
                    </div>
                </div>

                {/* Right: Context Controls & Utilities — hidden on mobile (desktop power-user features) */}
                <div className="hidden md:flex items-center gap-3">
                    {generationMode === 'image' ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                                data-testid="builder-btn"
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-[10px] font-medium uppercase tracking-wide
                                    ${showPromptBuilder
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                <MessageSquare size={12} /> Builder
                            </button>
                            <button
                                onClick={() => setShowBrandAssets(!showBrandAssets)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-[10px] font-medium uppercase tracking-wide
                                    ${showBrandAssets
                                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                <Sparkles size={12} /> Brand
                            </button>
                            <button
                                onClick={() => setShowPromptHistory(!showPromptHistory)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-[10px] font-medium uppercase tracking-wide
                                    ${showPromptHistory
                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                <Clock size={12} /> Library
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <DaisyChainControls
                                onOpenFrameModal={(target) => {
                                    setFrameModalTarget(target);
                                    setShowFrameModal(true);
                                }}
                            />
                        </div>
                    )}

                    {/* Main Systems Status */}
                    <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5" title="AI Systems Status">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest hidden lg:block">ONLINE</span>
                    </div>

                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    {/* Projector */}
                    <button
                        onClick={async () => {
                            const granted = await ScreenControl.requestPermission();
                            if (granted) {
                                ScreenControl.openProjectorWindow(window.location.href);
                            } else {
                                toast.error('Screen Control API not supported or permission denied.');
                            }
                        }}
                        title="Open Projector"
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                    >
                        <MonitorPlay size={14} />
                    </button>
                </div>
            </div>

            {/* Prompt Builder Drawer */}
            {showPromptBuilder && (
                <PromptBuilder onAddTag={(tag) => setPrompt(prompt ? `${prompt}, ${tag}` : tag)} />
            )}

            {/* Brand Assets Drawer */}
            {showBrandAssets && (
                <BrandAssetsDrawer onClose={() => setShowBrandAssets(false)} />
            )}

            {/* Prompt History Drawer */}
            {showPromptHistory && (
                <PromptHistoryDrawer onClose={() => setShowPromptHistory(false)} />
            )}

            <FrameSelectionModal
                isOpen={showFrameModal}
                onClose={() => setShowFrameModal(false)}
                onSelect={(image) => setVideoInput(frameModalTarget, image)}
                target={frameModalTarget}
            />
        </div>
    );
}
