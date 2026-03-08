import React, { useState } from 'react';
import { Activity, BarChart2, Heart, Shield } from 'lucide-react';
import { TraceViewer } from '@/components/studio/observability/TraceViewer';
import { MetricsDashboard } from './components/MetricsDashboard';
import { HealthPanel } from './components/HealthPanel';
import { CircuitBreakerPanel } from './components/CircuitBreakerPanel';

type ObsTab = 'traces' | 'metrics' | 'health' | 'breaker';

const TABS: Array<{ id: ObsTab; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
    { id: 'traces', label: 'Traces', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: BarChart2 },
    { id: 'health', label: 'Health', icon: Heart },
    { id: 'breaker', label: 'Circuit Breaker', icon: Shield },
];

export default function ObservabilityDashboard() {
    const [activeTab, setActiveTab] = useState<ObsTab>('traces');

    return (
        <div className="flex flex-col h-full w-full bg-background text-white overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-slate-800 shrink-0">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            activeTab === id
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'traces' && <TraceViewer />}
                {activeTab === 'metrics' && <MetricsDashboard />}
                {activeTab === 'health' && <HealthPanel />}
                {activeTab === 'breaker' && <CircuitBreakerPanel />}
import React, { useEffect, useState, useCallback } from 'react';
import { TraceViewer } from '@/components/studio/observability/TraceViewer';
import { MetricsService, SystemMetrics } from '@/services/agent/observability/MetricsService';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'motion/react';
import {
    Activity, Cpu, DollarSign, Clock, AlertTriangle,
    Zap, RefreshCw, TrendingUp, TrendingDown, BarChart3,
    Coins, Users, Shield
} from 'lucide-react';

/* ================================================================== */
/*  Observability Dashboard — Full Production Module                    */
/*                                                                     */
/*  Composes: MetricsService → SystemMetrics cards                     */
/*            TraceViewer → Real-time trace list + SwarmGraph           */
/*            Agent breakdown → Per-agent cost/execution stats          */
/* ================================================================== */

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    accentColor?: string;
}

