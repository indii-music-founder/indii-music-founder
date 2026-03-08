import React, { useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, TrendingUp, Eye, EyeOff, X, Search } from 'lucide-react';

/* ================================================================== */
/*  Item 157 — Anomaly Detection                                       */
/* ================================================================== */

interface DailyStream {
    date: string;
    label: string;
    trackA: number;
    trackB: number;
    trackC: number;
}

const TRACK_NAMES: Record<string, string> = {
    trackA: 'Midnight Circuit',
    trackB: 'Glass Waves',
    trackC: 'Neon Drift',
};

// Static stream data (14 days)
const STREAM_DATA: DailyStream[] = [
    { date: '2026-02-22', label: 'Feb 22', trackA: 12400, trackB: 8200, trackC: 5600 },
    { date: '2026-02-23', label: 'Feb 23', trackA: 13100, trackB: 7900, trackC: 5800 },
    { date: '2026-02-24', label: 'Feb 24', trackA: 11800, trackB: 8500, trackC: 6100 },
    { date: '2026-02-25', label: 'Feb 25', trackA: 12600, trackB: 8100, trackC: 5900 },
    { date: '2026-02-26', label: 'Feb 26', trackA: 13200, trackB: 7800, trackC: 6300 },
    { date: '2026-02-27', label: 'Feb 27', trackA: 12900, trackB: 8400, trackC: 5700 },
    { date: '2026-02-28', label: 'Feb 28', trackA: 13500, trackB: 8200, trackC: 6000 },
    { date: '2026-03-01', label: 'Mar 1', trackA: 14100, trackB: 8300, trackC: 5800 },
    { date: '2026-03-02', label: 'Mar 2', trackA: 13800, trackB: 8100, trackC: 6200 },
    { date: '2026-03-03', label: 'Mar 3', trackA: 14200, trackB: 8500, trackC: 5900 },
    { date: '2026-03-04', label: 'Mar 4', trackA: 13600, trackB: 8200, trackC: 6100 },
    // March 5: massive spike on trackA
    { date: '2026-03-05', label: 'Mar 5', trackA: 131800, trackB: 8400, trackC: 6000 },
    { date: '2026-03-06', label: 'Mar 6', trackA: 28400, trackB: 8100, trackC: 6400 },
    { date: '2026-03-07', label: 'Mar 7', trackA: 19200, trackB: 8300, trackC: 5800 },
];

type Confidence = 'High' | 'Medium' | 'Low';

interface Anomaly {
    id: string;
    trackKey: string;
    trackName: string;
    date: string;
    pctIncrease: number;
    confidence: Confidence;
    message: string;
    dismissed: boolean;
}

