import React, { useState } from 'react';
import { Plus, X, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SequenceTimelineProps {
    sequence: number[]; // represents beats
    onChange: (sequence: number[]) => void;
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
}

const AVAILABLE_INTERVALS = [4, 8, 16, 32]; // In beats

export const SequenceTimeline = ({ sequence, onChange, bpm = 120, onBpmChange }: SequenceTimelineProps) => {
    // Hard cap of 60 seconds for video generation total length
    const maxTotalSeconds = 60;
    const secondsPerBeat = 60 / bpm;
    const maxTotalBeats = Math.floor(maxTotalSeconds / secondsPerBeat);
    
    const totalBeats = sequence.reduce((a, b) => a + b, 0);
    const totalSeconds = totalBeats * secondsPerBeat;

    const handleAdd = (interval: number) => {
        if (totalBeats + interval <= maxTotalBeats) {
            onChange([...sequence, interval]);
        }
    };

    const handleRemove = (index: number) => {
        onChange(sequence.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <Activity size={12} />
                        <span>Sequence Builder</span>
                    </div>
                    {onBpmChange && (
                        <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-md border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">BPM</span>
                            <input 
                                type="number" 
                                value={bpm}
                                onChange={(e) => onBpmChange(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 bg-transparent text-white text-xs text-right focus:outline-none"
                                min={1}
                                max={300}
                            />
                        </div>
                    )}
                </div>
                <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                    <span>
                        <span className={totalBeats === maxTotalBeats ? 'text-amber-400' : 'text-white'}>{totalBeats}</span> / {maxTotalBeats} beats
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-purple-400" title="Total Duration">
                        {totalSeconds.toFixed(2)}s
                    </span>
                </div>
            </div>

            {/* Timeline Bar */}
            <div className="relative h-8 bg-black/40 rounded-lg overflow-hidden flex ring-1 ring-inset ring-white/5">
                <AnimatePresence>
                    {sequence.map((beats, index) => {
                        const widthPct = (beats / maxTotalBeats) * 100;
                        const durationSeconds = beats * secondsPerBeat;
                        return (
                            <motion.div
                                key={`${index}-${beats}`}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: `${widthPct}%`, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="h-full border-r border-black/50 relative group cursor-pointer"
                                style={{
                                    backgroundColor: `hsl(${280 + (index * 20)}, 70%, 50%)`
                                }}
                                onClick={() => handleRemove(index)}
                                title={`Remove ${beats} beats block (${durationSeconds.toFixed(2)}s)`}
                            >
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                    <X size={12} className="text-white" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity flex-col">
                                    <span className="text-[10px] font-bold text-white shadow-sm">{beats} beats</span>
                                    {widthPct > 10 && <span className="text-[8px] text-white/80">{durationSeconds.toFixed(2)}s</span>}
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
                        disabled={totalBeats + interval > maxTotalBeats}
                        onClick={() => handleAdd(interval)}
                        className="flex flex-col items-center justify-center px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-md border border-white/5 transition-colors text-gray-300"
                    >
                        <div className="flex items-center gap-1">
                            <Plus size={10} />
                            {interval} Beats
                        </div>
                        <span className="text-[8px] text-gray-500 font-mono normal-case">
                            {(interval * secondsPerBeat).toFixed(2)}s
                        </span>
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
                Build a sequence mathematically mapped to your song's BPM.
            </p>
        </div>
    );
};
