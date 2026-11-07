import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Music2, Scale, DollarSign, PackageCheck, Sparkles, type LucideIcon } from 'lucide-react';
import {
    deterministicBoardroomExecutiveFallback,
    type BoardroomExecutiveMission,
} from '@/config/typesafeJudgments';

export interface StarterCardItem {
    id: string;
    missionId: BoardroomExecutiveMission;
    title: string;
    description: string;
    prompt: string;
    agentIds: string[];
    icon: LucideIcon;
    accentColor: string;
    badgeText: string;
}

export const EXECUTIVE_STARTER_CARDS: StarterCardItem[] = [
    {
        id: 'master-audit',
        missionId: 'master_audit',
        title: 'Master Audio & Golden Metadata',
        description: 'Extract Audio DNA, verify ISRC, and check DDEX streaming readiness.',
        prompt: 'Audit my latest master recording: extract Audio DNA, verify ISRC, and check DDEX readiness.',
        agentIds: ['music', 'distribution'],
        icon: Music2,
        accentColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:border-cyan-400/50',
        badgeText: 'Music + Distribution',
    },
    {
        id: 'split-sheet',
        missionId: 'split_rights',
        title: 'Draft Split Sheet & Clear Rights',
        description: 'Verify 50/50 splits, sample clearances, and draft collaborator contracts.',
        prompt: 'Draft a standard 50/50 co-writer split sheet for my current track and check for sample clearance hurdles.',
        agentIds: ['legal', 'finance'],
        icon: Scale,
        accentColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:border-amber-400/50',
        badgeText: 'Legal + Finance',
    },
    {
        id: 'royalty-waterfall',
        missionId: 'royalty_waterfall',
        title: 'Recoupment & Waterfall Modeling',
        description: 'Model streaming recoupment, publishing dividends, and manager fee savings.',
        prompt: 'Model our distribution and publishing royalty waterfall to calculate recoupment and net earnings.',
        agentIds: ['finance'],
        icon: DollarSign,
        accentColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50',
        badgeText: 'Finance Chief',
    },
    {
        id: 'ddex-catalog',
        missionId: 'ddex_catalog',
        title: 'Catalog Audit & DDEX Delivery',
        description: 'Audit catalog gaps, generate BWARM reports, and stage DSP releases.',
        prompt: 'Inspect my catalog for missing metadata gaps and prepare staged DDEX release payloads.',
        agentIds: ['distribution', 'music'],
        icon: PackageCheck,
        accentColor: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-400/50',
        badgeText: 'Distribution Chief',
    },
];

interface BoardroomStarterCardsProps {
    compact?: boolean;
}

export const BoardroomStarterCards: React.FC<BoardroomStarterCardsProps> = ({ compact = false }) => {
    const { addActiveAgent, setCommandBarInput, commandBarInput, activeAgents, referencedAssets } = useStore(
        useShallow(state => ({
            addActiveAgent: state.addActiveAgent,
            setCommandBarInput: state.setCommandBarInput,
            commandBarInput: state.commandBarInput,
            activeAgents: state.activeAgents,
            referencedAssets: state.referencedAssets,
        }))
    );

    const topPickMission = useMemo(() => {
        const verdict = deterministicBoardroomExecutiveFallback({
            prompt: commandBarInput || '',
            activeAgents: activeAgents || [],
            hasReferencedAssets: (referencedAssets || []).length > 0,
            messageCount: 0,
        });
        return verdict.confidence >= 0.5 ? verdict.mission : null;
    }, [commandBarInput, activeAgents, referencedAssets]);

    const handleSelectCard = (card: StarterCardItem) => {
        // Seat required agents for this business domain
        card.agentIds.forEach(id => addActiveAgent(id));
        // Populate command prompt
        setCommandBarInput(card.prompt);
    };

    return (
        <div className={`w-full max-w-xl mx-auto ${compact ? 'space-y-2' : 'space-y-3'}`}>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Executive Business Starters</span>
            </div>
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-2.5'}`}>
                {EXECUTIVE_STARTER_CARDS.map((card, idx) => {
                    const Icon = card.icon;
                    const isTopPick = topPickMission === card.missionId;
                    return (
                        <motion.div
                            key={card.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectCard(card)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelectCard(card);
                                }
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * idx, duration: 0.3 }}
                            className={`flex flex-col text-left p-3.5 rounded-xl border backdrop-blur-md transition-all group cursor-pointer ${card.accentColor} ${isTopPick ? 'ring-1 ring-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.18)]' : ''}`}
                            data-testid={`starter-card-${card.id}`}
                        >
                            <div className="flex items-center justify-between w-full mb-1.5 gap-1">
                                <span className="p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                                    <Icon size={16} />
                                </span>
                                <div className="flex items-center gap-1">
                                    {isTopPick && (
                                        <span
                                            data-testid={`starter-card-jev-pick-${card.id}`}
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-400/30"
                                        >
                                            <Sparkles size={9} />
                                            Top Pick
                                        </span>
                                    )}
                                    <span className="text-[10px] font-mono text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                        {card.badgeText}
                                    </span>
                                </div>
                            </div>
                            <h4 className="text-xs font-semibold text-white/90 group-hover:text-white transition-colors">
                                {card.title}
                            </h4>
                            <p className="text-[11px] text-white/50 mt-1 line-clamp-2 leading-relaxed">
                                {card.description}
                            </p>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
