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
    Save,
    Check,
    Globe,
    Trash2,
    AlertTriangle,
    RefreshCw,
    ChevronRight,
    ScrollText,
    Rocket,
} from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { SectionHeader, SettingRow, Toggle } from './SettingsShared';
import { Database } from 'lucide-react';

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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [exporting, setExporting] = useState(false);
    const { updatePreferences } = useStore(useShallow((s: StoreState) => ({ updatePreferences: s.updatePreferences })));

    const handleLogout = async () => {
        try {
            await logout();
            showToast('Signed out successfully', 'success');
        } catch (_err: unknown) {
            showToast('Sign out failed', 'error');
        }
    };

    const handleDataExport = async () => {
        if (!user || !userProfile) return;
        setExporting(true);
        try {
            const exportData = {
                exportedAt: new Date().toISOString(),
                exportVersion: '1.0',
                profile: {
                    uid: userProfile.uid,
                    email: userProfile.email,
                    displayName: userProfile.displayName,
                    bio: userProfile.bio,
                    accountType: userProfile.accountType,
                    careerStage: userProfile.careerStage,
                    goals: userProfile.goals,
                    createdAt: userProfile.createdAt?.toDate?.()?.toISOString() || null,
                },
                preferences: userProfile.preferences || {},
                brandKit: userProfile.brandKit || {},
                membership: userProfile.membership || {},
                socialStats: userProfile.socialStats || null,
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const isoDate = new Date().toISOString();
            link.download = `indii-data-export-${isoDate.substring(0, isoDate.indexOf('T'))}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Data exported successfully', 'success');
            logger.info('[Settings] Data export completed');
        } catch (err: unknown) {
            logger.error('[Settings] Data export failed:', err);
            showToast('Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div>
            <SectionHeader
                title="Account & Security"
                description="Manage your account security and data."
            />

            <div className="flex flex-col gap-3 mb-6">
                {/* Sign Out Card */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Active Session</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Check size={12} className="text-emerald-400" />
                            {user?.email || 'Authenticated'}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors border border-red-500/20"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>

                {/* Data Export Premium Card */}
                <div className="p-4 rounded-xl bg-linear-to-r from-indigo-500/10 to-purple-500/5 border border-indigo-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                                <Globe size={16} /> Data Ownership & Export
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-[80%]">
                                You own your data. Download a complete archive of your profile, brand kit, and preferences as JSON.
                            </p>
                        </div>
                        <button
                            onClick={handleDataExport}
                            disabled={exporting}
                            className="flex items-center gap-1.5 text-xs font-medium bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        >
                            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {exporting ? 'Archiving...' : 'Export Archive (.zip)'}
                        </button>
                    </div>
                </div>
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

            {/* Delete Account */}
            <div className="mt-4">
                {!showDeleteConfirm ? (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 text-xs text-slate-600 hover:text-red-400 px-4 py-2 rounded-xl transition-colors"
                    >
                        <Trash2 size={14} />
                        Delete Account
                    </button>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-400">Delete your account?</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    This action is permanent and cannot be undone. All your data, projects, and connected services will be removed.
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        className="text-xs bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                                        onClick={() => {
                                            showToast('Account deletion is handled by support. Contact help@indii.music', 'info');
                                            setShowDeleteConfirm(false);
                                        }}
                                    >
                                        Yes, Delete
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default SecuritySection;
