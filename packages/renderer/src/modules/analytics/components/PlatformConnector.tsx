/**
 * PlatformConnector — Connect / disconnect streaming & social platforms
 *
 * Displays a card for each supported platform with:
 *  - Connection status (connected / disconnected)
 *  - OAuth "Connect" button that initiates the platform-specific flow
 *  - Guided "Walkthrough" copilot button that opens the assisted step-by-step modal
 *  - "Disconnect" button for connected platforms
 *  - Brief description of what data will be imported
 *
 * Platforms:
 *  - Spotify       (PKCE OAuth via SpotifyService)
 *  - YouTube       (Google reauth via YouTubeAnalyticsService)
 *  - TikTok        (OAuth 2.0 via TikTokAnalyticsService)
 *  - Instagram     (Facebook Login / Meta OAuth via InstagramAnalyticsService)
 *  - Twitter / X   (API v2 via Guided Setup & OAuth)
 *  - Apple Music   (requires secured Apple Music for Artists backend)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle, Compass } from 'lucide-react';

import { spotifyService } from '@/services/analytics/SpotifyService';
import { youTubeAnalyticsService } from '@/services/analytics/YouTubeAnalyticsService';
import { tikTokAnalyticsService } from '@/services/analytics/TikTokAnalyticsService';
import { instagramAnalyticsService } from '@/services/analytics/InstagramAnalyticsService';
import { appleMusicService } from '@/services/analytics/AppleMusicService';
import type { PlatformConnectionStatus } from '@/services/analytics/PlatformDataService';
import { PlatformWalkthroughModal, type WalkthroughPlatformId } from './PlatformWalkthroughModal';

// ── Platform definitions ──────────────────────────────────────────────────────

interface PlatformDef {
    id: keyof PlatformConnectionStatus;
    label: string;
    description: string;
    dataPoints: string[];
    unavailableReason?: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
}

const PLATFORMS: PlatformDef[] = [
    {
        id: 'spotify',
        label: 'Spotify',
        description: 'Top tracks, audio features, and recently played data from your Spotify account.',
        dataPoints: ['Top 50 tracks by popularity', 'Audio features (energy, BPM, key)', 'Recently played history', 'Spotify-led track weighting'],
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
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-400">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
        ),
    },
    {
        id: 'twitter',
        label: 'Twitter / X',
        description: 'Automated release tweets, campaign threads, impressions, and engagement metrics via X API.',
        dataPoints: ['Post automated announcement tweets', 'Impression and reach analytics', 'Retweet & like metrics', 'Release day campaign threads'],
        color: 'text-sky-400',
        bgColor: 'bg-sky-500/10',
        borderColor: 'border-sky-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-sky-400">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
        ),
    },
    {
        id: 'apple_music',
        label: 'Apple Music',
        description: 'Apple Music analytics require a secured Apple Music for Artists backend before indii can import real metrics.',
        dataPoints: ['Backend partner integration required', 'Real metrics only', 'Analytics hidden until verified'],
        unavailableReason: 'Apple Music analytics are unavailable until the secured backend integration is configured.',
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-rose-400">
                <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208a5.485 5.485 0 0 0-.36 1.548c-.052.51-.06 1.02-.075 1.532v11.44c.01.51.02 1.017.071 1.524.163 1.51.85 2.743 2.01 3.708.742.622 1.606.975 2.543 1.127.49.08.986.117 1.48.13H18.96c.517-.015 1.033-.06 1.54-.16 1.25-.245 2.3-.86 3.133-1.807.592-.68.96-1.467 1.137-2.35.12-.6.165-1.207.175-1.815V7.63c-.004-.503-.01-1.003-.01-1.506zM16.49 5.02v9.48a3.25 3.25 0 0 1-1.463 2.723c-.49.31-1.04.476-1.6.476-.24 0-.483-.027-.72-.083a3.26 3.26 0 0 1-2.57-3.184 3.26 3.26 0 0 1 3.26-3.26c.416 0 .82.08 1.193.234V7.33l-6.52 1.574V16.4a3.25 3.25 0 0 1-1.463 2.724c-.49.31-1.04.476-1.6.476-.24 0-.482-.027-.72-.083a3.26 3.26 0 0 1-2.57-3.184A3.26 3.26 0 0 1 5.46 13.07c.418 0 .82.08 1.19.234V6.01l9.84-2.38v1.39z"/>
            </svg>
        ),
    },
    {
        id: 'bluesky',
        label: 'Bluesky Social',
        description: 'Decentralized open social posting, custom domain identity (@indii.music), and direct fan broadcasting via AT Protocol.',
        dataPoints: ['Post release updates via AT Protocol', 'Custom domain handle (@indii.music)', 'App Password authentication', 'Decentralized syndication'],
        color: 'text-sky-400',
        bgColor: 'bg-sky-500/10',
        borderColor: 'border-sky-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-sky-400">
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.994C2.566.944 1.561 1.266.902 1.566.242 1.866.1 2.9.1 3.588c0 .688.378 5.65.624 6.478.815 2.736 3.712 3.66 6.383 3.364-3.913.58-7.387 2-2.83 7.076 5.012 5.19 6.87-1.114 7.823-4.307.953 3.193 2.81 9.497 7.823 4.307 4.557-5.076 1.083-6.496-2.83-7.076 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.688-.142-1.722-.802-2.022-.66-.3-1.664-.622-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8z"/>
            </svg>
        ),
    },
    {
        id: 'linkedin',
        label: 'LinkedIn',
        description: 'B2B music industry outreach, founder updates, licensing announcements, and executive networking via LinkedIn API.',
        dataPoints: ['Company page announcement posts', 'B2B sync licensing updates', 'Executive identity verification', 'Music industry engagement reach'],
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-400">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
        ),
    },
];

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ connected, unavailable = false }: { connected: boolean; unavailable?: boolean }) {
    if (unavailable) {
        return (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <AlertCircle size={10} />
                Unavailable
            </span>
        );
    }

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
        twitter:     false,
        bluesky:     false,
        linkedin:    false,
    });
    const [loading, setLoading] = useState<Partial<Record<keyof PlatformConnectionStatus, boolean>>>({});
    const [errors,  setErrors]  = useState<Partial<Record<keyof PlatformConnectionStatus, string>>>({});
    const [checking, setChecking] = useState(true);

    // Walkthrough modal state
    const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
    const [walkthroughPlatform, setWalkthroughPlatform] = useState<WalkthroughPlatformId>('instagram');

    const openWalkthrough = (platform: keyof PlatformConnectionStatus) => {
        setWalkthroughPlatform(platform as WalkthroughPlatformId);
        setIsWalkthroughOpen(true);
    };

    // ── Load connection status ────────────────────────────────────────────────

    const checkStatus = useCallback(async () => {
        setChecking(true);
        try {
            const [spotify, youtube, tiktok, instagram, apple] = await Promise.allSettled([
                spotifyService.isConnected(),
                youTubeAnalyticsService.isConnected(),
                tikTokAnalyticsService.isConnected(),
                instagramAnalyticsService.isConnected(),
                appleMusicService.isConnected(),
            ]);

            setStatus(prev => ({
                ...prev,
                spotify:     spotify.status    === 'fulfilled' && spotify.value,
                youtube:     youtube.status    === 'fulfilled' && youtube.value,
                tiktok:      tiktok.status     === 'fulfilled' && tiktok.value,
                apple_music: apple.status      === 'fulfilled' && apple.value,
                instagram:   instagram.status  === 'fulfilled' && instagram.value,
                twitter:     prev.twitter ?? false,
                bluesky:     prev.bluesky ?? false,
                linkedin:    prev.linkedin ?? false,
            }));
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
                case 'apple_music':
                    await appleMusicService.connect();
                    await checkStatus();
                    onConnectionChange?.();
                    break;
                case 'twitter':
                    // Open Twitter/X guided walkthrough sequence
                    openWalkthrough('twitter');
                    break;
                case 'bluesky':
                    openWalkthrough('bluesky');
                    break;
                case 'linkedin':
                    openWalkthrough('linkedin');
                    break;
                default:
                    throw new Error(`Connection not implemented for platform: ${platform}`);
            }
        } catch (err: unknown) {
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
                case 'spotify':      await spotifyService.disconnect();            break;
                case 'youtube':      await youTubeAnalyticsService.disconnect();   break;
                case 'tiktok':       await tikTokAnalyticsService.disconnect();    break;
                case 'instagram':    await instagramAnalyticsService.disconnect(); break;
                case 'apple_music':  await appleMusicService.disconnect();         break;
                case 'twitter':
                    setStatus(prev => ({ ...prev, twitter: false }));
                    break;
                case 'bluesky':
                    setStatus(prev => ({ ...prev, bluesky: false }));
                    break;
                case 'linkedin':
                    setStatus(prev => ({ ...prev, linkedin: false }));
                    break;
                default: 
                    throw new Error(`Disconnect not implemented for platform: ${platform}`);
            }
            await checkStatus();
            onConnectionChange?.();
        } catch (err: unknown) {
            setErrorFor(platform, err instanceof Error ? err.message : 'Disconnect failed.');
        } finally {
            setLoaderFor(platform, false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header with Walkthrough Copilot CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
                <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        Connect Your Platforms
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFD700]">
                            API & Analytics
                        </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Connect streaming and social accounts to unlock automated campaign delivery and real-time growth analytics.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => openWalkthrough('instagram')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FFD700]/20 via-[#FFB800]/10 to-[#E65100]/20 border border-[#FFB800]/40 text-[#FFD700] hover:border-[#FFD700] text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,184,0,0.15)] shrink-0 w-fit"
                >
                    <Compass size={14} className="text-[#FFD700]" />
                    <span>Setup Walkthrough Copilot</span>
                </button>
            </div>

            {checking ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                    <Loader2 size={16} className="animate-spin text-[#FFB800]" />
                    Checking platform connections…
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PLATFORMS.map(platform => {
                        const isConnected = Boolean(status[platform.id]);
                        const isLoading   = Boolean(loading[platform.id]);
                        const error       = errors[platform.id];
                        const isUnavailable = Boolean(platform.unavailableReason);

                        return (
                            <motion.div
                                key={platform.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all duration-200 ${
                                    isConnected
                                        ? `${platform.borderColor} ${platform.bgColor}`
                                        : 'border-white/10 bg-[#14100C]/80 hover:bg-[#14100C] hover:border-white/20'
                                }`}
                            >
                                <div>
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
                                                    <StatusPill connected={isConnected} unavailable={isUnavailable} />
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
                                            <li key={point} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                                <span className={`w-1 h-1 rounded-full shrink-0 ${isConnected ? platform.color.replace('text-', 'bg-') : 'bg-slate-600'}`} />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Error */}
                                    <AnimatePresence>
                                        {(error || platform.unavailableReason) && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className={`mb-3 flex items-start gap-1.5 text-[11px] border rounded-lg px-2 py-2 ${
                                                    error
                                                        ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                                        : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                                                }`}
                                            >
                                                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                                {error || platform.unavailableReason}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Action Buttons Row */}
                                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => openWalkthrough(platform.id)}
                                        className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-[#FFB800]/15 hover:text-[#FFD700] border border-white/10 text-gray-300 transition-all shrink-0"
                                        aria-label={`Open walkthrough guide for ${platform.label}`}
                                    >
                                        <Compass size={13} className="text-[#FFB800]" />
                                        <span>Guide</span>
                                    </button>

                                    <button
                                        onClick={() => isConnected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
                                        disabled={isLoading || isUnavailable}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${
                                            isConnected
                                                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-white/10'
                                                : `${platform.bgColor} border ${platform.borderColor} ${platform.color} hover:brightness-125`
                                        }`}
                                    >
                                        {isLoading ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : isConnected ? (
                                            'Disconnect'
                                        ) : isUnavailable ? (
                                            'Unavailable'
                                        ) : (
                                            <>
                                                <ExternalLink size={11} />
                                                Connect {platform.label.split(' ')[0]}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Privacy note */}
            <p className="text-[11px] text-slate-500 text-center pt-2">
                Platform credentials are cryptographically stored in your private Firestore vault.
                Publishing permissions are only used for campaigns you explicitly approve.
            </p>

            {/* Platform Walkthrough & Copilot Modal */}
            <PlatformWalkthroughModal
                isOpen={isWalkthroughOpen}
                onClose={() => setIsWalkthroughOpen(false)}
                initialPlatform={walkthroughPlatform}
                connectionStatus={status}
                onConnectPlatform={async (platformId) => {
                    await handleConnect(platformId);
                }}
                isConnecting={Boolean(loading[walkthroughPlatform])}
            />
        </div>
    );
}
