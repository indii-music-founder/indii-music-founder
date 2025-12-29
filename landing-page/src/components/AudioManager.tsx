'use client';

import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        // Event listeners
        const handleCanPlay = () => {
            console.log("Audio Ready");
            setIsReady(true);
        };

        const handleError = (e: Event | string) => {
            console.error("Audio error:", e);
        };

        audio.addEventListener('canplaythrough', handleCanPlay);
        audio.addEventListener('error', handleError);

        // Force load
        audio.load();

        return () => {
            audio.pause();
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            audioRef.current = null;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const setupAudioAnalysis = () => {
        if (!audioRef.current || audioContextRef.current) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.85;
            analyserRef.current = analyser;

            // Connect only if not already connected (though we check context above)
            // Need to handle CORS issues with generic error catch
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

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const bands: number[] = [];
        const bandCount = 31;
        let currentBin = 0;

        for (let i = 0; i < bandCount; i++) {
            const startBin = Math.floor(Math.pow(i / bandCount, 2) * (bufferLength * 0.8));
            const endBin = Math.floor(Math.pow((i + 1) / bandCount, 2) * (bufferLength * 0.8));
            const actualStart = Math.max(startBin, currentBin);
            const actualEnd = Math.max(endBin, actualStart + 1);
            let sum = 0;
            let count = 0;

            for (let j = actualStart; j < actualEnd && j < bufferLength; j++) {
                sum += dataArray[j];
                count++;
            }
            currentBin = actualEnd;
            bands.push(count > 0 ? (sum / count) / 255 : 0);
        }

        // Legacy 3-band approx
        let bass = 0; for (let i = 0; i < 10; i++) bass += dataArray[i];
        let mid = 0; for (let i = 10; i < 100; i++) mid += dataArray[i];
        let high = 0; for (let i = 100; i < 500; i++) high += dataArray[i];

        setFrequencyData({
            bass: (bass / 10) / 255,
            mid: (mid / 90) / 255,
            high: (high / 400) / 255,
            bands: bands
        });

        rafRef.current = requestAnimationFrame(analyzeLoop);
    };

    const [showGlitch, setShowGlitch] = useState(false);

    const triggerGlitch = () => {
        setShowGlitch(true);
        setTimeout(() => setShowGlitch(false), 2000);
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;

        // On iOS, we must create/resume context inside the click handler
        if (!audioContextRef.current) {
            setupAudioAnalysis();
        }
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            try {
                await audioRef.current.play();
            } catch (e) {
                console.error("Audio Play failed:", e);
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
            const playPromise = audioRef.current.play();
            if (playPromise) playPromise.catch(e => console.error("Play error after upload:", e));
        }
    };

    return (
        <div className="fixed bottom-8 left-8 z-50 flex flex-col gap-4 items-start md:flex-row md:items-center">
            {/* Play/Pause Control */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                disabled={!isReady}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-full backdrop-blur-md border transition-all flex items-center justify-center shadow-2xl group ${isPlaying
                    ? 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-[0_0_20px_rgba(0,243,255,0.4)]'
                    : 'bg-black/60 border-white/20 text-white hover:bg-white/10 hover:border-white/40'
                    } ${!isReady ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            >
                {isPlaying ? (
                    <Volume2 className="w-6 h-6 md:w-8 md:h-8" />
                ) : (
                    <VolumeX className="w-6 h-6 md:w-8 md:h-8 text-white/50 group-hover:text-white transition-colors" />
                )}
            </motion.button>

            {/* Controls Container */}
            <div className="flex gap-2">
                {/* Upload Button */}
                <div className="relative group">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-3 md:px-6 md:py-3 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 hover:border-white/30 backdrop-blur-md transition-all flex items-center gap-2 md:gap-3 font-medium tracking-wide shadow-lg"
                        title="Upload your own track"
                    >
                        <Upload className="w-5 h-5" />
                        <span className="inline">Upload</span>
                    </motion.button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="audio/*"
                        className="hidden"
                    />
                </div>

                {/* Mobile Camera/Action Button (Requested) */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="md:hidden px-4 py-3 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 backdrop-blur-md transition-all flex items-center justify-center shadow-lg"
                    onClick={triggerGlitch}
                    title="Use Camera"
                >
                    <span className="text-xl">📷</span>
                </motion.button>
            </div>

            {/* Hint */}
            {!hasInteracted && !isPlaying && isReady && (
                <div
                    className="absolute -top-12 left-0 bg-neon-blue/90 text-black px-4 py-2 rounded-lg pointer-events-none animate-bounce shadow-[0_0_20px_rgba(46,46,254,0.5)] z-50 w-max"
                >
                    <div className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">Tap to Initialize</div>
                </div>
            )}

            {fileName && (
                <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full max-w-[200px] shadow-lg">
                    <span className="text-xs text-white/90 font-mono truncate block animate-pulse">
                        Playing: {fileName}
                    </span>
                </div>
            )}

            {/* Glitch Overlay Toast */}
            <AnimatePresence>
                {showGlitch && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, x: "-50%" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)", x: "-50%" }}
                        className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase shadow-[0_0_30px_rgba(255,0,0,0.6)] border border-red-400 rotate-2"
                    >
                        SYSTEM_LOCK // CAMERA_OFFLINE
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
