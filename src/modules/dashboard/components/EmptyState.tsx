import React from 'react';
import { motion } from 'motion/react';
import {
    Command,
    Play,
    MousePointer2,
    Eye,
    PenTool,
    Image,
    MapPin,
    Megaphone,
    FileCheck,
    TrendingUp,
    Network,
} from 'lucide-react';
import { IndiiFavicon } from '@/components/shared/IndiiFavicon';
import { useStore } from '@/core/store';

interface EmptyStateProps {
    onCommandClick: (cmd: string) => void;
}

export function EmptyState({ onCommandClick }: EmptyStateProps) {
    const setModule = useStore(state => state.setModule);

    const suggestions = [
        // Row 1
        { icon: Eye, title: "Analyze Brand", cmd: "Audit my current visual brand" },
        { icon: Play, title: "Create Video", cmd: "Generate a music video for 'Lost in Space'" },
        { icon: Command, title: "Build Release", cmd: "Prepare a new distribution release" },
        { icon: PenTool, title: "Write Copy", cmd: "Draft press release for my upcoming single" },
        { icon: Image, title: "Design Cover", cmd: "Create album artwork for my new EP" },
        // Row 2
        { icon: MapPin, title: "Scout Venues", cmd: "Find suitable live music venues for my next tour" },
        { icon: Megaphone, title: "Plan Campaign", cmd: "Build a 30-day social media launch plan" },
        { icon: FileCheck, title: "Review Contract", cmd: "Analyze my latest licensing agreement" },
        { icon: TrendingUp, title: "Track Revenue", cmd: "Show me my royalty earnings this quarter" },
        { icon: Network, title: "Custom Workflow", cmd: "Build your own automation pipeline", action: () => setModule('workflow') },
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-6xl mx-auto w-full">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 flex items-center justify-center shadow-2xl shadow-indigo-500/10 border border-white/10 mb-6 overflow-hidden"
            >
                <IndiiFavicon size={44} />
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-3xl font-semibold text-white tracking-wide text-center leading-none"
            >
                indiiOS
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-indigo-200/60 font-medium uppercase tracking-[0.15em] text-[10px] mt-4 mb-10 text-center"
            >
                Your AI Creative Engine • What Would You Like To Do?
            </motion.p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full px-4">
                {suggestions.map((s, i) => (
                    <motion.button
                        key={s.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        onClick={() => s.action ? s.action() : onCommandClick(s.cmd)}
                        className="group relative flex flex-col p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 text-left overflow-hidden h-full"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 size={12} className="text-indigo-400" />
                        </div>
                        <s.icon size={22} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-xs font-semibold text-white tracking-wide mb-1.5">{s.title}</h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-normal group-hover:text-slate-300 transition-colors line-clamp-2">{s.cmd}</p>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
