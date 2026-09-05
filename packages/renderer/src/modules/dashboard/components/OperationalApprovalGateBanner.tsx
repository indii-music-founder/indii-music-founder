import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Check, X, CheckCheck } from 'lucide-react';
import { toolApprovalService, type PendingToolApproval } from '@/services/agent/governance/ToolApprovalService';
import { useToast } from '@/core/context/ToastContext';
import { Logger } from '@/core/logger/Logger';

export interface OperationalApprovalGateBannerProps {
    className?: string;
}

export function OperationalApprovalGateBanner({ className = 'w-full px-4 mb-6' }: OperationalApprovalGateBannerProps) {
    const [pendingApprovals, setPendingApprovals] = useState<(PendingToolApproval & { id: string })[]>([]);
    const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        const unsub = toolApprovalService.onPendingApprovals(setPendingApprovals);
        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, []);

    if (pendingApprovals.length === 0) {
        return null;
    }

    const handleApprove = async (id: string) => {
        setApprovalBusyId(id);
        try {
            const res = await toolApprovalService.approve(id);
            if (res?.success) {
                if (toast?.success) {
                    toast.success('Gate approved & executed');
                }
            } else {
                const errorMsg = res?.error || 'Gate approval failed';
                Logger.error('OperationalApprovalGateBanner', errorMsg);
                if (toast?.error) {
                    toast.error(errorMsg);
                }
            }
        } catch (err) {
            Logger.error('OperationalApprovalGateBanner', 'Approval error', err);
            if (toast?.error) {
                toast.error('Failed to execute gate approval');
            }
        } finally {
            setApprovalBusyId(null);
        }
    };

    const handleDeny = async (id: string) => {
        setApprovalBusyId(id);
        try {
            await toolApprovalService.deny(id, 'User denied from dashboard quick-action gate');
            if (toast?.success) {
                toast.success('Gate denied');
            }
        } catch (err) {
            Logger.error('OperationalApprovalGateBanner', 'Denial error', err);
            if (toast?.error) {
                toast.error('Failed to deny gate');
            }
        } finally {
            setApprovalBusyId(null);
        }
    };

    const handleApproveAll = async () => {
        setApprovalBusyId('all');
        let successCount = 0;
        let failCount = 0;

        for (const item of pendingApprovals) {
            try {
                const res = await toolApprovalService.approve(item.id);
                if (res?.success) {
                    successCount += 1;
                } else {
                    failCount += 1;
                }
            } catch (err) {
                Logger.error('OperationalApprovalGateBanner', `Failed approving ${item.id}`, err);
                failCount += 1;
            }
        }

        if (successCount > 0 && toast?.success) {
            toast.success(`Approved and executed ${successCount} gate${successCount > 1 ? 's' : ''}`);
        }
        if (failCount > 0 && toast?.error) {
            toast.error(`${failCount} gate approval${failCount > 1 ? 's' : ''} encountered issues`);
        }
        setApprovalBusyId(null);
    };

    const isMultiple = pendingApprovals.length > 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={className}
            data-testid="operational-approval-gate-banner"
        >
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col gap-3">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                                <ShieldAlert size={20} className="animate-pulse" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                                        Quick-Action Approval Gate
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
                                        {pendingApprovals.length} PENDING
                                    </span>
                                </div>
                                <p className="text-xs text-gray-300 font-medium truncate mt-0.5">
                                    {isMultiple
                                        ? `${pendingApprovals.length} autonomous agent actions require confirmation`
                                        : 'Autonomous action paused for authorization'}
                                </p>
                            </div>
                        </div>

                        {isMultiple && (
                            <button
                                type="button"
                                disabled={approvalBusyId !== null}
                                onClick={handleApproveAll}
                                data-testid="banner-approve-all-btn"
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/40 transition-all disabled:opacity-50 self-end sm:self-center"
                            >
                                <CheckCheck size={14} />
                                Approve All ({pendingApprovals.length})
                            </button>
                        )}
                    </div>

                    {/* Pending Approvals List */}
                    <div className={`grid gap-2.5 ${isMultiple ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {pendingApprovals.map((item, index) => {
                            const isBusy = approvalBusyId === item.id || approvalBusyId === 'all';
                            const riskColor = item.riskTier === 'destructive'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : item.riskTier === 'write'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

                            return (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between gap-2.5 hover:border-amber-500/30 transition-colors"
                                    data-testid={`gate-card-${item.id}`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-white truncate">{item.toolName}</span>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${riskColor}`}>
                                                {item.riskTier}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-300 leading-snug mt-1 line-clamp-2">
                                            {item.description || 'Action awaiting authorization'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleApprove(item.id)}
                                            data-testid={index === 0 ? 'banner-approve-btn' : `banner-approve-btn-${item.id}`}
                                            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50"
                                        >
                                            <Check size={12} />
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleDeny(item.id)}
                                            data-testid={index === 0 ? 'banner-deny-btn' : `banner-deny-btn-${item.id}`}
                                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-300 font-bold text-[10px] uppercase tracking-wider border border-white/10 transition-all disabled:opacity-50"
                                        >
                                            <X size={12} />
                                            Deny
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
    );
}
