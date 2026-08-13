import React from 'react';
import { AlertCircle, KeyRound, RefreshCw, Send, Shield } from 'lucide-react';
import { useSubscription } from '@/modules/finance/hooks/useSubscription';
import { getTierConfig } from '@/services/subscription/SubscriptionTier';

export function AuthorityInfoPanel() {
    const { subscription, loading, error, refresh } = useSubscription();
    const tierConfig = subscription ? getTierConfig(subscription.tier) : null;
    const isFallback = Boolean(subscription?.isFallback);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Authority</h3>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    aria-label="Sync account authority"
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300 disabled:opacity-50"
                >
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-200" role="alert">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>Verified account authority is unavailable. No tier has been assumed.</span>
                </div>
            )}

            {isFallback && !error && (
                <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-200" role="status">
                    Estimated account defaults — not verified billing entitlement.
                </div>
            )}

            <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Shield size={12} className="text-blue-400" />
                        <span className="text-xs text-gray-300">Account Tier</span>
                    </div>
                    <span className="text-xs font-bold text-white">
                        {loading ? 'Loading…' : tierConfig?.name ?? 'Unavailable'}
                    </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <KeyRound size={12} className="text-green-400" />
                        <span className="text-xs text-gray-300">API Access</span>
                    </div>
                    <span className="text-xs font-bold text-white">
                        {loading ? 'Loading…' : tierConfig ? (tierConfig.features.apiAccess ? 'Included' : 'Not included') : 'Unavailable'}
                    </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Send size={12} className="text-emerald-400" />
                        <span className="text-xs text-gray-300">Delivery Usage</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">Not tracked</span>
                </div>
            </div>
        </div>
    );
}
