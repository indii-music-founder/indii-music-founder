/**
 * TransportBar — Audio transport controls for Secure Cloud Streaming.
 * Connects directly to an HTML5 Audio element for standalone mobile playback.
 */

import { useRef, useEffect, useState } from 'react';
import type { HistoryItem } from '@/core/types/history';
import {
    Play, Pause, SkipForward, Volume2, VolumeX,
    Square, Music2, Headphones, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
 
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

interface TransportBarProps {
    track: HistoryItem | null;
    onNext?: () => void;
}

function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TransportBar({ track, onNext }: TransportBarProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playbackRequestRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => {
            playbackRequestRef.current += 1;
            setIsPlaying(false);
            if (onNext) onNext();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [onNext]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const requestId = ++playbackRequestRef.current;

        if (track?.url) {
            audio.src = track.url;
            audio.load();
            void (async () => {
                try {
                    await audio.play();
                    if (playbackRequestRef.current === requestId) setIsPlaying(true);
                } catch (err) {
                    if (playbackRequestRef.current === requestId) {
                        logger.error('[TransportBar] Playback failed:', err);
                        setIsPlaying(false);
                    }
                }
            })();
        } else if (!track) {
            audio.pause();
            audio.src = '';
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
        }

        return () => {
            if (playbackRequestRef.current === requestId) playbackRequestRef.current += 1;
        };
    }, [track]);

    const togglePlay = () => {
        if (!audioRef.current || !track) return;
        if (isPlaying) {
            playbackRequestRef.current += 1;
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            const requestId = ++playbackRequestRef.current;
            const audio = audioRef.current;
            void (async () => {
                try {
                    await audio.play();
                    if (playbackRequestRef.current === requestId) setIsPlaying(true);
                } catch (err) {
                    if (playbackRequestRef.current === requestId) {
                        logger.error('[TransportBar] Toggle play failed:', err);
                        setIsPlaying(false);
                    }
                }
            })();
        }
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleStop = () => {
        if (!audioRef.current) return;
        playbackRequestRef.current += 1;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const trackTitle = track?.prompt || track?.subject || track?.type || null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-white/[0.05] via-[#1c1c1e] to-white/[0.02] border border-white/10 shadow-2xl p-6"
        >
            <audio ref={audioRef} style={{ display: 'none' }} playsInline crossOrigin="anonymous" />

            <AnimatePresence mode="wait">
                {!track ? (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-6 text-center"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                            <Headphones className="w-8 h-8 text-white/10" />
                        </div>
                        <h4 className="text-[10px] font-bold text-[#636366] uppercase tracking-[0.2em] mb-1">Secure Streaming</h4>
                        <p className="text-xs text-white/40">Select a track to stream from Cloud</p>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="active"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                    >
                        {/* Track Info */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Activity className="w-3 h-3 text-blue-400" />
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Streaming Now</span>
                                </div>
                                <h4 className="text-base font-bold text-white truncate tracking-tight">
                                    {trackTitle || 'Master Preview'}
                                </h4>
                                <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">Cloud Storage</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-inner">
                                <Music2 className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.3, ease: "linear" }}
                                    className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-600 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                                />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-mono font-bold text-white/40">{formatTime(currentTime)}</span>
                                <span className="text-[10px] font-mono font-bold text-white/40">{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Transport Controls */}
                        <div className="flex items-center justify-between gap-4 pt-2">
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={toggleMute}
                                aria-label={isMuted ? 'Unmute' : 'Mute'}
                                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/5 text-[#8e8e93] hover:text-white transition-all"
                            >
                                {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                            </motion.button>

                            <div className="flex items-center gap-6">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleStop}
                                    aria-label="Stop"
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/5 text-white/60 hover:text-white transition-all"
                                >
                                    <Square className="w-5 h-5" />
                                </motion.button>

                                <motion.button
                                    whileTap={{ scale: 0.92 }}
                                    onClick={togglePlay}
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                    className="w-20 h-20 rounded-[28px] bg-white flex items-center justify-center text-black shadow-[0_20px_40px_-8px_rgba(255,255,255,0.2)]"
                                >
                                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                                </motion.button>

                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onNext}
                                    disabled={!onNext}
                                    aria-label="Next Track"
                                    className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/5 transition-all",
                                        onNext ? "text-white/60 hover:text-white cursor-pointer" : "text-white/20 cursor-not-allowed"
                                    )}
                                >
                                    <SkipForward className="w-5 h-5" />
                                </motion.button>
                            </div>

                            <div className="w-12 h-12" /> {/* Layout Spacer */}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ambient Background Blur */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-green-500/10 blur-3xl pointer-events-none" />
        </motion.div>
    );
}
