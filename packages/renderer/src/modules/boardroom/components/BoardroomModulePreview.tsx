import React, { lazy, Suspense } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Palette,
    Scale,
    DollarSign,
    Library,
    Target,
    Share2,
    Briefcase,
    PackageCheck,
    Key,
    GitBranch,
    FileText,
    ExternalLink,
    ChevronDown,
    Sparkles,
} from 'lucide-react';
import type { ModuleId } from '@/core/constants';
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

interface ModuleOption {
    id: ModuleId;
    title: string;
    agentId: string;
    icon: React.ElementType;
}

export const PREVIEW_MODULES: readonly ModuleOption[] = [
    { id: 'creative', title: 'Creative Studio', agentId: 'creative', icon: Palette },
    { id: 'publishing', title: 'Publishing', agentId: 'publishing', icon: Library },
    { id: 'finance', title: 'Finance', agentId: 'finance', icon: DollarSign },
    { id: 'legal', title: 'Legal & Split Sheets', agentId: 'legal', icon: Scale },
    { id: 'marketing', title: 'Marketing', agentId: 'marketing', icon: Target },
    { id: 'social', title: 'Social Rollout', agentId: 'social', icon: Share2 },
    { id: 'brand', title: 'Brand Identity', agentId: 'brand', icon: Briefcase },
    { id: 'distribution', title: 'Distribution', agentId: 'distribution', icon: PackageCheck },
    { id: 'registration', title: 'Registration Center', agentId: 'registration', icon: Key },
    { id: 'licensing', title: 'Licensing', agentId: 'licensing', icon: Key },
    { id: 'workflow', title: 'Workflow Lab', agentId: 'workflow', icon: GitBranch },
    { id: 'notes', title: 'Founder Notes', agentId: 'notes', icon: FileText },
];

export function BoardroomModulePreview() {
    const {
        boardroomPreviewModuleId,
        setBoardroomPreviewModuleId,
        activeAgents,
        setModule,
        setConversationMode,
    } = useStore(
        useShallow(state => ({
            boardroomPreviewModuleId: state.boardroomPreviewModuleId || 'creative',
            setBoardroomPreviewModuleId: state.setBoardroomPreviewModuleId,
            activeAgents: state.activeAgents || [],
            setModule: state.setModule,
            setConversationMode: state.setConversationMode,
        }))
    );

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const activeOption = PREVIEW_MODULES.find(m => m.id === boardroomPreviewModuleId) || PREVIEW_MODULES[0];
    const ActiveIcon = activeOption.icon;

    // Seated agent priority pills
    const seatedOptions = PREVIEW_MODULES.filter(m => activeAgents.includes(m.agentId));

    const handleExitToStudio = () => {
        setModule(boardroomPreviewModuleId);
        setConversationMode('direct');
    };

    const renderActiveModuleComponent = () => {
        switch (boardroomPreviewModuleId) {
            case 'creative': return <CreativeStudio />;
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
            default: return <CreativeStudio />;
        }
    };

    return (
        <div data-testid="boardroom-module-preview" className="h-full w-full flex flex-col bg-zinc-950 text-white min-h-0 min-w-0 overflow-hidden">
            {/* Header bar with Module Selector & Seated Pills */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10 shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Module Dropdown Trigger */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all"
                            data-testid="boardroom-module-picker-btn"
                        >
                            <ActiveIcon size={14} className="text-indigo-400 shrink-0" />
                            <span className="truncate">{activeOption.title}</span>
                            <ChevronDown size={12} className={cn("text-white/40 transition-transform", isMenuOpen && "rotate-180")} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-[#0e0e14] border border-white/15 p-1 shadow-2xl z-50 backdrop-blur-xl">
                                <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase text-white/40 tracking-wider">
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
                                                onClick={() => {
                                                    setBoardroomPreviewModuleId(m.id);
                                                    setIsMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors",
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
                                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap shrink-0",
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition-all shrink-0"
                    title="Open this module full-screen in Studio"
                    data-testid="boardroom-module-exit-btn"
                >
                    <ExternalLink size={12} />
                    <span className="hidden md:inline">Open in Full Studio</span>
                </button>
            </div>

            {/* In-Place Module Viewport */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-[#06060a] overflow-y-auto custom-scrollbar">
                <ModuleErrorBoundary moduleName={boardroomPreviewModuleId}>
                    <Suspense fallback={<LoadingFallback />}>
                        {renderActiveModuleComponent()}
                    </Suspense>
                </ModuleErrorBoundary>
            </div>
        </div>
    );
}
export default BoardroomModulePreview;
