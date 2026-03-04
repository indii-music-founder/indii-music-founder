import React, { useState, useCallback } from 'react';
import { Layers, Disc, Zap, Sliders, ChevronRight, Play, CheckCircle2, Loader2, Save, Download, Globe } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { masteringService, type MasteringStyle } from '@/services/audio/MasteringService';
import { WaveformPlayer } from './WaveformPlayer';

const COMPLIANCE_PROFILES: { id: MasteringStyle; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'hip_hop', label: 'Urban / Dynamic', description: 'Optimized for high-impact streaming (Spotify/Apple).', icon: <Disc className="w-5 h-5" /> },
    { id: 'pop', label: 'Balanced / Radio', description: 'Standard commercial profile for global stores.', icon: <Zap className="w-5 h-5" /> },
    { id: 'electronic', label: 'Club / Maximum', description: 'Peak loudness profile for club play and festivals.', icon: <Globe className="w-5 h-5" /> },
    { id: 'lo_fi', label: 'Warm / Ambient', description: 'Subtle saturation for mood-based platforms.', icon: <Layers className="w-5 h-5" /> },
    { id: 'vocal_focus', label: 'Dialog / Vocal', description: 'Optimized for podcasts and spoken word releases.', icon: <Sliders className="w-5 h-5" /> },
];

export const MasteringWorkspace: React.FC = () => {
    const toast = useToast();
    const [selectedStyle, setSelectedStyle] = useState<MasteringStyle>('pop');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [targetLoudness, setTargetLoudness] = useState(-14);

    const handleMaster = useCallback(async () => {
        setIsProcessing(true);
        setIsDone(false);

        // Mocking the mastering process for the UI demonstration
        // In a real Electron environment, this would call window.electronAPI.audio.master
        setTimeout(() => {
            setIsProcessing(false);
            setIsDone(true);
            toast.success('Mastering Chain Optimized!');
        }, 3000);
    }, [toast]);

    return (
        <div className="grid grid-cols-12 gap-8 animate-in fade-in duration-500">
            {/* Left: Style Selection */}
            <div className="col-span-4 space-y-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Compliance Profile</h4>
                    <div className="space-y-2">
                        {COMPLIANCE_PROFILES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => setSelectedStyle(style.id)}
                                className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group ${selectedStyle === style.id ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10 hover:bg-white/10'}`}
                            >
                                <div className={`p-2 rounded-lg ${selectedStyle === style.id ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                    {style.icon}
                                </div>
                                <div>
                                    <p className="text-sm font-bold">{style.label}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{style.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Loudness Target</h4>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm px-1">
                            <span className="text-gray-400">LUFS Standard</span>
                            <span className="font-mono text-purple-400 font-bold">{targetLoudness} LUFS</span>
                        </div>
                        <input
                            type="range"
                            min="-18" max="-8" step="1"
                            value={targetLoudness}
                            onChange={(e) => setTargetLoudness(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 font-bold px-1 uppercase tracking-wider">
                            <span>Streaming (Deep)</span>
                            <span>Club (Hot)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Preview & Execution */}
            <div className="col-span-8 space-y-6">
                {/* Active Mastering Chain */}
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sliders size={120} className="rotate-12 text-purple-500" />
                    </div>

                    <div className="space-y-8 relative z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Release <span className="text-purple-500">Optimization</span></h3>
                                <p className="text-sm text-gray-500 font-medium">Automatic optimization for <span className="text-white font-bold">{selectedStyle.replace('_', ' ')}</span> target.</p>
                            </div>
                            {isDone && <CheckCircle2 className="text-emerald-500 w-8 h-8 scale-110 animate-in zoom-in-50 duration-300" />}
                        </div>

                        {/* Mastering Chain Visualization */}
                        <div className="flex items-center gap-2">
                            {['EQUALIZER', 'COMPRESSOR', 'LIMITER', 'LOUDNESS'].map((node, i) => (
                                <React.Fragment key={node}>
                                    <div className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest border transition-all ${isProcessing ? 'bg-purple-500/20 border-purple-500 text-purple-400 animate-pulse' : isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-600'}`}>
                                        {node}
                                    </div>
                                    {i < 3 && <ChevronRight size={14} className="text-gray-700" />}
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="h-24 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-center">
                            <span className="text-xs text-gray-700 font-mono italic">Spectral Preview Unavailable until Processing</span>
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                            {!isDone ? (
                                <button
                                    onClick={handleMaster}
                                    disabled={isProcessing}
                                    className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl hover:shadow-purple-500/30 transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Analyzing Signal & Applying Filters...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-5 h-5 fill-current" />
                                            Optimize for Distribution
                                        </>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all text-white">
                                        <Save className="w-5 h-5" />
                                        Save Optimized Master
                                    </button>
                                    <button className="px-6 bg-white/5 hover:bg-white/10 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all">
                                        <Download className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Audit Integration */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Sliders size={16} className="text-purple-500" />
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mastering Log</h4>
                    </div>
                    <div className="font-mono text-[10px] space-y-1.5 opacity-60">
                        <p className="">{'>'} [SYSTEM]: Mastering engine initialized...</p>
                        <p className="">{'>'} [SYSTEM]: Selected Filter Chain: {selectedStyle}</p>
                        <p className="">{'>'} [SYSTEM]: Target Level: {targetLoudness} LUFS</p>
                        {isProcessing && <p className="text-purple-400 animate-pulse">{'>'} [AUDIO]: Processing FFmpeg chain...</p>}
                        {isDone && <p className="text-emerald-400">{'>'} [SUCCESS]: Master verified (100% compliant)</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
