import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, ShieldAlert } from 'lucide-react';
import { secureRandomInt } from '@/utils/crypto-random';

interface MissionBriefProps {
    onAccept: () => void;
}

export const MissionBrief = ({ onAccept }: MissionBriefProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center"
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="mb-8 relative"
            >
                <div className="absolute inset-0 bg-[#FF00FF] blur-[50px] opacity-20 animate-pulse" />
                <ShieldAlert className="w-24 h-24 text-[#FF00FF] animate-pulse drop-shadow-[0_0_15px_rgba(255,0,255,0.8)] relative z-10" />
            </motion.div>

            <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-4xl md:text-5xl font-bold mb-6 tracking-widest uppercase text-[#FF00FF] drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]"
            >
                Genesis Launch
            </motion.h1>

            <div className="space-y-6 text-lg md:text-xl mb-12 font-mono text-left bg-black/80 p-8 border border-[#00FF00]/50 rounded-lg shadow-[0_0_30px_rgba(0,255,0,0.15)] relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00FF00] to-transparent opacity-50" />
                <DecodeText text="> ATTENTION FOUNDING ARCHITECT..." delay={1000} />
                <DecodeText text="> THE SOVEREIGN ENGINE REQUIRES IGNITION." delay={2500} />
                <DecodeText text="> PROTOCOL: DETROIT 8 INIT." delay={4000} />
                <DecodeText text="> STATUS: AWAITING NODE AUTHORIZATION." delay={5500} />
            </div>

            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 7.5 }}
                onClick={onAccept}
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0, 255, 0, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                className="px-10 py-5 bg-[#00FF00]/10 border-2 border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00] hover:text-black transition-all duration-300 rounded font-bold tracking-widest uppercase text-xl flex items-center gap-4 group shadow-[0_0_15px_rgba(0,255,0,0.3)]"
            >
                <Terminal className="w-6 h-6 group-hover:animate-bounce" />
                <span>Engage Sovereign Node</span>
            </motion.button>
        </motion.div>
    );
};

const DecodeText = ({ text, delay }: { text: string; delay: number }) => {
    const [visibleText, setVisibleText] = React.useState('');
    const [started, setStarted] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    React.useEffect(() => {
        if (!started) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*<>[]{}';
        let iteration = 0;

        const interval = setInterval(() => {
            setVisibleText(text.split('').map((letter, index) => {
                if (index < iteration) {
                    return text[index];
                }
                return chars[secureRandomInt(0, chars.length - 1)];
            }).join(''));

            if (iteration >= text.length) {
                clearInterval(interval);
            }
            iteration += 1 / 2; // Decodes somewhat fast
        }, 30);

        return () => clearInterval(interval);
    }, [text, started]);

    if (!started) return <div className="h-6 md:h-7" />; // Placeholder to prevent layout shift

    return (
        <div className="font-mono text-[#00FF00] drop-shadow-[0_0_8px_rgba(0,255,0,0.8)]">
            {visibleText}
        </div>
    );
};
