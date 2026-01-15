import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/core/store';

export const WorkspaceCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isAgentOpen } = useStore();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;

        const resize = () => {
            canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
            canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        };

        window.addEventListener('resize', resize);
        resize();

        const draw = () => {
            time += 0.005;
            ctx.fillStyle = '#0d1117'; // Match app background
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw fluid grid
            const gridSize = 40;
            const cols = Math.ceil(canvas.width / gridSize);
            const rows = Math.ceil(canvas.height / gridSize);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const x = i * gridSize;
                    const y = j * gridSize;

                    // Calculate noise/wave effect
                    const noise = Math.sin(x * 0.01 + time) * Math.cos(y * 0.01 + time) * 2;

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + gridSize, y);
                    ctx.lineTo(x + gridSize, y + gridSize);
                    // ctx.lineTo(x, y + gridSize); // Open grid look
                    ctx.stroke();

                    // Occasional active points
                    if (Math.sin(i * 0.5 + time * 2) * Math.cos(j * 0.5 + time) > 0.95) {
                        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; // Light blue pulse
                        ctx.fillRect(x, y, gridSize, gridSize);
                    }
                }
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="relative w-full h-[60vh] min-h-[400px] rounded-xl overflow-hidden border border-white/5 bg-bg-dark shadow-inner group">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full opacity-60"
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center space-y-4"
                >
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" />
                        <div className="absolute inset-0 bg-blue-500/5 rounded-full animate-pulse delay-75" />
                        <div className="relative w-full h-full rounded-full border border-blue-500/20 flex items-center justify-center backdrop-blur-sm">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 opacity-20" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-light text-white/80 tracking-wide">
                        indii is listening
                    </h2>
                    <p className="text-sm text-gray-500 font-mono">
                        Describe your task below to begin
                    </p>
                </motion.div>
            </div>

            {/* Hint arrow pointing down to command bar */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-600 animate-bounce"
            >
                ↓
            </motion.div>
        </div>
    );
};
