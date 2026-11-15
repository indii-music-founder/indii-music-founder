/**
 * ApprovalQueue — displays the Studio-projected request. Decisions travel
 * through the relay and are resolved only by the matching Studio request.
 */

import { useState, useEffect, useRef } from 'react';
import type { DesktopState } from '@/services/agent/RemoteRelayService';
import { Check, X, Shield, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface ApprovalQueueProps {
    approval: NonNullable<DesktopState['pendingApproval']>;
    onDecision: (action: 'approve' | 'reject', approvalId: string) => Promise<void>;
}

export default function ApprovalQueue({ approval, onDecision }: ApprovalQueueProps) {
    const prefersReducedMotion = useReducedMotion();
    const isMountedRef = useRef(true);
    const [sending, setSending] = useState(false);
    // Track outcome keyed to approval.id so rotating requests never inherit stale status.
    const [decisionOutcome, setDecisionOutcome] = useState<{
        approvalId: string;
        sent: boolean;
        error: string | null;
    }>({ approvalId: approval.id, sent: false, error: null });

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Track live elapsed & expiry state in an effect; stop ticking once expired.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        if (Date.now() >= approval.expiresAt) return;
        const interval = setInterval(() => {
            const current = Date.now();
            setNowMs(current);
            if (current >= approval.expiresAt) {
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [approval.id, approval.timestamp, approval.expiresAt]);

    const timeAgo = Math.max(0, Math.round((nowMs - approval.timestamp) / 1000));
    const isExpired = nowMs >= approval.expiresAt;
    const isCurrentOutcome = decisionOutcome.approvalId === approval.id;
    const sent = isCurrentOutcome && decisionOutcome.sent;
    const error = isCurrentOutcome ? decisionOutcome.error : null;

    const decide = async (action: 'approve' | 'reject') => {
        if (sending || Date.now() >= approval.expiresAt) return;
        const targetId = approval.id;
        setSending(true);
        setDecisionOutcome({ approvalId: targetId, sent: false, error: null });
        try {
            await onDecision(action, targetId);
            if (isMountedRef.current) {
                setDecisionOutcome({ approvalId: targetId, sent: true, error: null });
            }
        } catch {
            if (isMountedRef.current) {
                setDecisionOutcome({
                    approvalId: targetId,
                    sent: false,
                    error: 'Studio did not accept the decision. Retry while connected.',
                });
            }
        } finally {
            if (isMountedRef.current) {
                setSending(false);
            }
        }
    };

    return (
        <div className="relative min-h-[200px]">
            <AnimatePresence mode="wait">
                {(
                    <motion.div 
                        key="pending"
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20, scale: 0.95 }}
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
                                    <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">
                                        {isExpired ? 'Expired Request' : 'Required Action'}
                                    </p>
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
                                    type="button"
                                    whileTap={!sending && !isExpired && !prefersReducedMotion ? { scale: 0.95 } : undefined}
                                    onClick={() => void decide('reject')}
                                    disabled={sending || isExpired}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 text-white/60 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                    <X className="w-4 h-4" />
                                    Reject
                                </motion.button>
                                <motion.button
                                    type="button"
                                    whileTap={!sending && !isExpired && !prefersReducedMotion ? { scale: 0.95 } : undefined}
                                    onClick={() => void decide('approve')}
                                    disabled={sending || isExpired}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white text-black text-xs font-bold uppercase tracking-widest shadow-lg shadow-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff66]"
                                >
                                    <Check className="w-4 h-4" />
                                    Approve
                                </motion.button>
                            </div>
                            {isExpired && (
                                <p role="status" className="mt-3 text-xs text-amber-300">
                                    Authorization expired — check Desktop Studio for the current request.
                                </p>
                            )}
                            {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
                            {sent && !error && !isExpired && <p role="status" className="mt-3 text-xs text-amber-200">Decision sent. Waiting for Studio confirmation. You can retry if it stays here.</p>}
                        </div>

                        {/* Ambient Background Decoration */}
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
