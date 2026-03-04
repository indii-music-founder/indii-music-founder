import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, Users, MousePointerClick, AlertCircle, Loader2 } from 'lucide-react';
import { DashboardService } from '@/services/dashboard/DashboardService';
import { SalesAnalyticsData } from '@/services/dashboard/schema';
import { logger } from '@/utils/logger';

// Reusable Chart Component
const LineChart = ({ data }: { data: number[] }) => (
    <div className="relative h-64 w-full bg-gray-900/50 rounded-lg border border-gray-800 flex items-end justify-between p-4 overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-10 pointer-events-none">
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
        </div>

        {/* Data points */}
        {data.length > 0 ? data.map((h, i) => (
            <div key={i} className="w-8 bg-gradient-to-t from-purple-600/20 to-purple-500/50 rounded-t-sm relative group" style={{ height: `${Math.min(h, 100)}%` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-black text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    {h}
                </div>
            </div>
        )) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                No data available
            </div>
        )}
    </div>
);

// Reusable Metric Card
const MetricCard = ({
    label,
    value,
    change,
    trend,
    icon: Icon,
    iconColor
}: {
    label: string;
    value: string;
    change?: number;
    trend: 'up' | 'down' | 'neutral';
    icon: React.ElementType;
    iconColor: string;
}) => (
    <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-gray-500 uppercase font-bold">{label}</span>
            <Icon size={16} className={iconColor} />
        </div>
        <span className="text-2xl font-bold text-white">{value}</span>
        {change !== undefined && (
            <span className={`text-xs ml-2 ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                {change > 0 ? '+' : ''}{change}%
            </span>
        )}
         {change === undefined && (
             <span className="text-xs text-gray-500 ml-2">--</span>
         )}
    </div>
);

export default function SalesAnalytics() {
    const [data, setData] = useState<SalesAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState('30d');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            setLoading(true);
            try {
                const analytics = await DashboardService.getSalesAnalytics(period);
                if (isMounted) {
                    setData(analytics);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError('Failed to load sales analytics.');
                    logger.error(err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [period, retryCount]);

    if (loading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="text-gray-500 text-sm">Loading analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-64 flex flex-col items-center justify-center space-y-4 bg-[#161b22] rounded-xl border border-red-900/50">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <span className="text-red-400 text-sm">{error}</span>
                <button
                    onClick={() => setRetryCount(c => c + 1)}
                    className="px-4 py-2 bg-red-900/30 text-red-200 text-xs rounded hover:bg-red-900/50 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={20} className="text-purple-500" />
                Sales Analytics
            </h3>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Conversion Rate"
                    value={data.conversionRate.formatted || `${data.conversionRate.value}%`}
                    change={data.conversionRate.change}
                    trend={data.conversionRate.trend}
                    icon={TrendingUp}
                    iconColor="text-green-500"
                />
                <MetricCard
                    label="Total Visitors"
                    value={data.totalVisitors.formatted || `${data.totalVisitors.value}`}
                    change={data.totalVisitors.change}
                    trend={data.totalVisitors.trend}
                    icon={Users}
                    iconColor="text-blue-500"
                />
                <MetricCard
                    label="Click Rate"
                    value={data.clickRate.formatted || `${data.clickRate.value}%`}
                    change={data.clickRate.change}
                    trend={data.clickRate.trend}
                    icon={MousePointerClick}
                    iconColor="text-yellow-500"
                />
                <MetricCard
                    label="Avg. Order"
                    value={data.avgOrderValue.formatted || `$${data.avgOrderValue.value}`}
                    change={data.avgOrderValue.change}
                    trend={data.avgOrderValue.trend}
                    icon={Activity}
                    iconColor="text-pink-500"
                />
            </div>

            {/* Chart */}
            <div className="bg-[#161b22] p-6 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-bold text-white text-sm">Revenue Over Time</h4>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-xs text-white rounded px-2 py-1 outline-none"
                    >
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="1y">This Year</option>
                    </select>
                </div>
                <LineChart data={data.revenueChart} />
            </div>
        </div>
    );
}
