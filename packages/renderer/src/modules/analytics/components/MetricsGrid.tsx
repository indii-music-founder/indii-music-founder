import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Heart, Users, Share2, Music } from 'lucide-react';
import type { ComputedMetrics } from '@/services/analytics/types';

interface MetricsGridProps {
    metrics: ComputedMetrics;
    totalStreams: number;
}

interface MetricCardProps {
    label: string;
    value: string;
    subtitle: string;
    icon: React.ElementType;
    trend: 'up' | 'down' | 'neutral';
    color: string;
    delay: number;
}

function MetricCard({ label, value, subtitle, icon: Icon, trend, color, delay }: MetricCardProps) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="bg-slate-800/50 border border-white/8 rounded-xl p-4 flex flex-col gap-3"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg ${color}`}>
                    <Icon size={14} className="text-white" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <div className="flex items-center gap-1 mt-1">
                    <TrendIcon size={11} className={trendColor} />
                    <span className="text-xs text-slate-400">{subtitle}</span>
                </div>
            </div>
        </motion.div>
    );
}

function fmtPct(val: number) { return `${(val * 100).toFixed(1)}%`; }
function fmtNum(val: number) { return val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : `${val}`; }
function fmtRatio(val: number) { return `${val.toFixed(2)}x`; }

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, totalStreams }) => {
    const cards: MetricCardProps[] = [
        {
            label: 'Total Streams',
            value: fmtNum(totalStreams),
            subtitle: `Velocity ${(metrics.velocity * 100 - 100).toFixed(0)}% day/day`,
            icon: BarChart2,
            trend: metrics.velocity >= 1.05 ? 'up' : metrics.velocity <= 0.95 ? 'down' : 'neutral',
            color: 'bg-blue-500/20',
            delay: 0,
        },
        {
            label: 'Save Rate',
            value: fmtPct(metrics.saveRate),
            subtitle: metrics.saveRate >= 0.08 ? 'Above avg (>8%)' : 'Below avg (<8%)',
            icon: Heart,
            trend: metrics.saveRate >= 0.06 ? 'up' : 'down',
            color: 'bg-pink-500/20',
            delay: 0.05,
        },
        {
            label: 'Completion Rate',
            value: fmtPct(metrics.completionRate),
            subtitle: 'Full-play ratio',
            icon: Music,
            trend: metrics.completionRate >= 0.6 ? 'up' : metrics.completionRate <= 0.4 ? 'down' : 'neutral',
            color: 'bg-violet-500/20',
            delay: 0.1,
        },
        {
            label: 'Repeat Listeners',
            value: fmtRatio(metrics.repeatListenerRatio),
            subtitle: 'Streams per unique listener',
            icon: Users,
            trend: metrics.repeatListenerRatio >= 1.5 ? 'up' : 'neutral',
            color: 'bg-emerald-500/20',
            delay: 0.15,
        },
        {
            label: 'Playlist Velocity',
            value: `${metrics.playlistVelocity.toFixed(1)}/day`,
            subtitle: '7-day avg new adds',
            icon: TrendingUp,
            trend: metrics.playlistVelocity >= 5 ? 'up' : metrics.playlistVelocity <= 0.5 ? 'down' : 'neutral',
            color: 'bg-amber-500/20',
            delay: 0.2,
        },
        {
            label: 'Share Rate',
            value: fmtPct(metrics.shareRate),
            subtitle: 'Viral spread potential',
            icon: Share2,
            trend: metrics.shareRate >= 0.02 ? 'up' : 'neutral',
            color: 'bg-cyan-500/20',
            delay: 0.25,
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map(card => <MetricCard key={card.label} {...card} />)}
        </div>
    );
};
