import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { BananaTheme } from '../themes';

interface AnalyticsOverlayProps {
    theme: BananaTheme;
}

export function AnalyticsOverlay({ theme }: AnalyticsOverlayProps) {
    return (
        <div className={`w-[300px] h-full border-l p-6 flex flex-col z-20 transition-all duration-500 ${theme.colors.surface} ${theme.effects.glass} ${theme.colors.border}`}>
            <div className="flex items-center gap-3 mb-8">
                <div className={`h-8 w-1 rounded-full ${theme.colors.accent.replace('text', 'bg')}`} />
                <h2 className={`text-xl font-bold tracking-tight ${theme.colors.text}`}>Pro Analytics</h2>
            </div>

            <div className="space-y-6">
                <MetricCard
                    label="Projected ROI"
                    value="320%"
                    trend="+12%"
                    color="text-green-500"
                    icon={TrendingUp}
                    theme={theme}
                />
                <MetricCard
                    label="Viral Potential"
                    value="High"
                    trend="8.5/10"
                    color="text-purple-500"
                    icon={Activity}
                    theme={theme}
                />
                <MetricCard
                    label="Est. Unit Cost"
                    value="$12.40"
                    trend="Bulk"
                    color="text-blue-500"
                    icon={DollarSign}
                    theme={theme}
                />
            </div>

            <div className={`mt-auto p-4 rounded-xl border ${theme.colors.surfaceHighlight} ${theme.colors.border}`}>
                <h4 className={`text-xs font-bold uppercase mb-2 ${theme.colors.textSecondary}`}>Audience Match</h4>
                <div className={`flex items-center gap-2 text-sm ${theme.colors.text}`}>
                    <Users className={`w-4 h-4 ${theme.colors.accent}`} />
                    <span>Urban / Streetwear</span>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, trend, color, icon: Icon, theme }: any) {
    return (
        <div className={`p-4 rounded-xl border transition-colors ${theme.colors.surfaceHighlight} ${theme.colors.border} hover:border-yellow-400/30`}>
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-medium uppercase ${theme.colors.textSecondary}`}>{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-end gap-2">
                <span className={`text-2xl font-mono font-bold ${theme.colors.text}`}>{value}</span>
                <span className={`text-xs ${color} mb-1`}>{trend}</span>
            </div>
        </div>
    );
}