const CONFIDENCE_COLORS: Record<Confidence, string> = {
    High: 'text-red-400 bg-red-500/10 border-red-500/20',
    Medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    Low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function detectAnomalies(data: DailyStream[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const THRESHOLD = 2.5;

    (['trackA', 'trackB', 'trackC'] as const).forEach((key) => {
        for (let i = 3; i < data.length; i++) {
            const window = data.slice(Math.max(0, i - 7), i);
            const avg = window.reduce((s, d) => s + d[key], 0) / window.length;
            const current = data[i][key];
            if (current > avg * THRESHOLD) {
                const pct = Math.round((current / avg - 1) * 100);
                const confidence: Confidence = pct > 500 ? 'High' : pct > 200 ? 'Medium' : 'Low';
                anomalies.push({
                    id: `${key}-${data[i].date}`,
                    trackKey: key,
                    trackName: TRACK_NAMES[key],
                    date: data[i].label,
                    pctIncrease: pct,
                    confidence,
                    message: `'${TRACK_NAMES[key]}' spiked ${pct}% on ${data[i].label} — possible viral TikTok or botting`,
                    dismissed: false,
                });
            }
        }
    });

    return anomalies;
}

function isAnomalousBar(data: DailyStream[], idx: number, key: 'trackA' | 'trackB' | 'trackC'): boolean {
    if (idx < 3) return false;
    const window = data.slice(Math.max(0, idx - 7), idx);
    const avg = window.reduce((s, d) => s + d[key], 0) / window.length;
    return data[idx][key] > avg * 2.5;
}

interface TooltipPayload {
    name: string;
    value: number;
    color: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#0f0f0f] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
            <p className="text-gray-400 mb-2">{label}</p>
            {payload.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4">
                    <span style={{ color: p.color }}>{TRACK_NAMES[p.name] || p.name}</span>
                    <span className="font-bold text-white">{p.value.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

export function AnomalyDetector() {
    const baseAnomalies = useMemo(() => detectAnomalies(STREAM_DATA), []);
    const [alerts, setAlerts] = useState<Anomaly[]>(baseAnomalies);
    const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
    const [investigating, setInvestigating] = useState<Set<string>>(new Set());

    const activeAlerts = alerts.filter((a) => !a.dismissed);

    function handleDismiss(id: string) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
    }

    function handleInvestigate(id: string) {
        setInvestigating((prev) => new Set([...prev, id]));
    }

    // Build chart data — optionally filter to anomalous days only
    const chartData = useMemo(() => {
        if (!showAnomaliesOnly) return STREAM_DATA;
        return STREAM_DATA.filter((_, i) =>
            isAnomalousBar(STREAM_DATA, i, 'trackA') ||
            isAnomalousBar(STREAM_DATA, i, 'trackB') ||
            isAnomalousBar(STREAM_DATA, i, 'trackC')
        );
    }, [showAnomaliesOnly]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle size={14} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Anomaly Detector</h2>
                        <p className="text-[10px] text-gray-500">Last 14 days · 2.5x rolling avg threshold</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeAlerts.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                            {activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    <button
                        onClick={() => setShowAnomaliesOnly((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-bold transition-colors"
                    >
                        {showAnomaliesOnly ? <Eye size={10} /> : <EyeOff size={10} />}
                        {showAnomaliesOnly ? 'All Days' : 'Anomalies Only'}
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                <div className="flex items-center gap-4 mb-4 text-[10px]">
                    {Object.entries(TRACK_NAMES).map(([key, name]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-sm ${
                                key === 'trackA' ? 'bg-purple-500' : key === 'trackB' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`} />
                            <span className="text-gray-400">{name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm bg-red-500" />
                        <span className="text-gray-400">Spike</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} barGap={2} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis
                            tick={{ fontSize: 9, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                            width={35}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="trackA" name="trackA" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => {
                                const origIdx = STREAM_DATA.findIndex((d) => d.date === entry.date);
                                const isSpike = isAnomalousBar(STREAM_DATA, origIdx, 'trackA');
                                return <Cell key={`trackA-${index}`} fill={isSpike ? '#ef4444' : '#8b5cf6'} />;
                            })}
                        </Bar>
                        <Bar dataKey="trackB" name="trackB" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => {
                                const origIdx = STREAM_DATA.findIndex((d) => d.date === entry.date);
                                const isSpike = isAnomalousBar(STREAM_DATA, origIdx, 'trackB');
                                return <Cell key={`trackB-${index}`} fill={isSpike ? '#ef4444' : '#3b82f6'} />;
                            })}
                        </Bar>
                        <Bar dataKey="trackC" name="trackC" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => {
                                const origIdx = STREAM_DATA.findIndex((d) => d.date === entry.date);
                                const isSpike = isAnomalousBar(STREAM_DATA, origIdx, 'trackC');
                                return <Cell key={`trackC-${index}`} fill={isSpike ? '#ef4444' : '#10b981'} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Alert List */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Alerts</h3>
                <AnimatePresence>
                    {activeAlerts.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center"
                        >
                            <TrendingUp size={20} className="text-gray-600 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">No active alerts</p>
                        </motion.div>
                    )}
                    {activeAlerts.map((alert) => {
                        const isInvestigating = investigating.has(alert.id);
                        return (
                            <motion.div
                                key={alert.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10, height: 0 }}
                                className="p-3 rounded-xl bg-red-500/5 border border-red-500/10"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-200">{alert.message}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${CONFIDENCE_COLORS[alert.confidence]}`}>
                                                {alert.confidence} confidence
                                            </span>
                                            <span className="text-[10px] text-gray-500">+{alert.pctIncrease}% spike</span>
                                        </div>
                                        {isInvestigating && (
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-[10px] text-yellow-400 mt-1"
                                            >
                                                Investigation queued — checking DSP fraud reports…
                                            </motion.p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleInvestigate(alert.id)}
                                            disabled={isInvestigating}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-[10px] font-bold transition-colors disabled:opacity-50"
                                        >
                                            <Search size={9} />
                                            {isInvestigating ? 'On it' : 'Investigate'}
                                        </button>
                                        <button
                                            onClick={() => handleDismiss(alert.id)}
                                            className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
