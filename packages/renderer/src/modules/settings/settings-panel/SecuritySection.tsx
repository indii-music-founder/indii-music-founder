/**
 * Account & Security Settings Section
 *
 * Auth info, audit log viewer, data export (GDPR), sign out, and account deletion.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Shield,
    LogOut,
    Check,
    RefreshCw,
    ChevronRight,
    ScrollText,
    Rocket,
    AlertCircle,
    Mail,
    CalendarDays,
    CreditCard,
    Image as ImageIcon,
    Video,
    MessageSquareText,
    HardDrive,
} from 'lucide-react';
import { sendEmailVerification, getAuth } from 'firebase/auth';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { SectionHeader, SettingRow, Toggle } from './SettingsShared';
import { Database } from 'lucide-react';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { getTierConfig } from '@/services/subscription/SubscriptionTier';
import type { Subscription, UsageStats } from '@/services/subscription/types';
import { PrivacySettingsPanel } from '@/components/shared/PrivacySettingsPanel';
import { getColorForModule } from '@/core/theme/moduleColors';

const AuditLogDashboard = React.lazy(() =>
    import('@/modules/settings/components/AuditLogDashboard').then(m => ({ default: m.AuditLogDashboard }))
);

type BillingState = 'loading' | 'ready' | 'unavailable';

const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unavailable';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(timestamp));
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const UsageMeter = ({ label, used, total, remaining, icon: Icon }: {
    label: string;
    used: number;
    total: number;
    remaining: number;
    icon: React.ElementType;
}) => {
    const boundedPercent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
    const warning = boundedPercent >= 80;

    return (
        <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
                    <Icon size={13} className="text-slate-400" /> {label}
                </span>
                <span className={`text-[10px] ${warning ? 'text-amber-300' : 'text-slate-400'}`}>
                    {formatNumber(remaining)} remaining
                </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/60">
                <div
                    className={`h-full rounded-full ${warning ? 'bg-amber-400' : 'bg-cyan-400'}`}
                    style={{ width: `${boundedPercent}%` }}
                />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
                {formatNumber(used)} of {formatNumber(total)} used ({Math.round(boundedPercent)}%)
            </p>
        </div>
    );
};

const SecuritySection: React.FC = () => {
    const { logout, user, userProfile } = useStore(useShallow((s: StoreState) => ({
        logout: s.logout,
        user: s.user,
        userProfile: s.userProfile,
    })));
    const { showToast } = useToast();
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [billingState, setBillingState] = useState<BillingState>('loading');
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [billingError, setBillingError] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [sendingVerification, setSendingVerification] = useState(false);
    const { updatePreferences } = useStore(useShallow((s: StoreState) => ({ updatePreferences: s.updatePreferences })));
    const moduleColor = getColorForModule('settings');

    const loadBilling = useCallback(async (forceRefresh = false) => {
        if (!user?.uid) {
            setBillingState('unavailable');
            setBillingError('Your authenticated account is still loading.');
            return false;
        }

        const billingUserId = user.uid;
        setBillingError(null);
        try {
            if (forceRefresh) subscriptionService.clearCache(billingUserId);
            const [nextSubscription, nextUsage] = await Promise.all([
                subscriptionService.getSubscription(billingUserId, forceRefresh),
                subscriptionService.getUsageStats(billingUserId, forceRefresh),
            ]);
            setSubscription(nextSubscription);
            setUsage(nextUsage);
            setBillingState('ready');
            setLastSyncedAt(Date.now());
            return true;
        } catch (err: unknown) {
            logger.error('[Settings] Loading billing overview failed:', err);
            setSubscription(null);
            setUsage(null);
            setBillingState('unavailable');
            setBillingError(err instanceof Error ? err.message : 'Plan and usage data are unavailable.');
            return false;
        }
    }, [user?.uid]);

    useEffect(() => {
        void loadBilling();
    }, [loadBilling]);

    const handleResendVerification = async () => {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
            showToast('No active session found', 'error');
            return;
        }
        setSendingVerification(true);
        try {
            await sendEmailVerification(currentUser);
            showToast('Verification email sent! Check your inbox.', 'success');
        } catch (err: unknown) {
            logger.error('[Settings] Resend email verification failed:', err);
            showToast(err instanceof Error ? err.message : 'Failed to send verification email', 'error');
        } finally {
            setSendingVerification(false);
        }
    };

    const handleSyncBilling = async () => {
        if (!user?.uid) {
            showToast('Authenticated account not fully loaded yet', 'error');
            return;
        }
        setSyncing(true);
        try {
            const synced = await loadBilling(true);
            showToast(
                synced ? 'Plan and usage synchronized' : 'Plan and usage could not be synchronized',
                synced ? 'success' : 'error'
            );
        } finally {
            setSyncing(false);
        }
    };

    const tierConfig = subscription ? getTierConfig(subscription.tier) : null;
    const isFallback = Boolean(subscription?.isFallback || usage?.isFallback);
    const periodLabel = subscription?.cancelAtPeriodEnd ? 'Access ends' : 'Renews';

    const handleLogout = async () => {
        try {
            await logout();
            showToast('Signed out successfully', 'success');
        } catch (_err: unknown) {
            showToast('Sign out failed', 'error');
        }
    };

    return (
        <div>
            <SectionHeader
                title="Account & Security"
                description="Manage your account security and data."
            />

            <div className="flex flex-col gap-3 mb-6">
                {/* Active Session & Verification Status Card */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-white">Active Session</h3>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                <span>{user?.email || 'Authenticated'}</span>
                                {user?.emailVerified ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <Check size={10} /> Email Verified
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <AlertCircle size={10} /> Unverified
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors border border-red-500/20"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>

                    {!user?.emailVerified && (
                        <div className="pt-2 border-t border-slate-700/30 flex items-center justify-between">
                            <p className="text-xs text-amber-300/80 flex items-center gap-1">
                                <AlertCircle size={12} /> Email verification is required for AI generation.
                            </p>
                            <button
                                onClick={handleResendVerification}
                                disabled={sendingVerification}
                                className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 disabled:opacity-50 cursor-pointer"
                            >
                                <Mail size={12} />
                                {sendingVerification ? 'Sending...' : 'Resend Verification Email'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Plan, billing, and usage overview */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4" aria-label="Plan and usage overview">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-white">Plan &amp; Usage</h3>
                            <p className="mt-1 text-xs text-slate-400">Your subscription, billing period, and current usage in one place.</p>
                        </div>
                        <button
                            onClick={handleSyncBilling}
                            disabled={syncing || billingState === 'loading'}
                            className={`flex items-center gap-2 text-xs font-medium ${moduleColor.text} hover:opacity-80 hover:${moduleColor.bg} px-3 py-2 rounded-lg transition-colors border ${moduleColor.border}/20 disabled:opacity-50 cursor-pointer`}
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync Plan & Usage'}
                        </button>
                    </div>

                    {billingState === 'loading' && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400" role="status">
                            <RefreshCw size={14} className="animate-spin" /> Loading your plan and usage…
                        </div>
                    )}

                    {billingState === 'unavailable' && (
                        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3" role="alert">
                            <p className="flex items-center gap-2 text-xs font-medium text-amber-300"><AlertCircle size={14} /> Plan details unavailable</p>
                            <p className="mt-1 text-[11px] text-slate-400">{billingError || 'We could not load verified subscription data. No plan has been assumed.'}</p>
                        </div>
                    )}

                    {billingState === 'ready' && subscription && usage && tierConfig && (
                        <div className="mt-4 space-y-4">
                            {isFallback && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200" role="status">
                                    Live billing data is unavailable. These are estimated defaults and are not proof of your current entitlement.
                                </div>
                            )}

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Current plan</p>
                                    <p className="mt-1 text-base font-semibold text-white">{tierConfig.name}</p>
                                    <p className="mt-1 text-[11px] capitalize text-slate-400">Status: {subscription.status.replace('_', ' ')}</p>
                                </div>
                                <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
                                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"><CreditCard size={11} /> Price</p>
                                    <p className="mt-1 text-base font-semibold text-white">
                                        {tierConfig.price === 0 ? 'Free' : `$${tierConfig.price}/${tierConfig.billingPeriod === 'year' ? 'year' : 'month'}`}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-400">{tierConfig.description}</p>
                                </div>
                                <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
                                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"><CalendarDays size={11} /> {periodLabel}</p>
                                    <p className="mt-1 text-base font-semibold text-white">{formatDate(subscription.currentPeriodEnd)}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {subscription.cancelAtPeriodEnd ? 'Cancellation scheduled' : `Current period began ${formatDate(subscription.currentPeriodStart)}`}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h4 className="text-xs font-semibold text-white">Current usage</h4>
                                    <span className="text-[10px] text-slate-500">Resets {formatDate(usage.resetDate)}</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <UsageMeter label="Images" used={usage.imagesGenerated} total={usage.imagesPerMonth} remaining={usage.imagesRemaining} icon={ImageIcon} />
                                    <UsageMeter label="Video minutes" used={usage.videoDurationMinutes} total={usage.videoTotalMinutes} remaining={usage.videoRemainingMinutes} icon={Video} />
                                    <UsageMeter label="AI chat tokens" used={usage.aiChatTokensUsed} total={usage.aiChatTokensPerMonth} remaining={usage.aiChatTokensRemaining} icon={MessageSquareText} />
                                    <UsageMeter label="Storage (GB)" used={usage.storageUsedGB} total={usage.storageTotalGB} remaining={usage.storageRemainingGB} icon={HardDrive} />
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-500">
                                {lastSyncedAt ? `Last synchronized ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. ` : ''}
                                “Pro”, “Fast”, and “Lite” generation controls elsewhere select processing quality; they do not change this subscription.
                            </p>
                        </div>
                    )}
                </div>

                <PrivacySettingsPanel />
            </div>

            <div className="space-y-1">
                <SettingRow icon={Rocket} label="Share Usage Data" description="Help us improve Indii by sharing anonymized usage metrics.">
                    <Toggle
                        enabled={userProfile?.preferences?.usageTelemetry !== false}
                        onChange={(enabled) => updatePreferences({ usageTelemetry: enabled })}
                    />
                </SettingRow>

                {/* Auto Memory Informational */}
                <div className="px-4 py-3 flex items-center gap-3 bg-slate-800/20 rounded-xl border border-slate-700/30">
                    <Database size={16} className="text-slate-500" />
                    <div>
                        <p className="text-xs font-medium text-slate-300">Auto Memory Extraction</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Auto Memory is always active. Agents continuously learn from your interactions.</p>
                    </div>
                    <Check size={14} className="ml-auto text-emerald-500/50" />
                </div>

                <SettingRow icon={ScrollText} label="Audit Log" description="View account activity and changes">
                    <button
                        onClick={() => setShowAuditLog(!showAuditLog)}
                        className={`text-xs ${moduleColor.text} hover:opacity-80 flex items-center gap-1 transition-colors`}
                    >
                        {showAuditLog ? 'Hide' : 'View'} <ChevronRight size={12} className={`transition-transform ${showAuditLog ? 'rotate-90' : ''}`} />
                    </button>
                </SettingRow>
            </div>

            {/* Inline Audit Log Dashboard */}
            <AnimatePresence>
                {showAuditLog && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 overflow-hidden"
                    >
                        <React.Suspense fallback={<div className="text-xs text-slate-500 p-4">Loading audit logs...</div>}>
                            <AuditLogDashboard />
                        </React.Suspense>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default SecuritySection;
