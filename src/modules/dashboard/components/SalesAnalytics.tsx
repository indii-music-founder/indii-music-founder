import React, { useEffect, useState } from 'react';
import { RevenueService, RevenueChartData } from '@/services/RevenueService';
import { useStore } from '@/core/store';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function SalesAnalytics() {
    const [chartData, setChartData] = useState<RevenueChartData[]>([]);
    const [period, setPeriod] = useState<'week' | 'month'>('month');
    const [loading, setLoading] = useState(true);
    const currentUser = useStore((state) => state.user);

    useEffect(() => {
        if (!currentUser) return;
        RevenueService.getChartData(currentUser.uid, period)
            .then(setChartData)
            .finally(() => setLoading(false));
    }, [currentUser, period]);

    const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

    // Calculate growth (simple first vs last comparison for demo)
    const growth = chartData.length > 1
        ? ((chartData[chartData.length - 1].amount - chartData[0].amount) / chartData[0].amount) * 100
        : 0;

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <DollarSign size={20} className="text-green-400" />
                        Revenue Analytics
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-semibold flex items-center gap-1
                            ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(growth).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500">vs beginning of period</span>
                    </div>
                </div>

                <div className="flex bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => {
                            setPeriod('week');
                            setLoading(true);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all min-w-[44px] min-h-[44px]
                            ${period === 'week' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                        7D
                    </button>
                    <button
                        onClick={() => {
                            setPeriod('month');
                            setLoading(true);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all min-w-[44px] min-h-[44px]
                            ${period === 'month' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                        30D
                    </button>
                </div>
            </div>

            <div className="flex-1 flex items-end gap-2 min-h-[150px]">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                    </div>
                ) : (
                    chartData.map((data, i) => {
                        const heightPercent = (data.amount / maxAmount) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-10 bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                    ${data.amount.toFixed(2)} - {data.date}
                                </div>

                                <div
                                    className="w-full bg-green-500/20 hover:bg-green-500/40 border-t border-green-500/50 rounded-t transition-all duration-300 relative overflow-hidden"
                                    style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                >
                                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-green-500/10 to-transparent" />
                                </div>
                                <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {data.date.split(' ')[1]}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
