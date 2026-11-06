import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';

import { ScreenControl } from '@/services/screen/ScreenControlService';
import {
    Sparkles, Video, MonitorPlay, MessageSquare,
    Palette, Clock, Rocket, Cpu, ArrowLeft, ChevronLeft, ChevronRight,
    Compass, ChevronDown, Music, Scissors, Smartphone, Users
} from 'lucide-react';
import IntelligencePromptBuilder from './IntelligencePromptBuilder';
import { useToast } from '@/core/context/ToastContext';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import HistoryDrawer from './HistoryDrawer';
import AgentCapabilityRegistry from './AgentCapabilityRegistry';
import CanvasModePicker from './CanvasModePicker';
import { FreeMiniCampaignModal } from './FreeMiniCampaignModal';
import { useVideoEditorStore } from '../video/store/videoEditorStore';
import { judgeCreativeJourneyIntent, type CreativeJourneyVerdict } from '@/config/typesafeJudgments';

interface CreativeNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function CreativeNavbar(props: CreativeNavbarProps) {
    const {
        creativePrompt,
        setCreativePrompt,
        generationMode,
        setGenerationMode,
        studioControls,
        enablePLPMode,
        disablePLPMode,
        showPromptBuilder,
        togglePromptBuilder,
        viewMode,
        setViewMode,
        viewModeBack,
        viewModeForward,
        _viewModeHistory,
        _viewModeIndex,
        goBackModule,
        currentModule,
        _navigationHistory,
        videoInputs
    } = useStore(useShallow(state => ({
        creativePrompt: state.creativePrompt,
        setCreativePrompt: state.setCreativePrompt,
        generationMode: state.generationMode,
        setGenerationMode: state.setGenerationMode,
        studioControls: state.studioControls,
        enablePLPMode: state.enablePLPMode,
        disablePLPMode: state.disablePLPMode,
        showPromptBuilder: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder,
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        viewModeBack: state.viewModeBack,
        viewModeForward: state.viewModeForward,
        _viewModeHistory: state._viewModeHistory,
        _viewModeIndex: state._viewModeIndex,
        goBackModule: state.goBackModule,
        currentModule: state.currentModule,
        _navigationHistory: state._navigationHistory,
        videoInputs: state.videoInputs
    })));
    const toast = useToast();

    // ISSUE-1375: navigation state for Back/Forward controls.
    const canGoBackView = (_viewModeIndex ?? 0) > 0;
    const canGoForwardView = (_viewModeIndex ?? 0) < ((_viewModeHistory?.length ?? 1) - 1);
    const moduleHistory = _navigationHistory ?? [currentModule];
    const canGoBackModule = moduleHistory.lastIndexOf(currentModule) > 0;

    // Single active right-rail panel
    type RailPanel = 'brand' | 'history' | 'roster' | null;
    const [activePanel, setActivePanel] = useState<RailPanel>(null);
    const showBrandAssets = activePanel === 'brand';
    const showHistory = activePanel === 'history';
    const showRosterRegistry = activePanel === 'roster';
    const togglePanel = (p: Exclude<RailPanel, null>) => setActivePanel(prev => (prev === p ? null : p));

    // Integrated Journeys state
    const [isJourneysOpen, setIsJourneysOpen] = useState(false);
    const [isMiniCampaignOpen, setIsMiniCampaignOpen] = useState(false);
    const [verdict, setVerdict] = useState<CreativeJourneyVerdict | null>(null);
    const journeysRef = useRef<HTMLDivElement>(null);

