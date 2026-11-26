import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Sparkles, type LucideIcon } from 'lucide-react';
import {
    deterministicBoardroomExecutiveFallback,
    judgeBoardroomExecutiveIntent,
    type BoardroomExecutiveMission,
} from '@/config/typesafeJudgments';
import { BOARDROOM_MISSIONS } from '../constants/boardroomMissions';

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

export const EXECUTIVE_STARTER_CARDS: StarterCardItem[] = BOARDROOM_MISSIONS
    .filter((mission): mission is typeof mission & { starterCardId: string; starterAccentColor: string } =>
        Boolean(mission.starterCardId && mission.starterAccentColor),
    )
    .map(mission => ({
        id: mission.starterCardId,
        missionId: mission.id,
        title: mission.label,
        description: mission.description,
        prompt: mission.prompt,
        agentIds: [...mission.agentIds],
        icon: mission.icon,
        accentColor: mission.starterAccentColor,
        badgeText: mission.badge,
    }));

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

    const contextKey = JSON.stringify({
        prompt: (commandBarInput || '').trim(),
        activeAgents: activeAgents || [],
        hasReferencedAssets: (referencedAssets || []).length > 0,
    });
    const [judgedMission, setJudgedMission] = useState<{
        key: string;
        mission: BoardroomExecutiveMission | null;
    } | null>(null);

    const baselineTopMission = useMemo(() => {
        const verdict = deterministicBoardroomExecutiveFallback({
            prompt: commandBarInput || '',
            activeAgents: activeAgents || [],
            hasReferencedAssets: (referencedAssets || []).length > 0,
            messageCount: 0,
        });
        return verdict.confidence >= 0.5 ? verdict.mission : null;
    }, [commandBarInput, activeAgents, referencedAssets]);

    const promptText = (commandBarInput || '').trim();
    const hasAssets = (referencedAssets || []).length > 0;
    const agents = useMemo(() => activeAgents || [], [activeAgents]);
    const hasSignal = Boolean(
        promptText || hasAssets || agents.some(id => id !== 'generalist'),
    );

    useEffect(() => {
        if (!hasSignal) {
            return undefined;
        }
        let cancelled = false;
        const parsed = JSON.parse(contextKey) as {
            prompt: string;
            activeAgents: string[];
            hasReferencedAssets: boolean;
        };
        const timer = setTimeout(() => {
            void judgeBoardroomExecutiveIntent({
                prompt: parsed.prompt,
                activeAgents: parsed.activeAgents,
                hasReferencedAssets: parsed.hasReferencedAssets,
                messageCount: 0,
            })
                .then((verdict) => {
                    if (!cancelled) {
                        setJudgedMission({
                            key: contextKey,
                            mission: verdict.confidence >= 0.5 ? verdict.mission : null,
                        });
                    }
                })
                .catch(() => {});
        }, 1200);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [hasSignal, contextKey]);

    const topPickMission = judgedMission?.key === contextKey ? judgedMission.mission : baselineTopMission;

    const handleSelectCard = (card: StarterCardItem) => {
        // Seat required agents for this business domain
        card.agentIds.forEach(id => addActiveAgent(id));
        // Populate command prompt
        if (!commandBarInput?.trim()) {
            setCommandBarInput(card.prompt);
        }
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
                            className={`flex flex-col text-left p-3.5 rounded-xl border backdrop-blur-md transition-colors group cursor-pointer ${card.accentColor} ${isTopPick ? 'ring-1 ring-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.18)]' : ''}`}
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
                                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-400/30"
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
