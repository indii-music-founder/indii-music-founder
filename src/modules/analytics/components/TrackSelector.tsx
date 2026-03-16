import React from 'react';
import { motion } from 'motion/react';
import { Music, Zap } from 'lucide-react';
import type { TrackReport } from '@/services/analytics/types';

interface TrackSelectorProps {
    reports: TrackReport[];
    selectedTrackId: string | null;
    onSelect: (trackId: string) => void;
}

const LABEL_COLORS: Record<string, string> = {
    'Breakout!': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    'High':      'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    'Moderate':  'text-blue-400 bg-blue-400/10 border-blue-400/30',
    'Low':       'text-slate-400 bg-slate-400/10 border-slate-400/30',
};

export const TrackSelector: React.FC<TrackSelectorProps> = ({ reports, selectedTrackId, onSelect }) => {
    return (
        <div className="space-y-1.5">
            {reports.map((report, i) => {
                const isSelected = report.track.trackId === selectedTrackId;
                const labelColor = LABEL_COLORS[report.viralScore.label] ?? LABEL_COLORS['Low'];

                return (
                    <motion.button
                        key={report.track.trackId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        onClick={() => onSelect(report.track.trackId)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                            isSelected
                                ? 'border-indigo-500/60 bg-indigo-500/10'
                                : 'border-white/8 bg-slate-800/40 hover:bg-slate-700/50 hover:border-white/15'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-indigo-500/20' : 'bg-slate-700/50'}`}>
                                <Music size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-400'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{report.track.trackName}</p>
                                <p className="text-xs text-slate-400 truncate">{report.track.artistName} · {report.track.genre}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${labelColor}`}>
                                    {report.viralScore.label === 'Breakout!' && <Zap size={9} className="inline mr-0.5" />}
                                    {report.viralScore.score}
                                </span>
                                <span className="text-xs text-slate-500">{report.viralScore.label}</span>
                            </div>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
};
