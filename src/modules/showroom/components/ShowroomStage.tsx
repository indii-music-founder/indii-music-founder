import React from 'react';
import { motion } from 'framer-motion';
import { Play, Camera, Loader2, Sparkles, Monitor } from 'lucide-react';

interface ShowroomStageProps {
    mockupImage: string | null;
    videoUrl: string | null;
    isGenerating: boolean;
    onGenerate: () => void;
    onAnimate: () => void;
    canGenerate: boolean;
    canAnimate: boolean;
}

export default function ShowroomStage({
    mockupImage,
    videoUrl,
    isGenerating,
    onGenerate,
    onAnimate,
    canGenerate,
    canAnimate
}: ShowroomStageProps) {
    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] p-6 relative overflow-hidden backdrop-blur-2xl">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/10 via-black to-purple-900/10 pointer-events-none" />

            <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="h-8 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full" />
                <h2 className="text-xl font-bold text-white tracking-tight">The Stage</h2>
            </div>

            {/* Monitor */}
            <div className="flex-1 relative z-10 mb-8 min-h-0">
                <div className="w-full h-full bg-black rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group">
                    {/* Screen Content */}
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        {isGenerating ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
                                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin relative z-10" />
                                </div>
                                <span className="text-sm font-medium text-blue-400 animate-pulse uppercase tracking-widest">
                                    Rendering Reality...
                                </span>
                            </div>
                        ) : videoUrl ? (
                            <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-lg shadow-2xl" />
                        ) : mockupImage ? (
                            <motion.img
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                src={mockupImage}
                                alt="Mockup"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        ) : (
                            <div className="relative w-64 h-64 perspective-1000">
                                <div className="w-full h-full relative preserve-3d animate-spin-slow">
                                    {/* Front */}
                                    <div className="absolute inset-0 bg-yellow-400/20 border border-yellow-400/50 rounded-xl backdrop-blur-md flex items-center justify-center transform translate-z-32">
                                        <div className="text-yellow-400 font-bold text-4xl">FRONT</div>
                                    </div>
                                    {/* Back */}
                                    <div className="absolute inset-0 bg-yellow-400/20 border border-yellow-400/50 rounded-xl backdrop-blur-md flex items-center justify-center transform -translate-z-32 rotate-y-180">
                                        <div className="text-yellow-400 font-bold text-4xl">BACK</div>
                                    </div>
                                    {/* Sides (Visuals only) */}
                                    <div className="absolute inset-y-0 left-1/2 w-64 h-full bg-yellow-400/10 border-x border-yellow-400/30 transform -translate-x-1/2 rotate-y-90" />
                                </div>
                                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center w-full">
                                    <p className="text-sm font-mono text-yellow-500/80 animate-pulse">Awaiting Design Input</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scanlines Effect */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-overlay" />
                    <div className="absolute inset-x-0 top-0 h-px bg-white/10 shadow-[0_0_20px_white] animate-scanline pointer-events-none" />
                </div>
            </div>

            {/* Controls */}
            <div className="h-20 flex items-center justify-center gap-6 relative z-10">
                <motion.button
                    onClick={onGenerate}
                    disabled={!canGenerate || isGenerating}
                    whileHover={canGenerate ? { scale: 1.05, y: -2 } : {}}
                    whileTap={canGenerate ? { scale: 0.95 } : {}}
                    className={`
                        group relative px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all duration-300
                        ${canGenerate
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:bg-blue-500'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'}
                    `}
                >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                    <Camera className={`w-5 h-5 ${canGenerate ? 'text-white' : 'text-gray-600'}`} />
                    <span className="tracking-wide">Generate Mockup</span>
                </motion.button>

                <div className="w-px h-12 bg-white/10" />

                <motion.button
                    onClick={onAnimate}
                    disabled={!canAnimate || isGenerating}
                    whileHover={canAnimate ? { scale: 1.05, y: -2 } : {}}
                    whileTap={canAnimate ? { scale: 0.95 } : {}}
                    className={`
                        group relative px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all duration-300 overflow-hidden
                        ${canAnimate
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:bg-purple-500'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'}
                    `}
                >
                    {canAnimate && (
                        <div className="absolute inset-0 bg-[size:200%_200%] animate-gradient bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    <span className="relative z-10 flex items-center gap-3">
                        <Play className={`w-5 h-5 ${canAnimate ? 'text-white fill-current' : 'text-gray-600'}`} />
                        <span className="tracking-wide">Walk Runway</span>
                        {canAnimate && <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />}
                    </span>
                </motion.button>
            </div>
        </div>
    );
}
