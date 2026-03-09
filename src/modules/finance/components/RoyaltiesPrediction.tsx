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

/* ================================================================== */
/*  Item 152 — Daily Royalties Prediction                              */
/* ================================================================== */

const PER_STREAM_RATE = 0.004; // Spotify per-stream rate

interface StreamDataPoint {
    label?: string;
    forecast?: number | null;
    upper?: number | null;
    lower?: number | null;
    actual?: number | null;
    [key: string]: unknown;
}

// Stream data and DSP breakdown should come from the distributor/streaming analytics API
// Empty arrays shown until real analytics data is connected
function generateStreamData(): StreamDataPoint[] {
    return [];
}

const DSP_BREAKDOWN: Array<{ name: string; pct: number; color: string }> = [];

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
    const initialData = useMemo(() => generateStreamData(), []);
    const [chartData, setChartData] = useState(initialData);
    const [isUpdating, setIsUpdating] = useState(false);
    const [modelVersion, setModelVersion] = useState(1);

    const totalForecastStreams = useMemo(
        () => chartData.filter((d) => d.forecast != null).reduce((sum, d) => sum + (d.forecast ?? 0), 0),
        [chartData]
    );
    const predictedPayout = (totalForecastStreams * PER_STREAM_RATE).toFixed(2);

    function handleUpdateModel() {
        setIsUpdating(true);
        setTimeout(() => {
            // Recalculate with slight variation
            const base = generateStreamData();
            const bump = 0.95 + Math.random() * 0.15;
            const updated = base.map((d) => ({
                ...d,
                forecast: d.forecast != null ? Math.round(d.forecast * bump) : null,
                upper: d.upper != null ? Math.round(d.upper * bump) : null,
                lower: d.lower != null ? Math.round(d.lower * bump) : null,
            }));
            setChartData(updated);
            setModelVersion((v) => v + 1);
            setIsUpdating(false);
        }, 1000);
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
                        <p className="text-[10px] text-gray-500">v{modelVersion} · 30-day forecast at $0.004/stream</p>
                    </div>
                </div>
                <button
                    onClick={handleUpdateModel}
                    disabled={isUpdating}
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
                    <p className="text-[10px] text-gray-500">next 30 days · ±15%</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <Music size={12} className="text-purple-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Forecast Streams</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        {totalForecastStreams > 0 ? (totalForecastStreams / 1000).toFixed(0) + 'K' : '0'}
                    </p>
                    <p className="text-[10px] text-gray-500">projected next 30 days</p>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[220px] text-center">
                        <TrendingUp size={24} className="text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No Forecast Data Here</p>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">Connect your stores to start seeing royalty predictions</p>
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
                                <ReferenceLine x={chartData[29]?.label} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                {/* Confidence interval */}
                                <Area
                                    type="monotone"
                                    dataKey="upper"
                                    stroke="none"
                                    fill="url(#gradCI)"
                                    connectNulls={false}
                                    isAnimationActive={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="lower"
                                    stroke="none"
                                    fill="url(#gradCI)"
                                    connectNulls={false}
                                    isAnimationActive={false}
                                />
                                {/* Actual */}
                                <Area
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    fill="url(#gradActual)"
                                    connectNulls={false}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#8b5cf6' }}
                                />
                                {/* Forecast (dashed) */}
                                <Area
                                    type="monotone"
                                    dataKey="forecast"
                                    stroke="#a78bfa"
                                    strokeWidth={2}
                                    strokeDasharray="5 4"
                                    fill="url(#gradForecast)"
                                    connectNulls={false}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#a78bfa' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </>
                )}
            </div>

            {/* DSP Breakdown */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">DSP Breakdown</h3>

                {DSP_BREAKDOWN.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-xs text-gray-500">Awaiting stream data</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {DSP_BREAKDOWN.map((dsp) => (
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
                )}
            </div>
        </div>
    );
}