    // JEV System One Ambient Intent Resolution
    useEffect(() => {
        let isCurrent = true;
        const hasAudio = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'audio'));
        const hasVideo = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'video'));
        const hasImage = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'image'));

        void judgeCreativeJourneyIntent({
            prompt: creativePrompt,
            hasAudio,
            hasVideo,
            hasImage,
            currentMode: generationMode as 'image' | 'video' | 'omni',
            currentView: viewMode,
        }).then(res => {
            if (isCurrent) {
                setVerdict(res);
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [creativePrompt, generationMode, viewMode, videoInputs]);

    // Close Journeys menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (journeysRef.current && !journeysRef.current.contains(e.target as Node)) {
                setIsJourneysOpen(false);
            }
        };
        if (isJourneysOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isJourneysOpen]);

    const openVideo = (mode: 'director' | 'editor' | 'storyboard') => {
        useVideoEditorStore.getState().setViewMode(mode);
        setViewMode('video_production');
        setGenerationMode('video');
        setIsJourneysOpen(false);
    };

    const handleApplyVerdict = () => {
        if (!verdict) return;
        if (verdict.recommendedJourney === 'guided_campaign') {
            setIsMiniCampaignOpen(true);
            return;
        }
        if (verdict.recommendedJourney === 'band_references') {
            togglePanel('roster');
            return;
        }
        if (verdict.targetGenMode === 'video' && verdict.targetVideoSubView) {
            useVideoEditorStore.getState().setViewMode(verdict.targetVideoSubView);
        }
        setViewMode(verdict.targetViewMode);
        setGenerationMode(verdict.targetGenMode);
    };

    return (
        <div {...props} className={`flex flex-col z-20 relative bg-[#060608]/95 backdrop-blur-xl border-b border-white/6 select-none ${props.className || ''}`}>
            {/* Single Unified Header Bar */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 h-12 gap-3">
                {/* Left: Navigation, Studio Crumb & Integrated Journeys Entry */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {/* Back/Forward Navigation */}
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
                    <div className="hidden md:flex items-center gap-1 text-[10px] text-gray-500 shrink-0 font-mono">
                        {viewMode}
                    </div>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5 shrink-0" />

                    {/* Integrated Journeys Menu Dropdown */}
                    <div className="relative shrink-0" ref={journeysRef}>
                        <button
                            type="button"
                            onClick={() => setIsJourneysOpen(!isJourneysOpen)}
                            data-testid="creative-journeys-menu-trigger"
                            aria-expanded={isJourneysOpen}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white transition-all text-xs font-semibold"
                        >
                            <Compass size={13} className="text-dept-creative" />
                            <span>Journeys</span>
                            <ChevronDown size={11} className={`text-gray-400 transition-transform duration-200 ${isJourneysOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isJourneysOpen && (
                            <div
                                data-testid="creative-journeys-menu"
                                className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-white/10 bg-[#0d0d12]/98 backdrop-blur-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
                            >
                                <div className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-gray-500 font-bold border-b border-white/5 mb-1">
                                    Creative Creation Pathways
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMiniCampaignOpen(true);
                                        setIsJourneysOpen(false);
                                    }}
                                    data-testid="journey-guided-campaign"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
                                >
                                    <Rocket size={13} className="text-amber-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Guided Campaign Launch</div>
                                        <div className="text-[10px] text-gray-400">1 track + visual concept → unwatermarked pack</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('storyboard')}
                                    data-testid="journey-music-video"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Music size={13} className="text-purple-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Music Video Storyboard</div>
                                        <div className="text-[10px] text-gray-400">Assemble visual scenes synced to audio</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('editor')}
                                    data-testid="journey-social-clips"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Scissors size={13} className="text-blue-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Edit & Social Clips</div>
                                        <div className="text-[10px] text-gray-400">9:16 vertical reels and cutdowns</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('director')}
                                    data-testid="journey-phone-recording"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Smartphone size={13} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Phone Recording & Takes</div>
                                        <div className="text-[10px] text-gray-400">Import mobile takes and trim proxy</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('canvas');
                                        setGenerationMode('image');
                                        setIsJourneysOpen(false);
                                    }}
                                    data-testid="journey-artwork"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Palette size={13} className="text-pink-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Release Artwork & Press</div>
                                        <div className="text-[10px] text-gray-400">DSPs, 3000px print, and headshots</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        togglePanel('roster');
                                        setIsJourneysOpen(false);
                                    }}
                                    data-testid="journey-band-references"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Users size={13} className="text-teal-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Artist & Band References</div>
                                        <div className="text-[10px] text-gray-400">Face and character consistency library</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: Segmented Mode Switcher */}
                <CanvasModePicker />

                {/* Right: Ambient Jev Flow Chip + Utility Drawers */}
                <div className="hidden lg:flex items-center gap-2 shrink-0 justify-end">
                    {/* Inline Jev System One Flow Chip */}
                    {verdict && (
                        <div
                            data-testid="creative-journey-flow-strip"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dept-creative/10 border border-dept-creative/25 text-left max-w-sm truncate"
                        >
                            <Sparkles size={11} className="text-dept-creative shrink-0 animate-pulse" />
                            <span data-testid="creative-journey-headline" className="text-[11px] text-gray-200 truncate font-medium">
                                {verdict.headline}
                            </span>
                            <button
                                type="button"
                                onClick={handleApplyVerdict}
                                data-testid="creative-journey-action-btn"
                                className="px-2 py-0.5 rounded bg-dept-creative/30 hover:bg-dept-creative/50 text-white font-bold text-[9px] uppercase tracking-wider shrink-0 ml-1 transition-colors"
                            >
                                {verdict.actionLabel}
                            </button>
                        </div>
                    )}

                    {/* Standard Right Utilities */}
                    <div className="flex items-center bg-white/4 p-0.5 rounded-lg border border-white/6">
                        <button
                            onClick={togglePromptBuilder}
                            data-testid="builder-btn"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showPromptBuilder
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/4'}`}
                        >
                            <MessageSquare size={11} className={showPromptBuilder ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">Builder</span>
                        </button>
                        <button
                            onClick={() => togglePanel('brand')}
                            data-testid="brand-assets-btn"
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showBrandAssets
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/4'}`}
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
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/4'}`}
                        >
                            <Clock size={11} className={showHistory ? 'text-green-400' : ''} />
                            <span className="hidden xl:inline">History</span>
                        </button>
                        <button
                            onClick={() => togglePanel('roster')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider
                                ${showRosterRegistry
                                    ? 'bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/4'}`}
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
                                : 'bg-white/3 border-white/6 text-gray-400 hover:text-gray-200 hover:bg-white/6'}`}
                    >
                        <Rocket size={11} className={studioControls.isPLPMode ? "text-indigo-400" : ""} />
                        <span className="hidden xl:inline">PLP</span>
                    </button>

                    <div className="h-3.5 w-px bg-white/8 mx-0.5 shrink-0" />

                    {/* System Status */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/3 rounded-md border border-white/6 shrink-0" title="Autonomous Systems Status">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest hidden xl:block">ONLINE</span>
                    </div>

                    {/* Projector */}
                    <button
                        onClick={async () => {
                            const granted = await ScreenControl.requestPermission();
                            if (granted) {
                                const isVideo = generationMode === 'video' || viewMode === 'video_production';
                                const targetUrl = isVideo ? '/video-popout' : `${window.location.pathname}?projector=true`;
                                ScreenControl.openProjectorWindow(targetUrl);
                            } else {
                                toast.error('Screen Control API not supported or permission denied.');
                            }
                        }}
                        title="Open Projector"
                        className="p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors shrink-0"
                    >
                        <MonitorPlay size={13} />
                    </button>
                </div>
            </div>

            {/* Prompt Builder Drawer */}
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

            {/* Unified History Drawer */}
            {showHistory && (
                <HistoryDrawer onClose={() => setActivePanel(null)} />
            )}

            {/* Roster Capability Registry */}
            <AnimatePresence>
                {showRosterRegistry && (
                    <AgentCapabilityRegistry onClose={() => setActivePanel(null)} />
                )}
            </AnimatePresence>

            {/* Guided Campaign Launch Modal */}
            <FreeMiniCampaignModal
                isOpen={isMiniCampaignOpen}
                onClose={() => setIsMiniCampaignOpen(false)}
            />
        </div>
    );
}
