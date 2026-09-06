import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';

import { ScreenControl } from '@/services/screen/ScreenControlService';
import {
    Sparkles, Video, MonitorPlay, MessageSquare,
    Palette, Clock, Rocket, Cpu, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';
import IntelligencePromptBuilder from './IntelligencePromptBuilder';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import HistoryDrawer from './HistoryDrawer';
import AgentCapabilityRegistry from './AgentCapabilityRegistry';
import CanvasModePicker from './CanvasModePicker';

interface CreativeNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function CreativeNavbar(props: CreativeNavbarProps) {
    const {
        creativePrompt,
        setCreativePrompt,
        generationMode,
        studioControls,
        enablePLPMode,
        disablePLPMode,
        showPromptBuilder,
        togglePromptBuilder,
        viewMode,
        viewModeBack,
        viewModeForward,
        _viewModeHistory,
        _viewModeIndex,
        goBackModule,
        currentModule,
        _navigationHistory
    } = useStore(useShallow(state => ({
        creativePrompt: state.creativePrompt,
        setCreativePrompt: state.setCreativePrompt,
        generationMode: state.generationMode,
        studioControls: state.studioControls,
        enablePLPMode: state.enablePLPMode,
        disablePLPMode: state.disablePLPMode,
        showPromptBuilder: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder,
        viewMode: state.viewMode,
        viewModeBack: state.viewModeBack,
        viewModeForward: state.viewModeForward,
        _viewModeHistory: state._viewModeHistory,
        _viewModeIndex: state._viewModeIndex,
        goBackModule: state.goBackModule,
        currentModule: state.currentModule,
        _navigationHistory: state._navigationHistory
    })));
    const toast = useToast();

    // ISSUE-1375: navigation state for Back/Forward controls.
    const canGoBackView = (_viewModeIndex ?? 0) > 0;
    const canGoForwardView = (_viewModeIndex ?? 0) < ((_viewModeHistory?.length ?? 1) - 1);
    const moduleHistory = _navigationHistory ?? [currentModule];
    const canGoBackModule = moduleHistory.lastIndexOf(currentModule) > 0;
    // Single active right-rail panel so they are mutually exclusive and can't
    // overlap/stack on top of each other (ISSUE-492).
    type RailPanel = 'brand' | 'history' | 'roster' | null;
    const [activePanel, setActivePanel] = useState<RailPanel>(null);
    const showBrandAssets = activePanel === 'brand';
    const showHistory = activePanel === 'history';
    const showRosterRegistry = activePanel === 'roster';
    const togglePanel = (p: Exclude<RailPanel, null>) => setActivePanel(prev => (prev === p ? null : p));

    return (
        <div {...props} className={`flex flex-col z-20 relative bg-[#060608]/90 backdrop-blur-xl border-b border-white/6 select-none ${props.className || ''}`}>
            {/* Single Compact Header Row */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 h-12 gap-2">
                {/* Left: Branding & Tabs */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {/* ISSUE-1375: Back/Forward navigation — one-click return
                        to the previous page (module) and previous view
                        (studio/canvas and every other creative view). */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-white/[0.03] p-0.5 rounded-lg border border-white/5">
                        <button
                            onClick={() => void goBackModule()}
                            disabled={!canGoBackModule}
                            title="Exit Module: Back to previous dashboard/module"
                            aria-label="Exit to previous module"
                            data-testid="creative-nav-back-module"
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ArrowLeft size={14} />
                        </button>
                        <div className="h-3 w-px bg-white/10 mx-0.5" />
                        <button
                            onClick={() => viewModeBack()}
                            disabled={!canGoBackView}
                            title="Previous View Mode (e.g. canvas → studio)"
                            aria-label="Back to previous view"
                            data-testid="creative-nav-back-view"
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={() => viewModeForward()}
                            disabled={!canGoForwardView}
                            title="Next View Mode"
                            aria-label="Forward to next view"
                            data-testid="creative-nav-forward-view"
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 shrink-0">
                        {generationMode === 'video' ? (
                            <Video size={15} className="text-blue-400" />
                        ) : (
                            <Palette size={15} className="text-green-400" />
                        )}
                        <h1 className="text-xs font-bold text-gray-300 tracking-tight hidden sm:block">
                            {generationMode === 'video' ? 'Video Producer' : 'Studio'}
                        </h1>
                    </div>
                    <div className="hidden md:flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
                        {viewMode}
                    </div>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5" />
                </div>

                <CanvasModePicker />

                <div className="hidden md:flex items-center gap-1.5 shrink-0 overflow-hidden max-w-[40%] justify-end">
                    <div className="flex items-center bg-white/4 p-0.5 rounded-lg border border-white/6">
                        <button
                            onClick={togglePromptBuilder}
                            data-testid="builder-btn"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showPromptBuilder
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                        >
                            <MessageSquare size={11} className={showPromptBuilder ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">Builder</span>
                        </button>
                        <button
                            onClick={() => togglePanel('brand')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showBrandAssets
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                        >
                            <Sparkles size={11} className={showBrandAssets ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">Brand</span>
                        </button>
                        <button
                            onClick={() => togglePanel('history')}
                            data-testid="history-btn"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showHistory
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                        >
                            <Clock size={11} className={showHistory ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">History</span>
                        </button>
                        <button
                            onClick={() => togglePanel('roster')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showRosterRegistry
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                        >
                            <Cpu size={11} className={showRosterRegistry ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">Roster</span>
                        </button>
                    </div>


                    {/* PLP Mode Toggle */}
                    <button
                        onClick={() => {
                            if (studioControls.isPLPMode) {
                                disablePLPMode();
                                toast.success("PLP Mode deactivated");
                            } else {
                                enablePLPMode();
                                toast.success("PLP Mode activated: Ready to generate 15 ad variants");
                            }
                        }}
                        title={studioControls.isPLPMode ? "Disable PLP — Promote · Launch · Push" : "Enable PLP — Promote · Launch · Push (15 release-ready ad variants)"}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-bold uppercase tracking-wider shrink-0
                            ${studioControls.isPLPMode
                                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse'
                                : 'bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}
                    >
                        <Rocket size={11} className={studioControls.isPLPMode ? "text-indigo-400" : ""} />
                        <span className="hidden lg:inline">PLP</span>
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
                <BrandAssetsDrawer onClose={() => setActivePanel(null)} />
            )}

            {/* Unified History Drawer (Versions + Prompts) — ISSUE-496 */}
            {showHistory && (
                <HistoryDrawer onClose={() => setActivePanel(null)} />
            )}

            {/* Roster Capability Registry */}
            <AnimatePresence>
                {showRosterRegistry && (
                    <AgentCapabilityRegistry onClose={() => setActivePanel(null)} />
                )}
            </AnimatePresence>

        </div>
    );
}
