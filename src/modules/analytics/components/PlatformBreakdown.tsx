import React from 'react';

import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PlatformData } from '@/services/analytics/types';

interface PlatformBreakdownProps {
    platforms: PlatformData[];
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
    spotify: { label: 'Spotify', color: '#1DB954' },
    apple_music: { label: 'Apple Music', color: '#fc3c44' },
    tiktok: { label: 'TikTok', color: '#69C9D0' },
    youtube_shorts: { label: 'YT Shorts', color: '#FF0000' },
    instagram_reels: { label: 'Reels', color: '#E1306C' },
};

interface PlatformTooltipPayloadEntry { value: number; payload?: { completionRate?: number; creatorCount?: number } }
interface PlatformTooltipProps { active?: boolean; payload?: PlatformTooltipPayloadEntry[]; label?: string }

const CustomTooltip = ({ active, payload, label }: PlatformTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-2xl text-sm">
            <p className="text-white font-semibold mb-1">{label}</p>
            <p className="text-slate-300">{Number(payload[0]?.value ?? 0).toLocaleString()} streams</p>
            {payload[0]?.payload?.completionRate && (
                <p className="text-slate-500 text-xs mt-0.5">
                    Completion: {(payload[0].payload.completionRate * 100).toFixed(0)}%
                </p>
            )}
            {(payload[0]?.payload?.creatorCount ?? 0) > 0 && (
                <p className="text-slate-500 text-xs">
                    Creators: {payload[0]?.payload?.creatorCount?.toLocaleString()}
                </p>
            )}
        </div>
    );
};


export const PlatformBreakdown: React.FC<PlatformBreakdownProps> = ({ platforms }) => {
    const data = platforms.map(p => ({
        name: PLATFORM_META[p.platform]?.label ?? p.platform,
        streams: p.streams,
        completionRate: p.completionRate,
        creatorCount: p.creatorCount ?? 0,
        color: PLATFORM_META[p.platform]?.color ?? '#6366f1',
    }));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="h-40"
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="streams" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    );
};
