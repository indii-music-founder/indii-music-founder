import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, Bot, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface SwarmCollaborationFeedProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SwarmCollaborationFeed({ isOpen, onClose }: SwarmCollaborationFeedProps) {
    const dialogRef = useModalAccessibility(isOpen, onClose);
    const toast = useToast();
    const { a2aMessages, updateA2AMessage } = useStore(
        useShallow(state => ({
            a2aMessages: state.a2aMessages,
            updateA2AMessage: state.updateA2AMessage
        }))
    );

    const handleApprove = (msgId: string) => {
        updateA2AMessage(msgId, { approved: true, rejected: false });
        toast.success('Handoff approved! Swarm execution resuming.');
    };

    const handleReject = (msgId: string) => {
        updateA2AMessage(msgId, { approved: false, rejected: true });
        toast.info('Revision requested. The handoff was stopped.');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000]"
                    />
                    
                    {/* Slide-over Panel */}
                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Swarm Collaboration Feed"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 bottom-0 w-[450px] max-w-full bg-[#0a0a0e] border-l border-white/10 z-[100001] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-2">
                                <Bot className="text-indigo-400" size={18} />
                                <h2 className="text-base font-bold tracking-tight text-gray-100">Swarm Collaboration Feed</h2>
                            </div>
                            <button type="button" aria-label="Close collaboration feed" onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {a2aMessages.length === 0 ? (
                                <div className="text-center p-12 text-white/40">
                                    <Bot className="mx-auto mb-4 opacity-20" size={32} />
                                    <p className="text-xs font-medium text-gray-300">No agent-to-agent activity yet.</p>
                                    <p className="text-[10px] mt-2 opacity-80">Behind-the-scenes swarm negotiations will appear here in real-time.</p>
                                </div>
                            ) : (
                                [...a2aMessages].reverse().map(msg => (
                                    <div key={msg.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 relative group">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="flex items-center gap-1 text-indigo-400 font-bold uppercase tracking-wider">
                                                <Bot size={12} /> {msg.fromAgent} ➔ {msg.toAgent}
                                            </span>
                                            <span className="text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-sm text-gray-200 leading-relaxed font-medium">{msg.content}</p>
                                        
                                        {msg.requiresApproval && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                {msg.approved ? (
                                                    <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-md border border-green-500/20">
                                                        ✓ Approved
                                                    </span>
                                                ) : msg.rejected ? (
                                                    <span className="text-xs font-bold text-red-300 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                                                        Revision requested
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(msg.id)}
                                                            className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg border border-green-500/30 transition-all font-semibold"
                                                        >
                                                            <Check size={12} /> Approve Handoff
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(msg.id)}
                                                            className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg border border-red-500/30 transition-all font-semibold"
                                                        >
                                                            <RefreshCw size={12} /> Request Revision
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
