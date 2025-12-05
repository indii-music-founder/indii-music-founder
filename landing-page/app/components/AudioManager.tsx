'use client';

import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Upload } from 'lucide-react';
import { useAudioStore } from '../store/audioStore';

export default function AudioManager() {
    const { isPlaying, setIsPlaying, setFrequencyData } = useAudioStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const rafRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isReady, setIsReady] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    useEffect(() => {
        // Create audio element
        const audio = new Audio('/audio/tech-house-loop.mp3');
        audio.loop = true;
        audio.volume = 0.7;
        audio.crossOrigin = "anonymous"; // Important for analyzing external audio if needed
        audioRef.current = audio;

        // Event listeners
        audio.addEventListener('canplaythrough', () => {
            setIsReady(true);
        });

        audio.addEventListener('error', (e) => {
            console.error("Audio error:", e);
        });

        return () => {
            audio.pause();
            audioRef.current = null;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const setupAudioAnalysis = () => {
        if (!audioRef.current || audioContextRef.current) return;

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048; // Higher resolution for 31 bands
            analyserRef.current = analyser;

            const source = ctx.createMediaElementSource(audioRef.current);
            sourceRef.current = source;
            source.connect(analyser);
            analyser.connect(ctx.destination);

            analyzeLoop();
        } catch (e) {
            console.error("Audio Context Setup Failed:", e);
        }
    };

    const analyzeLoop = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount; // 1024
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate 31 Bands (Logarithmic-ish approximation)
        // 1024 bins spread across 0-22kHz.
        // We want 31 bands.
        const bands: number[] = [];
        const bandCount = 31;

        // Simple linear-to-log mapping
        // We can use a multiplier to widen the bin range for higher frequencies
        let currentBin = 0;

        for (let i = 0; i < bandCount; i++) {
            // Determine start and end bin for this band
            // Using a power function to distribute bins: bin = floor(base ^ i)
            // Or simpler: just hardcode ranges or use a geometric progression.

            // Geometric progression:
            // start = 0
            // next = start * factor
            // factor = (1024)^(1/31) ~= 1.25

            // Let's use a simpler approach for visualizer:
            // Low bands need fewer bins, high bands need more.

            // Total bins = 1024.
            // Let's try to grab chunks.

            const startBin = Math.floor(Math.pow(i / bandCount, 2) * (bufferLength * 0.8)); // Use mostly lower/mid range, ignore very top
            const endBin = Math.floor(Math.pow((i + 1) / bandCount, 2) * (bufferLength * 0.8));

            let sum = 0;
            let count = 0;

            // Ensure at least one bin
            const actualStart = Math.max(startBin, currentBin);
            const actualEnd = Math.max(endBin, actualStart + 1);

            for (let j = actualStart; j < actualEnd && j < bufferLength; j++) {
                sum += dataArray[j];
                count++;
            }

            currentBin = actualEnd;

            const avg = count > 0 ? sum / count : 0;
            bands.push(avg / 255);
        }

        // Legacy 3-band calculation (kept for compatibility)
        // Bass: 0-3 (~0-500Hz) -> rough mapping to new bins
        // We can re-calculate from dataArray for accuracy
        let bass = 0;
        for (let i = 0; i < 10; i++) bass += dataArray[i]; // First ~200Hz
        bass /= 10;

        let mid = 0;
        for (let i = 10; i < 100; i++) mid += dataArray[i]; // ~200Hz - 2kHz
        mid /= 90;

        let high = 0;
        for (let i = 100; i < 500; i++) high += dataArray[i]; // ~2kHz - 10kHz
        high /= 400;

        // Normalize 0-1
        setFrequencyData({
            bass: bass / 255,
            mid: mid / 255,
            high: high / 255,
            bands: bands
        });

        rafRef.current = requestAnimationFrame(analyzeLoop);
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (!audioContextRef.current) {
            setupAudioAnalysis();
        }

        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.error("Audio play failed on click:", e));
            }
        }
        setIsPlaying(!isPlaying);
        setHasInteracted(true);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !audioRef.current) return;

        const url = URL.createObjectURL(file);
        audioRef.current.src = url;
        audioRef.current.load();
        setFileName(file.name);
        setIsReady(true);

        if (isPlaying) {
            audioRef.current.play();
        }
    };

    return (
        <div className="fixed bottom-8 left-8 z-50 flex items-center gap-4">
            <button
                onClick={togglePlay}
                disabled={!isReady}
                className={`p-3 rounded-full backdrop-blur-md border transition-all group ${isPlaying
                    ? 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                    : 'bg-black/50 border-white/10 text-white hover:bg-white/10'
                    } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isPlaying ? (
                    <Volume2 className="w-6 h-6" />
                ) : (
                    <VolumeX className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
                )}
            </button>

            {/* Upload Button */}
            <div className="relative group">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-full bg-black/50 border border-white/10 text-white hover:bg-white/10 backdrop-blur-md transition-all"
                    title="Upload your own track"
                >
                    <Upload className="w-5 h-5" />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="audio/*"
                    className="hidden"
                />
            </div>

            {/* Status / CTA */}
            {!hasInteracted && !isPlaying && isReady && (
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full animate-pulse cursor-pointer" onClick={togglePlay}>
                    <span className="text-xs text-white font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-neon-blue rounded-full animate-ping"></span>
                        Click for Sound
                    </span>
                </div>
            )}

            {fileName && (
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full max-w-[200px]">
                    <span className="text-xs text-white/80 font-mono truncate block">
                        {fileName}
                    </span>
                </div>
            )}
        </div>
    );
}
