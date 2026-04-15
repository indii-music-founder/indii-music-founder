import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ScreenControl } from '@/services/screen/ScreenControlService';
import {
    Sparkles, Image as ImageIcon, Video, MonitorPlay, MessageSquare,
    Palette, Clock, FlaskConical, Wand2, Rocket, Settings2
} from 'lucide-react';
import PromptBuilder from './PromptBuilder';
import DaisyChainControls from './DaisyChainControls';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import PromptHistoryDrawer from './PromptHistoryDrawer';
import StudioSettingsPanel from './StudioSettingsPanel';
import FrameSelectionModal from '../../video/components/FrameSelectionModal';

interface CreativeNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function CreativeNavbar(props: CreativeNavbarProps) {
    const {
        setVideoInput,
        prompt,
        setPrompt,
        generationMode,
        viewMode,
        setViewMode,
        studioControls,
        enableAndromedaMode,
        disableAndromedaMode
    } = useStore(useShallow(state => ({
        setVideoInput: state.setVideoInput,
        prompt: state.prompt,
        setPrompt: state.setPrompt,
        generationMode: state.generationMode,
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        studioControls: state.studioControls,
        enableAndromedaMode: state.enableAndromedaMode,
        disableAndromedaMode: state.disableAndromedaMode
    })));
    const toast = useToast();
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showBrandAssets, setShowBrandAssets] = useState(false);
    const [showPromptHistory, setShowPromptHistory] = useState(false);
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    const tabs = [
        { id: 'direct', label: 'Generate', icon: Wand2, testId: 'direct-view-btn', always: true },
        { id: 'canvas', label: 'Canvas', icon: ImageIcon, testId: 'canvas-view-btn', always: true },
        { id: 'video_production', label: 'Director', icon: Video, testId: 'director-view-btn', always: false, showWhen: generationMode === 'video' },
        { id: 'lab', label: 'Lab', icon: FlaskConical, testId: 'lab-view-btn', always: true },
    ] as const;

    return (
        <div {...props} className={`flex flex-col z-20 relative bg-[#060608]/90 backdrop-blur-xl border-b border-white/6 select-none ${props.className || ''}`}>
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 h-12 gap-2">
                {/* Left: Branding & Tabs */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="flex items-center gap-2 text-gray-400 shrink-0">
                        <Palette size={15} className="text-purple-400" />
                        <h1 className="text-xs font-bold text-gray-300 tracking-tight hidden sm:block">Creative Director</h1>
                    </div>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5" />

                    {/* View Mode Switcher */}
                    <div className="flex bg-white/4 p-0.5 rounded-lg border border-white/6 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => {
                            if (!tab.always && tab.showWhen === false) return null;
                            const Icon = tab.icon;
                            const isActive = viewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id as typeof viewMode)}
                                    data-testid={tab.testId}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${isActive
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'
                                        }`}
                                >
                                    <Icon size={11} className={isActive ? 'text-purple-400' : ''} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Context Controls */}
                <div className="hidden md:flex items-center gap-2">
                    {generationMode === 'image' ? (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                                data-testid="builder-btn"
                                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-[9px] font-semibold uppercase tracking-wide
                                    ${showPromptBuilder
                                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                                        : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                            >
                                <MessageSquare size={10} /> Builder
                            </button>
                            <button
                                onClick={() => setShowBrandAssets(!showBrandAssets)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-[9px] font-semibold uppercase tracking-wide
                                    ${showBrandAssets
                                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                        : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                            >
                                <Sparkles size={10} /> Brand
                            </button>
                            <button
                                onClick={() => setShowPromptHistory(!showPromptHistory)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-[9px] font-semibold uppercase tracking-wide
                                    ${showPromptHistory
                                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                        : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                            >
                                <Clock size={10} /> History
                            </button>
                        </div>
                    ) : (
                        <DaisyChainControls
                            onOpenFrameModal={(target) => {
                                setFrameModalTarget(target);
                                setShowFrameModal(true);
                            }}
                        />
                    )}

                    <div className="h-3.5 w-px bg-white/8 mx-0.5" />

                    {/* Studio Settings Toggle */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        data-testid="settings-btn"
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-[9px] font-semibold uppercase tracking-wide
                            ${showSettings
                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                    >
                        <Settings2 size={10} />
                        <span className="hidden lg:inline">Settings</span>
                    </button>

                    {/* Andromeda Mode Toggle */}
                    <button
                        onClick={() => {
                            if (studioControls.isAndromedaMode) {
                                disableAndromedaMode();
                                toast.success("Andromeda Mode deactivated");
                            } else {
                                enableAndromedaMode();
                                toast.success("Andromeda Mode activated: Ready to generate 15 ad variants");
                            }
                        }}
                        title={studioControls.isAndromedaMode ? "Disable Andromeda Pipeline" : "Enable Andromeda Pipeline"}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-bold uppercase tracking-wider
                            ${studioControls.isAndromedaMode
                                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse'
                                : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                    >
                        <Rocket size={11} className={studioControls.isAndromedaMode ? "text-indigo-400" : ""} />
                        <span className="hidden lg:inline">Andromeda</span>
                    </button>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5" />

                    {/* System Status */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/3 rounded-md border border-white/6" title="AI Systems Status">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest hidden lg:block">ONLINE</span>
                    </div>

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
                        className="p-1 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                    >
                        <MonitorPlay size={13} />
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

            {/* Studio Settings Panel */}
            {showSettings && (
                <StudioSettingsPanel onClose={() => setShowSettings(false)} />
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
