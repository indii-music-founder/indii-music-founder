import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Activity, Radio, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const AudioAnalyzer: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Sonic OS Animations
    const pulseVariant = {
        animate: {
            scale: [1, 1.02, 1],
            opacity: [0.8, 1, 0.8],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    useEffect(() => {
        // Basic canvas visualizer loop placeholder
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;

        const draw = () => {
            ctx.fillStyle = '#050505'; // bg-dark
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw fake spectrogram/wavy lines
            const time = Date.now() * 0.002;
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x++) {
                const y = canvas.height / 2 + Math.sin(x * 0.02 + time) * 50 * (isPlaying ? 1 : 0.2)
                    + Math.sin(x * 0.05 + time * 1.5) * 20 * (isPlaying ? 1 : 0.2);
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#00FFFF'; // Electric Blue/Cyan
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00FFFF';
            ctx.stroke();

            // Second line (Purple)
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x++) {
                const y = canvas.height / 2 + Math.cos(x * 0.03 - time) * 40 * (isPlaying ? 1 : 0.2) + 20;
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#A020F0'; // Neon Purple
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#A020F0';
            ctx.stroke();

            animationId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationId);
    }, [isPlaying]);

    return (
        <div className="h-full w-full p-6 flex flex-col gap-6 bg-transparent text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white glow-text-white">
                        Audio<span className="text-primary glow-text-yellow">Analyzer</span>
                    </h1>
                    <p className="text-muted-foreground mt-1">Real-time spectral decomposition & mastering suite</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/50 text-secondary text-xs font-mono">
                        <Activity className="w-3 h-3" />
                        <span>ENGINE: ONLINE</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/50 text-accent text-xs font-mono">
                        <Mic2 className="w-3 h-3" />
                        <span>INPUT: ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* Main Visualizer Area */}
            <div className="flex-1 rounded-xl border border-white/10 glass relative overflow-hidden group">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                    width={1200}
                    height={600}
                />

                {/* Holographic Overlay Data */}
                <div className="absolute inset-0 p-8 pointer-events-none flex flex-col justify-between">
                    <div className="flex justify-between font-mono text-xs text-white/40">
                        <div>
                            <p>FREQ_RANGE: 20Hz - 20kHz</p>
                            <p>SAMPLE_RATE: 48.0kHz</p>
                        </div>
                        <div className="text-right">
                            <p>PEAK: -0.5dB</p>
                            <p>LUFS: -14.2</p>
                        </div>
                    </div>

                    {/* Center HUD */}
                    <div className="self-center border border-white/5 bg-black/50 backdrop-blur-sm p-4 rounded-full w-32 h-32 flex items-center justify-center animate-pulse">
                        <Radio className={cn("w-12 h-12 text-primary transition-all duration-300", isPlaying ? "text-primary glow-text-yellow scale-110" : "text-muted-foreground")} />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Track Info */}
                <div className="glass-panel p-4 rounded-lg flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-900 to-blue-900 rounded-md border border-white/10 flex items-center justify-center">
                        <Activity className="text-white/50" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Neural Oscillations</h3>
                        <p className="text-xs text-primary">Cyberpunk 2077 OST</p>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn("h-12 w-12 rounded-full border-primary/50 hover:bg-primary/20 hover:text-primary transition-all shadow-[0_0_15px_rgba(255,255,0,0.1)]", isPlaying && "bg-primary/20 shadow-[0_0_20px_rgba(255,255,0,0.4)]")}
                            onClick={() => setIsPlaying(!isPlaying)}
                        >
                            {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                        </Button>
                    </div>
                    <div className="w-full max-w-[200px] mt-2">
                        <Slider defaultValue={[33]} max={100} step={1} className="py-2" />
                    </div>
                </div>

                {/* Analysis Tools */}
                <div className="glass-panel p-4 rounded-lg grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="flex flex-col justify-center items-center bg-black/20 rounded p-2 border border-white/5 hover:border-accent/50 transition-colors cursor-pointer">
                        <span className="text-accent">SPECTROGRAM</span>
                        <span className="text-white/60">3D</span>
                    </div>
                    <div className="flex flex-col justify-center items-center bg-black/20 rounded p-2 border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
                        <span className="text-primary">VECTORSCOPE</span>
                        <span className="text-white/60">2CH</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioAnalyzer;
