import React from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

interface DaisyChainControlsProps {
    onOpenFrameModal: (target: 'firstFrame' | 'lastFrame') => void;
}

export default function DaisyChainControls({ onOpenFrameModal }: DaisyChainControlsProps) {
    const { videoInputs, setVideoInput } = useStore();
    const toast = useToast();

    return (
        <div className="flex items-center gap-2 border-l border-r border-gray-800 px-3 mx-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Composition</span>

            {/* First Frame Slot */}
            <div className="flex items-center gap-2">
                <div
                    onClick={() => onOpenFrameModal('firstFrame')}
                    data-testid="first-frame-slot"
                    className={`relative w-8 h-8 bg-gray-800 rounded border ${videoInputs.firstFrame ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500 cursor-pointer'} overflow-hidden flex items-center justify-center group transition-colors`}
                >
                    {videoInputs.firstFrame ? (
                        <>
                            <img src={videoInputs.firstFrame.url} className="w-full h-full object-cover" alt="First Frame" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setVideoInput('firstFrame', null); }}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <span className="text-white text-xs">×</span>
                            </button>
                        </>
                    ) : (
                        <span className="text-[9px] text-gray-600 text-center leading-none select-none">First<br />Frame</span>
                    )}
                </div>
            </div>

            {/* Link Icon */}
            <div className={`h-px w-4 ${videoInputs.isDaisyChain ? 'bg-purple-500' : 'bg-gray-700'}`}></div>

            {/* Last Frame Slot */}
            <div className="flex items-center gap-2">
                <div
                    onClick={() => onOpenFrameModal('lastFrame')}
                    data-testid="last-frame-slot"
                    className={`relative w-8 h-8 bg-gray-800 rounded border ${videoInputs.lastFrame ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500 cursor-pointer'} overflow-hidden flex items-center justify-center group transition-colors`}
                >
                    {videoInputs.lastFrame ? (
                        <>
                            <img src={videoInputs.lastFrame.url} className="w-full h-full object-cover" alt="Last Frame" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setVideoInput('lastFrame', null); }}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <span className="text-white text-xs">×</span>
                            </button>
                        </>
                    ) : (
                        <span className="text-[9px] text-gray-600 text-center leading-none select-none">Last<br />Frame</span>
                    )}
                </div>
            </div>

            {/* Daisy Chain Toggle */}
            <button
                onClick={() => setVideoInput('isDaisyChain', !videoInputs.isDaisyChain)}
                data-testid="daisy-chain-toggle"
                className={`ml-2 text-[10px] px-2 py-0.5 rounded border transition-colors ${videoInputs.isDaisyChain ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300'}`}
            >
                Daisy Chain
            </button>

            {/* Time Offset Slider */}
            <div className="flex items-center gap-2 ml-4 border-l border-gray-800 pl-4">
                <span className="text-[9px] text-gray-500 uppercase font-bold">Time</span>
                <input
                    type="range"
                    min="-8"
                    max="8"
                    step="1"
                    value={videoInputs.timeOffset}
                    onChange={(e) => setVideoInput('timeOffset', parseInt(e.target.value))}
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className={`text-[10px] font-mono w-8 text-right ${videoInputs.timeOffset > 0 ? 'text-green-400' : videoInputs.timeOffset < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {videoInputs.timeOffset > 0 ? '+' : ''}{videoInputs.timeOffset}s
                </span>
            </div>
        </div>
    );
}
