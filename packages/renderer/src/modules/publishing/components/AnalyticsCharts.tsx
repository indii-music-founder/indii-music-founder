import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Loader2, TrendingUp, Music, DollarSign } from 'lucide-react';

interface TimeSeriesDataPoint {
    date: string;
    revenue: number;
    streams: number;
}

interface AnalyticsChartsProps {
    data: TimeSeriesDataPoint[];
    selectedMetric: 'revenue' | 'streams';
    onMetricChange: (metric: 'revenue' | 'streams') => void;
    dateRange: { start: string; end: string };
    loading?: boolean;
    className?: string;
}

type CustomTooltipProps = {
    active?: boolean;
    payload?: Array<{ value: number; name: string;[key: string]: unknown }>;
    label?: string | number;
    isRevenue: boolean;
};

const CustomTooltip = ({ active, payload, label, isRevenue }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0 && label !== undefined) {
        return (
            <div className="bg-[#18181b] border border-gray-800 p-3 rounded-lg shadow-2xl backdrop-blur-md">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                    {new Date(String(label)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm font-black text-white">
                    {isRevenue ? '$' : ''}{payload[0]?.value?.toLocaleString()}
                    <span className="ml-1 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                        {isRevenue ? 'USD' : 'Streams'}
                    </span>
                </p>
            </div>
        );
    }
    return null;
};

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
    data,
    selectedMetric,
    onMetricChange,
    dateRange,
    loading = false,
    className = ''
}) => {
    const isRevenue = selectedMetric === 'revenue';
    const mainColor = isRevenue ? '#A855F7' : '#3B82F6'; // Purple for revenue, Blue for streams

    return (
        <div className={`bg-[#121212] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col ${className}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        Performance Analytics
                        {loading && <Loader2 size={14} className="animate-spin text-gray-600" />}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                        {new Date(dateRange.start).toLocaleDateString()} — {new Date(dateRange.end).toLocaleDateString()}
                    </p>
                </div>

                <div className="flex p-1 bg-gray-900 rounded-xl border border-gray-800">
                    <button
                        onClick={() => onMetricChange('revenue')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${isRevenue ? 'bg-purple-500/10 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <DollarSign size={14} />
                        Revenue
                    </button>
                    <button
                        onClick={() => onMetricChange('streams')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${!isRevenue ? 'bg-blue-500/10 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <Music size={14} />
                        Streams
                    </button>
                </div>
            </div>

            <div className="h-[300px] w-full relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 backdrop-blur-[2px] rounded-xl z-10">
                        <Loader2 size={32} className="text-gray-700 animate-spin" />
                    </div>
                ) : !data.some(d => (d.revenue || 0) > 0 || (d.streams || 0) > 0) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-40">
                        <TrendingUp size={48} className="text-gray-800 mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest text-gray-600">No data available for this range</p>
                    </div>
                ) : null}

                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={mainColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="#1f1f23"
                        />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#3f3f46', fontSize: 10, fontWeight: 700 }}
                            tickFormatter={(str) => {
                                const date = new Date(str);
                                return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            }}
                            minTickGap={30}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#3f3f46', fontSize: 10, fontWeight: 700 }}
                            tickFormatter={(val) => {
                                if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
                                return val;
                            }}
                        />
                        <Tooltip content={<CustomTooltip isRevenue={isRevenue} />} />
                        <Area
                            type="monotone"
                            dataKey={selectedMetric}
                            stroke={mainColor}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorMetric)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/30 rounded-2xl border border-gray-800/50">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Peak Performance</p>
                    <p className="text-xl font-black text-white tracking-tight">
                        {isRevenue ? '$' : ''}
                        {data.length > 0 ? Math.max(...data.map(d => d[selectedMetric] || 0)).toLocaleString() : '0'}
                    </p>
                </div>
                <div className="p-4 bg-gray-900/30 rounded-2xl border border-gray-800/50">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Average Daily</p>
                    <p className="text-xl font-black text-white tracking-tight">
                        {isRevenue ? '$' : ''}
                        {Math.round(data.reduce((acc, curr) => acc + (curr[selectedMetric] || 0), 0) / (data.length || 1)).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};
