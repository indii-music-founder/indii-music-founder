/**
 * TransportBar — Audio transport controls for the phone remote.
 * Provides play/pause/skip/seek controls for the studio's audio preview engine,
 * matching the desktop AudioPIPPlayer functionality.
 */

import { useState } from 'react';
import { useStore } from '@/core/store';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Repeat, Shuffle
} from 'lucide-react';

interface TransportBarProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

export default function TransportBar({ onSendCommand, isPaired }: TransportBarProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isRepeat, setIsRepeat] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);

    const currentModule = useStore(state => state.currentModule);

    const sendTransport = (action: string) => {
        onSendCommand({
            type: 'agent_action',
            payload: { action: `transport_${action}` },
        });
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        sendTransport(isPlaying ? 'pause' : 'play');
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        sendTransport(isMuted ? 'unmute' : 'mute');
    };

    const skip = (direction: 'back' | 'forward') => {
        sendTransport(`skip_${direction}`);
    };

    const seek = (value: number) => {
        setProgress(value);
        sendTransport('seek');
    };

    return (
        <div className="rounded-2xl bg-[#161b22]/70 border border-[#30363d]/40 backdrop-blur-xl p-4">
            {/* Track Info */}
            <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-semibold truncate">
                        {currentModule ? `${currentModule} Preview` : 'No track loaded'}
                    </p>
                    <p className="text-[10px] text-[#6e7681] mt-0.5">indiiOS Audio Preview</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsShuffle(!isShuffle)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isShuffle ? 'text-blue-400 bg-blue-600/20' : 'text-[#6e7681] hover:text-white'
                            }`}
                    >
                        <Shuffle className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setIsRepeat(!isRepeat)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isRepeat ? 'text-blue-400 bg-blue-600/20' : 'text-[#6e7681] hover:text-white'
                            }`}
                    >
                        <Repeat className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={e => seek(Number(e.target.value))}
                    className="w-full h-1 rounded-full appearance-none bg-[#21262d] cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400
            [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-0"
                />
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[#484f58]">
                        {Math.floor(progress * 2.4 / 60)}:{String(Math.floor(progress * 2.4) % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-[#484f58]">4:00</span>
                </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={toggleMute}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#8b949e] hover:text-white transition-colors"
                >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                    onClick={() => skip('back')}
                    disabled={!isPaired}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-[#21262d] transition-colors disabled:opacity-30 active:scale-95"
                >
                    <SkipBack className="w-5 h-5" />
                </button>

                <button
                    onClick={togglePlay}
                    disabled={!isPaired}
                    className="w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all disabled:opacity-30 active:scale-95 shadow-lg shadow-blue-600/25"
                >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                <button
                    onClick={() => skip('forward')}
                    disabled={!isPaired}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-[#21262d] transition-colors disabled:opacity-30 active:scale-95"
                >
                    <SkipForward className="w-5 h-5" />
                </button>

                <div className="w-9 h-9" /> {/* Spacer for symmetry */}
            </div>
        </div>
    );
}
