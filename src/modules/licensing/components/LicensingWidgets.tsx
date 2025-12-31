import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, TrendingUp, Users, ArrowUpRight } from 'lucide-react';

import { License, LicenseRequest } from '@/services/licensing/types';

interface MetricsGridProps {
    activeLicensesCount: number;
    pendingRequestsCount: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ activeLicensesCount, pendingRequestsCount }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <MetricCard
                title="Active Licenses"
                value={activeLicensesCount.toString()}
                trend="Portfolio"
                icon={CreditCard}
                color="text-emerald-400"
                gradient="from-emerald-500/10 to-transparent"
            />
            <MetricCard
                title="Active Negotiations"
                value={pendingRequestsCount.toString()}
                trend="In Progress"
                icon={Users}
                color="text-blue-400"
                gradient="from-blue-500/10 to-transparent"
            />
            <MetricCard
                title="Beta: Projected Value"
                value={`$${(activeLicensesCount * 12500).toLocaleString()}`} // Simulated projection for Beta
                trend="+8.5%"
                icon={TrendingUp}
                color="text-purple-400"
                gradient="from-purple-500/10 to-transparent"
            />
        </div>
    );
};

interface MetricCardProps {
    title: string;
    value: string;
    trend: string;
    icon: React.ElementType;
    color: string;
    gradient: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, trend, icon: Icon, color, gradient }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="relative overflow-hidden bg-[#1c2128] border border-white/5 rounded-2xl p-6 group"
    >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-white/5 ${color}`}>
                    <Icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <ArrowUpRight size={12} />
                    {trend}
                </div>
            </div>
            <h4 className="text-gray-400 font-medium text-sm mb-1">{title}</h4>
            <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        </div>
    </motion.div>
);

export const DealFlowChart = () => {
    return (
        <div className="relative h-64 w-full bg-[#1c2128] rounded-2xl border border-white/5 overflow-hidden p-6">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />

            <h3 className="relative z-10 text-lg font-bold text-white mb-6">Deal Velocity</h3>

            {/* Artistic CSS Chart Representation */}
            <div className="relative z-10 flex items-end justify-between h-40 gap-2 px-2">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 50].map((height, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.05, duration: 1, type: 'spring' }}
                        className="w-full bg-gradient-to-t from-indigo-500/20 to-indigo-500 rounded-t-sm hover:from-indigo-400/30 hover:to-indigo-400 transition-colors cursor-pointer group"
                    >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                            Vol: {height * 10}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
