import React from 'react';
import { motion } from 'motion/react';
import {
    MousePointer2,
    Eye,
    Play,
    Command,
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
import { useShallow } from 'zustand/react/shallow';

interface EmptyStateProps {
    /** Legacy: populate the prompt input box without submitting */
    onCommandClick: (cmd: string) => void;
    /** Immediately submit the command to the agent */
    onCommandSubmit: (cmd: string) => void;
}

export function EmptyState({ onCommandSubmit }: EmptyStateProps) {
    const { setModule } = useStore(useShallow(state => ({
        setModule: state.setModule
    })));

    const suggestions = [
        // Row 1 — each fires its command immediately on click
        { icon: Eye, title: 'Analyze Brand', prompt: 'Audit my current visual brand and give me a detailed brand identity report with specific improvement recommendations.' },
        { icon: Play, title: 'Create Video', prompt: "Generate a creative brief and shot list for a music video for my latest track, then kick off the video generation pipeline." },
        { icon: Command, title: 'Build Release', prompt: 'Walk me through preparing a new distribution release: gather my track metadata, run QC checks, and stage it for distribution.' },
        { icon: PenTool, title: 'Write Copy', prompt: 'Draft a compelling press release for my upcoming single, including a hook, artist bio blurb, and key talking points for media outreach.' },
        { icon: Image, title: 'Design Cover', prompt: 'Generate several album artwork concepts for my new EP. Ask me about the vibe, genre, and visual references before generating.' },
        // Row 2
        { icon: MapPin, title: 'Scout Venues', prompt: 'Find suitable live music venues for my next tour. Ask me about my preferred cities, capacity range, and tour dates.' },
        { icon: Megaphone, title: 'Plan Campaign', prompt: 'Build a detailed 30-day social media launch plan for my upcoming release, with platform-specific strategies and a content calendar.' },
        { icon: FileCheck, title: 'Review Contract', prompt: 'Analyze my latest licensing agreement for red flags, unfavorable clauses, and key terms I should negotiate. Ask me to share the document.' },
        { icon: TrendingUp, title: 'Track Revenue', prompt: 'Show me a summary of my royalty earnings this quarter broken down by platform, territory, and track.' },
        // Custom Workflow — navigates instead of submitting
        {
            icon: Network,
            title: 'Custom Workflow',
            prompt: null,
            action: () => setModule('workflow'),
        },
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-8 max-w-6xl mx-auto w-full">
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
                        onClick={() => {
                            if (s.action) {
                                s.action();
                            } else if (s.prompt) {
                                onCommandSubmit(s.prompt);
                            }
                        }}
                        className="group relative flex flex-col p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 text-left overflow-hidden h-full"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 size={12} className="text-indigo-400" />
                        </div>
                        <s.icon size={22} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-xs font-semibold text-white tracking-wide mb-1.5">{s.title}</h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-normal group-hover:text-slate-300 transition-colors line-clamp-2">
                            {s.action ? 'Build your own automation pipeline' : s.prompt?.split('.')[0]}
                        </p>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
