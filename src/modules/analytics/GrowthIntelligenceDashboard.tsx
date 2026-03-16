/**
 * GrowthIntelligenceDashboard — Music Growth Intelligence Engine
 *
 * Production analytics dashboard powered by real platform data:
 *  - Spotify Web API (top tracks, audio features, recently played)
 *  - YouTube Analytics API (views, watch time, subscribers, geography)
 *  - TikTok Display API (video views, engagement)
 *  - Instagram Graph API (Reels plays, reach, impressions)
 *
 * Shows a "Connect Platforms" onboarding state when no accounts are linked.
 * Once connected, loads real TrackAnalytics and passes through the full
 * viral scoring + pattern detection pipeline.
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import {
    RefreshCw, Brain, TrendingUp, Globe, Bell,
    BarChart2, GitBranch, Plug, Settings,
} from 'lucide-react';

import { useStore } from '@/core/store';
import { platformDataService } from '@/services/analytics/PlatformDataService';
import { analyticsEngine } from '@/services/analytics/AnalyticsEngine';
import type { TrackReport } from '@/services/analytics/types';

import { TrackSelector } from './components/TrackSelector';
import { ViralScorePanel } from './components/ViralScorePanel';
import { MetricsGrid } from './components/MetricsGrid';
import { StreamGrowthChart } from './components/StreamGrowthChart';
import { GrowthPatternsPanel } from './components/GrowthPatternsPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { PlatformBreakdown } from './components/PlatformBreakdown';
import { RegionalMap } from './components/RegionalMap';
import { PlatformConnector } from './components/PlatformConnector';

// ──────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'patterns' | 'platforms' | 'regions' | 'alerts';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  icon: TrendingUp },
    { id: 'patterns',  label: 'Patterns',  icon: GitBranch  },
    { id: 'platforms', label: 'Platforms', icon: BarChart2   },
    { id: 'regions',   label: 'Regions',   icon: Globe       },
    { id: 'alerts',    label: 'Alerts',    icon: Bell        },
];

// ──────────────────────────────────────────────────────────────────────────────
// Empty state — no platforms connected
// ──────────────────────────────────────────────────────────────────────────────

function NoPlatformsState({ onConnected }: { onConnected: () => void }) {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8 pt-4">
                    <div className="inline-flex p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
                        <Plug size={32} className="text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Connect Your Platforms</h2>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                        Link your streaming and social accounts to see real-time viral scores,
                        growth patterns, and 14-day breakout forecasts for your tracks.
                    </p>
                </div>
                <PlatformConnector onConnectionChange={onConnected} />
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function GrowthIntelligenceDashboard() {
    const {
        analyticsSelectedTrackId,
        setAnalyticsSelectedTrackId,
        analyticsReports,
        setAnalyticsReport,
        analyticsAlerts,
        addAnalyticsAlerts,
        dismissAnalyticsAlert,
        analyticsLoading,
        setAnalyticsLoading,
        analyticsLastRefresh,
        setAnalyticsLastRefresh,
    } = useStore(useShallow(s => ({
        analyticsSelectedTrackId: s.analyticsSelectedTrackId,
        setAnalyticsSelectedTrackId: s.setAnalyticsSelectedTrackId,
        analyticsReports: s.analyticsReports,
        setAnalyticsReport: s.setAnalyticsReport,
        analyticsAlerts: s.analyticsAlerts,
        addAnalyticsAlerts: s.addAnalyticsAlerts,
        dismissAnalyticsAlert: s.dismissAnalyticsAlert,
        analyticsLoading: s.analyticsLoading,
        setAnalyticsLoading: s.setAnalyticsLoading,
        analyticsLastRefresh: s.analyticsLastRefresh,
        setAnalyticsLastRefresh: s.setAnalyticsLastRefresh,
    })));

    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [showConnector, setShowConnector] = useState(false);
    const [hasConnections, setHasConnections] = useState<boolean | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ── Load data ─────────────────────────────────────────────────────────────

    const loadReports = useCallback(async () => {
        setAnalyticsLoading(true);
        setLoadError(null);
        try {
            // Check connections first
            const anyConnected = await platformDataService.hasAnyConnection();
            setHasConnections(anyConnected);

            if (!anyConnected) return;

            const tracks = await platformDataService.buildCatalogue();
            if (tracks.length === 0) {
                setHasConnections(false);
                return;
            }

            const reports = analyticsEngine.generateCatalogueReports(tracks);
            reports.forEach(r => setAnalyticsReport(r.track.trackId, r));
            addAnalyticsAlerts(reports.flatMap(r => r.alerts));

            if (!analyticsSelectedTrackId && reports.length > 0) {
                setAnalyticsSelectedTrackId(reports[0].track.trackId);
            }
            setAnalyticsLastRefresh(Date.now());
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load analytics data.');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [
        setAnalyticsLoading, setAnalyticsReport, addAnalyticsAlerts,
        analyticsSelectedTrackId, setAnalyticsSelectedTrackId, setAnalyticsLastRefresh,
    ]);

    useEffect(() => {
        if (hasConnections === null) {
            loadReports();
        }
    }, [hasConnections, loadReports]);

    const handleConnectionChange = useCallback(() => {
        setHasConnections(null); // force re-check
        setShowConnector(false);
    }, []);

    // ── Derived state ─────────────────────────────────────────────────────────

    const allReports = useMemo(
        () => Object.values(analyticsReports).sort((a, b) => b.viralScore.score - a.viralScore.score),
        [analyticsReports]
    );

    const selectedReport: TrackReport | null = useMemo(
        () => (analyticsSelectedTrackId ? analyticsReports[analyticsSelectedTrackId] ?? null : null),
        [analyticsReports, analyticsSelectedTrackId]
    );

    const activeAlerts = useMemo(
        () => analyticsAlerts.filter(a =>
            !selectedReport || a.trackId === selectedReport.track.trackId
        ),
        [analyticsAlerts, selectedReport]
    );

    // ── Render: checking connections ──────────────────────────────────────────

    if (hasConnections === null) {
        return (
            <div className="h-full flex items-center justify-center bg-[#0d1117]">
                <div className="text-center text-slate-500">
                    <Brain size={36} className="mx-auto mb-3 opacity-30 animate-pulse" />
                    <p className="text-sm">Checking platform connections…</p>
                </div>
            </div>
        );
    }

    // ── Render: no connections ────────────────────────────────────────────────

    if (!hasConnections && !analyticsLoading) {
        return (
            <div className="h-full flex flex-col bg-[#0d1117] text-white overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/15 border border-indigo-500/30 rounded-xl">
                            <Brain size={18} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white">Growth Intelligence</h1>
                            <p className="text-xs text-slate-400">Viral scores · Pattern detection · Breakout forecasts</p>
                        </div>
                    </div>
                </div>
                <NoPlatformsState onConnected={handleConnectionChange} />
            </div>
        );
    }

    // ── Render: main dashboard ────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white overflow-hidden">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/15 border border-indigo-500/30 rounded-xl">
                        <Brain size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white">Growth Intelligence</h1>
                        <p className="text-xs text-slate-400">
                            Viral scores · Pattern detection · Breakout forecasts
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {analyticsLastRefresh && (
                        <span className="text-xs text-slate-500 hidden sm:block">
                            Updated {new Date(analyticsLastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => setShowConnector(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            showConnector
                                ? 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'
                                : 'text-slate-400 bg-slate-800 border-white/10 hover:bg-slate-700'
                        }`}
                    >
                        <Settings size={12} />
                        Platforms
                    </button>
                    <button
                        onClick={loadReports}
                        disabled={analyticsLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-white/10 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={analyticsLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Platform connector panel (slide-in) ── */}
            <AnimatePresence>
                {showConnector && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-b border-white/8 bg-slate-900/50"
                    >
                        <div className="p-5 max-h-[60vh] overflow-y-auto">
                            <PlatformConnector onConnectionChange={handleConnectionChange} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error banner ── */}
            <AnimatePresence>
                {loadError && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400"
                    >
                        {loadError}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left panel: track list */}
                <div className="w-64 xl:w-72 shrink-0 border-r border-white/8 overflow-y-auto p-3 hidden md:block">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">
                        Tracked Releases ({allReports.length})
                    </p>
                    {analyticsLoading && allReports.length === 0 ? (
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <TrackSelector
                            reports={allReports}
                            selectedTrackId={analyticsSelectedTrackId}
                            onSelect={setAnalyticsSelectedTrackId}
                        />
                    )}
                </div>

                {/* Right panel: detail view */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedReport ? (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <Brain size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">
                                    {analyticsLoading ? 'Fetching platform data…' : 'Select a track to view analytics'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 space-y-5 max-w-4xl">
                            {/* Track header */}
                            <motion.div
                                key={selectedReport.track.trackId}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                {selectedReport.track.coverUrl && (
                                    <img
                                        src={selectedReport.track.coverUrl}
                                        alt={selectedReport.track.trackName}
                                        className="w-12 h-12 rounded-lg object-cover mb-3 border border-white/10"
                                    />
                                )}
                                <h2 className="text-xl font-bold text-white">{selectedReport.track.trackName}</h2>
                                <p className="text-sm text-slate-400">
                                    {selectedReport.track.artistName}
                                    {selectedReport.track.genre ? ` · ${selectedReport.track.genre}` : ''}
                                    {selectedReport.track.releaseDate ? ` · Released ${selectedReport.track.releaseDate}` : ''}
                                </p>
                            </motion.div>

                            {/* Tab bar */}
                            <div className="flex gap-1 overflow-x-auto pb-0.5">
                                {TABS.map(tab => {
                                    const Icon = tab.icon;
                                    const isAlert  = tab.id === 'alerts';
                                    const hasAlerts = isAlert && activeAlerts.length > 0;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                                activeTab === tab.id
                                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                                            }`}
                                        >
                                            <Icon size={12} />
                                            {tab.label}
                                            {hasAlerts && (
                                                <span className="ml-0.5 bg-yellow-500 text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                                    {activeAlerts.length}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab content */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <ViralScorePanel
                                                viralScore={selectedReport.viralScore}
                                                metrics={selectedReport.metrics}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="bg-slate-800/50 border border-white/8 rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stream Growth</p>
                                                    <span className="text-xs text-slate-500">30d + 14d forecast</span>
                                                </div>
                                                <StreamGrowthChart
                                                    history={selectedReport.track.history}
                                                    forecast={selectedReport.forecast}
                                                    showForecast={true}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-slate-800/50 border border-white/8 rounded-xl p-3">
                                                    <p className="text-lg font-bold text-white">{selectedReport.forecast.growthMultiplier}x</p>
                                                    <p className="text-xs text-slate-400">Projected Growth</p>
                                                </div>
                                                <div className="bg-slate-800/50 border border-white/8 rounded-xl p-3">
                                                    <p className="text-lg font-bold text-white">{selectedReport.track.creatorCount.toLocaleString()}</p>
                                                    <p className="text-xs text-slate-400">Creators Using Audio</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Engagement Metrics</p>
                                        <MetricsGrid
                                            metrics={selectedReport.metrics}
                                            totalStreams={selectedReport.track.totalStreams}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'patterns' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-400">
                                        {selectedReport.patterns.length} growth pattern{selectedReport.patterns.length !== 1 ? 's' : ''} detected in this track's trajectory.
                                    </p>
                                    <GrowthPatternsPanel patterns={selectedReport.patterns} />
                                </div>
                            )}

                            {activeTab === 'platforms' && (
                                <div className="space-y-4">
                                    <div className="bg-slate-800/50 border border-white/8 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platform Distribution</p>
                                        <PlatformBreakdown platforms={selectedReport.track.platforms} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {selectedReport.track.platforms.map(p => {
                                            const labels: Record<string, string> = {
                                                spotify: 'Spotify', apple_music: 'Apple Music',
                                                tiktok: 'TikTok', youtube_shorts: 'YouTube',
                                                instagram_reels: 'Instagram Reels',
                                            };
                                            return (
                                                <div key={p.platform} className="bg-slate-800/50 border border-white/8 rounded-xl p-3">
                                                    <p className="text-sm font-semibold text-white mb-2">{labels[p.platform] ?? p.platform}</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <p className="text-slate-500">Streams / Views</p>
                                                            <p className="text-white font-medium">{p.streams.toLocaleString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500">Completion</p>
                                                            <p className="text-white font-medium">{(p.completionRate * 100).toFixed(0)}%</p>
                                                        </div>
                                                        {p.creatorCount !== undefined && p.creatorCount > 0 && (
                                                            <div>
                                                                <p className="text-slate-500">Creators</p>
                                                                <p className="text-white font-medium">{p.creatorCount.toLocaleString()}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Connect more platforms CTA */}
                                    <button
                                        onClick={() => setShowConnector(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 text-xs text-slate-500 hover:text-slate-300 hover:border-white/25 transition-colors"
                                    >
                                        <Plug size={12} />
                                        Connect more platforms to see additional data
                                    </button>
                                </div>
                            )}

                            {activeTab === 'regions' && (
                                <div className="bg-slate-800/50 border border-white/8 rounded-xl p-5">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Geographic Diffusion</p>
                                    {selectedReport.track.regions.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 text-sm">
                                            <Globe size={28} className="mx-auto mb-2 opacity-30" />
                                            <p>Connect YouTube to unlock geographic breakdown data.</p>
                                            <button
                                                onClick={() => setShowConnector(true)}
                                                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
                                            >
                                                Connect YouTube Analytics
                                            </button>
                                        </div>
                                    ) : (
                                        <RegionalMap
                                            regions={selectedReport.track.regions}
                                            totalStreams={selectedReport.track.totalStreams}
                                        />
                                    )}
                                </div>
                            )}

                            {activeTab === 'alerts' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-400">
                                        Active breakout triggers for "{selectedReport.track.trackName}".
                                    </p>
                                    <AlertsPanel
                                        alerts={activeAlerts}
                                        onDismiss={dismissAnalyticsAlert}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
