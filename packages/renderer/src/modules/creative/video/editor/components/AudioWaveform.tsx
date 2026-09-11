import React, { useEffect, useMemo, useState, useRef } from 'react';
import { fetchAudioData } from '@/utils/audioPeaks';
import type { AudioPeaks as AudioData } from '@/utils/audioPeaks';
import { logger } from '@/utils/logger';

export interface AudioWaveformProps {
    src: string;
    width: number;
    height: number;
    color?: string;
    sourceInUs?: number;
    sourceOutUs?: number;
    durationInFrames?: number;
    fps?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
    src,
    width,
    height,
    color = 'rgba(255, 255, 255, 0.5)',
    sourceInUs,
    sourceOutUs,
    durationInFrames,
    fps = 30
}) => {
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
                const data = await fetchAudioData(src);
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

    // 2. Resample (When width, audioData, or trim boundaries change)
    const waveform = useMemo(() => {
        if (!activeAudioData) return [];

        // Resample data to fit width
        const samples = activeAudioData.channelWaveforms[0]; // Use first channel
        if (!samples || samples.length === 0 || width <= 0) return [];

        let targetSamples = samples;
        const dataWithDuration = activeAudioData as AudioData & { duration?: number };
        const totalDurationSec =
            dataWithDuration.durationInSeconds ??
            dataWithDuration.duration ??
            (dataWithDuration.sampleRate > 0 ? samples.length / dataWithDuration.sampleRate : 0);

        let effectiveSourceOutUs = sourceOutUs;
        if (effectiveSourceOutUs === undefined && sourceInUs !== undefined && durationInFrames && fps && fps > 0) {
            effectiveSourceOutUs = sourceInUs + (durationInFrames / fps) * 1_000_000;
        }

        if ((sourceInUs !== undefined || effectiveSourceOutUs !== undefined) && totalDurationSec > 0) {
            const totalDurationUs = totalDurationSec * 1_000_000;
            const startFrac = Math.max(0, Math.min(1, (sourceInUs ?? 0) / totalDurationUs));
            const endFrac = Math.max(startFrac, Math.min(1, (effectiveSourceOutUs ?? totalDurationUs) / totalDurationUs));

            const startIdx = Math.floor(startFrac * samples.length);
            const endIdx = Math.max(startIdx + 1, Math.min(samples.length, Math.ceil(endFrac * samples.length)));

            targetSamples = samples.subarray ? samples.subarray(startIdx, endIdx) : samples.slice(startIdx, endIdx);
        }

        if (targetSamples.length === 0) return [];

        const numBars = Math.floor(width);
        if (numBars <= 0) return [];

        const step = targetSamples.length / numBars;
        const resampled: number[] = [];

        for (let i = 0; i < numBars; i++) {
            const start = Math.floor(i * step);
            const end = Math.min(targetSamples.length, Math.max(start + 1, Math.floor((i + 1) * step)));
            let max = 0;
            for (let j = start; j < end; j++) {
                const val = Math.abs(targetSamples[j]!);
                if (val > max) max = val;
            }
            resampled.push(max);
        }

        return resampled;
    }, [activeAudioData, width, sourceInUs, sourceOutUs, durationInFrames, fps]);

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
