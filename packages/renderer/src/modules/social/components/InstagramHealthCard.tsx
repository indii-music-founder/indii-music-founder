import React, { useState, useEffect } from 'react';
import { Instagram, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { auditInstagramConnection } from '@/services/social/InstagramPlatformService';
import type { InstagramConnectionHealth } from '@indii/shared';

interface InstagramHealthCardProps {
    onConnectClick?: () => void;
}

export const InstagramHealthCard: React.FC<InstagramHealthCardProps> = ({ onConnectClick }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [audit, setAudit] = useState<InstagramConnectionHealth | null>(null);

    const runAudit = async () => {
        setLoading(true);
        try {
            const res = await auditInstagramConnection();
            setAudit(res);
            if (res.status === 'HEALTHY') {
                toast.success('Instagram Business connection healthy!');
            } else {
                toast.warning(`Instagram status: ${res.status}`);
            }
        } catch (e) {
            toast.error(`Failed to audit Instagram connection: ${String(e)}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void runAudit();
    }, []);

    const currentStatus = audit?.status || 'UNCONNECTED';

    const healthColor = {
        HEALTHY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        RECONNECT_REQUIRED: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        MISSING_PERMISSIONS: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        EXPIRED: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        UNCONNECTED: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
    }[currentStatus];

    const requiredScopes = [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_comments',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_read_engagement',
    ];

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md">
                        <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                            Instagram Business Account
                            {audit?.instagramUsername && (
                                <span className="text-xs font-normal text-rose-400">@{audit.instagramUsername}</span>
                            )}
                        </h3>
                        <p className="text-xs text-zinc-400">v23.0 Graph API & Messenger Automation</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void runAudit()}
                        disabled={loading}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Re-audit connection"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Audit</span>
                    </button>

                    {onConnectClick && (
                        <button
                            type="button"
                            onClick={onConnectClick}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Connect / Re-auth</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Health Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${healthColor}`}>
                    {currentStatus === 'HEALTHY' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {currentStatus === 'EXPIRED' && <ShieldAlert className="w-3.5 h-3.5" />}
                    {(currentStatus === 'MISSING_PERMISSIONS' || currentStatus === 'RECONNECT_REQUIRED') && (
                        <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {currentStatus}
                </span>
            </div>

            {audit && (
                <div className="mt-4 pt-3 border-t border-zinc-800/80">
                    <span className="text-xs font-medium text-zinc-400 block mb-2">Granted Scopes:</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        {requiredScopes.map((scope) => {
                            const granted = audit.permissions?.includes(scope);
                            return (
                                <div key={scope} className="flex items-center justify-between bg-zinc-950/50 px-2.5 py-1.5 rounded-md border border-zinc-800/50">
                                    <span className="text-zinc-300 font-mono text-[11px] truncate">{scope}</span>
                                    <span className={granted ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                        {granted ? '✓' : '✗'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
