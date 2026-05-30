import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { Image as ImageIcon, Plus, ArrowRight, X } from 'lucide-react';

interface DaisyChainControlsProps {
    onOpenFrameModal: (target: 'firstFrame' | 'lastFrame') => void;
}

export default function DaisyChainControls({ onOpenFrameModal }: DaisyChainControlsProps) {
    const { videoInputs, setVideoInput } = useStore(useShallow(state => ({
        videoInputs: state.videoInputs,
        setVideoInput: state.setVideoInput
    })));
    const _toast = useToast();

    return (
        <div className="flex items-center gap-3.5 border-l border-r border-white/6 px-4 mx-2 h-9 bg-white/[0.01] backdrop-blur-md rounded-lg">
            {/* Group Label */}
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-extrabold font-mono">Composition</span>
            </div>

            {/* First Frame Slot */}
            <div className="flex items-center">
                <div
                    onClick={() => onOpenFrameModal('firstFrame')}
                    data-testid="first-frame-slot"
                    className={`relative w-20 h-8 bg-black/60 rounded-lg border transition-all duration-300 overflow-hidden flex items-center justify-center group cursor-pointer ${
                        videoInputs.firstFrame 
                            ? 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.15)] bg-purple-950/5' 
                            : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/[0.02]'
                    }`}
                >
                    {videoInputs.firstFrame ? (
                        <>
                            <img src={videoInputs.firstFrame.url} className="w-full h-full object-cover" alt="First Frame" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setVideoInput('firstFrame', null); }}
                                className="absolute inset-0 bg-black/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                                <X size={14} className="text-red-400 hover:text-red-300 hover:scale-110 transition-transform" />
                                <span className="sr-only">×</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-1 px-1.5 py-1">
                            <Plus size={10} className="text-purple-400 group-hover:text-purple-300" />
                            <span className="text-[8px] text-gray-500 group-hover:text-gray-300 font-bold uppercase tracking-widest font-mono select-none">Start</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Flow Connector Link Line */}
            <div className="flex items-center gap-1 shrink-0">
                <div className={`h-[1px] w-2 transition-all duration-300 ${videoInputs.isDaisyChain ? 'bg-purple-500' : 'bg-white/10'}`} />
                <ArrowRight size={10} className={`transition-colors duration-300 ${videoInputs.isDaisyChain ? 'text-purple-400 animate-pulse' : 'text-gray-600'}`} />
                <div className={`h-[1px] w-2 transition-all duration-300 ${videoInputs.isDaisyChain ? 'bg-purple-500' : 'bg-white/10'}`} />
            </div>

            {/* Last Frame Slot */}
            <div className="flex items-center">
                <div
                    onClick={() => onOpenFrameModal('lastFrame')}
                    data-testid="last-frame-slot"
                    className={`relative w-20 h-8 bg-black/60 rounded-lg border transition-all duration-300 overflow-hidden flex items-center justify-center group cursor-pointer ${
                        videoInputs.lastFrame 
                            ? 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.15)] bg-purple-950/5' 
                            : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/[0.02]'
                    }`}
                >
                    {videoInputs.lastFrame ? (
                        <>
                            <img src={videoInputs.lastFrame.url} className="w-full h-full object-cover" alt="Last Frame" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setVideoInput('lastFrame', null); }}
                                className="absolute inset-0 bg-black/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                                <X size={14} className="text-red-400 hover:text-red-300 hover:scale-110 transition-transform" />
                                <span className="sr-only">×</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-1 px-1.5 py-1">
                            <Plus size={10} className="text-purple-400 group-hover:text-purple-300" />
                            <span className="text-[8px] text-gray-500 group-hover:text-gray-300 font-bold uppercase tracking-widest font-mono select-none">End</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Daisy Chain Toggle */}
            <button
                onClick={() => setVideoInput('isDaisyChain', !videoInputs.isDaisyChain)}
                data-testid="daisy-chain-toggle"
                className={`ml-1 text-[9px] px-2.5 py-1 rounded-md border font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 shrink-0
                    ${videoInputs.isDaisyChain 
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)] hover:bg-purple-500/20' 
                        : 'bg-white/3 border-white/6 text-gray-400 hover:text-gray-200 hover:bg-white/6 hover:border-white/10'}`}
            >
                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${videoInputs.isDaisyChain ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
                Daisy Chain
            </button>

            {/* Time Offset Slider */}
            <div className="flex items-center gap-2.5 ml-2 border-l border-white/8 pl-4 h-5">
                <span className="text-[9px] text-gray-500 uppercase font-extrabold font-mono tracking-widest">Time</span>
                <input
                    type="range"
                    min="-8"
                    max="8"
                    step="1"
                    value={videoInputs.timeOffset}
                    onChange={(e) => setVideoInput('timeOffset', parseInt(e.target.value))}
                    className="w-18 md:w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none hover:bg-white/15 transition-all"
                />
                <span className={`text-[10px] font-mono font-bold w-9 text-right transition-colors duration-300 ${
                    videoInputs.timeOffset > 0 
                        ? 'text-emerald-400' 
                        : videoInputs.timeOffset < 0 
                            ? 'text-rose-400' 
                            : 'text-gray-500'
                }`}>
                    {videoInputs.timeOffset > 0 ? '+' : ''}{videoInputs.timeOffset}s
                </span>
            </div>
        </div>
    );
}
