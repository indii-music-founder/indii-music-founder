import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StudioLayoutProps {
    children: ReactNode;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-coral-500/30">
            {/* Cinematic Background Gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[150px]" />
                <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[80%] h-[40%] bg-coral-500/5 rounded-full blur-[120px] opacity-50" />
            </div>

            {/* Glass Overlay/Noise Texture if desired */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none mix-blend-overlay" />

            {/* Content Container */}
            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 w-full h-screen flex flex-col"
            >
                {/* Header Area placeholder */}
                {/* <header className="h-16 border-b border-white/5 backdrop-blur-md sticky top-0 z-50 flex items-center px-6">
                    <div className="font-bold tracking-widest uppercase text-xs text-white/40">Studio OS</div>
                </header> */}

                <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    {children}
                </div>
            </motion.main>
        </div>
    );
};
