import React from 'react';
import { Globe2, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const GodModeCanvas: React.FC = () => {
    // Mock "God Mode" View (Item 199)
    return (
        <div className="w-full h-screen bg-[#050505] relative overflow-hidden flex flex-col cursor-move">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="absolute top-8 left-8 z-20 flex items-center gap-3">
                <div className="p-2 bg-white text-black rounded-lg">
                    <Globe2 size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter">GOD MODE</h1>
                    <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mt-1">Ecosystem Overview</p>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 z-20">
                <button className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur transition-all">
                    <Maximize2 size={20} />
                </button>
            </div>

            <motion.div
                drag
                dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                className="w-full h-full flex items-center justify-center relative"
            >
                {/* Central Node */}
                <div className="absolute w-40 h-40 bg-white/5 border border-white/20 rounded-3xl flex items-center justify-center backdrop-blur-xl z-10 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-white rounded-full mx-auto mb-3" />
                        <h3 className="font-bold text-white">Artist Nucleus</h3>
                    </div>
                </div>

                {/* Satellite Nodes */}
                <div className="absolute -top-32 left-32 w-32 h-32 bg-pink-500/10 border border-pink-500/30 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-pink-400 font-bold mb-1">Catalog</span>
                    <span className="text-xs text-pink-200/50">14 Tracks</span>
                </div>

                <div className="absolute top-32 -left-48 w-32 h-32 bg-green-500/10 border border-green-500/30 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-green-400 font-bold mb-1">Treasury</span>
                    <span className="text-xs text-green-200/50">$12,450 YTD</span>
                </div>

                <div className="absolute -bottom-24 right-20 w-32 h-32 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-blue-400 font-bold mb-1">Audience</span>
                    <span className="text-xs text-blue-200/50">84k MAU</span>
                </div>
            </motion.div>
        </div>
    );
};
