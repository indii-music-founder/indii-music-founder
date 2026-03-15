/**
 * PlatformConnector — Connect / disconnect streaming & social platforms
 *
 * Displays a card for each supported platform with:
 *  - Connection status (connected / disconnected)
 *  - OAuth "Connect" button that initiates the platform-specific flow
 *  - "Disconnect" button for connected platforms
 *  - Brief description of what data will be imported
 *
 * Platforms:
 *  - Spotify       (PKCE OAuth via SpotifyService)
 *  - YouTube       (Google reauth via YouTubeAnalyticsService)
 *  - TikTok        (OAuth 2.0 via TikTokAnalyticsService)
 *  - Instagram     (Facebook Login / Meta OAuth via InstagramAnalyticsService)
 *  - Apple Music   (MusicKit — coming soon)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

import { spotifyService } from '@/services/analytics/SpotifyService';
import { youTubeAnalyticsService } from '@/services/analytics/YouTubeAnalyticsService';
import { tikTokAnalyticsService } from '@/services/analytics/TikTokAnalyticsService';
import { instagramAnalyticsService } from '@/services/analytics/InstagramAnalyticsService';
import type { PlatformConnectionStatus } from '@/services/analytics/PlatformDataService';

// ── Platform definitions ──────────────────────────────────────────────────────

interface PlatformDef {
    id: keyof PlatformConnectionStatus;
    label: string;
    description: string;
    dataPoints: string[];
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
    comingSoon?: boolean;
}

const PLATFORMS: PlatformDef[] = [
    {
        id: 'spotify',
        label: 'Spotify',
        description: 'Top tracks, audio features, and recently played data from your Spotify account.',
        dataPoints: ['Top 50 tracks by popularity', 'Audio features (energy, BPM, key)', 'Recently played history', 'Estimated stream counts'],
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-400">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
        ),
    },
    {
        id: 'youtube',
        label: 'YouTube',
        description: 'Real views, watch time, and subscriber data from YouTube Analytics API.',
        dataPoints: ['Daily view counts (30 days)', 'Estimated watch minutes', 'Subscriber gains', 'Geographic breakdown by country'],
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
        ),
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        description: 'Video views, likes, shares, and account engagement from TikTok Display API.',
        dataPoints: ['Video view counts', 'Likes & shares per video', 'Account engagement rate', 'Upload timeline (30 days)'],
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-pink-400">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.89a8.2 8.2 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1-.31z"/>
            </svg>
        ),
    },
    {
        id: 'instagram',
        label: 'Instagram Reels',
        description: 'Reels plays, reach, impressions, and engagement via Instagram Graph API.',
        dataPoints: ['Reels plays & reach', 'Impressions (30 days)', 'Saves & shares per Reel', 'Account-level daily insights'],
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-purple-400">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
        ),
    },
    {
        id: 'apple_music',
        label: 'Apple Music',
        description: 'Apple Music for Artists analytics via MusicKit JS integration.',
        dataPoints: ['Streams & plays', 'Shazam counts', 'Radio airplay', 'Playlist placements'],
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
        comingSoon: true,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-rose-400">
                <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208a5.485 5.485 0 0 0-.36 1.548c-.052.51-.06 1.02-.075 1.532v11.44c.01.51.02 1.017.071 1.524.163 1.51.85 2.743 2.01 3.708.742.622 1.606.975 2.543 1.127.49.08.986.117 1.48.13H18.96c.517-.015 1.033-.06 1.54-.16 1.25-.245 2.3-.86 3.133-1.807.592-.68.96-1.467 1.137-2.35.12-.6.165-1.207.175-1.815V7.63c-.004-.503-.01-1.003-.01-1.506zM16.49 5.02v9.48a3.25 3.25 0 0 1-1.463 2.723c-.49.31-1.04.476-1.6.476-.24 0-.483-.027-.72-.083a3.26 3.26 0 0 1-2.57-3.184 3.26 3.26 0 0 1 3.26-3.26c.416 0 .82.08 1.193.234V7.33l-6.52 1.574V16.4a3.25 3.25 0 0 1-1.463 2.724c-.49.31-1.04.476-1.6.476-.24 0-.482-.027-.72-.083a3.26 3.26 0 0 1-2.57-3.184A3.26 3.26 0 0 1 5.46 13.07c.418 0 .82.08 1.19.234V6.01l9.84-2.38v1.39z"/>
            </svg>
        ),
    },
];

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ connected }: { connected: boolean }) {
    return (
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            connected
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'bg-slate-700/50 text-slate-500 border border-white/8'
        }`}>
            {connected ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {connected ? 'Connected' : 'Not connected'}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PlatformConnectorProps {
    onConnectionChange?: () => void;
}

export function PlatformConnector({ onConnectionChange }: PlatformConnectorProps) {
    const [status, setStatus] = useState<PlatformConnectionStatus>({
        spotify:     false,
        youtube:     false,
        tiktok:      false,
        apple_music: false,
        instagram:   false,
    });
    const [loading, setLoading] = useState<Partial<Record<keyof PlatformConnectionStatus, boolean>>>({});
    const [errors,  setErrors]  = useState<Partial<Record<keyof PlatformConnectionStatus, string>>>({});
    const [checking, setChecking] = useState(true);

    // ── Load connection status ────────────────────────────────────────────────

    const checkStatus = useCallback(async () => {
        setChecking(true);
        try {
            const [spotify, youtube, tiktok, instagram] = await Promise.allSettled([
                spotifyService.isConnected(),
                youTubeAnalyticsService.isConnected(),
                tikTokAnalyticsService.isConnected(),
                instagramAnalyticsService.isConnected(),
            ]);

            setStatus({
                spotify:     spotify.status    === 'fulfilled' && spotify.value,
                youtube:     youtube.status    === 'fulfilled' && youtube.value,
                tiktok:      tiktok.status     === 'fulfilled' && tiktok.value,
                apple_music: false,
                instagram:   instagram.status  === 'fulfilled' && instagram.value,
            });
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => { checkStatus(); }, [checkStatus]);

    // ── Connection handlers ───────────────────────────────────────────────────

    const setLoaderFor = (id: keyof PlatformConnectionStatus, val: boolean) =>
        setLoading(prev => ({ ...prev, [id]: val }));

    const setErrorFor = (id: keyof PlatformConnectionStatus, msg: string | undefined) =>
        setErrors(prev => ({ ...prev, [id]: msg }));

    const handleConnect = async (platform: keyof PlatformConnectionStatus) => {
        setLoaderFor(platform, true);
        setErrorFor(platform, undefined);
        try {
            switch (platform) {
                case 'spotify':
                    await spotifyService.initiateOAuth();
                    break;
                case 'youtube':
                    await youTubeAnalyticsService.requestYouTubeAccess();
                    await checkStatus();
                    onConnectionChange?.();
                    break;
                case 'tiktok':
                    await tikTokAnalyticsService.initiateOAuth();
                    break;
                case 'instagram':
                    await instagramAnalyticsService.initiateOAuth();
                    break;
                default:
                    break;
            }
        } catch (err) {
            setErrorFor(platform, err instanceof Error ? err.message : 'Connection failed.');
        } finally {
            setLoaderFor(platform, false);
        }
    };

    const handleDisconnect = async (platform: keyof PlatformConnectionStatus) => {
        setLoaderFor(platform, true);
        setErrorFor(platform, undefined);
        try {
            switch (platform) {
                case 'spotify':   await spotifyService.disconnect();            break;
                case 'youtube':   youTubeAnalyticsService.disconnect();         break;
                case 'tiktok':    await tikTokAnalyticsService.disconnect();    break;
                case 'instagram': await instagramAnalyticsService.disconnect(); break;
                default: break;
            }
            await checkStatus();
            onConnectionChange?.();
        } catch (err) {
            setErrorFor(platform, err instanceof Error ? err.message : 'Disconnect failed.');
        } finally {
            setLoaderFor(platform, false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-3">
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Connect Your Platforms</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                    Connect your streaming and social accounts to unlock real analytics data.
                    Your credentials are stored securely and never shared.
                </p>
            </div>

            {checking ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
                    <Loader2 size={16} className="animate-spin" />
                    Checking connections…
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {PLATFORMS.map(platform => {
                        const isConnected = status[platform.id];
                        const isLoading   = !!loading[platform.id];
                        const error       = errors[platform.id];

                        return (
                            <motion.div
                                key={platform.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative rounded-xl border p-4 transition-all duration-200 ${
                                    platform.comingSoon
                                        ? 'border-white/8 bg-slate-800/30 opacity-60'
                                        : isConnected
                                            ? `${platform.borderColor} ${platform.bgColor}`
                                            : 'border-white/8 bg-slate-800/40 hover:bg-slate-800/70'
                                }`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-2 rounded-lg ${platform.bgColor} border ${platform.borderColor}`}>
                                            {platform.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white leading-tight">
                                                {platform.label}
                                            </p>
                                            <div className="mt-0.5">
                                                {platform.comingSoon
                                                    ? <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Coming soon</span>
                                                    : <StatusPill connected={isConnected} />
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                                    {platform.description}
                                </p>

                                {/* Data points */}
                                <ul className="space-y-1 mb-4">
                                    {platform.dataPoints.map(point => (
                                        <li key={point} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                            <span className={`w-1 h-1 rounded-full shrink-0 ${isConnected ? platform.color.replace('text-', 'bg-') : 'bg-slate-600'}`} />
                                            {point}
                                        </li>
                                    ))}
                                </ul>

                                {/* Error */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mb-3 flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-2"
                                        >
                                            <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Action button */}
                                {!platform.comingSoon && (
                                    <button
                                        onClick={() => isConnected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
                                        disabled={isLoading}
                                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${
                                            isConnected
                                                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-white/10'
                                                : `${platform.bgColor} border ${platform.borderColor} ${platform.color} hover:brightness-125`
                                        }`}
                                    >
                                        {isLoading ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : isConnected ? (
                                            'Disconnect'
                                        ) : (
                                            <>
                                                <ExternalLink size={11} />
                                                Connect {platform.label}
                                            </>
                                        )}
                                    </button>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Privacy note */}
            <p className="text-[11px] text-slate-600 text-center pt-2">
                Platform credentials are stored encrypted in your private Firestore account.
                We only request read-only analytics access — we never post on your behalf.
            </p>
        </div>
    );
}
