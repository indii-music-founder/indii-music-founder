import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, Briefcase } from 'lucide-react';

export const GenerativeUIMorpher: React.FC = () => {
    // Mock Generative UI Morphing (Item 193)
    const [role, setRole] = useState<'artist' | 'manager'>('artist');

    return (
        <div className="p-8 bg-black min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-white/10">
            <div className="absolute top-4 right-4 flex gap-2 bg-white/5 p-1 rounded-xl backdrop-blur-md z-20">
                <button
                    onClick={() => setRole('artist')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${role === 'artist' ? 'bg-purple-600 text-white' : 'text-white/50 hover:bg-white/10'}`}
                >
                    <Mic2 size={16} /> Artist Mode
                </button>
                <button
                    onClick={() => setRole('manager')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${role === 'manager' ? 'bg-blue-600 text-white' : 'text-white/50 hover:bg-white/10'}`}
                >
                    <Briefcase size={16} /> Manager Mode
                </button>
            </div>

            <AnimatePresence mode="wait">
                {role === 'artist' ? (
                    <motion.div
                        key="artist-ui"
                        initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/20 p-8 rounded-3xl"
                    >
                        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Creative Studio</h2>
                        <p className="text-purple-200/60 mb-8">Your canvas is ready. Let's make some magic.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-32 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex items-center justify-center text-purple-400 font-mono text-sm">Drop Audio Here</div>
                            <div className="h-32 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex items-center justify-center text-purple-400 font-mono text-sm">Generate Artwork</div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="manager-ui"
                        initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-2xl bg-gradient-to-br from-blue-900/40 to-black border border-blue-500/20 p-8 rounded-3xl"
                    >
                        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Executive Dashboard</h2>
                        <p className="text-blue-200/60 mb-8">Global telemetry and financial forecasting active.</p>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 h-40 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center text-blue-400 font-mono text-sm">Revenue Waterfall Chart</div>
                            <div className="col-span-1 h-40 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center text-blue-400 font-mono text-sm">Pending Deals (3)</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
