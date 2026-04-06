import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Play, Pause, X, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { logger } from '@/utils/logger';

export default function AudioPIPPlayer() {
    const {
        currentTrack, isPlaying, volume, isPIPVisible,
        pauseTrack, resumeTrack, stopTrack, setVolume, updatePlaybackProgress
    } = useStore(useShallow(state => ({
        currentTrack: state.currentTrack,
        isPlaying: state.isPlaying,
        volume: state.volume,
        isPIPVisible: state.isPIPVisible,
        pauseTrack: state.pauseTrack,
        resumeTrack: state.resumeTrack,
        stopTrack: state.stopTrack,
        setVolume: state.setVolume,
        updatePlaybackProgress: state.updatePlaybackProgress
    })));

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (currentTrack && audioRef.current) {
            audioRef.current.src = currentTrack.url;
            if (isPlaying) {
                audioRef.current.play().catch((e) => logger.error('[AudioPIPPlayer] Playback failed:', e));
            }
        }
    }, [currentTrack, isPlaying]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch((e) => logger.error('[AudioPIPPlayer] Playback failed:', e));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            updatePlaybackProgress(audioRef.current.currentTime, audioRef.current.duration);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    if (!currentTrack || !isPIPVisible) return null;

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4"
        >
            <div className="bg-[#141414]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                {/* Header: Track Info & Close */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                            <Volume2 size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate uppercase tracking-tight">
                                {currentTrack.prompt || "Untitled track"}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">
                                PROJECT: {currentTrack.projectId}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={stopTrack}
                        className="p-1.5 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex flex-col gap-1">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.01"
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-gray-500">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="text-gray-400 hover:text-white transition-colors disabled:opacity-30" disabled>
                            <SkipBack size={20} />
                        </button>
                        <button
                            onClick={isPlaying ? pauseTrack : resumeTrack}
                            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                            {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                        </button>
                        <button className="text-gray-400 hover:text-white transition-colors disabled:opacity-30" disabled>
                            <SkipForward size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="text-gray-500 hover:text-blue-400 transition-colors"
                        >
                            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                                setVolume(parseFloat(e.target.value));
                                if (isMuted) setIsMuted(false);
                            }}
                            className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-gray-400 hover:accent-white transition-all"
                        />
                    </div>
                </div>

                <audio
                    ref={audioRef}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={stopTrack}
                />
            </div>
        </motion.div>
    );
}

function formatTime(seconds: number) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
