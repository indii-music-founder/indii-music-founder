import React, { useState, useRef } from 'react';
import { useStore } from '@/core/store';
import { ScreenControl } from '@/services/screen/ScreenControlService';
import { Sparkles, ChevronDown, Image as ImageIcon, Video, MonitorPlay } from 'lucide-react';
import PromptBuilder from './PromptBuilder';
// import StudioNavControls from './StudioNavControls'; // Removed
import ImageSubMenu from './ImageSubMenu';
import DaisyChainControls from './DaisyChainControls';
import { StudioToolbar } from '@/components/studio/StudioToolbar';

import { useToast } from '@/core/context/ToastContext';
// import { PromptInput, PromptInputTextarea } from '@/components/ui/prompt-input'; // Removed

import BrandAssetsDrawer from './BrandAssetsDrawer';
import FrameSelectionModal from '../../video/components/FrameSelectionModal';
import AI_Input_Search from '@/components/kokonutui/ai-input-search';

export default function CreativeNavbar() {
    const { setVideoInput, prompt, setPrompt, generationMode, setGenerationMode } = useStore();
    const toast = useToast();
    // const [prompt, setPrompt] = useState(''); // Removed local state
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [showBrandAssets, setShowBrandAssets] = useState(false);
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    return (
        <div className="flex flex-col z-20 relative">
            <StudioToolbar
                className="bg-[#1a1a1a]"
                left={
                    <div className="flex items-center gap-4">
                        {/* Branding */}
                        <h1 className="text-sm font-bold text-yellow-500 tracking-widest uppercase whitespace-nowrap">indiiOS</h1>
                        <div className="h-4 w-px bg-gray-700"></div>
                        <span className="text-[10px] text-gray-500 font-mono" id="debug-uid">
                            {'Superuser'}
                        </span>

                        {/* Mode Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModeDropdown(!showModeDropdown)}
                                className="flex items-center gap-2 bg-[#0f0f0f] border border-gray-700 text-xs rounded px-3 py-1.5 text-gray-300 hover:border-gray-500 transition-colors whitespace-nowrap"
                            >
                                {generationMode === 'image' ? (
                                    <><ImageIcon size={12} /> Image</>
                                ) : (
                                    <><Video size={12} /> Video</>
                                )}
                                <ChevronDown size={12} />
                            </button>

                            {showModeDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-32 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                    <button
                                        onClick={() => { setGenerationMode('image'); setShowModeDropdown(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                                    >
                                        <ImageIcon size={12} /> Image Mode
                                    </button>
                                    <button
                                        onClick={() => { setGenerationMode('video'); setShowModeDropdown(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                                    >
                                        <Video size={12} /> Video Mode
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile: Agent Toggle in top row */}
                        <button
                            onClick={() => useStore.getState().toggleAgentWindow()}
                            className="md:hidden bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs py-1.5 px-3 rounded border border-purple-700 transition-all flex items-center gap-2"
                        >
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            Agent
                        </button>
                    </div>
                }
                right={
                    <div className="hidden md:flex gap-2">
                        <button
                            onClick={async () => {
                                const granted = await ScreenControl.requestPermission();
                                if (granted) {
                                    ScreenControl.openProjectorWindow(window.location.href);
                                } else {
                                    alert("Screen Control API not supported or permission denied.");
                                }
                            }}
                            className="bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs py-1.5 px-3 rounded border border-blue-700 transition-all flex items-center gap-2"
                        >
                            <MonitorPlay size={12} />
                            Projector
                        </button>
                        <button
                            onClick={() => useStore.getState().toggleAgentWindow()}
                            className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs py-1.5 px-3 rounded border border-purple-700 transition-all flex items-center gap-2"
                        >
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            indii
                        </button>
                    </div>
                }
            >
                {/* Center is now empty for minimalism */}
            </StudioToolbar>

            {/* Sub-Menu Bar */}
            <div className="bg-[#111] border-b border-gray-800 py-1 px-4">
                {generationMode === 'image' ? (
                    <ImageSubMenu
                        onShowBrandAssets={() => setShowBrandAssets(!showBrandAssets)}
                        showBrandAssets={showBrandAssets}
                        onTogglePromptBuilder={() => setShowPromptBuilder(!showPromptBuilder)}
                        showPromptBuilder={showPromptBuilder}
                    />
                ) : (
                    <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar w-full">
                        <button className="text-xs text-purple-400 font-bold px-2 py-1 bg-purple-900/20 rounded">Video</button>

                        <DaisyChainControls
                            onOpenFrameModal={(target) => {
                                setFrameModalTarget(target);
                                setShowFrameModal(true);
                            }}
                        />

                        <button className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors">Motion Brush</button>
                        <button className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors">Director's Cut</button>

                        {/* Brand Palette Section */}
                        <div className="h-4 w-px bg-gray-700 mx-2 flex-shrink-0"></div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowBrandAssets(!showBrandAssets)}
                                data-testid="brand-assets-toggle"
                                className={`text-[10px] uppercase font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors ${showBrandAssets ? 'bg-yellow-900/30 text-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Sparkles size={10} className={showBrandAssets ? "text-yellow-500" : "text-gray-500"} /> Brand
                            </button>
                            {useStore.getState().userProfile.brandKit?.colors?.length > 0 && !showBrandAssets && (
                                <div className="flex gap-1">
                                    {useStore.getState().userProfile.brandKit.colors.map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full border border-gray-600 cursor-pointer hover:scale-110 transition-transform relative group"
                                            style={{ backgroundColor: color }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(color);
                                                toast.success(`Copied ${color}`);
                                            }}
                                        >
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                                                {color}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
