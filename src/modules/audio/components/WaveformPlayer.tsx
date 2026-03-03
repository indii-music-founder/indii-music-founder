import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';

interface WaveformPlayerProps {
    url: string;
    onPlay?: () => void;
    onPause?: () => void;
    height?: number;
    waveColor?: string;
    progressColor?: string;
    isPlaying?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
    url,
    onPlay,
    onPause,
    height = 60,
    waveColor = '#4b5563',
    progressColor = '#a855f7',
    isPlaying: externalIsPlaying
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            height,
            waveColor,
            progressColor,
            cursorColor: '#ffffff',
            barWidth: 2,
            barGap: 3,
            barRadius: 3,
            url,
        });

        wavesurferRef.current = ws;

        ws.on('ready', () => {
            setIsLoading(false);
        });

        ws.on('play', () => {
            setIsPlaying(true);
            onPlay?.();
        });

        ws.on('pause', () => {
            setIsPlaying(false);
            onPause?.();
        });

        ws.on('finish', () => {
            setIsPlaying(false);
        });

        return () => {
            ws.destroy();
        };
    }, [url, height, waveColor, progressColor, onPlay, onPause]);

    // Sync with external isPlaying prop (e.g. from a list)
    useEffect(() => {
        if (wavesurferRef.current && externalIsPlaying !== undefined) {
            if (externalIsPlaying && !wavesurferRef.current.isPlaying()) {
                wavesurferRef.current.play();
            } else if (!externalIsPlaying && wavesurferRef.current.isPlaying()) {
                wavesurferRef.current.pause();
            }
        }
    }, [externalIsPlaying]);

    const togglePlay = () => {
        wavesurferRef.current?.playPause();
    };

    const toggleMute = () => {
        if (wavesurferRef.current) {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            wavesurferRef.current.setMuted(newMuted);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full bg-black/20 p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-4">
                <button
                    onClick={togglePlay}
                    disabled={isLoading}
                    className="p-3 rounded-full bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                    ) : (
                        <Play className="w-5 h-5 fill-current" />
                    )}
                </button>

                <div className="flex-1">
                    <div ref={containerRef} />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMute}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                        ) : (
                            <Volume2 className="w-5 h-5" />
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVolume(val);
                            setIsMuted(false);
                            wavesurferRef.current?.setVolume(val);
                            wavesurferRef.current?.setMuted(false);
                        }}
                        className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                </div>
            </div>
            {isLoading && (
                <div className="text-xs text-gray-500 flex items-center gap-2 px-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading waveform...
                </div>
            )}
        </div>
    );
};
