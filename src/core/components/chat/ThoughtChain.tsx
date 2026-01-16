import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { AgentThought } from '@/core/store';

interface ThoughtChainProps {
    thoughts: AgentThought[];
    messageId: string;
}

export const ThoughtChain = memo(({ thoughts, messageId }: ThoughtChainProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = `thought-chain-${messageId}`;

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className="mb-5 relative">
            <div className="absolute left-0 top-8 bottom-0 w-px bg-gradient-to-b from-purple-500/30 to-transparent" />
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="group flex items-center gap-3 mb-3 h-8 px-3 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
            >
                <div className={`w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] ${isOpen ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                    <TextEffect per='char' preset='fade'>Cognitive Logic</TextEffect>
                    <span className="text-[9px] text-gray-600 font-mono">[{thoughts.length} ITERATIONS]</span>
                </span>
                <span className={`text-gray-600 group-hover:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={12} />
                </span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, x: -5 }}
                        animate={{ height: 'auto', opacity: 1, x: 0 }}
                        exit={{ height: 0, opacity: 0, x: -5 }}
                        id={contentId}
                        role="region"
                        className="space-y-3 pl-6 overflow-hidden"
                    >
                        {thoughts.map(thought => (
                            <div key={thought.id} className="text-[11px] text-gray-400 font-mono flex items-start gap-3 leading-relaxed group/item">
                                <span className="opacity-40 mt-1 select-none text-[10px] group-hover/item:opacity-100 transition-opacity">
                                    {thought.type === 'tool' ? '⚡' : '🧠'}
                                </span>
                                <span className={`${thought.type === 'error' ? 'text-red-400' : 'text-gray-400 group-hover/item:text-gray-300'} transition-colors`}>
                                    {thought.text.length > 250 ? thought.text.substring(0, 250) + '...' : thought.text}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

ThoughtChain.displayName = 'ThoughtChain';
