import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, LayoutGrid } from 'lucide-react';

interface ModeSelectorProps {
    mode: 'agent' | 'studio';
    onChange: (mode: 'agent' | 'studio') => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
    return (
        <div className="flex justify-center">
            <div className="bg-black/20 backdrop-blur-xl p-1 rounded-full border border-white/10 flex relative shadow-2xl">
                {/* Active Background Pill */}
                <motion.div
                    className="absolute top-1 bottom-1 bg-stone-700 rounded-full"
                    initial={false}
                    animate={{
                        x: mode === 'agent' ? 0 : '100%',
                        width: '50%'
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />

                <button
                    onClick={() => onChange('agent')}
                    className={`relative z-10 flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'agent' ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Sparkles size={14} />
                    <span>Talk to Indi</span>
                </button>

                <button
                    onClick={() => onChange('studio')}
                    className={`relative z-10 flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'studio' ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <LayoutGrid size={14} />
                    <span>Studio HQ</span>
                </button>
            </div>
        </div>
    );
}
