import React from 'react';
import { motion } from 'motion/react';
import { CreditCard, TrendingUp, Users, ArrowUpRight } from 'lucide-react';

interface MetricsGridProps {
    activeLicensesCount: number;
    pendingRequestsCount: number;
    projectedValue: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ activeLicensesCount, pendingRequestsCount, projectedValue }) => {
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
                title="Projected Value"
                value={`$${projectedValue.toLocaleString()}`}
                trend="Est. Value"
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

            {/* Empty State */}
            <div className="relative z-10 flex flex-col items-center justify-center h-40 gap-2">
                <TrendingUp size={24} className="text-gray-500 mb-2 opacity-50" />
                <p className="text-xs text-gray-500 font-medium">No deal velocity data</p>
                <p className="text-[10px] text-gray-600">Connect CRM to visualize pipeline</p>
            </div>
        </div>
    );
};
