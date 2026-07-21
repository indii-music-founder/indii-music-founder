import React, { useEffect, useState } from 'react';
import { ChevronRight, ShieldAlert, Check, X, Monitor, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { Logger } from '@/core/logger/Logger';
import { toolApprovalService, type PendingToolApproval } from '@/services/agent/governance/ToolApprovalService';

interface ToolApprovalsPanelProps {
    toggleRightPanel: () => void;
}

const RISK_TIER_COLOR: Record<string, string> = {
    read: 'text-blue-400',
    write: 'text-yellow-400',
    destructive: 'text-red-400',
};

/**
 * Allowlist management (ISSUE-1111 residual #4). The computer:allowlist-* IPC
 * channels have existed since CE-2/CE-5 with no UI consumer — this closes that
 * gap. Fail-closed semantics unchanged: an empty list still means nothing is
 * allowed to launch; this UI is how a user actually populates it.
 */
function AllowlistSection() {
    const toast = useToast();
    const [apps, setApps] = useState<string[]>([]);
    const [newApp, setNewApp] = useState('');
    const [loading, setLoading] = useState(false);
    const [available, setAvailable] = useState(true);

    const refresh = React.useCallback(async () => {
        if (typeof window === 'undefined' || !window.electronAPI?.computer) {
            setAvailable(false);
            return;
        }
        try {
            const result = await window.electronAPI.computer.allowlistGet();
            if (result.success && result.data) {
                setApps(result.data.apps);
            }
        } catch (error) {
            Logger.error('ToolApprovalsPanel', 'Failed to load allowlist', error);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleAdd = async () => {
        const trimmed = newApp.trim();
        if (!trimmed || !window.electronAPI?.computer) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.computer.allowlistAdd(trimmed);
            if (result.success) {
                setApps(result.data?.apps ?? []);
                setNewApp('');
                toast.success(`${trimmed} added to allowlist`);
            } else {
                toast.error(result.error || 'Failed to add app');
            }
        } catch (error) {
            Logger.error('ToolApprovalsPanel', 'Failed to add to allowlist', error);
            toast.error('Failed to add app');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (app: string) => {
        if (!window.electronAPI?.computer) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.computer.allowlistRemove(app);
            if (result.success) {
                setApps(result.data?.apps ?? []);
                toast.success(`${app} removed from allowlist`);
            } else {
                toast.error(result.error || 'Failed to remove app');
            }
        } catch (error) {
            Logger.error('ToolApprovalsPanel', 'Failed to remove from allowlist', error);
            toast.error('Failed to remove app');
        } finally {
            setLoading(false);
        }
    };

    if (!available) {
        return (
            <div className="border-t border-white/10 pt-4">
                <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-2 mb-2">
                    <Monitor size={12} /> Computer App Allowlist
                </h4>
                <p className="text-xs text-gray-500">Requires the indii desktop app.</p>
            </div>
        );
    }

    return (
        <div className="border-t border-white/10 pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <Monitor size={12} /> Computer App Allowlist
            </h4>
            <p className="text-[11px] text-gray-500">
                Apps `computer_open_app` may launch. Empty list = nothing allowed (fail-closed).
            </p>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newApp}
                    onChange={(e) => setNewApp(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                    placeholder="Safari or com.apple.Safari"
                    disabled={loading}
                    className="flex-1 text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/30"
                />
                <button
                    onClick={handleAdd}
                    disabled={loading || !newApp.trim()}
                    className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    aria-label="Add app to allowlist"
                >
                    <Plus size={14} />
                </button>
            </div>
            {apps.length === 0 ? (
                <p className="text-xs text-gray-600 italic py-1">No apps allowlisted yet.</p>
            ) : (
                <ul className="space-y-1">
                    {apps.map((app) => (
                        <li key={app} className="flex items-center justify-between text-xs bg-black/30 rounded-lg px-2 py-1.5">
                            <span className="text-gray-300 font-mono truncate">{app}</span>
                            <button
                                onClick={() => handleRemove(app)}
                                disabled={loading}
                                className="p-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                aria-label={`Remove ${app} from allowlist`}
                            >
                                <Trash2 size={12} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function ToolApprovalsPanel({ toggleRightPanel }: ToolApprovalsPanelProps) {
    const toast = useToast();
    const [approvals, setApprovals] = useState<(PendingToolApproval & { id: string })[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = toolApprovalService.onPendingApprovals(setApprovals);
        return unsubscribe;
    }, []);

    const handleApprove = async (id: string) => {
        setBusyId(id);
        try {
            const result = await toolApprovalService.approve(id);
            if (result.success) {
                toast.success('Action approved and executed');
            } else {
                toast.error(result.error || 'Action failed');
            }
        } catch (error) {
            Logger.error('ToolApprovalsPanel', 'Approve failed', error);
            toast.error('Failed to approve action');
        } finally {
            setBusyId(null);
        }
    };

    const handleDeny = async (id: string) => {
        setBusyId(id);
        try {
            await toolApprovalService.deny(id, 'Denied by user');
            toast.success('Action denied');
        } catch (error) {
            Logger.error('ToolApprovalsPanel', 'Deny failed', error);
            toast.error('Failed to deny action');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-bg-dark to-bg-dark/90 relative">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm shrink-0">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-red-500/10 rounded-lg">
                        <ShieldAlert size={14} className="text-red-400" />
                    </div>
                    Approvals{approvals.length > 0 ? ` (${approvals.length})` : ''}
                </h3>
                <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative p-4 space-y-3">
                {approvals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center opacity-50">
                        <ShieldAlert size={28} className="mb-2 text-red-400" />
                        <p className="text-sm">No pending approvals</p>
                        <p className="text-xs mt-1">Destructive actions (execute_code, computer_click, etc.) pause here before running</p>
                    </div>
                ) : (
                    approvals.map((approval) => (
                        <motion.div
                            key={approval.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-200 font-mono">{approval.toolName}</span>
                                <span className={`text-[10px] uppercase tracking-wide ${RISK_TIER_COLOR[approval.riskTier] ?? 'text-gray-400'}`}>
                                    {approval.riskTier}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400">{approval.description}</p>
                            <pre className="text-[10px] text-gray-500 bg-black/40 rounded p-2 overflow-x-auto max-h-24">
                                {JSON.stringify(approval.args, null, 2)}
                            </pre>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={() => handleApprove(approval.id)}
                                    disabled={busyId === approval.id}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                >
                                    <Check size={12} /> Approve
                                </button>
                                <button
                                    onClick={() => handleDeny(approval.id)}
                                    disabled={busyId === approval.id}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                >
                                    <X size={12} /> Deny
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}

                <AllowlistSection />
            </div>
        </div>
    );
}
