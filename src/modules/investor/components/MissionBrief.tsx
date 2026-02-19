import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, ShieldAlert } from 'lucide-react';

interface MissionBriefProps {
    onAccept: () => void;
}

export const MissionBrief = ({ onAccept }: MissionBriefProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center"
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="mb-8"
            >
                <ShieldAlert className="w-24 h-24 text-red-500 animate-pulse" />
            </motion.div>

            <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-4xl md:text-5xl font-bold mb-6 tracking-widest uppercase text-red-500"
            >
                Mission Critical
            </motion.h1>

            <div className="space-y-4 text-lg md:text-xl text-green-500/80 mb-12 font-mono text-left bg-black/50 p-6 border border-green-900 rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.1)]">
                <TypingText text="> ATTENTION FOUNDING ARCHITECT..." delay={1000} />
                <TypingText text="> THE AGENCY REQUIRES YOUR IMMEDIATE INTERVENTION." delay={2500} />
                <TypingText text="> PROTOCOL: DETROIT 8 INIT." delay={4000} />
                <TypingText text="> STATUS: AWAITING AUTHORIZATION." delay={5500} />
            </div>

            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 7 }}
                onClick={onAccept}
                className="px-8 py-4 bg-green-900/20 border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-all duration-300 rounded font-bold tracking-widest uppercase text-xl flex items-center gap-3 group"
            >
                <Terminal className="w-6 h-6" />
                <span>Initialize Protocol</span>
            </motion.button>
        </motion.div>
    );
};

const TypingText = ({ text, delay }: { text: string; delay: number }) => {
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    if (!visible) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="border-r-2 border-green-500 pr-2 animate-pulse w-fit whitespace-nowrap overflow-hidden"
            style={{ animation: 'typing 3.5s steps(40, end), blink-caret .75s step-end infinite' }}
        >
            {text}
        </motion.div>
    );
};
