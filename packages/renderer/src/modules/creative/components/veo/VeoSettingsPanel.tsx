import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Clock, Move3d, Maximize, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useDirectGeneration } from '../../hooks/useDirectGeneration';
import { normalizeVideoDuration, normalizeVideoResolution } from '@indii/shared';

interface VeoSettingsPanelProps {
    isOpen: boolean;
}

export function VeoSettingsPanel({ isOpen }: VeoSettingsPanelProps) {
    const { studioControls, setStudioControls, videoInputs, characterReferences } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        videoInputs: state.videoInputs,
        characterReferences: state.characterReferences
    })));

    const { mappedIngredients } = useDirectGeneration();

    // ISSUE-788: Veo 3.1 only honors '9:16' specially and coerces every
    // other aspect ratio to '16:9' server-side (gateway.ts
    // normalizeVideoAspectRatio); supported lengths are 4/6/8 seconds only.
    // '1:1' and '5' looked selectable here but had no effect once submitted.
    const aspectRatios = ['16:9', '9:16'] as const;
    const hasFrameInput = !!videoInputs.firstFrame?.url || mappedIngredients.length > 0 || characterReferences.length > 0;
    const effectiveResolution = normalizeVideoResolution(studioControls.resolution, studioControls.model);
    const resolvedDuration = normalizeVideoDuration(studioControls.duration, effectiveResolution, hasFrameInput);
    
    // Determine which options to show based on the current configuration
    const durations = (effectiveResolution !== '720p' || hasFrameInput)
        ? [8] as const
        : [4, 6, 8] as const;

    const cameraMovements = ['Static', 'Pan', 'Tilt', 'Zoom', 'Orbit'];
    const directorFps = studioControls.fps || 24;
    const directorFrames = Math.round((resolvedDuration || 0) * directorFps);

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
                            <Sparkles size={16} className="text-green-400" />
                            <h3 className="text-sm font-bold text-white">Veo 3.1 Settings</h3>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Temporal lock</p>
                                <p className="text-[11px] font-mono font-bold text-white">{directorFps} fps · {directorFrames} frames</p>
                            </div>
                            <span className="text-[9px] uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-1">
                                Director timing
                            </span>
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
                                                    ? "bg-green-500/20 text-green-300 border border-green-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
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
