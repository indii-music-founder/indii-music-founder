import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Heart, Users, Share2, Music, type LucideIcon } from 'lucide-react';
import type { ComputedMetrics } from '@/services/analytics/types';
import { getColorForModule } from '@/core/theme/moduleColors';

interface MetricsGridProps {
    metrics: ComputedMetrics;
    totalStreams: number;
    modeled?: boolean;
    unavailable?: boolean;
}

interface MetricCardProps {
    label: string;
    value: string;
    subtitle: string;
    icon: LucideIcon;
    trend: 'up' | 'down' | 'neutral';
    color: string;
    delay: number;
    key?: React.Key;
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

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, totalStreams, modeled = false, unavailable = false }) => {
    const cards: MetricCardProps[] = [
        {
            label: unavailable ? 'Track Plays / Views' : modeled ? 'Modeled Plays / Views' : 'Provider-Reported Streams',
            value: unavailable ? '—' : `${modeled ? '≈ ' : ''}${fmtNum(totalStreams)}`,
            subtitle: unavailable
                ? 'Unavailable from the connected source'
                : modeled
                ? 'Popularity/account allocation; not a royalty statement'
                : `Velocity ${(metrics.velocity * 100 - 100).toFixed(0)}% day/day`,
            icon: BarChart2,
            trend: unavailable ? 'neutral' : metrics.velocity >= 1.05 ? 'up' : metrics.velocity <= 0.95 ? 'down' : 'neutral',
            color: 'bg-blue-500/20',
            delay: 0,
        },
        {
            label: 'Save Rate',
            value: unavailable ? '—' : fmtPct(metrics.saveRate),
            subtitle: unavailable ? 'Unavailable from the connected source' : metrics.saveRate >= 0.08 ? 'Above avg (>8%)' : 'Below avg (<8%)',
            icon: Heart,
            trend: unavailable ? 'neutral' : metrics.saveRate >= 0.06 ? 'up' : 'down',
            color: 'bg-pink-500/20',
            delay: 0.05,
        },
        {
            label: 'Completion Rate',
            value: unavailable ? '—' : fmtPct(metrics.completionRate),
            subtitle: unavailable ? 'Unavailable from the connected source' : 'Full-play ratio',
            icon: Music,
            trend: unavailable ? 'neutral' : metrics.completionRate >= 0.6 ? 'up' : metrics.completionRate <= 0.4 ? 'down' : 'neutral',
            color: 'bg-violet-500/20',
            delay: 0.1,
        },
        {
            label: 'Repeat Listeners',
            value: unavailable ? '—' : fmtRatio(metrics.repeatListenerRatio),
            subtitle: unavailable ? 'Unavailable from the connected source' : 'Streams per unique listener',
            icon: Users,
            trend: unavailable ? 'neutral' : metrics.repeatListenerRatio >= 1.5 ? 'up' : 'neutral',
            color: 'bg-emerald-500/20',
            delay: 0.15,
        },
        {
            label: 'Playlist Velocity',
            value: unavailable ? '—' : `${metrics.playlistVelocity.toFixed(1)}/day`,
            subtitle: unavailable ? 'Unavailable from the connected source' : '7-day avg new adds',
            icon: TrendingUp,
            trend: unavailable ? 'neutral' : metrics.playlistVelocity >= 5 ? 'up' : metrics.playlistVelocity <= 0.5 ? 'down' : 'neutral',
            color: 'bg-amber-500/20',
            delay: 0.2,
        },
        {
            label: 'Share Rate',
            value: unavailable ? '—' : fmtPct(metrics.shareRate),
            subtitle: unavailable ? 'Unavailable from the connected source' : 'Share rate',
            icon: Share2,
            trend: unavailable ? 'neutral' : metrics.shareRate >= 0.02 ? 'up' : 'neutral',
            color: getColorForModule('analytics').bg.replace('/10', '/20'),
            delay: 0.25,
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map(card => <MetricCard key={card.label} {...card} />)}
        </div>
    );
};
