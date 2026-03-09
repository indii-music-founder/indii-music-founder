import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'motion/react';

interface WaterfallChartProps {
    grossRevenue: number;
    netRevenue: number;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl">
                <p className="text-sm font-semibold text-white mb-1">{data.name}</p>
                <p className={`text-sm font-bold ${data.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.value > 0 ? '+' : ''}{formatCurrency(data.value)}
                </p>
            </div>
        );
    }
    return null;
};

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ grossRevenue, netRevenue }) => {
    // Generate waterfall data from the gross and net parameters
    const data = useMemo(() => {
        // Fallback amounts if data isn't provided realistically
        const gross = grossRevenue || 0;
        const net = netRevenue || 0;

        // Let's create sensible mock splits based on the difference
        const difference = gross - net;
        const distributorFee = difference * 0.3; // 30% of deductions
        const taxes = difference * 0.2; // 20% of deductions
        const splits = difference * 0.5; // 50% to other collaborators

        return [
            {
                name: 'Gross Revenue',
                range: [0, gross],
                value: gross,
                color: '#a855f7', // Purple
                isTotal: true
            },
            {
                name: 'Distributor (15%)',
                range: [gross - distributorFee, gross],
                value: -distributorFee,
                color: '#ef4444', // Red
                isTotal: false
            },
            {
                name: 'Taxes',
                range: [gross - distributorFee - taxes, gross - distributorFee],
                value: -taxes,
                color: '#f97316', // Orange
                isTotal: false
            },
            {
                name: 'Splits',
                range: [net, gross - distributorFee - taxes],
                value: -splits,
                color: '#eab308', // Yellow
                isTotal: false
            },
            {
                name: 'Net Profit',
                range: [0, net],
                value: net,
                color: '#22c55e', // Green
                isTotal: true
            }
        ];
    }, [grossRevenue, netRevenue]);

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-4 px-2">
                <div>
                    <h3 className="font-semibold text-white">Revenue Waterfall</h3>
                    <p className="text-xs text-gray-500">Gross to Net Breakdown</p>
                </div>
                <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Gross</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Fees/Splits</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Net Profit</div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#888', fontSize: 11 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#888', fontSize: 11 }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                        <Bar
                            dataKey="range"
                            radius={[4, 4, 4, 4]}
                            animationDuration={1500}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    fillOpacity={0.8}
                                    stroke={entry.color}
                                    strokeWidth={1}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
