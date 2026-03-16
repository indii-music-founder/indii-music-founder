import React from 'react';
import { motion } from 'motion/react';
import type { DetectedPattern } from '@/services/analytics/types';

interface GrowthPatternsPanelProps {
    patterns: DetectedPattern[];
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
    const pct = Math.round(confidence * 100);
    const color = pct >= 80 ? 'text-emerald-400 bg-emerald-500/15' : pct >= 60 ? 'text-blue-400 bg-blue-500/15' : 'text-slate-400 bg-slate-700/50';
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
            {pct}% match
        </span>
    );
}

export const GrowthPatternsPanel: React.FC<GrowthPatternsPanelProps> = ({ patterns }) => {
    if (!patterns.length) {
        return (
            <div className="bg-slate-800/50 border border-white/8 rounded-xl p-5 text-center">
                <p className="text-slate-500 text-sm">No dominant growth patterns detected yet.</p>
                <p className="text-slate-600 text-xs mt-1">More data needed (7+ days).</p>
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {patterns.map((pattern, i) => (
                <motion.div
                    key={pattern.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.07 }}
                    className="bg-slate-800/50 border border-white/8 rounded-xl p-4 flex items-start gap-3"
                >
                    <span className="text-2xl leading-none shrink-0 mt-0.5">{pattern.icon}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-white">{pattern.label}</span>
                            <ConfidenceBadge confidence={pattern.confidence} />
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{pattern.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
