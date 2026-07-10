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
import { Smartphone, QrCode, Copy, Check, RefreshCw, Info, Wifi } from 'lucide-react';
import { SectionHeader, SettingRow } from './SettingsShared';
import { auth } from '@/services/firebase';
import { isPrivateIP } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';

const CODE_TTL_MS = 5 * 60 * 1000; // matches auth_handoffs expiry in functions/auth/handoff.ts

const RemoteSection: React.FC = () => {
    const [code, setCode] = useState<string | null>(null);
    const [qrUrl, setQrUrl] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const expiryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearExpiryTimer = () => {
        if (expiryTimer.current) {
            clearInterval(expiryTimer.current);
            expiryTimer.current = null;
        }
    };

    useEffect(() => clearExpiryTimer, []);

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
            const isDev = window.location.hostname === 'localhost' || isPrivateIP(window.location.hostname);
            const base = isDev ? window.location.origin + '/mobile-remote' : 'https://indii.music/mobile-remote';
            setCode(data.code);
            setQrUrl(`${base}?code=${data.code}`);

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

            {/* Sync status */}
            <div className="space-y-1">
                <SettingRow
                    icon={Wifi}
                    label="Cloud Relay"
                    description="Paired devices sync through the indii Cloud Relay while this studio is running."
                >
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${auth.currentUser
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : 'text-slate-500 bg-slate-800/60 border border-slate-700/50'
                        }`}>
                        {auth.currentUser ? 'Active' : 'Signed out'}
                    </span>
                </SettingRow>
            </div>

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
