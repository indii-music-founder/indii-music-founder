import React from 'react';
import { motion } from 'motion/react';
import { Zap } from 'lucide-react';
import type { ViralScore, ComputedMetrics } from '@/services/analytics/types';
import { viralScoreService } from '@/services/analytics/ViralScoreService';

interface ViralScorePanelProps {
    viralScore: ViralScore;
    metrics: ComputedMetrics;
}

const LABEL_STYLES: Record<string, { ring: string; glow: string; text: string; bar: string }> = {
    'Breakout!': { ring: 'border-yellow-400/60', glow: 'shadow-yellow-500/20', text: 'text-yellow-400', bar: 'bg-yellow-400' },
    'High':      { ring: 'border-emerald-400/60', glow: 'shadow-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-400' },
    'Moderate':  { ring: 'border-blue-400/60',    glow: 'shadow-blue-500/20',    text: 'text-blue-400',    bar: 'bg-blue-400'    },
    'Low':       { ring: 'border-slate-600',       glow: '',                      text: 'text-slate-400',   bar: 'bg-slate-500'   },
};

const TREND_LABELS: Record<string, string> = {
    accelerating: '↑ Accelerating',
    growing:      '↗ Growing',
    stable:       '→ Stable',
    declining:    '↓ Declining',
};

interface BreakdownRowProps {
    label: string;
    pts: number;
    maxPts: number;
    color: string;
}

function BreakdownRow({ label, pts, maxPts, color }: BreakdownRowProps) {
    const pct = maxPts > 0 ? (pts / maxPts) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                />
            </div>
            <span className="text-xs font-mono text-slate-300 w-10 text-right">{pts.toFixed(1)}</span>
        </div>
    );
}

export const ViralScorePanel: React.FC<ViralScorePanelProps> = ({ viralScore, metrics }) => {
    const style = LABEL_STYLES[viralScore.label] ?? LABEL_STYLES['Low'];
    const momentum = viralScoreService.detectMomentumSignal(metrics.momentumRatio);
    const circumference = 2 * Math.PI * 44; // r=44
    const dashOffset = circumference * (1 - viralScore.score / 100);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`bg-slate-800/50 border ${style.ring} rounded-xl p-5 shadow-xl ${style.glow} flex flex-col gap-5`}
        >
            {/* Score ring + label */}
            <div className="flex items-center gap-5">
                {/* SVG ring */}
                <div className="relative shrink-0 w-24 h-24">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
                        <motion.circle
                            cx="50" cy="50" r="44"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            className={style.text}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: dashOffset }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-white">{viralScore.score}</span>
                        <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={14} className={style.text} />
                        <span className={`text-lg font-bold ${style.text}`}>{viralScore.label}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                        {TREND_LABELS[viralScore.trend] ?? '→ Stable'}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Momentum:</span>
                        <span className={`text-xs font-semibold ${momentum.color}`}>{momentum.label}</span>
                        <span className="text-xs text-slate-600">({metrics.momentumRatio.toFixed(2)}x)</span>
                    </div>
                </div>
            </div>

            {/* Score breakdown */}
            <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score Breakdown</p>
                <BreakdownRow label="Save Rate"       pts={viralScore.breakdown.saveRate}        maxPts={35} color={style.bar} />
                <BreakdownRow label="Completion Rate" pts={viralScore.breakdown.completionRate}   maxPts={25} color={style.bar} />
                <BreakdownRow label="Repeat Listeners"pts={viralScore.breakdown.repeatListeners}  maxPts={20} color={style.bar} />
                <BreakdownRow label="Playlist Velocity"pts={viralScore.breakdown.playlistVelocity} maxPts={10} color={style.bar} />
                <BreakdownRow label="Share Rate"      pts={viralScore.breakdown.shareRate}        maxPts={10} color={style.bar} />
            </div>
        </motion.div>
    );
};
