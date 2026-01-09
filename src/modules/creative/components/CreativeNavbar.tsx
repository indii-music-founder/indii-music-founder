import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { ScreenControl } from '@/services/screen/ScreenControlService';
import { Sparkles, Image as ImageIcon, Video, MonitorPlay, MessageSquare, Palette, PanelLeftClose, PanelRightClose, Maximize2 } from 'lucide-react';
import PromptBuilder from './PromptBuilder';
import ImageSubMenu from './ImageSubMenu';
import DaisyChainControls from './DaisyChainControls';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import FrameSelectionModal from '../../video/components/FrameSelectionModal';

export default function CreativeNavbar() {
    const { setVideoInput, prompt, setPrompt, generationMode, viewMode, setViewMode } = useStore();
    const toast = useToast();
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showBrandAssets, setShowBrandAssets] = useState(false);
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    return (
        <div className="flex flex-col z-20 relative bg-[#0a0a0a] border-b border-white/5 select-none">
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-4 py-2 h-14">
                {/* Left: Branding & Title */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Palette size={16} className="text-purple-400" />
                        <h1 className="text-sm font-bold text-gray-200 tracking-tight">Creative Director</h1>
                    </div>
                    {/* Divider */}
                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    {/* View Mode Switcher (Compact Segmented Control) */}
                    <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                        <button
                            onClick={() => setViewMode('gallery')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'gallery' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Gallery
                        </button>
                        <button
                            onClick={() => setViewMode('canvas')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'canvas' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Canvas
                        </button>
                        <button
                            onClick={() => setViewMode('showroom')}
                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${viewMode === 'showroom' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Showroom
                        </button>
                    </div>
                </div>

                {/* Right: Context Controls & Utilities */}
                <div className="flex items-center gap-3">
                    {generationMode === 'image' ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
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

            {/* Prompt Builder Drawer */}
            {showPromptBuilder && (
                <PromptBuilder onAddTag={(tag) => setPrompt(prompt ? `${prompt}, ${tag}` : tag)} />
            )}

            {/* Brand Assets Drawer */}
            {showBrandAssets && (
                <BrandAssetsDrawer onClose={() => setShowBrandAssets(false)} />
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
