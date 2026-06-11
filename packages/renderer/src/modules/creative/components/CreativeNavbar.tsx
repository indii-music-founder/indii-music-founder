import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';

import { ScreenControl } from '@/services/screen/ScreenControlService';
import {
    Sparkles, Image as ImageIcon, Video, MonitorPlay, MessageSquare,
    Palette, Clock, FlaskConical, Wand2, Rocket, Layers, Cpu
} from 'lucide-react';
import IntelligencePromptBuilder from './IntelligencePromptBuilder';
import DaisyChainControls from './DaisyChainControls';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import PromptHistoryDrawer from './PromptHistoryDrawer';
import DesignHistoryDrawer from './DesignHistoryDrawer';
import AgentCapabilityRegistry from './AgentCapabilityRegistry';
import FrameSelectionModal from '../video/components/FrameSelectionModal';

interface CreativeNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function CreativeNavbar(props: CreativeNavbarProps) {
    const {
        setVideoInput,
        creativePrompt,
        setCreativePrompt,
        generationMode,
        viewMode,
        setViewMode,
        studioControls,
        enableAndromedaMode,
        disableAndromedaMode,
        showPromptBuilder,
        togglePromptBuilder
    } = useStore(useShallow(state => ({
        setVideoInput: state.setVideoInput,
        creativePrompt: state.creativePrompt,
        setCreativePrompt: state.setCreativePrompt,
        generationMode: state.generationMode,
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        studioControls: state.studioControls,
        enableAndromedaMode: state.enableAndromedaMode,
        disableAndromedaMode: state.disableAndromedaMode,
        showPromptBuilder: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder
    })));
    const toast = useToast();
    const [showBrandAssets, setShowBrandAssets] = useState(false);
    const [showPromptHistory, setShowPromptHistory] = useState(false);
    const [showDesignHistory, setShowDesignHistory] = useState(false);
    const [showSwarmRegistry, setShowSwarmRegistry] = useState(false);
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    const tabs = [
        { id: 'direct', label: 'Generate', icon: Wand2, testId: 'direct-view-btn' },
        { id: 'canvas', label: 'Canvas', icon: ImageIcon, testId: 'canvas-view-btn' },
        { id: 'video_production', label: 'Video', icon: Video, testId: 'director-view-btn' },
        { id: 'omni', label: 'Omni Remix', icon: Sparkles, testId: 'omni-view-btn' },
        { id: 'showroom', label: 'Showroom', icon: MonitorPlay, testId: 'showroom-view-btn' },
        { id: 'lab', label: 'Keyframes', icon: FlaskConical, testId: 'lab-view-btn' },
    ] as const;

    return (
        <div {...props} className={`flex flex-col z-20 relative bg-[#060608]/90 backdrop-blur-xl border-b border-white/6 select-none ${props.className || ''}`}>
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 h-12 gap-2">
                {/* Left: Branding & Tabs */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-gray-400 shrink-0">
                        {generationMode === 'video' ? (
                            <Video size={15} className="text-blue-400" />
                        ) : (
                            <Palette size={15} className="text-purple-400" />
                        )}
                        <h1 className="text-xs font-bold text-gray-300 tracking-tight hidden sm:block">
                            {generationMode === 'video' ? 'Video Producer' : 'Studio'}
                        </h1>
                    </div>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5" />

                    {/* View Mode Switcher */}
                    <div className="flex bg-white/4 p-0.5 rounded-lg border border-white/6 overflow-x-auto no-scrollbar min-w-0 flex-shrink">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = viewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    title={tab.label}
                                    onClick={() => {
                                        setViewMode(tab.id as typeof viewMode);
                                        if (tab.id === 'video_production' || tab.id === 'omni') {
                                            useStore.getState().setGenerationMode('video');
                                        } else if (tab.id === 'direct' || tab.id === 'canvas' || tab.id === 'showroom') {
                                            useStore.getState().setGenerationMode('image');
                                        }
                                    }}
                                    data-testid={tab.testId}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${isActive
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'
                                        }`}
                                  >
                                    <Icon size={11} className={isActive ? 'text-purple-400' : ''} />
                                    <span className="hidden xl:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Context Controls */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0 overflow-hidden max-w-[40%] justify-end">
                    {generationMode === 'image' ? (
                        <div className="flex items-center bg-white/4 p-0.5 rounded-lg border border-white/6">
                            <button
                                onClick={togglePromptBuilder}
                                data-testid="builder-btn"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showPromptBuilder
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <MessageSquare size={11} className={showPromptBuilder ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Builder</span>
                            </button>
                            <button
                                onClick={() => setShowBrandAssets(!showBrandAssets)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showBrandAssets
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Sparkles size={11} className={showBrandAssets ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Brand</span>
                            </button>
                            <button
                                onClick={() => setShowPromptHistory(!showPromptHistory)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showPromptHistory
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Clock size={11} className={showPromptHistory ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">History</span>
                            </button>
                            <button
                                onClick={() => setShowDesignHistory(!showDesignHistory)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showDesignHistory
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Layers size={11} className={showDesignHistory ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Versions</span>
                            </button>
                            <button
                                onClick={() => setShowSwarmRegistry(!showSwarmRegistry)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showSwarmRegistry
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Cpu size={11} className={showSwarmRegistry ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Swarm</span>
                            </button>
                        </div>
                    ) : (
                        <div className="min-w-0 flex-1 flex justify-end">
                            <DaisyChainControls
                                onOpenFrameModal={(target) => {
                                    setFrameModalTarget(target);
                                    setShowFrameModal(true);
                                }}
                            />
                        </div>
                    )}


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
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-bold uppercase tracking-wider shrink-0
                            ${studioControls.isAndromedaMode
                                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse'
                                : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                    >
                        <Rocket size={11} className={studioControls.isAndromedaMode ? "text-indigo-400" : ""} />
                        <span className="hidden lg:inline">Andromeda</span>
                    </button>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5 shrink-0" />

                    {/* System Status */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/3 rounded-md border border-white/6 shrink-0" title="Autonomous Systems Status">
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
                        className="p-1 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors shrink-0"
                    >
                        <MonitorPlay size={13} />
                    </button>
                </div>
            </div>

            {/* Prompt Builder — Full-width horizontal overlay below navbar */}
            <AnimatePresence>
                {showPromptBuilder && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="relative z-50 bg-[#0a0a0c]/98 backdrop-blur-xl border-b border-white/10 shadow-xl"
                    >
                        <IntelligencePromptBuilder
                            onAddTag={(tag) => setCreativePrompt(creativePrompt ? `${creativePrompt}, ${tag}` : tag)}
                            currentPrompt={creativePrompt}
                            onSetPrompt={setCreativePrompt}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Brand Assets Drawer */}
            {showBrandAssets && (
                <BrandAssetsDrawer onClose={() => setShowBrandAssets(false)} />
            )}

            {/* Prompt History Drawer */}
            {showPromptHistory && (
                <PromptHistoryDrawer onClose={() => setShowPromptHistory(false)} />
            )}

            {/* Design History Drawer */}
            {showDesignHistory && (
                <DesignHistoryDrawer onClose={() => setShowDesignHistory(false)} />
            )}

            {/* Swarm Capability Registry */}
            <AnimatePresence>
                {showSwarmRegistry && (
                    <AgentCapabilityRegistry onClose={() => setShowSwarmRegistry(false)} />
                )}
            </AnimatePresence>


            <FrameSelectionModal
                isOpen={showFrameModal}
                onClose={() => setShowFrameModal(false)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onSelect={(image: any) => setVideoInput(frameModalTarget, image)}
                target={frameModalTarget}
            />
        </div>
    );
}
