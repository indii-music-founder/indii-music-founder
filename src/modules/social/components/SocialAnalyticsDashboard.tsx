/**
 * SocialAnalyticsDashboard
 *
 * Unified social platform analytics panel. Aggregates real metrics from
 * Twitter, Instagram, TikTok, Spotify, and YouTube into a normalized view.
 * Reads live data via SocialPlatformService and caches to Firestore.
 *
 * Item 227: Social Analytics Aggregation Dashboard.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Heart, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { syncSpotifyStats, type PlatformStats } from '@/services/social/SocialPlatformService';
import { logger } from '@/utils/logger';

interface PlatformCard {
    platform: string;
    label: string;
    color: string;
    connectUrl: string;
    icon: React.ReactNode;
    stats?: PlatformStats;
    connected: boolean;
    loading: boolean;
    error?: string;
}

function PlatformIcon({ platform }: { platform: string }) {
    const icons: Record<string, string> = {
        twitter: 'X',
        instagram: 'IG',
        tiktok: 'TK',
        youtube: 'YT',
        spotify: 'SP',
    };
    return <span className="text-[11px] font-black">{icons[platform] || '?'}</span>;
}

function StatPill({ label, value, icon }: { label: string; value: number | undefined; icon: React.ReactNode }) {
    if (value === undefined) return null;
    const formatted = value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
            ? `${(value / 1_000).toFixed(1)}K`
            : String(value);

    return (
        <div className="flex items-center gap-1.5">
            <span className="text-gray-600">{icon}</span>
            <span className="text-[11px] text-gray-400">{label}</span>
            <span className="text-[11px] font-bold text-white">{formatted}</span>
        </div>
    );
}

const PLATFORM_META = [
    { platform: 'spotify', label: 'Spotify', color: 'from-green-600 to-green-400', connectUrl: 'https://accounts.spotify.com/authorize' },
    { platform: 'instagram', label: 'Instagram', color: 'from-pink-600 to-orange-400', connectUrl: 'https://api.instagram.com/oauth/authorize' },
    { platform: 'tiktok', label: 'TikTok', color: 'from-cyan-600 to-blue-400', connectUrl: 'https://www.tiktok.com/auth/authorize' },
    { platform: 'youtube', label: 'YouTube', color: 'from-red-600 to-red-400', connectUrl: 'https://accounts.google.com/o/oauth2/auth' },
    { platform: 'twitter', label: 'X (Twitter)', color: 'from-gray-600 to-gray-400', connectUrl: 'https://twitter.com/i/oauth2/authorize' },
];

export default function SocialAnalyticsDashboard() {
    const uid = useStore(useShallow(s => s.userProfile?.id));
    const [cards, setCards] = useState<PlatformCard[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [syncing, setSyncing] = useState(false);

    const initCards = useCallback(() => {
        setCards(PLATFORM_META.map(meta => ({
            ...meta,
            icon: <PlatformIcon platform={meta.platform} />,
            connected: false,
            loading: false,
        })));
    }, []);

    useEffect(() => {
        initCards();
    }, [initCards]);

    const syncAll = useCallback(async () => {
        if (!uid || syncing) return;
        setSyncing(true);

        // Mark all as loading
        setCards(prev => prev.map(c => ({ ...c, loading: true, error: undefined })));

        // For each platform, try to fetch stats
        const results = await Promise.allSettled(
            PLATFORM_META.map(async meta => {
                if (meta.platform === 'spotify') {
                    // Spotify: sync artist stats (uses stored artistId from profile)
                    const { useStore } = await import('@/core/store');
                    const artistId = (useStore.getState().userProfile as any)?.spotifyArtistId as string || '';
                    if (!artistId) return { platform: 'spotify', stats: undefined, connected: false };
                    const stats = await syncSpotifyStats(uid, artistId);
                    return { platform: 'spotify', stats, connected: stats.followers !== undefined };
                }

                // Other platforms: read from Firestore cache
                const { db } = await import('@/services/firebase');
                const { doc, getDoc } = await import('firebase/firestore');
                const cacheRef = doc(db, 'users', uid, 'platformStats', meta.platform);
                const snap = await getDoc(cacheRef);

                if (snap.exists()) {
                    const data = snap.data() as PlatformStats;
                    return { platform: meta.platform, stats: data, connected: true };
                }

                // Check if token exists (= connected)
                const tokenRef = doc(db, 'users', uid, 'socialTokens', meta.platform);
                const tokenSnap = await getDoc(tokenRef);
                return { platform: meta.platform, stats: undefined, connected: tokenSnap.exists() };
            })
        );

        setCards(prev => prev.map(card => {
            const result = results.find(r =>
                r.status === 'fulfilled' && r.value.platform === card.platform
            );
            if (result?.status === 'fulfilled') {
                return {
                    ...card,
                    loading: false,
                    stats: result.value.stats,
                    connected: result.value.connected,
                };
            }
            if (result?.status === 'rejected') {
                logger.error(`[SocialAnalytics] ${card.platform} sync error:`, result.reason);
                return { ...card, loading: false, error: 'Sync failed' };
            }
            return { ...card, loading: false };
        }));

        setLastSync(new Date());
        setSyncing(false);
    }, [uid, syncing]);

    useEffect(() => {
        syncAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    const totalFollowers = cards.reduce((sum, c) => sum + (c.stats?.followers || 0), 0);
    const totalImpressions = cards.reduce((sum, c) => sum + (c.stats?.impressions || 0), 0);
    const connectedCount = cards.filter(c => c.connected).length;

    return (
        <div className="space-y-6">
            {/* Summary header */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={14} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Followers</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        {totalFollowers >= 1000 ? `${(totalFollowers / 1000).toFixed(1)}K` : totalFollowers || '—'}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">across {connectedCount} platforms</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Eye size={14} className="text-purple-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Impressions</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        {totalImpressions >= 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions || '—'}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">last 30 days</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Platforms</span>
                    </div>
                    <p className="text-2xl font-black text-white">{connectedCount} / {PLATFORM_META.length}</p>
                    <p className="text-[10px] text-gray-600 mt-1">connected</p>
                </div>
            </div>

            {/* Platform cards */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 size={14} className="text-gray-400" />
                    Platform Breakdown
                </h3>
                <button
                    onClick={syncAll}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {cards.map(card => (
                    <div key={card.platform} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        {/* Platform badge */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shrink-0`}>
                            {card.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-white">{card.label}</span>
                                {card.connected ? (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">Connected</span>
                                ) : (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">Not Connected</span>
                                )}
                            </div>

                            {card.loading && (
                                <div className="flex items-center gap-1.5">
                                    <RefreshCw size={10} className="animate-spin text-gray-600" />
                                    <span className="text-[10px] text-gray-600">Loading…</span>
                                </div>
                            )}

                            {!card.loading && card.error && (
                                <div className="flex items-center gap-1.5">
                                    <AlertCircle size={10} className="text-yellow-500" />
                                    <span className="text-[10px] text-yellow-500">{card.error}</span>
                                </div>
                            )}

                            {!card.loading && !card.error && card.stats && (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <StatPill label="Followers" value={card.stats.followers} icon={<Users size={10} />} />
                                    <StatPill label="Impressions" value={card.stats.impressions} icon={<Eye size={10} />} />
                                    <StatPill label="Plays" value={card.stats.plays} icon={<TrendingUp size={10} />} />
                                    <StatPill label="Likes" value={card.stats.likes} icon={<Heart size={10} />} />
                                </div>
                            )}

                            {!card.loading && !card.error && !card.stats && card.connected && (
                                <p className="text-[10px] text-gray-600">Stats will appear after first sync</p>
                            )}
                        </div>

                        {/* Connect / Manage action */}
                        {!card.connected && (
                            <a
                                href={card.connectUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/20 transition-all"
                            >
                                Connect <ExternalLink size={9} />
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {lastSync && (
                <p className="text-[10px] text-gray-700 text-right">
                    Last synced: {lastSync.toLocaleTimeString()}
                </p>
            )}
        </div>
    );
}