function MetricCard({ icon, label, value, subtitle, trend, accentColor = 'purple' }: MetricCardProps) {
    const colorMap: Record<string, string> = {
        purple: 'from-purple-500/20 to-purple-900/5 border-purple-500/20',
        blue: 'from-blue-500/20 to-blue-900/5 border-blue-500/20',
        green: 'from-emerald-500/20 to-emerald-900/5 border-emerald-500/20',
        amber: 'from-amber-500/20 to-amber-900/5 border-amber-500/20',
        red: 'from-red-500/20 to-red-900/5 border-red-500/20',
    };
    const colors = colorMap[accentColor] || colorMap.purple;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card className={`bg-gradient-to-br ${colors} border backdrop-blur-sm`}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
                            <p className="text-2xl font-bold tracking-tight">{value}</p>
                            {subtitle && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    {trend === 'up' && <TrendingUp size={10} className="text-emerald-400" />}
                                    {trend === 'down' && <TrendingDown size={10} className="text-red-400" />}
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        <div className="p-2 rounded-lg bg-white/5">
                            {icon}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

interface AgentBreakdownRowProps {
    agentId: string;
    data: { count: number; cost: number; tokens: number };
    totalExecutions: number;
}

const AGENT_COLORS: Record<string, string> = {
    orchestrator: 'bg-purple-500',
    generalist: 'bg-blue-500',
    legal: 'bg-red-500',
    finance: 'bg-emerald-500',
    creative: 'bg-pink-500',
    publicist: 'bg-orange-500',
    brand: 'bg-cyan-500',
    marketing: 'bg-yellow-500',
    music: 'bg-indigo-500',
    video: 'bg-rose-500',
};

function AgentBreakdownRow({ agentId, data, totalExecutions }: AgentBreakdownRowProps) {
    const pct = totalExecutions > 0 ? (data.count / totalExecutions) * 100 : 0;
    const barColor = AGENT_COLORS[agentId.toLowerCase()] || 'bg-gray-500';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${barColor}`} />
                    <span className="font-medium capitalize">{agentId}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="font-mono">{data.count}×</span>
                    <span className="font-mono">${data.cost.toFixed(4)}</span>
                </div>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}

export default function ObservabilityDashboard() {
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState(7);

    const loadMetrics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await MetricsService.getSystemMetrics(timeRange);
            setMetrics(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load metrics');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        loadMetrics();
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadMetrics, 30_000);
        return () => clearInterval(interval);
    }, [loadMetrics]);

    const formatTokens = (tokens: number): string => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return tokens.toString();
    };

    const formatLatency = (ms: number): string => {
        if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
        if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
        return `${Math.round(ms)}ms`;
    };

    const sortedAgents = metrics
        ? Object.entries(metrics.agentBreakdown).sort((a, b) => b[1].count - a[1].count)
        : [];

    return (
        <ModuleErrorBoundary moduleName="Observability">
            <div className="absolute inset-0 flex flex-col text-white bg-background overflow-hidden">
                {/* ── HEADER ────────────────────────────────────────── */}
                <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <Activity size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">System Observability</h1>
                            <p className="text-[11px] text-muted-foreground">Agent telemetry, cost tracking, and trace analysis</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Time range selector */}
                        <div className="flex bg-white/5 rounded-lg border border-white/10 p-0.5">
                            {[1, 7, 30].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setTimeRange(days)}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${timeRange === days
                                        ? 'bg-purple-500/30 text-purple-200 font-medium'
                                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={loadMetrics}
                            disabled={loading}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                            aria-label="Refresh metrics"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ── CONTENT ───────────────────────────────────────── */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* ── LEFT PANEL — System Metrics ─────────────────── */}
                    <aside className="w-72 xl:w-80 flex-shrink-0 border-r border-white/5 overflow-y-auto">
                        <div className="p-4 space-y-4">
                            {/* Error state */}
                            {error && (
                                <Card className="bg-red-900/20 border-red-500/30">
                                    <CardContent className="p-3 flex items-center gap-2 text-red-300 text-xs">
                                        <AlertTriangle size={14} />
                                        {error}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Metric Cards */}
                            <div className="space-y-3">
                                <MetricCard
                                    icon={<Zap size={18} className="text-purple-400" />}
                                    label="Total Executions"
                                    value={metrics ? metrics.totalExecutions.toLocaleString() : '—'}
                                    subtitle={`${timeRange}-day window`}
                                    accentColor="purple"
                                />
                                <MetricCard
                                    icon={<Coins size={18} className="text-amber-400" />}
                                    label="Total Cost"
                                    value={metrics ? `$${metrics.totalCost.toFixed(4)}` : '—'}
                                    subtitle="Across all agents"
                                    accentColor="amber"
                                />
                                <MetricCard
                                    icon={<Cpu size={18} className="text-blue-400" />}
                                    label="Total Tokens"
                                    value={metrics ? formatTokens(metrics.totalTokens) : '—'}
                                    subtitle="Input + output"
                                    accentColor="blue"
                                />
                                <MetricCard
                                    icon={<Clock size={18} className="text-green-400" />}
                                    label="Avg Latency"
                                    value={metrics ? formatLatency(metrics.avgLatencyMs) : '—'}
                                    subtitle="Per execution"
                                    accentColor="green"
                                />
                                <MetricCard
                                    icon={<Shield size={18} className="text-red-400" />}
                                    label="Error Rate"
                                    value={metrics ? `${(metrics.errorRate * 100).toFixed(1)}%` : '—'}
                                    trend={metrics && metrics.errorRate > 0.05 ? 'down' : 'up'}
                                    subtitle={metrics && metrics.errorRate > 0.05 ? 'Above threshold' : 'Healthy'}
                                    accentColor="red"
                                />
                            </div>

                            {/* Agent Breakdown */}
                            {sortedAgents.length > 0 && (
                                <Card className="bg-black/30 border-white/10">
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-xs font-medium flex items-center gap-2">
                                            <BarChart3 size={14} className="text-muted-foreground" />
                                            Agent Breakdown
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4">
                                        <div className="space-y-3">
                                            {sortedAgents.map(([agentId, data]) => (
                                                <AgentBreakdownRow
                                                    key={agentId}
                                                    agentId={agentId}
                                                    data={data}
                                                    totalExecutions={metrics?.totalExecutions || 1}
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Loading skeleton */}
                            {loading && !metrics && (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ── CENTER — Trace Viewer ──────────────────────── */}
                    <main className="flex-1 min-w-0 overflow-hidden">
                        <ModuleErrorBoundary moduleName="Observability / Traces">
                            <TraceViewer />
                        </ModuleErrorBoundary>
                    </main>
                </div>
            </div>
        </ModuleErrorBoundary>
    );
}
