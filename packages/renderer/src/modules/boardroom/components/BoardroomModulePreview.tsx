import React, { lazy, Suspense } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { PREVIEW_MODULES } from '@/modules/boardroom/components/boardroomPreviewModules';
import { cn } from '@/lib/utils';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

// Lazy-loaded departmental modules for in-place Boardroom preview
const CreativeStudio = lazy(() => import('@/modules/creative/CreativeStudio'));
const LegalDashboard = lazy(() => import('@/modules/legal/LegalDashboard'));
const MarketingDashboard = lazy(() => import('@/modules/marketing/MarketingDashboard'));
const WorkflowLab = lazy(() => import('@/modules/workflow/WorkflowLab'));
const PublishingDashboard = lazy(() => import('@/modules/publishing/PublishingDashboard'));
const FinanceDashboard = lazy(() => import('@/modules/finance/FinanceDashboard'));
const LicensingDashboard = lazy(() => import('@/modules/licensing/LicensingDashboard'));
const DistributionDashboard = lazy(() => import('@/modules/distribution/DistributionDashboard'));
const RegistrationCenter = lazy(() => import('@/modules/registration/RegistrationCenter'));
const SocialDashboard = lazy(() => import('@/modules/social/SocialDashboard'));
const BrandManager = lazy(() => import('@/modules/marketing/components/BrandManager'));
const NotesModule = lazy(() => import('@/modules/notes/NotesModule'));

function BoardroomModulePreviewContent() {
    const {
        boardroomPreviewModuleId,
        setBoardroomPreviewModuleId,
        activeAgents,
        setModule,
        setConversationMode,
        boardroomControl,
        takeBoardroomControl,
    } = useStore(
        useShallow(state => ({
            boardroomPreviewModuleId: state.boardroomPreviewModuleId || 'creative',
            setBoardroomPreviewModuleId: state.setBoardroomPreviewModuleId,
            activeAgents: state.activeAgents || [],
            setModule: state.setModule,
            setConversationMode: state.setConversationMode,
            boardroomControl: state.boardroomControl,
            takeBoardroomControl: state.takeBoardroomControl,
        }))
    );

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuContainerRef = React.useRef<HTMLDivElement>(null);
    const pickerButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (!isMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
                pickerButtonRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
        );
        if (items.length === 0) return;
        const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
        let nextIndex = -1;
        if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        else if (event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = items.length - 1;
        else return;
        event.preventDefault();
        items[nextIndex]?.focus();
    };

    const activeOption = PREVIEW_MODULES.find(m => m.id === boardroomPreviewModuleId) || PREVIEW_MODULES[0];
    const ActiveIcon = activeOption.icon;

    // Seated agent priority pills
    const seatedOptions = PREVIEW_MODULES.filter(m => activeAgents.includes(m.agentId));

    const handleExitToStudio = async () => {
        await setModule(boardroomPreviewModuleId);
        if (useStore.getState().currentModule === boardroomPreviewModuleId) {
            setConversationMode('direct');
        }
    };

    const renderActiveModuleComponent = () => {
        switch (boardroomPreviewModuleId) {
            case 'creative': return <CreativeStudio embedded />;
            case 'publishing': return <PublishingDashboard />;
            case 'finance': return <FinanceDashboard />;
            case 'legal': return <LegalDashboard />;
            case 'marketing': return <MarketingDashboard />;
            case 'social': return <SocialDashboard />;
            case 'brand': return <BrandManager />;
            case 'distribution': return <DistributionDashboard />;
            case 'registration': return <RegistrationCenter />;
            case 'licensing': return <LicensingDashboard />;
            case 'workflow': return <WorkflowLab />;
            case 'notes': return <NotesModule />;
            default: return <CreativeStudio embedded />;
        }
    };

    const studioHolder = boardroomControl?.surface === 'studio' ? boardroomControl.holder : 'artist';
    const studioHolderName = studioHolder === 'artist'
        ? 'You'
        : resolveAgentVisualIdentity(studioHolder).displayName;

    return (
        <div data-testid="boardroom-module-preview" className="h-full w-full flex flex-col bg-bg-dark text-white min-h-0 min-w-0 overflow-hidden">
            {/* Control & Module Header */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-surface border-b border-white/10 shrink-0 gap-2 text-xs">
                <span role="status" className="text-white/75">
                    {studioHolder === 'artist' ? 'You have control' : `${studioHolderName} has control`}
                </span>
                {studioHolder !== 'artist' && (
                    <button
                        type="button"
                        onClick={() => takeBoardroomControl?.('studio')}
                        className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                        Take control
                    </button>
                )}
            </div>
            {/* Header bar with Module Selector & Seated Pills */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10 shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Module Dropdown Trigger */}
                    <div className="relative" ref={menuContainerRef}>
                        <button
                            ref={pickerButtonRef}
                            type="button"
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            aria-expanded={isMenuOpen}
                            aria-haspopup="menu"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                            data-testid="boardroom-module-picker-btn"
                        >
                            <ActiveIcon size={14} className="text-indigo-400 shrink-0" />
                            <span className="truncate">{activeOption.title}</span>
                            <ChevronDown size={12} className={cn("text-white/40 transition-transform", isMenuOpen && "rotate-180")} />
                        </button>

                        {isMenuOpen && (
                            <div
                                role="menu"
                                onKeyDown={handleMenuKeyDown}
                                className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-surface-elevated border border-white/15 p-1 shadow-2xl z-50 backdrop-blur-xl"
                            >
                                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white/40 tracking-wider">
                                    Studio Department Modules
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                                    {PREVIEW_MODULES.map(m => {
                                        const Icon = m.icon;
                                        const isSeated = activeAgents.includes(m.agentId);
                                        const isSelected = m.id === boardroomPreviewModuleId;

                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    setBoardroomPreviewModuleId(m.id);
                                                    setIsMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                                                    isSelected
                                                        ? "bg-indigo-600/30 text-indigo-200 font-bold"
                                                        : "text-white/70 hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <Icon size={13} className={isSelected ? "text-indigo-300" : "text-white/40"} />
                                                    <span className="truncate">{m.title}</span>
                                                </div>
                                                {isSeated && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Seated at table" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick pills for currently seated departments */}
                    <div className="hidden sm:flex items-center gap-1 overflow-x-auto custom-scrollbar">
                        {seatedOptions.map(m => {
                            const Icon = m.icon;
                            const isSelected = m.id === boardroomPreviewModuleId;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setBoardroomPreviewModuleId(m.id)}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                                        isSelected
                                            ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 shadow-xs"
                                            : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5"
                                    )}
                                    title={`Preview seated department ${m.title}`}
                                >
                                    <Icon size={11} className={isSelected ? "text-indigo-300" : "text-white/40"} />
                                    <span>{m.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Pop out to full studio */}
                <button
                    type="button"
                    onClick={handleExitToStudio}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                    title="Open this module full-screen in Studio"
                    data-testid="boardroom-module-exit-btn"
                >
                    <ExternalLink size={12} />
                    <span className="hidden md:inline">Open in Full Studio</span>
                </button>
            </div>

            {/* In-Place Module Viewport */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-bg-dark overflow-auto custom-scrollbar">
                <ModuleErrorBoundary key={boardroomPreviewModuleId} moduleName={boardroomPreviewModuleId}>
                    <Suspense fallback={<LoadingFallback />}>
                        {renderActiveModuleComponent()}
                    </Suspense>
                </ModuleErrorBoundary>
            </div>
        </div>
    );
}

export const BoardroomModulePreview = React.memo(BoardroomModulePreviewContent);
export default BoardroomModulePreview;
