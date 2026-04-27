import React from 'react';
import { Clock, Move3d, Maximize, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';

interface VeoSettingsPanelProps {
    isOpen: boolean;
}

export function VeoSettingsPanel({ isOpen }: VeoSettingsPanelProps) {
    const { studioControls, setStudioControls } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls
    })));

    const aspectRatios = ['16:9', '9:16', '1:1'] as const;
    const durations = [4, 5, 6, 8];
    const cameraMovements = ['Static', 'Pan', 'Tilt', 'Zoom', 'Orbit'];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                >
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2 backdrop-blur-md shadow-lg flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={16} className="text-purple-400" />
                            <h3 className="text-sm font-bold text-white">Veo 3.1 Settings</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Aspect Ratio */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                                    <Maximize size={12} /> Aspect Ratio
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {aspectRatios.map(ar => (
                                        <button
                                            key={ar}
                                            onClick={() => setStudioControls({ aspectRatio: ar })}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                studioControls.aspectRatio === ar
                                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                                                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            {ar}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Duration */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                                    <Clock size={12} /> Duration
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {durations.map(dur => (
                                        <button
                                            key={dur}
                                            onClick={() => setStudioControls({ duration: dur })}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                studioControls.duration === dur
                                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                                                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            {dur}s
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Camera Movement */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                                    <Move3d size={12} /> Camera Motion
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {cameraMovements.map(move => (
                                        <button
                                            key={move}
                                            onClick={() => setStudioControls({ cameraMovement: move })}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                studioControls.cameraMovement === move
                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            {move}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
