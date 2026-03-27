import React from 'react';
import { Key, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export function KeysStatusPanel() {
    const { connections, loading } = useStore(
        useShallow((s) => ({
            connections: s.distribution.connections,
            loading: s.distribution.loading,
        }))
    );

    if (loading && connections.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Keys & Certs</h3>
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="text-gray-600 animate-spin" />
                </div>
            </div>
        );
    }

    // Build key status from real connections — authExpiresAt drives expiry warning
    const now = Date.now();
    const WARN_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

    const keys = connections
        .filter((c) => c.isConnected)
        .map((c) => {
            const expiresAt = c.authExpiresAt ? new Date(c.authExpiresAt).getTime() : null;
            const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
            const status: 'Valid' | 'Expiring' | 'Expired' =
                daysLeft === null ? 'Valid'
                    : daysLeft <= 0 ? 'Expired'
                        : daysLeft <= 30 ? 'Expiring'
                            : 'Valid';
            const exp = daysLeft === null ? 'No expiry' : daysLeft <= 0 ? 'Expired' : `${daysLeft} days`;
            return { label: c.distributorId, status, exp };
        });

    if (keys.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Keys & Certs</h3>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                    <Key size={14} className="text-gray-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-gray-600">No credentials stored</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Connect a distributor to see key status</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Keys & Certs</h3>
            <div className="space-y-2">
                {keys.slice(0, 4).map((k) => {
                    const isWarn = k.status !== 'Valid';
                    return (
                        <div key={k.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                            {isWarn
                                ? <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                                : <Key size={12} className="text-green-400 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-white capitalize truncate">{k.label}</p>
                                <p className="text-[10px] text-gray-600">{k.exp}</p>
                            </div>
                            <span className={`text-[10px] font-bold ${k.status === 'Expired' ? 'text-red-400' : k.status === 'Expiring' ? 'text-amber-400' : 'text-green-400'}`}>
                                {k.status}
                            </span>
                        </div>
                    );
                })}
                {keys.length > 4 && (
                    <p className="text-[10px] text-gray-700 text-center pt-0.5">+{keys.length - 4} more</p>
                )}
            </div>
        </div>
    );
}
