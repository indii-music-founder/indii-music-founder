import React, { useState, useMemo } from 'react';
import {
    TrendingUp, Zap, DollarSign, BarChart2,
    Calendar, Activity, Flame
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

type DateRange = '7d' | '30d' | '90d';

interface MilestoneEvent {
    day: number;
    label: string;
    color: string;
}

interface DataPoint {
    day: number;
    label: string;
    streams: number;
    adSpend: number;
}

const MILESTONE_EVENTS: MilestoneEvent[] = [
    // Populated dynamically from real release analytics — empty by default
];

function generateData(days: number): DataPoint[] {
    // Returns empty data — real data would come from analytics API
    return Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        label: `Day ${i + 1}`,
        streams: 0,
        adSpend: 0,
    }));
}

const ALL_DATA = generateData(90);

const RANGE_DAYS: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

// Key moments would be populated from release analytics — empty until a release is tracked
const KEY_MOMENTS: { day: number; icon: React.ElementType; text: string; color: string }[] = [];

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#0f0f0f] border border-white/10 rounded-xl p-3 shadow-xl text-xs">
            <p className="text-gray-400 mb-1.5">{label}</p>
            {payload.map((p) => (
                <p key={p.name} style={{ color: p.color }} className="font-semibold">
                    {p.name === 'streams' ? `${p.value.toLocaleString()} streams` : `$${p.value} ad spend`}
                </p>
            ))}
        </div>
    );
}

export default function MomentumTracker() {
    const [dateRange, setDateRange] = useState<DateRange>('30d');

    const chartData = useMemo(() => {
        return ALL_DATA.slice(0, RANGE_DAYS[dateRange]);
    }, [dateRange]);

    const relevantMilestones = useMemo(
        () => MILESTONE_EVENTS.filter(m => m.day <= RANGE_DAYS[dateRange]),
        [dateRange]
    );

    const totalStreams = useMemo(() => chartData.reduce((sum, d) => sum + d.streams, 0), [chartData]);
    const totalAdSpend = useMemo(() => chartData.reduce((sum, d) => sum + d.adSpend, 0), [chartData]);
    const week1Streams = useMemo(() => ALL_DATA.slice(0, 7).reduce((sum, d) => sum + d.streams, 0), []);
    const organicRatio = useMemo(() => {
        const organic = totalStreams - totalAdSpend * 18;
        return Math.max(0, Math.min(100, Math.round((organic / totalStreams) * 100)));
    }, [totalStreams, totalAdSpend]);

    const relevantMoments = useMemo(
        () => KEY_MOMENTS.filter(m => m.day <= RANGE_DAYS[dateRange]),
        [dateRange]
    );

    return (
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity size={18} className="text-dept-marketing" />
                        Post-Release Momentum Tracker
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Overlay ad spend vs. organic stream growth post-release.</p>
                </div>
                {/* Date Range Selector */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {(['7d', '30d', '90d'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setDateRange(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r
                                ? 'bg-dept-marketing text-white shadow'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {totalStreams === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 border-dashed">
                    <div className="w-12 h-12 rounded-xl bg-dept-marketing/10 flex items-center justify-center">
                        <Flame size={20} className="text-dept-marketing/60" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-400">No Release Data Yet</p>
                        <p className="text-[11px] text-gray-600 mt-1 max-w-xs mx-auto">
                            Momentum tracking activates after your first release is distributed. Connect your distributor in the Distribution module to get started.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total Streams', value: totalStreams.toLocaleString(), icon: BarChart2, color: 'text-dept-marketing' },
                            { label: 'Week 1 Streams', value: week1Streams.toLocaleString(), icon: Calendar, color: 'text-blue-400' },
                            { label: 'Total Ad Spend', value: `$${totalAdSpend.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-400' },
                            { label: 'Organic %', value: `${organicRatio}%`, icon: TrendingUp, color: 'text-green-400' },
                        ].map(s => (
                            <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <s.icon size={13} className={`${s.color} mb-1.5`} />
                                <p className="text-base font-bold text-white">{s.value}</p>
                                <p className="text-[10px] text-gray-500">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Timeline Chart */}
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                            Streams + Ad Spend Timeline
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fill: '#6b7280', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={v => `D${v}`}
                                    interval={dateRange === '7d' ? 0 : dateRange === '30d' ? 4 : 11}
                                />
                                <YAxis
                                    yAxisId="streams"
                                    tick={{ fill: '#6b7280', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                                    width={36}
                                />
                                <YAxis
                                    yAxisId="spend"
                                    orientation="right"
                                    tick={{ fill: '#6b7280', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={v => `$${v}`}
                                    width={36}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                                    formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
                                />
                                {relevantMilestones.map(m => (
                                    <ReferenceLine
                                        key={m.day}
                                        x={m.day}
                                        yAxisId="streams"
                                        stroke={m.color}
                                        strokeDasharray="4 3"
                                        strokeOpacity={0.5}
                                        label={{ value: m.label, fill: m.color, fontSize: 9, position: 'top' }}
                                    />
                                ))}
                                <Line
                                    yAxisId="streams"
                                    type="monotone"
                                    dataKey="streams"
                                    name="streams"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#a855f7' }}
                                />
                                <Line
                                    yAxisId="spend"
                                    type="monotone"
                                    dataKey="adSpend"
                                    name="adSpend"
                                    stroke="#f59e0b"
                                    strokeWidth={1.5}
                                    dot={false}
                                    strokeDasharray="4 3"
                                    activeDot={{ r: 4, fill: '#f59e0b' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Key Moments Feed */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Zap size={11} /> Key Moments
                        </h3>
                        <div className="space-y-2">
                            {relevantMoments.map((m, i) => {
                                const Icon = m.icon;
                                return (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Icon size={12} className={m.color} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-mono text-gray-600">Day {m.day}</span>
                                            <p className="text-xs text-gray-300 leading-relaxed">{m.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {relevantMoments.length === 0 && (
                                <p className="text-xs text-gray-600 text-center py-4">No key moments in this range yet.</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
