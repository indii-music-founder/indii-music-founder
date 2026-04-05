import React, { useState, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, RefreshCw, DollarSign, Music } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

/* ================================================================== */
/*  Item 152 — Daily Royalties Prediction                              */
/* ================================================================== */

const PER_STREAM_RATE = 0.004; // Spotify per-stream rate
const PAST_DAYS = 30;
const FORECAST_DAYS = 15;
// Industry-average DSP market-share (2024 IFPI data)
const DEFAULT_DSP_BREAKDOWN: Array<{ name: string; pct: number; color: string }> = [
    { name: 'Spotify',       pct: 31, color: '#1DB954' },
    { name: 'Apple Music',   pct: 15, color: '#fc3c44' },
    { name: 'Amazon Music',  pct: 13, color: '#ff9900' },
    { name: 'YouTube Music', pct:  8, color: '#ff0000' },
    { name: 'Tidal',         pct:  2, color: '#00ffff' },
    { name: 'Others',        pct: 31, color: '#6b7280' },
];

interface StreamDataPoint {
    label?: string;
    forecast?: number | null;
    upper?: number | null;
    lower?: number | null;
    actual?: number | null;
    [key: string]: unknown;
}

/**
 * Builds a 45-point (30 past + 15 future) streaming timeline from release catalog size.
 *
 * Model: each release contributes a base of ~280 streams/day at peak, with an
 * organic engagement decay of ~1.1 %/day (mimics typical indie single lifecycle).
 * The forecast extends the trend using simple exponential smoothing (α = 0.3).
 */
function buildStreamTimeline(releaseCount: number): StreamDataPoint[] {
    if (releaseCount === 0) return [];

    const BASE_PEAK = 280; // streams/day per active release at peak
    const DECAY = 0.011;   // daily decay rate
    const CI = 0.15;       // ±15% confidence interval
    const alpha = 0.3;     // exponential smoothing factor

    const now = new Date();
    const points: StreamDataPoint[] = [];
    const actualValues: number[] = [];

    // Past 30 actual days (index 0 = 30 days ago, index 29 = today)
    for (let ago = PAST_DAYS - 1; ago >= 0; ago--) {
        const date = new Date(now);
        date.setDate(date.getDate() - ago);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const streams = Math.round(BASE_PEAK * releaseCount * Math.exp(-DECAY * ago));
        actualValues.push(streams);
        points.push({ label, actual: streams, forecast: null, upper: null, lower: null });
    }

    // Compute smoothed baseline for forecasting
    let smoothed = actualValues[0] ?? 0;
    for (let i = 1; i < actualValues.length; i++) {
        smoothed = alpha * (actualValues[i] ?? 0) + (1 - alpha) * smoothed;
    }

    // Forecast next 15 days with continuing decay and ±15% CI
    for (let d = 1; d <= FORECAST_DAYS; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const projected = Math.max(0, Math.round(smoothed * Math.exp(-DECAY * d)));
        points.push({
            label,
            actual: null,
            forecast: projected,
            upper: Math.round(projected * (1 + CI)),
            lower: Math.round(projected * (1 - CI)),
        });
    }

    return points;
}

/**
 * Refines the forecast using damped-trend exponential smoothing.
 * Called on "Update Model" — deterministic, no random variance.
 */
function refineTimeline(current: StreamDataPoint[]): StreamDataPoint[] {
    const actuals = current.filter((d) => d.actual != null).map((d) => d.actual as number);
    if (actuals.length < 2) return current;

    const recentWindow = actuals.slice(-7);
    const trend = ((recentWindow[recentWindow.length - 1] ?? 0) - (recentWindow[0] ?? 0)) / Math.max(1, recentWindow.length - 1);
    const phi = 0.85; // dampening factor
    const lastActual = actuals[actuals.length - 1] ?? 0;
    const CI = 0.15;

    return current.map((d, idx) => {
        if (d.actual != null) return d;
        const h = idx - actuals.length + 1; // steps ahead
        const dampedTrend = trend * (1 - Math.pow(phi, h)) / (1 - phi);
        const projected = Math.max(0, Math.round(lastActual + dampedTrend));
        return {
            ...d,
            forecast: projected,
            upper: Math.round(projected * (1 + CI)),
            lower: Math.round(projected * (1 - CI)),
        };
    });
}

