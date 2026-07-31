import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { listHeadIds } from '@/services/agent/departments';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { X } from 'lucide-react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const AVAILABLE_AGENTS = listHeadIds().map(agentId => resolveAgentVisualIdentity(agentId));

interface MobileParticipantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MobileParticipantDrawer({ isOpen, onClose }: MobileParticipantDrawerProps) {
    const { activeAgents, toggleAgent } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
        }))
    );

    const trapRef = useFocusTrap(isOpen);

    useGlobalShortcut({
        id: 'mobile-drawer-escape',
        key: 'Escape',
        priority: 'modal',
        handler: () => onClose()
    }, [onClose], isOpen);

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
                        className="fixed inset-x-0 bottom-0 z-[101] bg-slate-900 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
                            <div>
                                <h2 id="mobile-drawer-title" className="text-lg font-bold text-white">Boardroom Agents</h2>
                                <p className="text-xs text-white/50 mt-0.5">Select agents to seat at the table</p>
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
                            {AVAILABLE_AGENTS.map((identity) => {
                                const isActive = activeAgents.includes(identity.agentId);
                                
                                return (
                                    <button
                                        key={identity.agentId}
                                        onClick={() => toggleAgent(identity.agentId)}
                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors border ${
                                            isActive 
                                                ? 'bg-white/5 border-white/10' 
                                                : 'bg-transparent border-transparent hover:bg-white/2'
                                        }`}
                                        aria-pressed={isActive}
                                    >
                                        <div
                                            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border"
                                            style={{
                                                backgroundColor: identity.surface,
                                                borderColor: isActive ? identity.accent : identity.border,
                                                color: identity.accent,
                                                boxShadow: isActive ? `0 0 15px ${identity.glow}` : 'none',
                                            }}
                                        >
                                            <span className="text-xs font-black" style={{ color: identity.foreground }}>
                                                {identity.initials}
                                            </span>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-bold" style={{ color: isActive ? identity.accent : '#fff' }}>
                                                {identity.displayName}
                                            </div>
                                            <div className="text-[10px] text-white/50 truncate pr-4">
                                                {identity.role}
                                            </div>
                                        </div>
                                        
                                        <div className="shrink-0 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center mr-2">
                                            {isActive && (
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.accent }} />
                                            )}
                                        </div>
                                    </button>
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
