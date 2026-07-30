/**
 * Mobile Remote Settings Section
 *
 * Desktop half of the device-pairing flow. Generates a short-lived handoff
 * code (via the createHandoffCode Cloud Function), renders it as a QR code
 * and a copyable 64-character code. The phone redeems it in the Mobile
 * Remote pairing screen (redeemHandoffCode → signInWithCustomToken), after
 * which studio state syncs over the indii Cloud Relay (Firestore).
 *
 * The phone-side pairing modal has always pointed users at "your desktop
 * studio Settings panel" — this section is that destination.
 */
import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, QrCode, Copy, Check, RefreshCw, Info, Wifi, FolderPlus, Trash2, HardDrive } from 'lucide-react';
import { SectionHeader, SettingRow } from './SettingsShared';
import { auth } from '@/services/firebase';
import { isPrivateIP } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';
import { desktopFileIndexService, type ApprovedAssetFolder } from '@/services/agent/DesktopFileIndexService';
import { buildMobileRemotePairingUrl } from '@/modules/mobile-remote/routing';

const CODE_TTL_MS = 5 * 60 * 1000; // matches auth_handoffs expiry in functions/auth/handoff.ts

/**
 * Only the Electron desktop app can issue a Studio executor lease — the lease is
 * keyed to an OS-keychain enrollment secret reached through `window.electronAPI`
 * (see StudioExecutorLeaseService). A browser tab has no such bridge, so it can
 * never become the Studio a paired phone connects to.
 */
const isElectronStudio = typeof window !== 'undefined' && !!window.electronAPI;

