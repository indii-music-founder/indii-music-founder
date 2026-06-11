import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getAudioData } from '@remotion/media-utils';
import type { AudioData } from '@remotion/media-utils';
import { logger } from '@/utils/logger';

interface AudioWaveformProps {
    src: string;
    width: number;
    height: number;
    color?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ src, width, height, color = 'rgba(255, 255, 255, 0.5)' }) => {
    // Cache raw audio data to avoid re-fetching/decoding on resize.
    const [audioData, setAudioData] = useState<{ src: string; data: AudioData } | null>(null);
    const [error, setError] = useState<{ src: string; message: string } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const activeAudioData = audioData?.src === src ? audioData.data : null;
    const activeError = error?.src === src ? error.message : null;

    // 1. Fetch Audio (Only when src changes)
    useEffect(() => {
        let isMounted = true;

        const fetchAudio = async () => {
            try {
                // This is the expensive operation we want to cache
                const data = await getAudioData(src);
                if (isMounted) {
                    setAudioData({ src, data });
                    setError(null);
                }
            } catch (err: unknown) {
                logger.error("Failed to load audio waveform:", err);
                if (isMounted) setError({ src, message: "Failed to load audio" });
            }
        };

        fetchAudio();

        return () => {
            isMounted = false;
        };
    }, [src]);

    // 2. Resample (When width or audioData changes)
    const waveform = useMemo(() => {
        if (!activeAudioData) return [];

        // Resample data to fit width
        const samples = activeAudioData.channelWaveforms[0]; // Use first channel
        if (!samples) return [];
        const step = Math.ceil(samples.length / width);
        const resampled: number[] = [];

        for (let i = 0; i < width; i++) {
            let max = 0;
            // Optimization: Use a simpler loop or typed array methods if possible,
            // but this simple loop is likely fine for typical widths (~100-500px).
            // Main bottleneck was the getAudioData call.
            for (let j = 0; j < step; j++) {
                const idx = i * step + j;
                if (idx < samples.length) {
                    const val = Math.abs(samples[idx]!);
                    if (val > max) max = val;
                }
            }
            resampled.push(max);
        }

        return resampled;
    }, [activeAudioData, width]);

    // 3. Draw (When waveform or dimensions change)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || waveform.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;

        const centerY = height / 2;

        waveform.forEach((val, x) => {
            const barHeight = val * height;
            ctx.fillRect(x, centerY - barHeight / 2, 1, barHeight);
        });

    }, [waveform, width, height, color]);

    if (activeError) return <div className="text-[10px] text-red-400 p-1">Audio Error</div>;

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full pointer-events-none opacity-80"
        />
    );
};
