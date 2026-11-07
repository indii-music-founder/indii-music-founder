import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    Compass,
    DollarSign,
    GitMerge,
    Music2,
    PackageCheck,
    Palette,
    RotateCcw,
    Scale,
    Shield,
    Sparkles,
    Target,
    UserPlus,
    WalletCards,
    type LucideIcon,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    deterministicBoardroomExecutiveFallback,
    judgeBoardroomExecutiveIntent,
    type BoardroomExecutiveContext,
    type BoardroomExecutiveMission,
    type BoardroomExecutiveVerdict,
} from '@/config/typesafeJudgments';
import { BOARDROOM_PRIMARY_HEAD_IDS } from './ParticipantSelector';
import { boardroomMetaHarnessService } from '@/services/business-harness';
import { auth } from '@/services/firebase';

export interface BoardroomMissionOption {
    id: BoardroomExecutiveMission;
    label: string;
    description: string;
    badge: string;
    agentIds: string[];
    prompt: string;
    icon: LucideIcon;
}

export const BOARDROOM_MISSIONS: readonly BoardroomMissionOption[] = [
    {
        id: 'master_audit',
        label: 'Master Audio & Golden Metadata',
        description: 'Extract Audio DNA, verify ISRC, and check DDEX streaming readiness.',
        badge: 'Music + Distribution',
        agentIds: ['music', 'distribution'],
        prompt: 'Audit my latest master recording: extract Audio DNA, verify ISRC, and check DDEX readiness.',
        icon: Music2,
    },
    {
        id: 'split_rights',
        label: 'Draft Split Sheet & Clear Rights',
        description: 'Verify 50/50 splits, sample clearances, and draft collaborator contracts.',
        badge: 'Legal + Finance',
        agentIds: ['legal', 'finance'],
        prompt: 'Draft a standard 50/50 co-writer split sheet for my current track and check for sample clearance hurdles.',
        icon: Scale,
    },
    {
        id: 'royalty_waterfall',
        label: 'Recoupment & Waterfall Modeling',
        description: 'Model streaming recoupment, publishing dividends, and manager fee savings.',
        badge: 'Finance Chief',
        agentIds: ['finance'],
        prompt: 'Model our distribution and publishing royalty waterfall to calculate recoupment and net earnings.',
        icon: DollarSign,
    },
    {
        id: 'ddex_catalog',
        label: 'Catalog Audit & DDEX Delivery',
        description: 'Audit catalog gaps, generate BWARM reports, and stage DSP releases.',
        badge: 'Distribution + Publishing',
        agentIds: ['distribution', 'publishing'],
        prompt: 'Inspect my catalog for missing metadata gaps and prepare staged DDEX release payloads.',
        icon: PackageCheck,
    },
    {
        id: 'campaign_swarm',
        label: 'Release Campaign & Social Rollout',
        description: 'Synchronize 4-week marketing, social reels, and brand positioning.',
        badge: 'Marketing + Social + Brand',
        agentIds: ['marketing', 'social', 'brand'],
        prompt: 'Build a synchronized 4-week release rollout across Marketing, Social, and Brand strategy.',
        icon: Target,
    },
    {
        id: 'creative_sync',
        label: 'Creative & Visual Direction Sync',
        description: 'Align cover art, canvas visuals, and video teasers with seated directors.',
        badge: 'Creative + Video + Brand',
        agentIds: ['creative', 'video', 'brand'],
        prompt: 'Review our pinned visual assets and align cover art, canvas visuals, and video teasers.',
        icon: Palette,
    },
];

/**
 * Inline executive flow controls for the unified 48px Boardroom header row.
 * Embeds the Missions & Seating dropdown, the debounced Jev System One
 * recommendation chip (Judgment 82), and a compact Meta-Harness governance
 * popover directly inside the header — eliminating stacked bars above the chat.
 */
