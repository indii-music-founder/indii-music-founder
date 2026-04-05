import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface AudioWaveformViewerProps {
    audioUrl?: string; // If no url is provided, use a placeholder or silent dummy
    height?: number;
    waveColor?: string;
    progressColor?: string;
}

export const AudioWaveformViewer: React.FC<AudioWaveformViewerProps> = ({
    audioUrl,
    height = 80,
    waveColor = 'rgba(168, 85, 247, 0.4)', // purple-500 with opacity
    progressColor = '#a855f7', // purple-500
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            height,
            waveColor,
            progressColor,
            cursorColor: '#fff',
            barWidth: 2,
            barGap: 2,
            barRadius: 2,
            normalize: true,
            minPxPerSec: 10,
        });

        wavesurferRef.current = ws;

        ws.on('ready', () => {
            setIsReady(true);
        });

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));
        ws.on('finish', () => setIsPlaying(false));

        if (audioUrl) {
            ws.load(audioUrl);
        } else {
            // For mock demo, normally we'd pass a blob URL.
            // But since we want something interactive that doesn't fail, we load a data URL.
            // A short empty WAV file base64
            const emptyWav = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";
            ws.load(emptyWav);
        }

        return () => {
            ws.destroy();
        };
    }, [audioUrl, height, waveColor, progressColor]);

    const handlePlayPause = () => {
        if (wavesurferRef.current && isReady) {
            wavesurferRef.current.playPause();
        }
    };

    return (
        <div className="w-full bg-black/40 rounded-xl p-4 border border-white/10 flex items-center gap-4">
            <button
                onClick={handlePlayPause}
                disabled={!isReady}
                className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
            <div className="flex-1 overflow-hidden" ref={containerRef} />
        </div>
    );
};
