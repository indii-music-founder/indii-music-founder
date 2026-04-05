/**
 * ApprovalQueue — Wired to real pendingApproval from agentUISlice.
 * When the agent requests user approval via requestApproval(), this shows
 * the approval card on the phone remote. Approve/Reject calls resolveApproval().
 */

import { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Check, X, AlertTriangle, Shield, Clock } from 'lucide-react';

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

    // Compute elapsed seconds in an effect (Date.now() is impure, cannot be called during render)
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

    // Nothing pending — show clear state
    if (!pendingApproval) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-green-900/20 border border-green-700/30 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-semibold">All clear</p>
                <p className="text-xs text-[#6e7681] mt-1">No pending approvals</p>
                {isAgentProcessing && (
                    <p className="text-xs text-blue-400 mt-3 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 animate-pulse" />
                        Agent is processing — approval may appear soon
                    </p>
                )}
            </div>
        );
    }

    // Map approval type to visual cues
    const typeLabel = pendingApproval.type || 'Action';

    return (
        <div className="space-y-3">
            {/* Approval Card */}
            <div className="rounded-2xl border border-[#30363d]/40 bg-[#161b22]/70 backdrop-blur-xl overflow-hidden">
                {/* Header */}
                <div className="h-16 bg-gradient-to-br from-amber-900/30 to-red-900/20 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-amber-400" />
                </div>

                {/* Content */}
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-amber-400 bg-amber-600/20">
                            {typeLabel}
                        </span>
                        <span className="text-[10px] text-[#484f58]">{timeAgo}s ago</span>
                    </div>

                    <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <h3 className="text-sm font-semibold text-white">Agent Approval Required</h3>
                    </div>

                    <p className="text-xs text-[#c9d1d9] leading-relaxed bg-[#0d1117] rounded-lg p-3 border border-[#30363d]/40">
                        {pendingApproval.content}
                    </p>
                </div>

                {/* Action buttons — these call resolveApproval() which resolves the Promise */}
                <div className="flex border-t border-[#30363d]/40">
                    <button
                        onClick={handleReject}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 text-red-400 hover:bg-red-900/20 transition-colors active:scale-95 border-r border-[#30363d]/40"
                    >
                        <X className="w-4 h-4" />
                        <span className="text-xs font-semibold">Reject</span>
                    </button>
                    <button
                        onClick={handleApprove}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 text-green-400 hover:bg-green-900/20 transition-colors active:scale-95"
                    >
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-semibold">Approve</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
