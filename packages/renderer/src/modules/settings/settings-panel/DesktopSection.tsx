/**
 * Desktop & Updates Settings Section
 *
 * Provides manual update controls for the Electron desktop app:
 * - Current version display
 * - "Check for Updates" button
 * - Update channel selector (Stable / Beta)
 * - Update source selector (GitHub / Firebase)
 * - Real-time update status indicator
 *
 * All IPC handlers are already registered in packages/main/src/updater.ts.
 * This component simply surfaces them in the Settings UI.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Monitor,
    Download,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Info,
    Radio,
    Server,
    Loader2,
} from 'lucide-react';
import { SectionHeader, SettingRow, SelectDropdown } from './SettingsShared';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'up-to-date'
    | 'error';

interface UpdateConfig {
    channel: 'stable' | 'beta';
    source: 'github' | 'firebase';
    isAvailable: boolean;
    releaseName?: string;
    releaseNumber?: number;
    technicalVersion?: string;
}

// ---------------------------------------------------------------------------
// DesktopSection
// ---------------------------------------------------------------------------

const DesktopSection: React.FC = () => {
    const [appVersion, setAppVersion] = useState<string>('');
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [availableVersion, setAvailableVersion] = useState<string>('');
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [config, setConfig] = useState<UpdateConfig>({
        channel: 'stable',
        source: 'github',
        isAvailable: false,
        releaseName: 'Founders Version One',
        releaseNumber: 1,
    });
    const [isElectron] = useState(() => !!window.electronAPI);

    // -----------------------------------------------------------------------
    // Initialize — fetch app version and updater config
    // -----------------------------------------------------------------------
    useEffect(() => {
        const api = window.electronAPI;
        if (!api) return;

        api.getAppVersion().then((v) => setAppVersion(v)).catch(() => {
            setAppVersion('Unknown');
        });

        if (api.updater) {
            const updater = api.updater;
            if ('getConfig' in updater) {
                (updater as { getConfig: () => Promise<UpdateConfig> }).getConfig().then((cfg: UpdateConfig) => {
                    setConfig(cfg);
                }).catch(() => {
                    logger.warn('[DesktopSection] Failed to load updater config');
                });
            }
        }
    }, []);

    // -----------------------------------------------------------------------
    // Listen for updater events (same IPC events as UpdaterMonitor)
    // -----------------------------------------------------------------------
    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.updater?.onChecking) return;

        const unsubs = [
            api.updater.onChecking(() => {
                setStatus('checking');
                setErrorMessage('');
            }),
            api.updater.onAvailable((info: { version: string }) => {
                setStatus('available');
                setAvailableVersion(info.version);
            }),
            api.updater.onNotAvailable(() => {
                setStatus('up-to-date');
            }),
            api.updater.onProgress((data: { percent: number }) => {
                setStatus('downloading');
                setDownloadProgress(data.percent);
            }),
            api.updater.onDownloaded((info: { version: string }) => {
                setStatus('downloaded');
                setAvailableVersion(info.version);
            }),
            api.updater.onError((err: { message: string }) => {
                setStatus('error');
                setErrorMessage(err.message);
            }),
        ];

        return () => unsubs.forEach((unsub) => unsub());
    }, []);

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------
    const handleCheckForUpdates = useCallback(async () => {
        const api = window.electronAPI;
        if (!api?.updater) return;

        setStatus('checking');
        setErrorMessage('');

        try {
            const result = await api.updater.check();
            if (result.available) {
                setStatus('available');
                setAvailableVersion(result.version || 'Unknown');
            } else if (result.error) {
                setStatus('error');
                setErrorMessage(result.error);
            } else {
                setStatus('up-to-date');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus('error');
            setErrorMessage(message);
        }
    }, []);

    const handleInstall = useCallback(() => {
        window.electronAPI?.updater?.install();
    }, []);

    const handleChannelChange = useCallback(async (value: string) => {
        const channel = value as 'stable' | 'beta';
        const updater = window.electronAPI?.updater;
        if (updater?.setChannel) {
            await updater.setChannel(channel);
            setConfig((prev) => ({ ...prev, channel }));
            logger.info(`[DesktopSection] Update channel changed to: ${channel}`);
        }
    }, []);

    const handleSourceChange = useCallback(async (value: string) => {
        const source = value as 'github' | 'firebase';
        const updater = window.electronAPI?.updater;
        if (updater?.setSource) {
            await updater.setSource(source);
            setConfig((prev) => ({ ...prev, source }));
            logger.info(`[DesktopSection] Update source changed to: ${source}`);
        }
    }, []);

    // -----------------------------------------------------------------------
    // Status badge rendering
    // -----------------------------------------------------------------------
    const renderStatusBadge = () => {
        const badges: Record<UpdateStatus, { icon: React.ReactNode; text: string; color: string }> = {
            idle: { icon: <Info size={12} />, text: 'Not checked', color: 'text-slate-500 bg-slate-800/60' },
            checking: { icon: <Loader2 size={12} className="animate-spin" />, text: 'Checking...', color: 'text-cyan-400 bg-cyan-500/10' },
            available: { icon: <Download size={12} />, text: `v${availableVersion} available`, color: 'text-amber-400 bg-amber-500/10' },
            downloading: { icon: <Loader2 size={12} className="animate-spin" />, text: `Downloading ${downloadProgress.toFixed(0)}%`, color: 'text-purple-400 bg-purple-500/10' },
            downloaded: { icon: <CheckCircle size={12} />, text: `v${availableVersion} ready`, color: 'text-emerald-400 bg-emerald-500/10' },
            'up-to-date': { icon: <CheckCircle size={12} />, text: 'Up to date', color: 'text-emerald-400 bg-emerald-500/10' },
            error: { icon: <AlertTriangle size={12} />, text: 'Check failed', color: 'text-red-400 bg-red-500/10' },
        };

        const badge = badges[status];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide ${badge.color}`}>
                {badge.icon}
                {badge.text}
            </span>
        );
    };

    // -----------------------------------------------------------------------
    // Non-Electron fallback
    // -----------------------------------------------------------------------
    if (!isElectron) {
        return (
            <div>
                <SectionHeader
                    title="Desktop & Updates"
                    description="Auto-update controls are available in the desktop app."
                />
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                    <Info size={16} className="text-slate-500 shrink-0" />
                    <p className="text-sm text-slate-400">
                        You're using the web version of indii. Desktop auto-update settings are only available in the Electron app.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <SectionHeader
                title="Desktop & Updates"
                description="Manage app updates and release channel preferences."
            />

            {/* Version Info Card */}
            <div className="mb-6 p-4 rounded-xl bg-linear-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                            <Monitor size={18} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">{config.releaseName || 'Founders Version One'}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                                indii Studio
                                <span className="ml-2 text-slate-600">•</span>
                                build v{config.technicalVersion || appVersion || '...'}
                                <span className="ml-2 text-slate-600">•</span>
                                <span className="ml-2 capitalize text-slate-400">{config.channel}</span>
                            </p>
                        </div>
                    </div>
                    {renderStatusBadge()}
                </div>

                {/* Download progress bar */}
                <AnimatePresence>
                    {status === 'downloading' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3"
                        >
                            <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-linear-to-r from-purple-500 to-cyan-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${downloadProgress}%` }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error message */}
                <AnimatePresence>
                    {status === 'error' && errorMessage && (
                        <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 text-xs text-red-400/80 bg-red-500/5 p-2.5 rounded-lg border border-red-500/10 font-medium"
                        >
                            {errorMessage}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    id="settings-check-for-updates"
                    onClick={handleCheckForUpdates}
                    disabled={status === 'checking' || status === 'downloading'}
                    className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    <RefreshCw size={14} className={status === 'checking' ? 'animate-spin' : ''} />
                    {status === 'checking' ? 'Checking...' : 'Check for Updates'}
                </button>

                <AnimatePresence>
                    {status === 'downloaded' && (
                        <motion.button
                            id="settings-install-update"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={handleInstall}
                            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                        >
                            <Download size={14} />
                            Restart & Install v{availableVersion}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Settings */}
            <div className="space-y-1">
                <SettingRow
                    icon={Radio}
                    label="Update Channel"
                    description="Stable receives tested releases. Beta gets early access builds."
                >
                    <SelectDropdown
                        value={config.channel}
                        options={[
                            { value: 'stable', label: 'Stable' },
                            { value: 'beta', label: 'Beta' },
                        ]}
                        onChange={handleChannelChange}
                    />
                </SettingRow>

                <SettingRow
                    icon={Server}
                    label="Update Source"
                    description="Where to fetch updates from."
                >
                    <SelectDropdown
                        value={config.source}
                        options={[
                            { value: 'github', label: 'GitHub Releases' },
                            { value: 'firebase', label: 'Firebase Hosting' },
                        ]}
                        onChange={handleSourceChange}
                    />
                </SettingRow>
            </div>

            {/* Auto-update info */}
            <div className="mt-6 flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                    indii automatically checks for updates on launch and every 4 hours. Downloaded updates are installed when you quit the app, or you can click "Restart & Install" to apply immediately.
                </p>
            </div>
        </div>
    );
};

export default DesktopSection;
