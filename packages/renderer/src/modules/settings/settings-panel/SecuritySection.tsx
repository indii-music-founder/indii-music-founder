/**
 * Account & Security Settings Section
 *
 * Auth info, audit log viewer, data export (GDPR), sign out, and account deletion.
 */

import React, { useState } from 'react';
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
} from 'lucide-react';
import { sendEmailVerification, getAuth } from 'firebase/auth';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { SectionHeader, SettingRow, Toggle } from './SettingsShared';
import { Database } from 'lucide-react';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { PrivacySettingsPanel } from '@/components/shared/PrivacySettingsPanel';

const AuditLogDashboard = React.lazy(() =>
    import('@/modules/settings/components/AuditLogDashboard').then(m => ({ default: m.AuditLogDashboard }))
);

const SecuritySection: React.FC = () => {
    const { logout, user, userProfile } = useStore(useShallow((s: StoreState) => ({
        logout: s.logout,
        user: s.user,
        userProfile: s.userProfile,
    })));
    const { showToast } = useToast();
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [sendingVerification, setSendingVerification] = useState(false);
    const { updatePreferences } = useStore(useShallow((s: StoreState) => ({ updatePreferences: s.updatePreferences })));

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
        if (!userProfile?.id || userProfile.id === 'pending') {
            showToast('User profile not fully loaded yet', 'error');
            return;
        }
        setSyncing(true);
        try {
            subscriptionService.clearCache(userProfile.id);
            await Promise.all([
                subscriptionService.getSubscription(userProfile.id, true),
                subscriptionService.getUsageStats(userProfile.id, true)
            ]);
            showToast('Subscription and token usage quotas synchronized', 'success');
        } catch (err: unknown) {
            logger.error('[Settings] Sync billing failed:', err);
            showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
        } finally {
            setSyncing(false);
        }
    };

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

                {/* Sync Billing & Quotas Card */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Billing &amp; Quotas</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Manually sync your subscription tier and daily AI token usage limits.
                        </p>
                    </div>
                    <button
                        onClick={handleSyncBilling}
                        disabled={syncing}
                        className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-3 py-2 rounded-lg transition-colors border border-cyan-500/20 disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Limits'}
                    </button>
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
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
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
