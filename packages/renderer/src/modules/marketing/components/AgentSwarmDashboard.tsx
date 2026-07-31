import React, { useEffect } from 'react';
import {
    Activity, AlertCircle, CheckCircle2, Clock, Loader2, Power, Target,
} from 'lucide-react';
import {
    CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@/core/store';
import type { AgentActionLog } from '@/core/store';

/* ==================================================================== */
/*  Swarm Command Center                                                 */
/*                                                                       */
/*  ┌───────────────────────────────────┬──────────────────┐             */
/*  │  Campaign performance (ROAS)      │  Live agent logs │             */
/*  │  ClickHouse daily rollup          │  Firestore live  │             */
/*  └───────────────────────────────────┴──────────────────┘             */
/*                                                                       */
/*  Left is warehouse data on a sync cadence; right is a live snapshot    */
/*  subscription. They refresh independently and fail independently —     */
/*  a warehouse outage must not blank the activity feed.                  */
/* ==================================================================== */

const STATUS_ICON: Record<AgentActionLog['status'], React.ReactNode> = {
    success: <CheckCircle2 size={14} className="text-green-400" />,
    pending: <Clock size={14} className="text-gray-500" />,
    failed: <AlertCircle size={14} className="text-red-400" />,
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const AgentSwarmDashboard: React.FC = () => {
    const {
        agentLogs, campaignMetrics, revenueVisibility, isSwarmActive,
        swarmMetricsLoading, swarmMetricsError, swarmLogsError, swarmStatusError,
        subscribeAgentLogs, fetchCampaignMetrics, loadSwarmStatus, toggleSwarmStatus,
    } = useStore(useShallow(state => ({
        agentLogs: state.agentLogs,
        campaignMetrics: state.campaignMetrics,
        revenueVisibility: state.revenueVisibility,
        isSwarmActive: state.isSwarmActive,
        swarmMetricsLoading: state.swarmMetricsLoading,
        swarmMetricsError: state.swarmMetricsError,
        swarmLogsError: state.swarmLogsError,
        swarmStatusError: state.swarmStatusError,
        subscribeAgentLogs: state.subscribeAgentLogs,
        fetchCampaignMetrics: state.fetchCampaignMetrics,
        loadSwarmStatus: state.loadSwarmStatus,
        toggleSwarmStatus: state.toggleSwarmStatus,
    })));

    useEffect(() => {
        // The snapshot listener bills reads for as long as it lives — tear it
        // down with the panel rather than leaving it open behind a tab switch.
        const unsubscribe = subscribeAgentLogs();
        void loadSwarmStatus();
        void fetchCampaignMetrics();
        return unsubscribe;
    }, [subscribeAgentLogs, loadSwarmStatus, fetchCampaignMetrics]);

    const totals = campaignMetrics.reduce(
        (acc, row) => ({
            spend: acc.spend + row.total_spend,
            revenue: acc.revenue + row.total_revenue,
            linkClicks: acc.linkClicks + row.link_clicks,
            dspRedirects: acc.dspRedirects + row.dsp_redirects,
            presaves: acc.presaves + row.presaves,
        }),
        { spend: 0, revenue: 0, linkClicks: 0, dspRedirects: 0, presaves: 0 },
    );

    /**
     * Cost per outcome, not ROAS.
     *
     * For an artist with no connected store there is no attributable revenue —
     * streams can't be tied to a click and royalties land months later
     * unlinked. A ROAS tile would read 0.00x however well the ads performed,
     * which is worse than not showing it. When a store *is* connected, revenue
     * is real and ROAS appears.
     */
    const showRoas = revenueVisibility === 'measurable';
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : null;
    const costPer = (count: number) => (count > 0 && totals.spend > 0 ? totals.spend / count : null);
    const costPerFan = costPer(totals.dspRedirects);
    const costPerPresave = costPer(totals.presaves);

    const formatCostPer = (value: number | null) => (value === null ? '—' : currency.format(value));

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity size={18} className="text-dept-marketing" />
                        Swarm Command Center
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Autonomous marketing agents, their spend, and every action they took on your behalf.
                    </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <button
                        onClick={() => void toggleSwarmStatus(!isSwarmActive)}
                        aria-pressed={isSwarmActive}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            isSwarmActive
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                        }`}
                    >
                        <Power size={16} />
                        {isSwarmActive ? 'Halt All Agents' : 'Activate Swarm'}
                    </button>
                    <p className="text-[10px] text-gray-600">
                        {isSwarmActive
                            ? 'Agents may publish new ads.'
                            : 'New ad buys blocked. Running ads can still be paused.'}
                    </p>
                    {swarmStatusError && (
                        <p className="text-[10px] text-red-400 max-w-xs text-right">{swarmStatusError}</p>
                    )}
                </div>
            </div>

            {/* Rollup stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile label="Ad Spend" value={currency.format(totals.spend)} />
                <StatTile
                    label="Listeners Reached"
                    value={totals.dspRedirects.toLocaleString('en-US')}
                    hint="Fans who picked a streaming service and left"
                />
                <StatTile
                    label="Cost / Listener"
                    value={formatCostPer(costPerFan)}
                    hint="Ad spend divided by fans sent to a DSP"
                />
                {showRoas ? (
                    <StatTile
                        label="ROAS"
                        value={roas === null ? '—' : `${roas.toFixed(2)}x`}
                        hint="Store revenue per dollar of ad spend"
                    />
                ) : (
                    <StatTile
                        label="Cost / Pre-Save"
                        value={formatCostPer(costPerPresave)}
                        hint="Connect a store to see ROAS"
                    />
                )}
            </div>

            {!showRoas && totals.spend > 0 && (
                <p className="text-[11px] text-gray-600 -mt-3">
                    Revenue isn&apos;t shown because streams can&apos;t be attributed to an ad click and royalties
                    arrive months later unlinked. Connect a store to measure ROAS directly.
                </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Performance chart */}
                <div className="lg:col-span-2 bg-white/[0.03] border border-white/5 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <Target size={11} /> Campaign Performance (last 30 days)
                    </h3>

                    <div className="h-[300px] w-full">
                        {swarmMetricsLoading ? (
                            <div className="h-full flex items-center justify-center gap-2 text-gray-500">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-sm">Loading campaign metrics…</span>
                            </div>
                        ) : swarmMetricsError ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                                <AlertCircle size={22} className="text-red-400" />
                                <p className="text-sm font-medium text-red-400">Metrics unavailable</p>
                                <p className="text-xs text-gray-500 max-w-sm">{swarmMetricsError}</p>
                                <button
                                    onClick={() => void fetchCampaignMetrics()}
                                    className="mt-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : campaignMetrics.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                                <Target size={26} className="text-gray-700" />
                                <p className="text-sm text-gray-500">No campaign data yet.</p>
                                <p className="text-xs text-gray-600 max-w-xs">
                                    Numbers appear here once an agent has run an ad and the analytics sync has caught up.
                                </p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={campaignMetrics}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                                    <YAxis yAxisId="left" stroke="#6b7280" fontSize={11} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={11} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#111',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '0.5rem',
                                            fontSize: '12px',
                                        }}
                                        formatter={(value: number, name: string) => (
                                            name === 'Ad Spend' || name === 'Revenue'
                                                ? currency.format(value)
                                                : value.toLocaleString('en-US')
                                        )}
                                    />
                                    <Line
                                        yAxisId="left" type="monotone" dataKey="total_spend"
                                        stroke="#3b82f6" strokeWidth={2} dot={false} name="Ad Spend"
                                    />
                                    {/* Against spend, plot whichever outcome is actually
                                        measurable for this artist. Charting a flat-zero
                                        revenue line would read as "the ads failed". */}
                                    {showRoas ? (
                                        <Line
                                            yAxisId="right" type="monotone" dataKey="total_revenue"
                                            stroke="#10b981" strokeWidth={2} dot={false} name="Revenue"
                                        />
                                    ) : (
                                        <Line
                                            yAxisId="right" type="monotone" dataKey="dsp_redirects"
                                            stroke="#10b981" strokeWidth={2} dot={false} name="Listeners Reached"
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Live agent log */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 flex flex-col max-h-[420px]">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <Activity size={11} /> Live Agent Logs
                    </h3>

                    {swarmLogsError ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                            <AlertCircle size={20} className="text-red-400" />
                            <p className="text-xs text-red-400 max-w-[16rem]">{swarmLogsError}</p>
                        </div>
                    ) : agentLogs.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                            <Activity size={24} className="text-gray-700" />
                            <p className="text-sm text-gray-500">No agent activity yet.</p>
                            <p className="text-xs text-gray-600 max-w-[16rem]">
                                Every ad an agent publishes or pauses shows up here as it happens.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {agentLogs.map(log => (
                                <div
                                    key={log.id}
                                    className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-dept-marketing">
                                            {log.agentName}
                                        </span>
                                        {STATUS_ICON[log.status]}
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed">{log.message}</p>
                                    <span className="text-[10px] text-gray-600">
                                        {new Date(log.timestamp).toLocaleTimeString('en-US')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white mt-1">{value}</p>
        {hint && <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{hint}</p>}
    </div>
);

export default AgentSwarmDashboard;
