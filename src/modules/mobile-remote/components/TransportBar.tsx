/**
 * TransportBar — Audio transport controls wired to the real AudioPlayerSlice.
 * Controls the same playback engine as the desktop AudioPIPPlayer.
 */

import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Square, Music2
} from 'lucide-react';

interface TransportBarProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TransportBar({ onSendCommand }: TransportBarProps) {
    const {
        currentTrack,
        isPlaying,
        volume,
        currentTime,
        duration,
        pauseTrack,
        resumeTrack,
        stopTrack,
        setVolume,
    } = useStore(
        useShallow(state => ({
            currentTrack: state.currentTrack,
            isPlaying: state.isPlaying,
            volume: state.volume,
            currentTime: state.currentTime,
            duration: state.duration,
            pauseTrack: state.pauseTrack,
            resumeTrack: state.resumeTrack,
            stopTrack: state.stopTrack,
            setVolume: state.setVolume,
        }))
    );

    const isMuted = volume === 0;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const trackTitle = currentTrack?.prompt ?? currentTrack?.type ?? null;

    const togglePlay = () => {
        if (isPlaying) {
            pauseTrack();
        } else {
            resumeTrack();
        }
        onSendCommand({
            type: 'agent_action',
            payload: { action: isPlaying ? 'transport_pause' : 'transport_play' },
        });
    };

    const toggleMute = () => {
        if (isMuted) {
            setVolume(0.8);
        } else {
            setVolume(0);
        }
    };

    const handleStop = () => {
        stopTrack();
        onSendCommand({
            type: 'agent_action',
            payload: { action: 'transport_stop' },
        });
    };

    // No track loaded — show empty state
    if (!currentTrack) {
        return (
            <div className="rounded-2xl bg-[#161b22]/70 border border-[#30363d]/40 backdrop-blur-xl p-6">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#21262d] border border-[#30363d]/40 flex items-center justify-center mb-3">
                        <Music2 className="w-6 h-6 text-[#484f58]" />
                    </div>
                    <p className="text-sm text-[#6e7681]">No track loaded</p>
                    <p className="text-xs text-[#484f58] mt-1">
                        Play audio from the Audio Analyzer module
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-[#161b22]/70 border border-[#30363d]/40 backdrop-blur-xl p-4">
            {/* Track Info */}
            <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-semibold truncate">
                        {trackTitle || 'Unknown Track'}
                    </p>
                    <p className="text-[10px] text-[#6e7681] mt-0.5">indiiOS Audio Preview</p>
                </div>
            </div>

            {/* Progress Bar — read-only, driven by AudioPIPPlayer updates */}
            <div className="mb-3">
                <div className="w-full h-1.5 rounded-full bg-[#21262d] overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[#484f58]">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-[#484f58]">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Transport Controls — all wired to real AudioPlayerSlice */}
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={toggleMute}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#8b949e] hover:text-white transition-colors active:scale-95"
                >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                    onClick={handleStop}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-[#21262d] transition-colors active:scale-95"
                >
                    <Square className="w-4 h-4" />
                </button>

                <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all active:scale-95 shadow-lg shadow-blue-600/25"
                >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                <button
                    onClick={handleStop}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-[#21262d] transition-colors active:scale-95"
                >
                    <SkipForward className="w-5 h-5" />
                </button>

                <div className="w-9 h-9" /> {/* Spacer for symmetry */}
            </div>
        </div>
    );
}
