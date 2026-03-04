import React from 'react';
import { motion } from 'motion/react';
import { Brain, Command, Play, MousePointer2 } from 'lucide-react';

interface EmptyStateProps {
    onCommandClick: (cmd: string) => void;
}

export function EmptyState({ onCommandClick }: EmptyStateProps) {
    const suggestions = [
        { icon: Brain, title: "Analyze Brand", cmd: "Audit my current visual brand" },
        { icon: Play, title: "Create Video", cmd: "Generate a music video for 'Lost in Space'" },
        { icon: Command, title: "Build Release", cmd: "Prepare a new distribution release" },
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-dept-marketing to-dept-marketing/50 flex items-center justify-center shadow-2xl shadow-dept-marketing/20 border border-white/20 mb-8"
            >
                <Brain size={40} className="text-white drop-shadow-lg" />
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-black text-white tracking-tighter uppercase italic text-center leading-none"
            >
                Agent Zero <span className="text-dept-marketing">Active</span>
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4 mb-12 text-center"
            >
                IndiiOS Dynamic Orchestrator • Global Control Interface
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-4">
                {suggestions.map((s, i) => (
                    <motion.button
                        key={s.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        onClick={() => onCommandClick(s.cmd)}
                        className="group relative flex flex-col p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-dept-marketing/30 transition-all duration-300 text-left overflow-hidden h-full"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 size={12} className="text-dept-marketing" />
                        </div>
                        <s.icon size={24} className="text-dept-marketing mb-4 group-hover:scale-110 transition-transform" />
                        <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2">{s.title}</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-bold group-hover:text-gray-400 transition-colors uppercase tracking-tight">{s.cmd}</p>
                    </motion.button>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-12 flex items-center gap-4 text-gray-700 font-black italic text-[9px] uppercase tracking-[0.3em]"
            >
                <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gray-800" />
                    <span>Neural Link Established</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gray-800" />
                    <span>Vertex AI Connected</span>
                </div>
            </motion.div>
        </div>
    );
}
