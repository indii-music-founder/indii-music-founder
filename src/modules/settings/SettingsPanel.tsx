/**
 * Settings Module — User Profile, Connected Services, Notifications & Preferences
 *
 * This is the central hub for all user-configurable options:
 * - Profile editing (display name, avatar, bio)
 * - Connected services (Gmail, Outlook, Push Notifications)
 * - App preferences (theme, notification sounds)
 * - Account management (sign out, delete account)
 * - Audit log link
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    User,
    Bell,
    Link2,
    Palette,
    Shield,
    LogOut,
    Camera,
    Save,
    Check,
    X,
    Mail,
    Smartphone,
    ChevronRight,
    Globe,
    Moon,
    Sun,
    Volume2,
    VolumeX,
    Trash2,
    AlertTriangle,
    RefreshCw,
    ExternalLink,
    ScrollText,
} from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/services/firebase';
import { pushNotificationService } from '@/services/notifications/PushNotificationService';
import { EmailService } from '@/services/email/EmailService';
import type { EmailAccount } from '@/services/email/types';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsSection = 'profile' | 'connections' | 'notifications' | 'appearance' | 'security';

// ---------------------------------------------------------------------------
// Section Navigation
// ---------------------------------------------------------------------------

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: React.ElementType; description: string }> = [
    { id: 'profile', label: 'Profile', icon: User, description: 'Name, avatar, and bio' },
    { id: 'connections', label: 'Connected Services', icon: Link2, description: 'Email, social, and integrations' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push, email, and sound preferences' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, layout, and animations' },
    { id: 'security', label: 'Account & Security', icon: Shield, description: 'Sign out, data export, delete' },
];

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
    </div>
);

const SettingRow: React.FC<{
    icon: React.ElementType;
    label: string;
    description?: string;
    children: React.ReactNode;
}> = ({ icon: Icon, label, description, children }) => (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-800/50 last:border-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-slate-400" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                {description && <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>}
            </div>
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
);

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
    enabled,
    onChange,
    disabled,
}) => (
    <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

const SelectDropdown: React.FC<{
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer appearance-none"
    >
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);

// ---------------------------------------------------------------------------
// Profile Section
// ---------------------------------------------------------------------------

const ProfileSection: React.FC = () => {
    const { user, userProfile } = useStore(useShallow((s: StoreState) => ({
        user: s.user,
        userProfile: s.userProfile,
    })));
    const { showToast } = useToast();

    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [bio, setBio] = useState(userProfile?.bio || '');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setDisplayName(user?.displayName || '');
        setBio(userProfile?.bio || '');
    }, [user, userProfile]);

    const handleSave = async () => {
        if (!user || !dirty) return;
        setSaving(true);
        try {
            // Update Firebase Auth profile
            if (displayName !== user.displayName) {
                await updateProfile(user, { displayName });
            }
            // Update Firestore user document
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                updatedAt: new Date().toISOString(),
            });
            setDirty(false);
            showToast('Profile updated', 'success');
            logger.info('[Settings] Profile updated');
        } catch (err: unknown) {
            logger.error('[Settings] Profile update failed:', err);
            showToast('Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = () => {
        const name = displayName || user?.email || 'U';
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div>
            <SectionHeader title="Profile" description="Manage your personal information and how others see you." />

            {/* Avatar */}
            <div className="flex items-center gap-5 mb-8">
                <div className="relative group">
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="Avatar"
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-2 border-slate-700">
                            <span className="text-2xl font-bold text-white">{getInitials()}</span>
                        </div>
                    )}
                    <button className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={20} className="text-white" />
                    </button>
                </div>
                <div>
                    <p className="text-sm font-medium text-white">{displayName || 'No name set'}</p>
                    <p className="text-xs text-slate-500">{user?.email || 'No email'}</p>
                    <p className="text-xs text-slate-600 mt-1">
                        UID: {user?.uid?.substring(0, 8)}...
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Display Name</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all"
                        placeholder="Your display name"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                        rows={3}
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all resize-none"
                        placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-slate-600 mt-1">{bio.length}/280 characters</p>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Email</label>
                    <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-600 mt-1">Email cannot be changed directly. Contact support.</p>
                </div>

                {dirty && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={() => {
                                setDisplayName(user?.displayName || '');
                                setBio(userProfile?.bio || '');
                                setDirty(false);
                            }}
                            className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
                        >
                            <X size={14} /> Cancel
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Connected Services Section
// ---------------------------------------------------------------------------

const ConnectionsSection: React.FC = () => {
    const { showToast } = useToast();
    const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            const accounts = await EmailService.getConnectedAccounts();
            setEmailAccounts(accounts);
        } catch {
            // No accounts yet — that's fine
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const handleConnect = async (provider: 'gmail' | 'outlook') => {
        setConnecting(provider);
        try {
            await EmailService.connectAccount(provider);
            await loadAccounts();
            showToast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} connected`, 'success');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(message || 'Connection failed', 'error');
        } finally {
            setConnecting(null);
        }
    };

    const handleDisconnect = async (provider: 'gmail' | 'outlook') => {
        try {
            await EmailService.disconnectAccount(provider);
            await loadAccounts();
            showToast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} disconnected`, 'success');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(message || 'Disconnection failed', 'error');
        }
    };

    const isConnected = (provider: string) => emailAccounts.some(a => a.provider === provider);

    return (
        <div>
            <SectionHeader
                title="Connected Services"
                description="Manage email integrations and linked accounts."
            />

            <div className="space-y-1">
                {/* Gmail */}
                <SettingRow
                    icon={Mail}
                    label="Gmail"
                    description={isConnected('gmail')
                        ? emailAccounts.find(a => a.provider === 'gmail')?.email || 'Connected'
                        : 'Not connected'
                    }
                >
                    {isConnected('gmail') ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> Connected
                            </span>
                            <button
                                onClick={() => handleDisconnect('gmail')}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('gmail')}
                            disabled={connecting === 'gmail'}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {connecting === 'gmail' ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <ExternalLink size={12} />
                            )}
                            Connect
                        </button>
                    )}
                </SettingRow>

                {/* Outlook */}
                <SettingRow
                    icon={Mail}
                    label="Outlook"
                    description={isConnected('outlook')
                        ? emailAccounts.find(a => a.provider === 'outlook')?.email || 'Connected'
                        : 'Not connected'
                    }
                >
                    {isConnected('outlook') ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> Connected
                            </span>
                            <button
                                onClick={() => handleDisconnect('outlook')}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('outlook')}
                            disabled={connecting === 'outlook'}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {connecting === 'outlook' ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <ExternalLink size={12} />
                            )}
                            Connect
                        </button>
                    )}
                </SettingRow>

                {/* Push Notifications Token */}
                <SettingRow
                    icon={Smartphone}
                    label="Push Notifications"
                    description="Browser/native push via Firebase Cloud Messaging"
                >
                    <button
                        onClick={async () => {
                            const token = await pushNotificationService.requestPermissionAndGetToken();
                            if (token) {
                                showToast('Push notifications enabled', 'success');
                            } else {
                                showToast('Push notifications blocked or unavailable', 'error');
                            }
                        }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Bell size={12} /> Enable
                    </button>
                </SettingRow>
            </div>

            <p className="text-xs text-slate-600 mt-4">
                Connected accounts are secured via OAuth 2.0. Refresh tokens are stored server-side and never exposed to the browser.
            </p>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Notifications Section
// ---------------------------------------------------------------------------

const NotificationsSection: React.FC = () => {
    const { userProfile, updatePreferences } = useStore(useShallow((s: StoreState) => ({
        userProfile: s.userProfile,
        updatePreferences: s.updatePreferences,
    })));

    const prefs = userProfile?.preferences || {};

    // Derive values with defaults
    const pushEnabled = prefs.notifications ?? true;
    const notificationSound = prefs.notificationSound ?? true;
    const emailDigest = prefs.emailDigest ?? 'daily';
    const agentActivityAlerts = prefs.agentActivityAlerts ?? true;
    const budgetAlerts = prefs.budgetAlerts ?? true;

    return (
        <div>
            <SectionHeader
                title="Notifications"
                description="Control how and when you receive alerts."
            />

            <div className="space-y-1">
                <SettingRow icon={Bell} label="Push Notifications" description="Receive browser/mobile push alerts">
                    <Toggle
                        enabled={pushEnabled}
                        onChange={(v) => updatePreferences({ notifications: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Volume2}
                    label="Notification Sounds"
                    description="Play a sound for new notifications"
                >
                    <Toggle
                        enabled={notificationSound}
                        onChange={(v) => updatePreferences({ notificationSound: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Mail}
                    label="Email Digest"
                    description="Receive summary emails of activity"
                >
                    <SelectDropdown
                        value={emailDigest}
                        options={[
                            { value: 'realtime', label: 'Real-time' },
                            { value: 'daily', label: 'Daily' },
                            { value: 'weekly', label: 'Weekly' },
                            { value: 'off', label: 'Off' },
                        ]}
                        onChange={(v) => updatePreferences({ emailDigest: v as 'realtime' | 'daily' | 'weekly' | 'off' })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Globe}
                    label="Agent Activity Alerts"
                    description="Get notified when agents complete tasks"
                >
                    <Toggle
                        enabled={agentActivityAlerts}
                        onChange={(v) => updatePreferences({ agentActivityAlerts: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={AlertTriangle}
                    label="Budget Alerts"
                    description="Warn when AI usage nears budget limits"
                >
                    <Toggle
                        enabled={budgetAlerts}
                        onChange={(v) => updatePreferences({ budgetAlerts: v })}
                    />
                </SettingRow>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Appearance Section
// ---------------------------------------------------------------------------

const AppearanceSection: React.FC = () => {
    const { userProfile, updatePreferences, setTheme: storeSetTheme } = useStore(useShallow((s: StoreState) => ({
        userProfile: s.userProfile,
        updatePreferences: s.updatePreferences,
        setTheme: s.setTheme,
    })));

    const prefs = userProfile?.preferences || {};
    const theme = prefs.theme ?? 'dark';
    const compactMode = prefs.compactMode ?? false;
    const animationsEnabled = prefs.animationsEnabled ?? true;

    return (
        <div>
            <SectionHeader
                title="Appearance"
                description="Customize the look and feel of indiiOS."
            />

            <div className="space-y-1">
                <SettingRow icon={Moon} label="Theme" description="Choose your preferred color scheme">
                    <div className="flex gap-1">
                        {(['dark', 'light', 'system'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => storeSetTheme(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    theme === t
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                        : 'bg-slate-800/60 text-slate-400 border border-transparent hover:border-slate-700'
                                }`}
                            >
                                {t === 'dark' && <Moon size={12} className="inline mr-1" />}
                                {t === 'light' && <Sun size={12} className="inline mr-1" />}
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </SettingRow>

                <SettingRow icon={Palette} label="Compact Mode" description="Reduce spacing for more content density">
                    <Toggle
                        enabled={compactMode}
                        onChange={(v) => updatePreferences({ compactMode: v })}
                    />
                </SettingRow>

                <SettingRow icon={RefreshCw} label="Animations" description="Enable smooth transitions and micro-animations">
                    <Toggle
                        enabled={animationsEnabled}
                        onChange={(v) => updatePreferences({ animationsEnabled: v })}
                    />
                </SettingRow>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <p className="text-xs text-cyan-400 font-medium">
                    🎨 Theme customization is currently limited to dark mode during alpha. Full theme support is coming soon.
                </p>
            </div>
        </div>
    );
};

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

    const handleLogout = async () => {
        try {
            await logout();
            showToast('Signed out successfully', 'success');
        } catch (err: unknown) {
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
            link.download = `indiios-data-export-${isoDate.substring(0, isoDate.indexOf('T'))}.json`;
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

            <div className="space-y-1">
                <SettingRow icon={Shield} label="Authentication" description={user?.providerData?.[0]?.providerId || 'Unknown'}>
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check size={12} /> Verified
                    </span>
                </SettingRow>

                <SettingRow icon={ScrollText} label="Audit Log" description="View account activity and changes">
                    <button
                        onClick={() => setShowAuditLog(!showAuditLog)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                        {showAuditLog ? 'Hide' : 'View'} <ChevronRight size={12} className={`transition-transform ${showAuditLog ? 'rotate-90' : ''}`} />
                    </button>
                </SettingRow>

                <SettingRow icon={Globe} label="Data Export" description="Download all your data as JSON">
                    <button
                        onClick={handleDataExport}
                        disabled={exporting}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {exporting ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        {exporting ? 'Exporting...' : 'Export'}
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

            {/* Sign Out */}
            <div className="mt-8 pt-6 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2.5 rounded-xl transition-colors w-full"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </div>

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
                                            showToast('Account deletion is handled by support. Contact help@indiios.com', 'info');
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

// ---------------------------------------------------------------------------
// Main Settings Panel
// ---------------------------------------------------------------------------

const SettingsPanel: React.FC = () => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

    const renderSection = () => {
        switch (activeSection) {
            case 'profile': return <ProfileSection />;
            case 'connections': return <ConnectionsSection />;
            case 'notifications': return <NotificationsSection />;
            case 'appearance': return <AppearanceSection />;
            case 'security': return <SecuritySection />;
        }
    };

    return (
        <div className="h-full flex bg-[--bg]">
            {/* Sidebar Nav */}
            <div className="w-56 flex-shrink-0 border-r border-slate-800 p-4 space-y-1 hidden md:block">
                <h1 className="text-sm font-bold text-white mb-4 px-3">Settings</h1>
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                            }`}
                        >
                            <Icon size={16} />
                            <span className="text-sm font-medium">{section.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Mobile Nav */}
            <div className="md:hidden flex gap-1 p-3 border-b border-slate-800 overflow-x-auto w-full absolute top-0 left-0 bg-[--bg] z-10">
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                activeSection === section.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            <Icon size={14} />
                            {section.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pt-16 md:pt-8">
                <div className="max-w-2xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                        >
                            {renderSection()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