const RemoteSection: React.FC = () => {
    const [code, setCode] = useState<string | null>(null);
    const [qrUrl, setQrUrl] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [assetFolders, setAssetFolders] = useState<ApprovedAssetFolder[]>([]);
    const [assetFolderError, setAssetFolderError] = useState<string | null>(null);
    const [assetFolderBusy, setAssetFolderBusy] = useState(false);
    const expiryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearExpiryTimer = () => {
        if (expiryTimer.current) {
            clearInterval(expiryTimer.current);
            expiryTimer.current = null;
        }
    };

    useEffect(() => clearExpiryTimer, []);

    const loadAssetFolders = async () => {
        try {
            setAssetFolders(await desktopFileIndexService.listApprovedFolders());
        } catch (err) {
            setAssetFolderError(err instanceof Error ? err.message : 'Could not load approved asset folders.');
        }
    };

    useEffect(() => { loadAssetFolders(); }, []);

    const handleApproveAssetFolder = async () => {
        setAssetFolderBusy(true);
        setAssetFolderError(null);
        try {
            await desktopFileIndexService.approveFolder();
            await loadAssetFolders();
        } catch (err) {
            setAssetFolderError(err instanceof Error ? err.message : 'Could not approve this folder.');
        } finally {
            setAssetFolderBusy(false);
        }
    };

    const handleRevokeAssetFolder = async (folderId: string) => {
        setAssetFolderBusy(true);
        setAssetFolderError(null);
        try {
            await desktopFileIndexService.revokeFolder(folderId);
            await loadAssetFolders();
        } catch (err) {
            setAssetFolderError(err instanceof Error ? err.message : 'Could not remove this folder.');
        } finally {
            setAssetFolderBusy(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setCopied(false);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('You must be signed in to pair a device.');
            }

            const idToken = await currentUser.getIdToken();
            const { endpointService } = await import('@/core/config/EndpointService');
            const createUrl = endpointService.getFunctionUrl('createHandoffCode');

            const response = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
            if (!response.ok) {
                throw new Error(await response.text());
            }

            const data = await response.json();
            if (!data.code) {
                throw new Error('No pairing code returned');
            }

            // Same URL scheme the Mobile Remote pairing modal generates
            const isDev =
                window.location.hostname === 'localhost' || isPrivateIP(window.location.hostname);
            const origin = isDev ? window.location.origin : undefined;
            setCode(data.code);
            setQrUrl(buildMobileRemotePairingUrl(data.code, origin));

            // Countdown to expiry so the UI never shows a dead code as live
            clearExpiryTimer();
            const expiresAt = Date.now() + CODE_TTL_MS;
            setSecondsLeft(Math.round(CODE_TTL_MS / 1000));
            expiryTimer.current = setInterval(() => {
                const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
                setSecondsLeft(remaining);
                if (remaining <= 0) {
                    clearExpiryTimer();
                    setCode(null);
                    setQrUrl('');
                }
            }, 1000);
        } catch (err) {
            logger.error('[RemoteSection] Failed to generate pairing code:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate pairing code');
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.warn('[RemoteSection] Clipboard write failed:', err);
        }
    };

    const formatCountdown = (s: number) =>
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div>
            <SectionHeader
                title="Mobile Remote"
                description="Pair your phone or tablet to control the studio and sync your workspace from anywhere."
            />

            {/* Pairing card */}
            <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/30 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <QrCode size={16} className="text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Link a Device</p>
                        <p className="text-xs text-slate-500">
                            Scan the QR code with your phone, or enter the pairing code in the Mobile Remote pairing screen.
                        </p>
                    </div>
                </div>

                {code && qrUrl ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-2xl">
                            <QRCodeSVG value={qrUrl} size={168} />
                        </div>

                        <div className="w-full">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                Manual pairing code
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-slate-700/50 text-[10px] font-mono text-cyan-300 break-all select-all">
                                    {code}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white border border-slate-700/50 transition-colors flex-shrink-0"
                                    title="Copy pairing code"
                                    aria-label="Copy pairing code"
                                >
                                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>

                        <div className="w-full flex items-center justify-between">
                            <p className="text-xs text-slate-500">
                                Expires in <span className="font-mono text-slate-300">{formatCountdown(secondsLeft)}</span>
                            </p>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors disabled:opacity-40"
                            >
                                <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
                                New Code
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        id="settings-generate-pairing-code"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                    >
                        {generating ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Smartphone size={14} />
                                Generate Pairing Code
                            </>
                        )}
                    </button>
                )}

                {error && (
                    <p className="mt-3 text-xs text-red-400/80 bg-red-500/5 p-2.5 rounded-lg border border-red-500/10 font-medium">
                        {error}
                    </p>
                )}
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/30 mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <HardDrive size={16} className="text-violet-300" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Desktop Asset Folders</p>
                        <p className="text-xs text-slate-500">Only folders you approve here can be searched by your Studio agents. File contents and absolute paths are never shared.</p>
                    </div>
                </div>
                <div className="space-y-2 mb-3">
                    {assetFolders.length === 0 ? (
                        <p className="text-xs text-slate-500 rounded-lg border border-slate-700/40 bg-black/20 px-3 py-2.5">No folders approved yet. Add Photos, Projects, Downloads, or a creative cache folder when you want agents to find local assets.</p>
                    ) : assetFolders.map(folder => (
                        <div key={folder.id} className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-black/20 px-3 py-2">
                            <span className="flex-1 min-w-0 text-xs text-slate-200 truncate" title={folder.path}>{folder.label}</span>
                            <button onClick={() => handleRevokeAssetFolder(folder.id)} disabled={assetFolderBusy} className="p-1.5 text-slate-500 hover:text-red-300 disabled:opacity-40" aria-label={`Remove ${folder.label}`} title="Remove folder access"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleApproveAssetFolder} disabled={assetFolderBusy} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 disabled:opacity-40">
                    <FolderPlus size={14} /> {assetFolderBusy ? 'Updating…' : 'Approve Folder'}
                </button>
                {assetFolderError && <p className="mt-3 text-xs text-red-400/80">{assetFolderError}</p>}
            </div>

            {/* ISSUE-1290: pairing has two independent requirements — an authorized
                account AND a Studio executor that can publish presence. Only the first
                was surfaced, so a browser-tab Studio (which structurally cannot issue an
                executor lease) still showed a reassuring green "Signed in" while every
                pairing attempt silently timed out on the phone. Both are reported now. */}
            <div className="space-y-1">
                <SettingRow
                    icon={Wifi}
                    label="Cloud Relay Account"
                    description="Signing in authorizes cloud relay access."
                >
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${auth.currentUser
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : 'text-slate-500 bg-slate-800/60 border border-slate-700/50'
                        }`}>
                        {auth.currentUser ? 'Signed in' : 'Signed out'}
                    </span>
                </SettingRow>

                <SettingRow
                    icon={Smartphone}
                    label="Studio Executor"
                    description={isElectronStudio
                        ? 'This desktop app can act as the Studio your phone connects to.'
                        : 'Only the installed Electron desktop app can act as a Studio executor. A browser tab cannot — your phone will pair, then find no Studio and give up.'}
                >
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isElectronStudio
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        }`}>
                        {isElectronStudio ? 'Ready' : 'Not available in browser'}
                    </span>
                </SettingRow>
            </div>

            {!isElectronStudio && (
                <p className="mt-3 text-xs text-amber-300/90 bg-amber-500/5 p-3 rounded-lg border border-amber-500/15 leading-relaxed">
                    <strong className="font-semibold">Pairing will not complete from this browser tab.</strong>{' '}
                    The pairing code itself will work and your phone will sign in, but a
                    browser Studio cannot publish the executor presence the phone looks
                    for — so the phone waits, finds nothing, and returns to its pairing
                    screen. Open the installed indii desktop app and generate the code
                    there instead.
                </p>
            )}

            {/* Info */}
            <div className="mt-6 flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                    Pairing codes are single-use and expire after 5 minutes. On your phone, open the
                    Mobile Remote and choose Link Device, then scan the QR code or paste the pairing code.
                    Your phone signs in as you and stays synced through the cloud — no same-network requirement.
                </p>
            </div>
        </div>
    );
};

export default RemoteSection;
