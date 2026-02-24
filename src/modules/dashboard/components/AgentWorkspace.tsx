import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { motion } from 'motion/react';
import { Bot, Cpu, Clock, Sparkles } from 'lucide-react';

/* ── Chat primitives ── */
import { MessageItem } from '@/core/components/chat/ChatMessage';

/* ── Side-panel widgets ── */
import AssetSpotlight from './AssetSpotlight';
import RecentProjects from './RecentProjects';
import ActivityFeed from './ActivityFeed';

// ─── Stable session start ────────────────────────────────────────────
const SESSION_START = Date.now();

function useUptime(startMs: number) {
    const [uptime, setUptime] = useState('');
    useEffect(() => {
        const tick = () => {
            const s = Math.floor((Date.now() - startMs) / 1000);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setUptime(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [startMs]);
    return uptime;
}

/* ================================================================== */
/*  AgentWorkspace — HQ: center chat + side widget panels              */
/* ================================================================== */
export default function AgentWorkspace() {
    const {
        agentHistory,
        userProfile,
        isAgentProcessing,
    } = useStore(
        useShallow((s) => ({
            agentHistory: s.agentHistory,
            userProfile: s.userProfile,
            isAgentProcessing: s.isAgentProcessing,
        }))
    );

    const uptime = useUptime(SESSION_START);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [agentHistory.length]);

    return (
        <div className="absolute inset-0 flex">
            {/* ── LEFT PANEL — Projects & Activity ─────────────────── */}
            <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <RecentProjects />
                <ActivityFeed />
            </aside>

            {/* ── CENTER — Flat chat ──────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white leading-none">indii</h2>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                {isAgentProcessing ? 'Thinking…' : 'Ready to help'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <StatusPill icon={<Cpu size={10} />} label="Active" dot="bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                        <StatusPill icon={<Clock size={10} />} label={uptime} dot="bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]" />
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {agentHistory.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-1">
                            {agentHistory.map((msg) => (
                                <MessageItem
                                    key={msg.id}
                                    msg={msg}
                                    avatarUrl={msg.role === 'user' ? (userProfile?.photoURL ?? undefined) : undefined}
                                />
                            ))}
                            {isAgentProcessing && (
                                <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-xs">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                    >
                                        <Sparkles size={14} className="text-purple-400" />
                                    </motion.div>
                                    indii is thinking…
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  EmptyState                                                          */
/* ================================================================== */
function EmptyState() {
    const suggestions = [
        { text: 'Generate album cover art', emoji: '🎨' },
        { text: 'Write a press release', emoji: '📝' },
        { text: 'Help me plan a tour', emoji: '🗺️' },
        { text: 'Review my distribution strategy', emoji: '📊' },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-5 shadow-xl shadow-purple-500/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
            >
                <Bot size={28} className="text-white" />
            </motion.div>
            <h2 className="text-lg font-bold text-white mb-1">What can I help you create?</h2>
            <p className="text-xs text-gray-500 mb-6 max-w-sm">
                Generate images, produce videos, write marketing copy, manage releases, and more.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md">
                {suggestions.map((s, i) => (
                    <motion.button
                        key={s.text}
                        onClick={() => useStore.setState({ commandBarInput: s.text })}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-white/8 transition-all text-left text-xs text-gray-300"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                    >
                        <span className="text-base">{s.emoji}</span>
                        {s.text}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  StatusPill                                                          */
/* ================================================================== */
function StatusPill({ icon, label, dot }: { icon: React.ReactNode; label: string; dot: string }) {
    return (
        <div className="text-[10px] text-stone-500 flex items-center gap-1.5 bg-[#161b22] px-2.5 py-1.5 rounded-full border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {icon}
            <span>{label}</span>
        </div>
    );
}