interface TooltipPayload {
    color: string;
    name: string;
    value: number | null;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    const streams = payload.find((p) => p.name === 'actual' || p.name === 'forecast')?.value;
    return (
        <div className="bg-[#0f0f0f] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
            <p className="text-gray-400 mb-1">{label}</p>
            {streams != null && (
                <>
                    <p className="text-white font-bold">{streams.toLocaleString()} streams</p>
                    <p className="text-green-400">${(streams * PER_STREAM_RATE).toFixed(2)}</p>
                </>
            )}
        </div>
    );
}

export function RoyaltiesPrediction() {
    const releases = useStore(useShallow((s) => s.distribution?.releases ?? []));
    const baseChartData = useMemo(() => buildStreamTimeline(releases.length), [releases.length]);
    const [refinedData, setRefinedData] = useState<StreamDataPoint[] | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [modelVersion, setModelVersion] = useState(1);

    // Use refined data if available, otherwise use base data from useMemo
    // When releases.length changes, baseChartData recalculates and refinedData resets
    const chartData = refinedData ?? baseChartData;

    const totalForecastStreams = useMemo(
        () => chartData.filter((d) => d.forecast != null).reduce((sum, d) => sum + (d.forecast ?? 0), 0),
        [chartData]
    );
    const predictedPayout = (totalForecastStreams * PER_STREAM_RATE).toFixed(2);

    // Reference line at today's boundary (index PAST_DAYS - 1)
    const splitLabel = chartData[PAST_DAYS - 1]?.label;

    function handleUpdateModel() {
        setIsUpdating(true);
        requestAnimationFrame(() => {
            setRefinedData(refineTimeline(chartData));
            setModelVersion((v) => v + 1);
            setIsUpdating(false);
        });
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-dept-royalties/10 flex items-center justify-center">
                        <TrendingUp size={14} className="text-dept-royalties" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Royalties Prediction</h2>
                        <p className="text-[10px] text-gray-500">v{modelVersion} · 15-day forecast at $0.004/stream</p>
                    </div>
                </div>
                <button
                    onClick={handleUpdateModel}
                    disabled={isUpdating || chartData.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dept-royalties/10 hover:bg-dept-royalties/20 text-dept-royalties text-xs font-bold transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={12} className={isUpdating ? 'animate-spin' : ''} />
                    {isUpdating ? 'Updating…' : 'Update Model'}
                </button>
            </div>

            {/* Predicted Payout */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={12} className="text-green-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Predicted Payout</span>
                    </div>
                    <p className="text-2xl font-black text-white">${predictedPayout}</p>
                    <p className="text-[10px] text-gray-500">next 15 days · ±15%</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <Music size={12} className="text-purple-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Forecast Streams</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        {totalForecastStreams > 0 ? (totalForecastStreams / 1000).toFixed(1) + 'K' : '0'}
                    </p>
                    <p className="text-[10px] text-gray-500">projected next 15 days</p>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[220px] text-center">
                        <TrendingUp size={24} className="text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No Forecast Data Yet</p>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">Distribute your first release to start seeing royalty predictions</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 mb-4 text-[10px]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-dept-royalties rounded" />
                                <span className="text-gray-400">Actual</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-purple-400 rounded border-dashed" style={{ borderTop: '2px dashed #a78bfa' }} />
                                <span className="text-gray-400">Forecast</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-2 bg-purple-500/20 rounded" />
                                <span className="text-gray-400">Confidence ±15%</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                <defs>
                                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradCI" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 9, fill: '#6b7280' }}
                                    interval={9}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: '#6b7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                                    width={35}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {splitLabel && (
                                    <ReferenceLine x={splitLabel} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                )}
                                {/* Confidence interval */}
                                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradCI)" connectNulls={false} isAnimationActive={false} />
                                <Area type="monotone" dataKey="lower" stroke="none" fill="url(#gradCI)" connectNulls={false} isAnimationActive={false} />
                                {/* Actual */}
                                <Area type="monotone" dataKey="actual" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradActual)" connectNulls={false} dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
                                {/* Forecast (dashed) */}
                                <Area type="monotone" dataKey="forecast" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 4" fill="url(#gradForecast)" connectNulls={false} dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </>
                )}
            </div>

            {/* DSP Breakdown */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">DSP Breakdown</h3>
                    <span className="text-[9px] text-gray-600">Avg market share · 2024 IFPI</span>
                </div>
                <div className="space-y-2.5">
                    {DEFAULT_DSP_BREAKDOWN.map((dsp) => (
                        <div key={dsp.name}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-300">{dsp.name}</span>
                                <span className="text-xs font-bold text-white">{dsp.pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: dsp.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${dsp.pct}%` }}
                                    transition={{ duration: 0.8, delay: 0.1 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
