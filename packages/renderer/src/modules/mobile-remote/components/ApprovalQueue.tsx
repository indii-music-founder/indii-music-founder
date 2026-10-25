/**
 * ApprovalQueue — displays the Studio-projected request. Decisions travel
 * through the relay and are resolved only by the matching Studio request.
 */

import { useState, useEffect } from 'react';
import type { DesktopState } from '@/services/agent/RemoteRelayService';
import { Check, X, Shield, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ApprovalQueueProps {
    approval: NonNullable<DesktopState['pendingApproval']>;
    onDecision: (action: 'approve' | 'reject', approvalId: string) => Promise<void>;
}

export default function ApprovalQueue({ approval, onDecision }: ApprovalQueueProps) {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Compute elapsed seconds in an effect
    const [timeAgo, setTimeAgo] = useState(0);
    useEffect(() => {
        const updateTime = () =>
            setTimeAgo(Math.round((Date.now() - approval.timestamp) / 1000));
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [approval.timestamp]);

    const decide = async (action: 'approve' | 'reject') => {
        if (sending || Date.now() >= approval.expiresAt) return;
        setSending(true);
        setError(null);
        try {
            await onDecision(action, approval.id);
            setSent(true);
        } catch {
            setError('Studio did not accept the decision. Retry while connected.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="relative min-h-[200px]">
            <AnimatePresence mode="wait">
                {(
                    <motion.div 
                        key="pending"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="relative overflow-hidden rounded-[32px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-[#1a1512] to-red-500/10 shadow-[0_32px_64px_-16px_rgba(251,191,36,0.15)] backdrop-blur-xl"
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
                                        {approval.content}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 mb-8">
                                <Fingerprint className="w-4 h-4 text-[#8e8e93]" />
                                <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">
                                    Request ID: {approval.id.slice(0, 12).toUpperCase()}
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => void decide('reject')}
                                    disabled={sending}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 text-white/60 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5"
                                >
                                    <X className="w-4 h-4" />
                                    Reject
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => void decide('approve')}
                                    disabled={sending}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white text-black text-xs font-bold uppercase tracking-widest shadow-lg shadow-white/10"
                                >
                                    <Check className="w-4 h-4" />
                                    Approve
                                </motion.button>
                            </div>
                            {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
                            {sent && !error && <p role="status" className="mt-3 text-xs text-amber-200">Decision sent. Waiting for Studio confirmation. You can retry if it stays here.</p>}
                        </div>

                        {/* Ambient Background Decoration */}
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
