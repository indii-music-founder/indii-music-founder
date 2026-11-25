import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { listSeatedManagerIds } from '@/services/agent/departments';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { X } from 'lucide-react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface MobileParticipantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MobileParticipantDrawer({ isOpen, onClose }: MobileParticipantDrawerProps) {
    const activeAgents = useStore(useShallow(state => state.activeAgents));
    const statusSummaryKey = useStore(state => {
        const workingIds = new Set<string>();
        const awaitingIds = new Set<string>();
        if (state.isAgentProcessing && state.agentHistory?.length) {
            for (const msg of state.agentHistory) {
                if (!msg.isStreaming || !msg.agentId || !msg.metadata?.boardroomStepId) continue;
                if (msg.metadata.boardroomStepStatus === 'awaiting_approval') awaitingIds.add(msg.agentId);
                else workingIds.add(msg.agentId);
            }
        }
        if (state.a2aMessages?.length) {
            for (const msg of state.a2aMessages) {
                if (msg.toAgent && msg.requiresApproval && !msg.approved) awaitingIds.add(msg.toAgent);
            }
        }
        return `${Array.from(workingIds).sort().join(',')}|${Array.from(awaitingIds).sort().join(',')}`;
    });
    const latestActionsKey = useStore(state => {
        const entries: string[] = [];
        for (const agentId of listSeatedManagerIds(state.activeAgents || [])) {
            let summary = '';
            const history = state.agentHistory ?? [];
            for (let i = history.length - 1; i >= 0; i -= 1) {
                const msg = history[i];
                if (msg.agentId === agentId && typeof msg.metadata?.boardroomStepTask === 'string') {
                    summary = msg.metadata.boardroomStepTask;
                    break;
                }
            }
            if (!summary && state.a2aMessages?.length) {
                for (let i = state.a2aMessages.length - 1; i >= 0; i -= 1) {
                    const msg = state.a2aMessages[i];
                    if (msg.toAgent === agentId) {
                        summary = msg.requiresApproval && !msg.approved
                            ? `Approval requested from ${msg.fromAgent}`
                            : `Handoff from ${msg.fromAgent}`;
                        break;
                    }
                }
            }
            entries.push(`${agentId}\u0000${summary}`);
        }
        return entries.join('\u0001');
    });
    const seatedManagers = listSeatedManagerIds(activeAgents).map(
        agentId => resolveAgentVisualIdentity(agentId)
    );
    const [workingRaw, awaitingRaw] = statusSummaryKey.split('|');
    const workingSet = new Set(workingRaw ? workingRaw.split(',') : []);
    const awaitingSet = new Set(awaitingRaw ? awaitingRaw.split(',') : []);
    const latestActionMap = new Map(
        latestActionsKey ? latestActionsKey.split('\u0001').map(entry => {
            const sep = entry.indexOf('\u0000');
            return [entry.slice(0, sep), entry.slice(sep + 1)] as const;
        }) : [],
    );

    const trapRef = useModalAccessibility(isOpen, onClose);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        ref={trapRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mobile-drawer-title"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 z-[101] bg-bg-dark border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
                            <div>
                                <h2 id="mobile-drawer-title" className="text-lg font-bold text-white">Seated Managers</h2>
                                <p className="text-xs text-white/50 mt-0.5">Indii brings in managers as needed</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-2 space-y-1 overscroll-contain">
                            {seatedManagers.length === 0 && (
                                <p className="px-4 py-8 text-center text-sm text-white/40">
                                    No department managers are seated right now. Talk to Indii to begin.
                                </p>
                            )}
                            {seatedManagers.map((identity) => {
                                return (
                                    <div
                                        key={identity.agentId}
                                        data-testid={`mobile-seated-manager-${identity.agentId}`}
                                        className="w-full flex items-center gap-4 p-3 rounded-xl border bg-white/5 border-white/10"
                                    >
                                        <div
                                            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border"
                                            style={{
                                                backgroundColor: identity.surface,
                                                borderColor: identity.accent,
                                                color: identity.accent,
                                                boxShadow: `0 0 15px ${identity.glow}`,
                                            }}
                                        >
                                            <span className="text-xs font-black" style={{ color: identity.foreground }}>
                                                {identity.initials}
                                            </span>
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold" style={{ color: identity.accent }}>
                                                    {identity.displayName}
                                                </span>
                                                <span
                                                    data-testid={`mobile-status-${identity.agentId}`}
                                                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/80"
                                                >
                                                    {awaitingSet.has(identity.agentId)
                                                        ? 'Approval requested'
                                                        : workingSet.has(identity.agentId)
                                                            ? 'Working'
                                                            : 'Idle'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-white/50 truncate pr-4">
                                                {latestActionMap.get(identity.agentId) || identity.role}
                                            </div>
                                        </div>
                                        
                                        <div className="shrink-0 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center mr-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.accent }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-5 pt-2 border-t border-white/5 shrink-0">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
