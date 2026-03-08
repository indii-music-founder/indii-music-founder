import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, ExternalLink, Lock, CheckCircle, Clock, AlertCircle, Copy } from 'lucide-react';

/* ================================================================== */
/*  Item 154 — Stripe Connect Custom Accounts                          */
/* ================================================================== */

type ConnectStatus = 'not_started' | 'pending' | 'active';

interface Collaborator {
    id: number;
    name: string;
    email: string;
    splitPct: number;
    status: ConnectStatus;
    accountId?: string;
}

const INITIAL_COLLABORATORS: Collaborator[] = [
    { id: 1, name: 'Marcus Webb', email: 'marcus@beatstudio.io', splitPct: 40, status: 'active', accountId: 'acct_1Abc123' },
    { id: 2, name: 'Layla Chen', email: 'layla.chen@soundlab.co', splitPct: 30, status: 'pending' },
    { id: 3, name: 'Jordan Reeves', email: 'j.reeves@musiq.fm', splitPct: 20, status: 'not_started' },
    { id: 4, name: 'Sofia Almeida', email: 'sofia@waveworks.pt', splitPct: 10, status: 'not_started' },
];

const STATUS_CONFIG: Record<ConnectStatus, { label: string; color: string; icon: React.ElementType }> = {
    active: { label: 'Active', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
    pending: { label: 'Pending', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    not_started: { label: 'Not Started', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: AlertCircle },
};

function generateOnboardingLink(collaboratorId: number) {
    return `https://connect.stripe.com/setup/e/acct_onboard_${collaboratorId}_${Date.now().toString(36).toUpperCase()}`;
}

export function StripeConnectOnboarding() {
    const [collaborators, setCollaborators] = useState<Collaborator[]>(INITIAL_COLLABORATORS);
    const [invitedLinks, setInvitedLinks] = useState<Record<number, string>>({});
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const activeCount = collaborators.filter((c) => c.status === 'active').length;
    const totalCount = collaborators.length;
    const allActive = activeCount === totalCount;
    const progressPct = (activeCount / totalCount) * 100;

    function handleInvite(collaborator: Collaborator) {
        const link = generateOnboardingLink(collaborator.id);
        setInvitedLinks((prev) => ({ ...prev, [collaborator.id]: link }));
        // Simulate the collaborator being set to pending
        if (collaborator.status === 'not_started') {
            setCollaborators((prev) =>
                prev.map((c) => (c.id === collaborator.id ? { ...c, status: 'pending' as const } : c))
            );
        }
    }

    function handleCopyLink(id: number, link: string) {
        navigator.clipboard.writeText(link).catch(() => {});
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Users size={14} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">Stripe Connect Onboarding</h2>
                    <p className="text-[10px] text-gray-500">Collaborator payout accounts</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">Onboarding Progress</span>
                    <span className="text-xs text-gray-400">{activeCount}/{totalCount} active</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8 }}
                    />
                </div>
                {!allActive && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <Lock size={11} className="text-amber-400" />
                        <p className="text-[10px] text-amber-400">Funds locked until all collaborators are active</p>
                    </div>
                )}
                {allActive && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle size={11} className="text-green-400" />
                        <p className="text-[10px] text-green-400">All collaborators active — payouts unlocked</p>
                    </div>
                )}
            </div>

            {/* Collaborator List */}
            <div className="space-y-2">
                {collaborators.map((collab) => {
                    const cfg = STATUS_CONFIG[collab.status];
                    const StatusIcon = cfg.icon;
                    const link = invitedLinks[collab.id];

                    return (
                        <motion.div
                            key={collab.id}
                            layout
                            className="rounded-xl bg-white/[0.02] border border-white/5 p-3"
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-white">
                                        {collab.name.split(' ').map((n) => n[0]).join('')}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-white truncate">{collab.name}</p>
                                        <span className="text-[10px] text-gray-500 flex-shrink-0">{collab.splitPct}% split</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 truncate">{collab.email}</p>
                                </div>

                                {/* Status Badge */}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.color} flex-shrink-0`}>
                                    <StatusIcon size={10} />
                                    {cfg.label}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="mt-2.5 flex items-center gap-2">
                                {collab.status === 'active' && collab.accountId && (
                                    <a
                                        href={`https://dashboard.stripe.com/${collab.accountId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-bold transition-colors"
                                    >
                                        <ExternalLink size={10} />
                                        View Dashboard
                                    </a>
                                )}
                                {collab.status !== 'active' && !link && (
                                    <button
                                        onClick={() => handleInvite(collab)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold transition-colors"
                                    >
                                        Invite to Connect
                                    </button>
                                )}
                                <AnimatePresence>
                                    {link && collab.status !== 'active' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                            <div className="flex-1 min-w-0 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1">
                                                <p className="text-[10px] text-gray-400 truncate font-mono">{link}</p>
                                            </div>
                                            <button
                                                onClick={() => handleCopyLink(collab.id, link)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors flex-shrink-0"
                                            >
                                                <Copy size={10} />
                                                {copiedId === collab.id ? 'Copied!' : 'Copy'}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
                {(['active', 'pending', 'not_started'] as ConnectStatus[]).map((status) => {
                    const count = collaborators.filter((c) => c.status === status).length;
                    const cfg = STATUS_CONFIG[status];
                    return (
                        <div key={status} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                            <p className="text-lg font-black text-white">{count}</p>
                            <p className={`text-[10px] font-bold ${cfg.color.split(' ')[0]}`}>{cfg.label}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
