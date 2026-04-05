import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Cpu, DollarSign, Timer, AlertTriangle, Loader2 } from 'lucide-react';
import { MetricsService, SystemMetrics } from '@/services/agent/observability/MetricsService';

type TimeRange = 1 | 7 | 30;

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    1: '24h',
    7: '7d',
    30: '30d',
};

function StatCard({
    label,
    value,
    icon: Icon,
    color = 'text-white',
    sub,
}: {
    label: string;
    value: string;
    icon: React.FC<{ size?: string | number; className?: string }>;
    color?: string;
    sub?: string;
}) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-slate-800 ${color} shrink-0`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
                {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

export const MetricsDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>(7);

    useEffect(() => {
        let cancelled = false;
        const fetchMetrics = async () => {
            try {
                const data = await MetricsService.getSystemMetrics(timeRange);
                if (!cancelled) {
                    setMetrics(data);
                    setError(null);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError((err as Error)?.message ?? 'Failed to load metrics');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchMetrics();
        return () => { cancelled = true; };
    }, [timeRange]);

    const agentChartData = metrics
        ? Object.entries(metrics.agentBreakdown).map(([name, data]) => ({
            name: name.replace('-agent', '').replace('_', ' '),
            calls: data.count,
            cost: Number(data.cost.toFixed(4)),
            tokens: data.tokens,
        }))
        : [];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
            {/* Header + time range */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">System Metrics</h2>
                <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    {([1, 7, 30] as TimeRange[]).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${timeRange === range
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {TIME_RANGE_LABELS[range]}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Loading metrics…
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle size={16} />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {metrics && !loading && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Executions"
                            value={metrics.totalExecutions.toLocaleString()}
                            icon={TrendingUp}
                            color="text-emerald-400"
                        />
                        <StatCard
                            label="Total Tokens"
                            value={
                                metrics.totalTokens > 1_000_000
                                    ? `${(metrics.totalTokens / 1_000_000).toFixed(2)}M`
                                    : metrics.totalTokens > 1_000
                                        ? `${(metrics.totalTokens / 1_000).toFixed(1)}K`
                                        : metrics.totalTokens.toString()
                            }
                            icon={Cpu}
                            color="text-blue-400"
                        />
                        <StatCard
                            label="Estimated Cost"
                            value={`$${metrics.totalCost.toFixed(4)}`}
                            icon={DollarSign}
                            color="text-yellow-400"
                        />
                        <StatCard
                            label="Avg Latency"
                            value={
                                metrics.avgLatencyMs > 1000
                                    ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s`
                                    : `${Math.round(metrics.avgLatencyMs)}ms`
                            }
                            icon={Timer}
                            color={metrics.avgLatencyMs > 10000 ? 'text-red-400' : 'text-slate-300'}
                            sub={`Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`}
                        />
                    </div>

                    {/* Agent breakdown chart */}
                    {agentChartData.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-4">Agent Usage Breakdown</h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={agentChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                            color: '#fff',
                                        }}
                                    />
                                    <Bar dataKey="calls" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {agentChartData.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                            No agent execution data for this time range.
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
