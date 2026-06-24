import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';

import { ScreenControl } from '@/services/screen/ScreenControlService';
import {
    Sparkles, Image as ImageIcon, Video, MonitorPlay, MessageSquare,
    Palette, Clock, FlaskConical, Rocket, Cpu
} from 'lucide-react';
import IntelligencePromptBuilder from './IntelligencePromptBuilder';
import DaisyChainControls from './DaisyChainControls';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import HistoryDrawer from './HistoryDrawer';
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
        enablePLPMode,
        disablePLPMode,
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
        enablePLPMode: state.enablePLPMode,
        disablePLPMode: state.disablePLPMode,
        showPromptBuilder: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder
    })));
    const toast = useToast();
    // Single active right-rail panel so they are mutually exclusive and can't
    // overlap/stack on top of each other (ISSUE-492).
    type RailPanel = 'brand' | 'history' | 'roster' | null;
    const [activePanel, setActivePanel] = useState<RailPanel>(null);
    const showBrandAssets = activePanel === 'brand';
    const showHistory = activePanel === 'history';
    const showRosterRegistry = activePanel === 'roster';
    const togglePanel = (p: Exclude<RailPanel, null>) => setActivePanel(prev => (prev === p ? null : p));
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [frameModalTarget, setFrameModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

    // IA Option C, Phase 1 (ISSUE-488/491): the former 6 flat tabs are grouped into
    // 4 primary MODES with secondary sub-views. "Keyframes" is renamed "Sequence"
    // (Daisy Chain merges here conceptually; full functional merge is Phase 2).
    // Original view testIds are preserved so e2e/nav tests keep working.
    const MODES = [
        {
            id: 'image', label: 'Image', icon: ImageIcon, gen: 'image' as const,
            views: [
                { id: 'direct', label: 'Generate', testId: 'direct-view-btn' },
                { id: 'canvas', label: 'Canvas', testId: 'canvas-view-btn' },
            ],
        },
        {
            id: 'video', label: 'Video', icon: Video, gen: 'video' as const,
            views: [
                { id: 'video_production', label: 'Produce', testId: 'director-view-btn' },
                { id: 'omni', label: 'Omni Remix', testId: 'omni-view-btn' },
            ],
        },
        {
            id: 'mockup', label: 'Mockup', icon: MonitorPlay, gen: 'image' as const,
            views: [{ id: 'showroom', label: 'Showroom', testId: 'showroom-view-btn' }],
        },
        {
            id: 'sequence', label: 'Sequence', icon: FlaskConical, gen: 'video' as const,
            views: [{ id: 'lab', label: 'Sequence', testId: 'lab-view-btn' }],
        },
    ] as const;

    const activeMode = MODES.find(m => m.views.some(v => v.id === viewMode)) ?? MODES[0];

    const selectView = (viewId: string, gen: 'image' | 'video') => {
        setViewMode(viewId as typeof viewMode);
        useStore.getState().setGenerationMode(gen);
    };

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

                    {/* Primary mode picker (IA Option C) */}
                    <div className="flex bg-white/4 p-0.5 rounded-lg border border-white/6 overflow-x-auto no-scrollbar min-w-0 flex-shrink">
                        {MODES.map(mode => {
                            const Icon = mode.icon;
                            const isActive = activeMode.id === mode.id;
                            const isSingle = mode.views.length === 1;
                            return (
                                <button
                                    key={mode.id}
                                    title={mode.label}
                                    onClick={() => selectView(mode.views[0]!.id, mode.gen)}
                                    // Single-view modes carry the original view testId so e2e/nav tests still resolve.
                                    data-testid={isSingle ? mode.views[0]!.testId : `mode-${mode.id}-btn`}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${isActive
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'
                                        }`}
                                  >
                                    <Icon size={11} className={isActive ? 'text-purple-400' : ''} />
                                    <span className="hidden lg:inline">{mode.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Secondary sub-view selector (shown only when the active mode has >1 view) */}
                    {activeMode.views.length > 1 && (
                        <div className="flex bg-white/4 p-0.5 rounded-lg border border-white/6 shrink-0">
                            {activeMode.views.map(v => {
                                const isActive = viewMode === v.id;
                                return (
                                    <button
                                        key={v.id}
                                        title={v.label}
                                        onClick={() => selectView(v.id, activeMode.gen)}
                                        data-testid={v.testId}
                                        className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${isActive
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'
                                            }`}
                                    >
                                        {v.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
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
                                onClick={() => togglePanel('brand')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showBrandAssets
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Sparkles size={11} className={showBrandAssets ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Brand</span>
                            </button>
                            <button
                                onClick={() => togglePanel('history')}
                                data-testid="history-btn"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showHistory
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Clock size={11} className={showHistory ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">History</span>
                            </button>
                            <button
                                onClick={() => togglePanel('roster')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                    ${showRosterRegistry
                                        ? 'bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                            >
                                <Cpu size={11} className={showRosterRegistry ? 'text-purple-400' : ''} />
                                <span className="hidden xl:inline">Roster</span>
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
