import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { AgentThought } from '@/core/store';
import { cn } from '@/lib/utils';

interface ThoughtChainProps {
    thoughts: AgentThought[];
    messageId: string;
    compact?: boolean;
}

export const ThoughtChain = memo(({ thoughts, messageId, compact }: ThoughtChainProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = `thought-chain-${messageId}`;
    const buttonId = `thought-chain-btn-${messageId}`;

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className={compact ? "mb-2 relative" : "mb-5 relative"}>
            <div className={cn("absolute left-0 w-px bg-gradient-to-b from-purple-500/30 to-transparent", compact ? "top-6 bottom-0" : "top-8 bottom-0")} />
            <button
                id={buttonId}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className={cn(
                    "group flex items-center gap-2 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all",
                    compact ? "mb-2 h-6 px-2" : "mb-3 h-8 px-3"
                )}
            >
                <div className={cn("w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]", isOpen ? 'animate-pulse' : '')} />
                <span className={cn("font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-1.5", compact ? "text-[8px]" : "text-[10px]")}>
                    <TextEffect per='char' preset='fade'>Cognitive Logic</TextEffect>
                </span>
                <span className={cn("text-gray-600 group-hover:text-gray-400 transition-transform", isOpen ? 'rotate-180' : '')}>
                    <ChevronDown size={compact ? 10 : 12} />
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
                        aria-labelledby={buttonId}
                        className="space-y-3 pl-6 overflow-hidden"
                    >
                        {thoughts.map(thought => (
                            <div key={thought.id} className="text-[11px] text-gray-400 font-mono flex items-start gap-3 leading-relaxed group/item">
                                <span className="opacity-40 mt-1 select-none text-[10px] group-hover/item:opacity-100 transition-opacity">
                                    {thought.type === 'tool' ? '⚡' : thought.type === 'error' ? ' ❌' : '🧠'}
                                </span>
                                <div className="flex-1 space-y-1">
                                    {thought.toolName && (
                                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold tracking-wide ${thought.type === 'tool'
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            : thought.type === 'error'
                                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            }`}>
                                            {thought.toolName}
                                        </span>
                                    )}
                                    <span className={`block ${thought.type === 'error' ? 'text-red-400' : 'text-gray-400 group-hover/item:text-gray-300'} transition-colors`}>
                                        {thought.text.length > 250 ? thought.text.substring(0, 250) + '...' : thought.text}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

ThoughtChain.displayName = 'ThoughtChain';
