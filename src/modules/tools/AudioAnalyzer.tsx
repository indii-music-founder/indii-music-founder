import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Activity, Radio, Mic2, Upload, Volume2, Maximize2, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const AudioAnalyzer: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [sourceType, setSourceType] = useState<'file' | 'mic'>('file');
    const [fileName, setFileName] = useState<string | null>(null);
    const [volume, setVolume] = useState([75]);

    // Web Audio API Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    // Initialize Audio Context on user interaction
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048; // High resolution
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (isPlaying) stopAudio();

            const url = URL.createObjectURL(file);
            if (audioRef.current) {
                audioRef.current.src = url;
                setFileName(file.name);
                setSourceType('file');
            }
        }
    };

    const toggleMic = async () => {
        try {
            initAudioContext();
            if (sourceType === 'mic' && isPlaying) {
                stopAudio();
                return;
            }

            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (sourceRef.current) sourceRef.current.disconnect();

            const source = audioContextRef.current!.createMediaStreamSource(stream);
            source.connect(analyserRef.current!);
            // Do NOT connect mic to destination (speakers) to avoid feedback loop

            sourceRef.current = source;
            setSourceType('mic');
            setIsPlaying(true);
            setFileName("Live Microphone Input");
        } catch (err) {
            console.error("Mic Error:", err);
        }
    };

    const togglePlay = async () => {
        if (!audioRef.current || !fileName) return;

        initAudioContext();

        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // Connect nodes if not already connected
            if (!sourceRef.current && analyserRef.current && audioContextRef.current) {
                const source = audioContextRef.current.createMediaElementSource(audioRef.current);
                source.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
                sourceRef.current = source;
            }

            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    };

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume[0] / 100;
        }
    }, [volume]);

    // Visualizer Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserRef.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!analyserRef.current) return;

            animationRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear with fade effect for trails
            ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Calculate bass energy for pulse
            let bassEnergy = 0;
            for (let i = 0; i < 20; i++) {
                bassEnergy += dataArray[i];
            }
            bassEnergy /= 20;
            const pulseScale = 1 + (bassEnergy / 255) * 0.2;

            // Draw Circular Spectrum (Holographic Style)
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(pulseScale, pulseScale);

            const radius = 100;
            const bars = 180; // Number of bars around circle
            const step = Math.ceil(bufferLength / bars);
            // Only use lower frequencies for better visuals

            for (let i = 0; i < bars; i++) {
                const value = dataArray[i * step];
                const percent = value / 255;
                const height = radius + (percent * 200);
                const angle = (Math.PI * 2 * i) / bars;

                const x = Math.cos(angle) * height;
                const y = Math.sin(angle) * height;
                const xBase = Math.cos(angle) * radius;
                const yBase = Math.sin(angle) * radius;

                // Electric Blue to Neon Purple gradient based on frequency/intensity
                const hue = 180 + (percent * 120); // Cyan -> Purple
                ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${percent + 0.2})`;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(xBase, yBase);
                ctx.lineTo(x, y);
                ctx.stroke();

                // Reflection (Inner Circle)
                ctx.beginPath();
                ctx.moveTo(xBase, yBase);
                ctx.lineTo(Math.cos(angle) * (radius - percent * 50), Math.sin(angle) * (radius - percent * 50));
                ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.2)`;
                ctx.stroke();
            }

            ctx.restore();

            // Center Ring Glow
            ctx.beginPath();
            ctx.arc(centerX, centerY, 90 * pulseScale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 20 * pulseScale;
            ctx.shadowColor = '#00FFFF';
            ctx.stroke();
        };

        if (isPlaying) {
            draw();
        } else {
            // Idle State Animation
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Could add distinct idle animation here
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying]);

    return (
        <div className="h-full w-full p-6 flex flex-col gap-6 bg-transparent text-foreground">
            {/* Hidden Audio Element */}
            <audio ref={audioRef} crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white glow-text-white">
                        Audio<span className="text-primary glow-text-yellow">Analyzer</span>
                    </h1>
                    <p className="text-muted-foreground mt-1">Real-time spectral decomposition & mastering suite</p>
                </div>
                <div className="flex gap-2">
                    <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-colors",
                        audioContextRef.current ? "bg-secondary/20 border-secondary/50 text-secondary" : "bg-white/5 border-white/10 text-muted-foreground")}>
                        <Activity className="w-3 h-3" />
                        <span>ENGINE: {audioContextRef.current ? 'ONLINE' : 'STANDBY'}</span>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-colors",
                        isPlaying ? "bg-accent/20 border-accent/50 text-accent" : "bg-white/5 border-white/10 text-muted-foreground")}>
                        <Radio className="w-3 h-3" />
                        <span>INPUT: {sourceType === 'mic' ? 'MIC' : 'LINE'}</span>
                    </div>
                </div>
            </div>

            {/* Main Visualizer Area */}
            <div className="flex-1 rounded-xl border border-white/10 glass relative overflow-hidden group">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    width={1200}
                    height={600}
                />

                {/* Holographic Overlay Data */}
                <div className="absolute inset-0 p-8 pointer-events-none flex flex-col justify-between">
                    <div className="flex justify-between font-mono text-xs text-white/40">
                        <div>
                            <p>FREQ_RANGE: 20Hz - 20kHz</p>
                            <p>SAMPLE_RATE: {audioContextRef.current?.sampleRate || 48000}Hz</p>
                            <p>FFT_SIZE: 2048</p>
                        </div>
                        <div className="text-right">
                            <p>SOURCE: {sourceType.toUpperCase()}</p>
                            <p>STATUS: {isPlaying ? 'ANALYZING' : 'IDLE'}</p>
                        </div>
                    </div>

                    {/* Drag & Drop Overlay Hint */}
                    {!fileName && sourceType === 'file' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-white/20 font-mono text-sm tracking-widest">LOAD AUDIO SOURCE TO INITIALIZE CORE</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Track Info / Upload */}
                <div className="glass-panel p-4 rounded-lg flex items-center gap-4">
                    <label className="cursor-pointer w-16 h-16 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 flex flex-col items-center justify-center transition-colors group">
                        <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                        <Upload className="w-6 h-6 text-white/50 group-hover:text-primary mb-1 transition-colors" />
                        <span className="text-[10px] text-white/40">LOAD</span>
                    </label>
                    <div className="min-w-0 pr-2">
                        <h3 className="font-bold text-white truncate text-sm">{fileName || "No Track Loaded"}</h3>
                        <p className="text-xs text-primary truncate">
                            {sourceType === 'mic' ? 'Microphone Input' : (fileName ? 'Local File' : 'Select Audio File')}
                        </p>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-10 w-10 rounded-full hover:bg-white/5", sourceType === 'mic' && "text-red-500 animate-pulse bg-red-500/10")}
                            onClick={toggleMic}
                            title="Toggle Microphone"
                        >
                            <Mic2 className="w-5 h-5 fill-current" />
                        </Button>

                        <Button
                            variant="outline"
                            size="icon"
                            disabled={sourceType === 'mic'}
                            className={cn("h-14 w-14 rounded-full border-primary/50 hover:bg-primary/20 hover:text-primary transition-all shadow-[0_0_15px_rgba(255,255,0,0.1)]", isPlaying && sourceType === 'file' && "bg-primary/20 shadow-[0_0_20px_rgba(255,255,0,0.4)]")}
                            onClick={togglePlay}
                        >
                            {isPlaying && sourceType === 'file' ? <Pause className="fill-current w-6 h-6" /> : <Play className="fill-current ml-1 w-6 h-6" />}
                        </Button>

                        <div className="flex items-center gap-2 group">
                            <Volume2 className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                            <div className="w-20">
                                <Slider
                                    defaultValue={[75]}
                                    min={0}
                                    max={100}
                                    step={1}
                                    onValueChange={setVolume}
                                    className="py-2"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Tools */}
                <div className="glass-panel p-4 rounded-lg grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="flex flex-col justify-center items-center bg-black/20 rounded p-2 border border-white/5 hover:border-accent/50 transition-colors cursor-pointer">
                        <Activity className="w-4 h-4 mb-1 text-accent" />
                        <span className="text-white/60">SPECTROGRAM</span>
                    </div>
                    <div className="flex flex-col justify-center items-center bg-black/20 rounded p-2 border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
                        <Maximize2 className="w-4 h-4 mb-1 text-primary" />
                        <span className="text-white/60">FULLSCREEN</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioAnalyzer;
