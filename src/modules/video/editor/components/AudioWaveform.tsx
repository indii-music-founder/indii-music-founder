import React, { useEffect, useState, useRef } from 'react';
import { getAudioData } from '@remotion/media-utils';

interface AudioWaveformProps {
    src: string;
    width: number;
    height: number;
    color?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ src, width, height, color = 'rgba(255, 255, 255, 0.5)' }) => {
    const [waveform, setWaveform] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchAudio = async () => {
            try {
                const data = await getAudioData(src);
                if (!isMounted) return;

                // Resample data to fit width
                const samples = data.channelWaveforms[0]; // Use first channel
                const step = Math.ceil(samples.length / width);
                const resampled = [];

                for (let i = 0; i < width; i++) {
                    let max = 0;
                    for (let j = 0; j < step; j++) {
                        const val = Math.abs(samples[i * step + j] || 0);
                        if (val > max) max = val;
                    }
                    resampled.push(max);
                }

                setWaveform(resampled);
            } catch (err) {
                console.error("Failed to load audio waveform:", err);
                if (isMounted) setError("Failed to load audio");
            }
        };

        fetchAudio();

        return () => {
            isMounted = false;
        };
    }, [src, width]);

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

    if (error) return <div className="text-[10px] text-red-400 p-1">Audio Error</div>;

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full pointer-events-none opacity-80"
        />
    );
};
