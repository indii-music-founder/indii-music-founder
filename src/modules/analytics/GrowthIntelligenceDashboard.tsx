/**
 * GrowthIntelligenceDashboard — Music Growth Intelligence Engine
 *
 * Implements the full analytics pipeline defined in the IndiiOS Growth
 * Intelligence spec:
 *  - Streaming data ingestion (mock; swap in live Spotify/Apple API calls)
 *  - Viral score model (weighted composite 0-100)
 *  - Growth pattern detection (8 archetypes)
 *  - 14-day breakout forecast (logistic growth curve)
 *  - Cross-platform comparison + regional diffusion
 *  - Real-time breakout alerts
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'motion/react';
import { RefreshCw, Brain, TrendingUp, Globe, Bell, BarChart2, GitBranch } from 'lucide-react';

import { useStore } from '@/core/store';
import { mockDataService } from '@/services/analytics/MockDataService';
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

    const [activeTab, setActiveTab] = React.useState<TabId>('overview');

    // ── Load data ─────────────────────────────────────────────────────────────

    const loadReports = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            // In production: replace with live API calls
            // const tracks = await spotifyService.getArtistTracks(userId);
            const tracks = mockDataService.generateTrackCatalogue(30);
            const reports = analyticsEngine.generateCatalogueReports(tracks);

            reports.forEach(r => setAnalyticsReport(r.track.trackId, r));
            addAnalyticsAlerts(reports.flatMap(r => r.alerts));

            if (!analyticsSelectedTrackId && reports.length > 0) {
                setAnalyticsSelectedTrackId(reports[0].track.trackId);
            }
            setAnalyticsLastRefresh(Date.now());
        } finally {
            setAnalyticsLoading(false);
        }
    }, [
        setAnalyticsLoading, setAnalyticsReport, addAnalyticsAlerts,
        analyticsSelectedTrackId, setAnalyticsSelectedTrackId, setAnalyticsLastRefresh,
    ]);

    useEffect(() => {
        if (!analyticsLastRefresh) {
            loadReports();
        }
    }, [analyticsLastRefresh, loadReports]);

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

    // ── Render ────────────────────────────────────────────────────────────────

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
                <div className="flex items-center gap-3">
                    {analyticsLastRefresh && (
                        <span className="text-xs text-slate-500 hidden sm:block">
                            Updated {new Date(analyticsLastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
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
                                <p className="text-sm">{analyticsLoading ? 'Analyzing tracks…' : 'Select a track to view analytics'}</p>
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
                                <h2 className="text-xl font-bold text-white">{selectedReport.track.trackName}</h2>
                                <p className="text-sm text-slate-400">{selectedReport.track.artistName} · {selectedReport.track.genre} · Released {selectedReport.track.releaseDate}</p>
                            </motion.div>

                            {/* Tab bar */}
                            <div className="flex gap-1 overflow-x-auto pb-0.5">
                                {TABS.map(tab => {
                                    const Icon = tab.icon;
                                    const isAlert = tab.id === 'alerts';
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
                                                tiktok: 'TikTok', youtube_shorts: 'YT Shorts', instagram_reels: 'Reels',
                                            };
                                            return (
                                                <div key={p.platform} className="bg-slate-800/50 border border-white/8 rounded-xl p-3">
                                                    <p className="text-sm font-semibold text-white mb-2">{labels[p.platform] ?? p.platform}</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <p className="text-slate-500">Streams</p>
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
                                </div>
                            )}

                            {activeTab === 'regions' && (
                                <div className="bg-slate-800/50 border border-white/8 rounded-xl p-5">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Geographic Diffusion</p>
                                    <RegionalMap
                                        regions={selectedReport.track.regions}
                                        totalStreams={selectedReport.track.totalStreams}
                                    />
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
