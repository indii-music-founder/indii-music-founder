/**
 * ApprovalQueue — Wired to real pendingApproval from agentUISlice.
 * When the agent requests user approval via requestApproval(), this shows
 * the approval card on the phone remote. Approve/Reject calls resolveApproval().
 */

import { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Check, X, AlertTriangle, Shield, Clock, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ApprovalQueueProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

export default function ApprovalQueue({ onSendCommand }: ApprovalQueueProps) {
    const { pendingApproval, resolveApproval, isAgentProcessing } = useStore(
        useShallow(state => ({
            pendingApproval: state.pendingApproval,
            resolveApproval: state.resolveApproval,
            isAgentProcessing: state.isAgentProcessing,
        }))
    );

    // Compute elapsed seconds in an effect
    const [timeAgo, setTimeAgo] = useState(0);
    useEffect(() => {
        if (!pendingApproval) return;
        const updateTime = () =>
            setTimeAgo(Math.round((Date.now() - pendingApproval.timestamp) / 1000));
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [pendingApproval]);

    const handleApprove = () => {
        if (!pendingApproval) return;
        resolveApproval(true);
        onSendCommand({
            type: 'agent_action',
            payload: { action: 'approve', approvalId: pendingApproval.id },
        });
    };

    const handleReject = () => {
        if (!pendingApproval) return;
        resolveApproval(false);
        onSendCommand({
            type: 'agent_action',
            payload: { action: 'reject', approvalId: pendingApproval.id },
        });
    };

    return (
        <div className="relative min-h-[200px]">
            <AnimatePresence mode="wait">
                {!pendingApproval ? (
                    <motion.div 
                        key="clear"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center py-12 text-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 relative">
                            <motion.div 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl"
                            />
                            <Check className="w-8 h-8 text-white/20" />
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-2">Gate is Clear</h3>
                        <p className="text-xs text-[#8e8e93] max-w-[200px] mb-6">No pending agent actions require your authorization.</p>
                        
                        {isAgentProcessing && (
                            <motion.div 
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20"
                            >
                                <Clock className="w-3 h-3 text-blue-400" />
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Agent Processing…</span>
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div 
                        key="pending"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="relative overflow-hidden rounded-[32px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-[#1c1c1e] to-red-500/10 shadow-[0_32px_64px_-16px_rgba(251,191,36,0.15)]"
                    >
                        {/* Status Header */}
                        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">Authorization</h3>
                                    <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">Required Action</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-mono text-[#8e8e93]">{timeAgo}s</span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                                <div className="flex-1">
                                    <p className="text-sm text-white/90 leading-relaxed font-medium">
                                        {pendingApproval.content}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 mb-8">
                                <Fingerprint className="w-4 h-4 text-[#8e8e93]" />
                                <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">
                                    Request ID: {pendingApproval.id.slice(0, 12).toUpperCase()}
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleReject}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 text-white/60 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5"
                                >
                                    <X className="w-4 h-4" />
                                    Reject
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleApprove}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white text-black text-xs font-bold uppercase tracking-widest shadow-lg shadow-white/10"
                                >
                                    <Check className="w-4 h-4" />
                                    Approve
                                </motion.button>
                            </div>
                        </div>

                        {/* Ambient Background Decoration */}
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