export function BoardroomJourney() {
    const [isMissionsOpen, setIsMissionsOpen] = useState(false);
    const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
    const missionsToggleRef = useRef<HTMLButtonElement>(null);
    const governanceToggleRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        commandBarInput,
        activeAgents,
        referencedAssets,
        agentHistory,
        addActiveAgent,
        soloAgent,
        setCommandBarInput,
    } = useStore(
        useShallow(state => ({
            commandBarInput: state.commandBarInput,
            activeAgents: state.activeAgents,
            referencedAssets: state.referencedAssets,
            agentHistory: state.agentHistory,
            addActiveAgent: state.addActiveAgent,
            soloAgent: state.soloAgent,
            setCommandBarInput: state.setCommandBarInput,
        })),
    );

    const safeActiveAgents = useMemo(() => activeAgents || [], [activeAgents]);
    const safeAssets = useMemo(() => referencedAssets || [], [referencedAssets]);
    const safeMessages = useMemo(() => agentHistory || [], [agentHistory]);

    const context = useMemo<BoardroomExecutiveContext>(
        () => ({
            prompt: commandBarInput || '',
            activeAgents: safeActiveAgents,
            hasReferencedAssets: safeAssets.length > 0,
            messageCount: safeMessages.length,
        }),
        [commandBarInput, safeActiveAgents, safeAssets.length, safeMessages.length],
    );

    const hasSignal = Boolean(
        context.prompt.trim() ||
            context.hasReferencedAssets ||
            safeActiveAgents.some(id => id !== 'generalist'),
    );
    const contextKey = JSON.stringify(context);
    const [judgedContext, setJudgedContext] = useState<{ key: string; verdict: BoardroomExecutiveVerdict } | null>(null);
    const recommendation =
        judgedContext?.key === contextKey
            ? judgedContext.verdict
            : deterministicBoardroomExecutiveFallback(context);

    useEffect(() => {
        let current = true;
        const timer = window.setTimeout(() => {
            void judgeBoardroomExecutiveIntent(context).then(result => {
                if (current) {
                    setJudgedContext({ key: contextKey, verdict: result });
                }
            });
        }, 350);
        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [context, contextKey]);

    // Close popovers on outside click
    useEffect(() => {
        if (!isMissionsOpen && !isGovernanceOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsMissionsOpen(false);
                setIsGovernanceOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isMissionsOpen, isGovernanceOpen]);

    const launchMission = (missionId: BoardroomExecutiveMission) => {
        const option = BOARDROOM_MISSIONS.find(m => m.id === missionId);
        setIsMissionsOpen(false);
        missionsToggleRef.current?.focus();
        if (!option) return;

        if (addActiveAgent) {
            option.agentIds.forEach(id => addActiveAgent(id));
        } else {
            const merged = Array.from(new Set([...safeActiveAgents, ...option.agentIds]));
            useStore.setState({ activeAgents: merged });
        }

        if (setCommandBarInput && !commandBarInput?.trim()) {
            setCommandBarInput(option.prompt);
        }
    };

    const handleConveneAll = () => {
        setIsMissionsOpen(false);
        useStore.setState({
            activeAgents: ['generalist', ...BOARDROOM_PRIMARY_HEAD_IDS],
        });
    };

    const handleSoloConductor = () => {
        setIsMissionsOpen(false);
        if (soloAgent) {
            soloAgent('generalist');
        } else {
            useStore.setState({ activeAgents: ['generalist'] });
        }
    };

    const handleResetSeating = () => {
        setIsMissionsOpen(false);
        useStore.setState({ activeAgents: ['generalist'] });
    };

    // Meta-Harness Governance telemetry (compact popover replacement for the 3-card row)
    const userId = auth.currentUser?.uid ?? null;
    const decision = useMemo(() => {
        if (!userId) return null;
        try {
            return boardroomMetaHarnessService.createDecision({
                userId,
                requestedAction: 'cross-domain music business action',
                runs: [],
            });
        } catch {
            return null;
        }
    }, [userId]);

    const showRecommendation = hasSignal && recommendation.confidence >= 0.5;

    return (
        <div
            ref={containerRef}
            role="group"
            aria-label="Boardroom executive missions and governance"
            data-testid="boardroom-journey"
            className="relative flex min-w-0 items-center gap-1.5"
            onKeyDown={event => {
                if (event.key !== 'Escape') return;
                if (isMissionsOpen) {
                    setIsMissionsOpen(false);
                    missionsToggleRef.current?.focus();
                } else if (isGovernanceOpen) {
                    setIsGovernanceOpen(false);
                    governanceToggleRef.current?.focus();
                }
            }}
        >
            {/* Screen reader status for Jev executive recommendation */}
            <p role="status" aria-live="polite" className="sr-only">
                {hasSignal ? recommendation.headline : 'Select an executive mission or seat department heads when ready.'}
            </p>

            {/* Missions & Seating Dropdown */}
            <div className="relative shrink-0">
                <button
                    type="button"
                    ref={missionsToggleRef}
                    aria-expanded={isMissionsOpen}
                    aria-controls="boardroom-missions-options"
                    aria-label="Missions"
                    title="Executive missions & swarm seating presets"
                    onClick={() => {
                        setIsMissionsOpen(value => !value);
                        setIsGovernanceOpen(false);
                    }}
                    data-testid="boardroom-missions-toggle"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                    <Compass size={12} aria-hidden="true" className="text-indigo-400" />
                    <span className="hidden sm:inline">Missions</span>
                    <ChevronDown
                        size={11}
                        aria-hidden="true"
                        className={`text-gray-500 transition-transform duration-150 ${isMissionsOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isMissionsOpen && (
                    <div
                        id="boardroom-missions-options"
                        role="region"
                        aria-label="Executive missions and seating"
                        className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-[#0d0d12]/98 p-1.5 shadow-2xl backdrop-blur-2xl"
                    >
                        <div className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 mb-1">
                            Executive Missions
                        </div>
                        {BOARDROOM_MISSIONS.map(mission => {
                            const Icon = mission.icon;
                            const isRecommended = showRecommendation && recommendation.mission === mission.id;
                            return (
                                <button
                                    key={mission.id}
                                    type="button"
                                    onClick={() => launchMission(mission.id)}
                                    data-testid={`boardroom-mission-${mission.id}`}
                                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
                                >
                                    <Icon size={13} className="mt-0.5 shrink-0 text-indigo-400" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className="truncate text-xs font-medium text-gray-100">
                                                {mission.label}
                                            </span>
                                            {isRecommended && (
                                                <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-400/30">
                                                    Jev Pick
                                                </span>
                                            )}
                                        </div>
                                        <span className="mt-0.5 block text-[10px] text-gray-500 line-clamp-1">
                                            {mission.description}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}

                        <div className="mt-1.5 border-t border-white/5 pt-1.5">
                            <div className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-500">
                                Room Seating Presets
                            </div>
                            <div className="grid grid-cols-3 gap-1 px-1 pt-0.5">
                                <button
                                    type="button"
                                    onClick={handleConveneAll}
                                    data-testid="boardroom-preset-convene-all"
                                    className="flex items-center justify-center gap-1 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2 py-1.5 text-[10px] font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/20"
                                    title="Seat Orchestrator + all 9 core Department Heads"
                                >
                                    <UserPlus size={11} />
                                    <span>All 10</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSoloConductor}
                                    data-testid="boardroom-preset-solo-conductor"
                                    className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                                    title="Work 1-on-1 with indii Conductor"
                                >
                                    <Sparkles size={11} />
                                    <span>Solo Lead</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetSeating}
                                    data-testid="boardroom-preset-reset"
                                    className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                    title="Reset seating to Orchestrator only"
                                >
                                    <RotateCcw size={11} />
                                    <span>Reset</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Inline Jev Executive Recommendation Chip */}
            {showRecommendation && (
                <button
                    type="button"
                    onClick={() => launchMission(recommendation.mission)}
                    title={recommendation.headline}
                    data-testid="boardroom-journey-recommendation"
                    className="hidden min-w-0 max-w-[16rem] items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-100 transition-colors hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 lg:inline-flex"
                >
                    <Sparkles size={11} aria-hidden="true" className="shrink-0 text-indigo-300" />
                    <span className="truncate">{recommendation.actionLabel}</span>
                </button>
            )}

            {/* Compact Meta-Harness Governance Pill (replaces the permanent 3-card row) */}
            <div className="relative shrink-0">
                <button
                    type="button"
                    ref={governanceToggleRef}
                    aria-expanded={isGovernanceOpen}
                    aria-controls="boardroom-governance-digest"
                    aria-label="Meta Harness Governance"
                    title="Inspect Meta-Harness legal & cost governance"
                    onClick={() => {
                        setIsGovernanceOpen(value => !value);
                        setIsMissionsOpen(false);
                    }}
                    data-testid="boardroom-governance-toggle"
                    className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1 text-[10px] font-mono text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                    <Shield size={11} aria-hidden="true" className="text-emerald-400" />
                    <span>{decision ? decision.mode.replace('_', ' ') : 'Harness'}</span>
                    <ChevronDown
                        size={10}
                        aria-hidden="true"
                        className={`text-gray-500 transition-transform duration-150 ${isGovernanceOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isGovernanceOpen && (
                    <div
                        id="boardroom-governance-digest"
                        role="region"
                        aria-label="Meta Harness Governance Digest"
                        data-testid="boardroom-governance-popover"
                        className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#0d0d12]/98 p-3 shadow-2xl backdrop-blur-2xl"
                    >
                        <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                                Meta-Harness Telemetry
                            </span>
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
                                Active
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            <div className="rounded-lg border border-white/5 bg-black/30 p-2">
                                <div className="flex items-center gap-1 text-white/40 mb-0.5">
                                    <GitMerge size={11} />
                                    <span className="text-[8px] font-bold uppercase tracking-wider">Mode</span>
                                </div>
                                <p className="text-[11px] font-bold capitalize text-white/90 truncate">
                                    {decision ? decision.mode.replace('_', ' ') : 'standard'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-black/30 p-2">
                                <div className="flex items-center gap-1 text-white/40 mb-0.5">
                                    <Shield size={11} />
                                    <span className="text-[8px] font-bold uppercase tracking-wider">Legal</span>
                                </div>
                                <p className="text-[11px] font-bold capitalize text-white/90 truncate">
                                    {decision?.legalRisk ?? 'low'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-black/30 p-2">
                                <div className="flex items-center gap-1 text-white/40 mb-0.5">
                                    <WalletCards size={11} />
                                    <span className="text-[8px] font-bold uppercase tracking-wider">Cost</span>
                                </div>
                                <p className="text-[11px] font-bold text-white/90 truncate">
                                    {decision ? `$${decision.costImpact.total.toFixed(0)}` : '$0'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
export default BoardroomJourney;
