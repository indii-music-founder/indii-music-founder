import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'motion/react';

// Actual distributor commission rates (0 = flat-fee models, revenue not percentage-based)
const DISTRIBUTOR_FEE_RATES: Record<string, number> = {
    distrokid:      0.00, // Annual flat fee, 0% commission
    tunecore:       0.00, // Annual flat fee per release
    cdbaby:         0.09, // 9% of streaming revenue
    unitedmasters:  0.10, // 10% (Select tier) / 0% (Pro flat tier)
    onerpm:         0.15, // 15%
    believe:        0.15, // 15%
    amuse:          0.00, // Free tier 0%, Boost tier flat fee
    soundrop:       0.15, // 15%
    ingrooves:      0.15, // ~15%
    // Direct DSPs (indiiOS delivers as first-party distributor)
    spotify:        0.00,
    apple_music:    0.00,
    youtube_music:  0.00,
    amazon_music:   0.00,
};

// Effective US income + self-employment tax rate for independent music creators
const DEFAULT_TAX_RATE = 0.22;

interface WaterfallChartProps {
    grossRevenue: number;
    netRevenue: number;
    /** Distributor ID from the release deployments record (e.g. 'distrokid', 'cdbaby') */
    distributorId?: string;
    /** Fraction of gross already allocated to collaborators via split sheets (0–1) */
    splitsFraction?: number;
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

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
    grossRevenue,
    netRevenue,
    distributorId,
    splitsFraction = 0,
}) => {
    const data = useMemo(() => {
        const gross = grossRevenue || 0;
        const net = netRevenue || 0;

        // Resolve real distributor commission rate
        const distKey = (distributorId ?? '').toLowerCase();
        const distRate = DISTRIBUTOR_FEE_RATES[distKey] ?? 0.09; // 9% default (CDBaby-like)
        const distributorFee = gross * distRate;

        // Tax on remaining post-distributor gross
        const postDist = gross - distributorFee;
        const taxes = postDist * DEFAULT_TAX_RATE;

        // Collaborator splits from split sheet; clamp so we never go below 0
        const splits = Math.min(gross * splitsFraction, Math.max(0, postDist - taxes - net));

        // Any residual deduction unaccounted for (rounding, platform fees, etc.)
        const residual = Math.max(0, gross - distributorFee - taxes - splits - net);
        const displayNet = net > 0 ? net : Math.max(0, gross - distributorFee - taxes - splits - residual);

        const distLabel = distKey && DISTRIBUTOR_FEE_RATES[distKey] !== undefined
            ? `${distKey.charAt(0).toUpperCase()}${distKey.slice(1)} (${Math.round(distRate * 100)}%)`
            : `Distributor (${Math.round(distRate * 100)}%)`;

        const bars = [
            { name: 'Gross Revenue',            range: [0, gross],                                             value: gross,           color: '#a855f7', isTotal: true  },
            { name: distLabel,                   range: [gross - distributorFee, gross],                        value: -distributorFee, color: '#ef4444', isTotal: false },
            { name: `Taxes (~${Math.round(DEFAULT_TAX_RATE * 100)}%)`, range: [gross - distributorFee - taxes, gross - distributorFee], value: -taxes, color: '#f97316', isTotal: false },
        ];

        if (splits > 0.01) {
            const after = gross - distributorFee - taxes;
            bars.push({ name: 'Collaborator Splits', range: [after - splits, after], value: -splits, color: '#eab308', isTotal: false });
        }
        if (residual > 0.01) {
            const after = gross - distributorFee - taxes - splits;
            bars.push({ name: 'Other Fees', range: [after - residual, after], value: -residual, color: '#6b7280', isTotal: false });
        }

        bars.push({ name: 'Net Profit', range: [0, displayNet], value: displayNet, color: '#22c55e', isTotal: true });
        return bars;
    }, [grossRevenue, netRevenue, distributorId, splitsFraction]);

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
