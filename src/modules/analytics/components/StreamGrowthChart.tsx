import React, { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { motion } from 'motion/react';
import type { StreamDataPoint, GrowthForecast } from '@/services/analytics/types';

interface StreamGrowthChartProps {
    history: StreamDataPoint[];
    forecast?: GrowthForecast;
    showForecast?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const isForecast = payload[0]?.payload?.isForecast;
    return (
        <div className="bg-slate-900/95 backdrop-blur border border-white/10 rounded-xl p-3 shadow-2xl text-sm">
            <p className="text-slate-400 text-xs mb-1">{label} {isForecast ? '· Forecast' : ''}</p>
            {payload.map((entry: any) => (
                entry.name !== 'lower' && entry.name !== 'upper' && (
                    <p key={entry.name} className="font-semibold" style={{ color: entry.color }}>
                        {Number(entry.value).toLocaleString()} streams
                    </p>
                )
            ))}
            {isForecast && payload.find((e: any) => e.name === 'lower') && (
                <p className="text-xs text-slate-500 mt-0.5">
                    Range: {Number(payload.find((e: any) => e.name === 'lower')?.value ?? 0).toLocaleString()}
                    {' – '}
                    {Number(payload.find((e: any) => e.name === 'upper')?.value ?? 0).toLocaleString()}
                </p>
            )}
        </div>
    );
};

export const StreamGrowthChart: React.FC<StreamGrowthChartProps> = ({
    history,
    forecast,
    showForecast = true,
}) => {
    const data = useMemo(() => {
        const historyPoints = history.map(d => ({
            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            streams: d.streams,
            isForecast: false,
        }));

        if (!showForecast || !forecast) return historyPoints;

        const forecastPoints = forecast.projected.map(d => ({
            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            forecast: d.streams,
            lower: d.lower,
            upper: d.upper,
            isForecast: true,
        }));

        return [...historyPoints, ...forecastPoints];
    }, [history, forecast, showForecast]);

    const todayLabel = useMemo(() => {
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return data.find(d => d.date === today)?.date;
    }, [data]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="h-56"
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="streamGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {todayLabel && (
                        <ReferenceLine
                            x={todayLabel}
                            stroke="rgba(255,255,255,0.2)"
                            strokeDasharray="4 4"
                            label={{ value: 'Today', fill: '#64748b', fontSize: 9, position: 'top' }}
                        />
                    )}
                    {/* Historical streams */}
                    <Area
                        type="monotone"
                        dataKey="streams"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#streamGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#6366f1' }}
                    />
                    {/* Forecast */}
                    {showForecast && (
                        <>
                            <Area
                                type="monotone"
                                dataKey="forecast"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                strokeDasharray="5 3"
                                fill="url(#forecastGrad)"
                                dot={false}
                                activeDot={{ r: 4, fill: '#f59e0b' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="upper"
                                stroke="transparent"
                                fill="rgba(245,158,11,0.08)"
                                dot={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="lower"
                                stroke="transparent"
                                fill="rgba(245,158,11,0)"
                                dot={false}
                            />
                        </>
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
};
