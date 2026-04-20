import React, { useState } from 'react';
import { Plus, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SequenceTimelineProps {
    sequence: number[];
    onChange: (sequence: number[]) => void;
    maxTotal?: number;
}

const AVAILABLE_INTERVALS = [4, 8, 12, 16];

export const SequenceTimeline = ({ sequence, onChange, maxTotal = 60 }: SequenceTimelineProps) => {
    const totalDuration = sequence.reduce((a, b) => a + b, 0);

    const handleAdd = (interval: number) => {
        if (totalDuration + interval <= maxTotal) {
            onChange([...sequence, interval]);
        }
    };

    const handleRemove = (index: number) => {
        onChange(sequence.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Clock size={12} />
                    <span>Sequence Builder</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                    <span className={totalDuration === maxTotal ? 'text-amber-400' : 'text-white'}>{totalDuration}s</span> / {maxTotal}s
                </div>
            </div>

            {/* Timeline Bar */}
            <div className="relative h-8 bg-black/40 rounded-lg overflow-hidden flex ring-1 ring-inset ring-white/5">
                <AnimatePresence>
                    {sequence.map((duration, index) => {
                        const widthPct = (duration / maxTotal) * 100;
                        return (
                            <motion.div
                                key={`${index}-${duration}`}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: `${widthPct}%`, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="h-full border-r border-black/50 relative group cursor-pointer"
                                style={{
                                    backgroundColor: `hsl(${280 + (index * 20)}, 70%, 50%)`
                                }}
                                onClick={() => handleRemove(index)}
                                title={`Remove ${duration}s block`}
                            >
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                    <X size={12} className="text-white" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                                    <span className="text-[10px] font-bold text-white shadow-sm">{duration}s</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {sequence.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-600 uppercase tracking-wider">
                        Empty Sequence
                    </div>
                )}
            </div>

            {/* Add Controls */}
            <div className="flex flex-wrap gap-2">
                {AVAILABLE_INTERVALS.map(interval => (
                    <button
                        key={interval}
                        disabled={totalDuration + interval > maxTotal}
                        onClick={() => handleAdd(interval)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-md border border-white/5 transition-colors text-gray-300"
                    >
                        <Plus size={10} />
                        {interval}s Block
                    </button>
                ))}
                {sequence.length > 0 && (
                    <button
                        onClick={() => onChange([])}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors ml-auto"
                    >
                        Clear
                    </button>
                )}
            </div>
            <p className="text-[10px] text-gray-500">
                Build a sequence of generation lengths to daisy-chain video outputs.
            </p>
        </div>
    );
};
