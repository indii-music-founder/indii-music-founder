import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, AgentMessage } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import {
    CheckCircle, Cpu, Zap, Clock, MessageSquare,
    ArrowLeft, Send, Bot, Sparkles,
} from 'lucide-react';

/* ── Widgets ──────────────────────────────────────────────────────── */
import QuickActions from './QuickActions';
import { HubMap } from './HubMap';
import StatsRibbon from './StatsRibbon';
import RecentProjects from './RecentProjects';
import ActivityFeed from './ActivityFeed';
import AssetSpotlight from './AssetSpotlight';

/* ── Chat primitives (reused from ChatOverlay) ────────────────────── */
import { PromptArea } from '@/core/components/command-bar/PromptArea';
import { MessageItem } from '@/core/components/chat/ChatMessage';

// ─── Stable session start ────────────────────────────────────────────
const SESSION_START = Date.now();

type DashMode = 'hq' | 'chat';

/* ================================================================== */
/*  useUptime — live session clock                                     */
/* ================================================================== */
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

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

/* ================================================================== */
/*  AgentWorkspace — HQ Dashboard with dual-mode layout                */
/* ================================================================== */
export default function AgentWorkspace() {
    const {
        currentModule,
        agentHistory,
        userProfile,
        isAgentOpen,
        toggleAgentWindow,
        isAgentProcessing,
    } = useStore(
        useShallow((s) => ({
            currentModule: s.currentModule,
            agentHistory: s.agentHistory,
            userProfile: s.userProfile,
            isAgentOpen: s.isAgentOpen,
            toggleAgentWindow: s.toggleAgentWindow,
            isAgentProcessing: s.isAgentProcessing,
        }))
    );

    const [mode, setMode] = useState<DashMode>('hq');
    const uptime = useUptime(SESSION_START);
    const messageCount = agentHistory.length;
    const firstName = (userProfile?.displayName ?? 'Creator').split(' ')[0];

    /* ── auto-scroll chat ─────────────────────────────────────────── */
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (mode === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [agentHistory.length, mode]);

    /* ── switch to chat ───────────────────────────────────────────── */
    const enterChat = useCallback(() => {
        setMode('chat');
        // Make sure the ChatOverlay (prompt area) is ready
        if (!isAgentOpen) toggleAgentWindow();
    }, [isAgentOpen, toggleAgentWindow]);

    /* ================================================================ */
    /*  CHAT MODE                                                       */
    /* ================================================================ */
    if (mode === 'chat') {
        return (
            <div className="max-w-6xl mx-auto h-full flex flex-col">
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMode('hq')}
                            className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <Bot size={14} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white leading-none">indii</h2>
                                <p className="text-[10px] text-gray-500">
                                    {isAgentProcessing ? 'Thinking…' : 'Ready to help'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <StatusPill icon={<Cpu size={10} />} label="Active" dotColor="bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                        <StatusPill icon={<Clock size={10} />} label={uptime} dotColor="bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]" />
                    </div>
                </div>

                {/* Main chat layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Chat messages */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                            {agentHistory.length === 0 ? (
                                <ChatEmptyState onQuickAction={(_prompt: string) => {
                                    useStore.setState({ commandBarInput: _prompt });
                                }} />
                            ) : (
                                agentHistory.map((msg) => (
                                    <MessageItem
                                        key={msg.id}
                                        msg={msg}
                                        avatarUrl={msg.role === 'user' ? (userProfile?.photoURL ?? undefined) : undefined}
                                    />
                                ))
                            )}
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
                            <div ref={chatEndRef} />
                        </div>
                        {/* Prompt area */}
                        <div className="flex-shrink-0 border-t border-white/5 p-3">
                            <PromptArea className="max-w-3xl mx-auto" />
                        </div>
                    </div>

                    {/* Side panel — assets & quick access */}
                    <div className="hidden lg:flex w-80 xl:w-96 flex-col border-l border-white/5 overflow-y-auto">
                        <div className="p-3 space-y-3">
                            <AssetSpotlightCompact />
                            <QuickActions />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ================================================================ */
    /*  HQ DASHBOARD MODE                                               */
    /* ================================================================ */
    return (
        <div className="max-w-5xl mx-auto space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-end justify-between px-2">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-xl font-bold text-white mb-0.5">
                        Good {getGreeting()}, {firstName}.
                    </h1>
                    <p className="text-xs text-stone-400">
                        Your creative network is active — click any department to begin.
                    </p>
                </motion.div>
                <motion.div
                    className="flex gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <StatusPill
                        icon={<Cpu size={10} />}
                        label="System Active"
                        dotColor="bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                    />
                    <StatusPill
                        icon={<Clock size={10} />}
                        label={uptime}
                        dotColor="bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"
                    />
                </motion.div>
            </div>

            {/* Stats Ribbon */}
            <StatsRibbon />

            {/* Quick Actions */}
            <QuickActions />

            {/* Chat CTA + conversation preview */}
            <ChatCTA messageCount={messageCount} onEnterChat={enterChat} />

            {/* Asset Spotlight — browse your creations */}
            <AssetSpotlight />

            {/* Hub Map — interactive department network */}
            <div className="h-[52vh] min-h-[340px]">
                <HubMap />
            </div>

            {/* Bottom row — Projects + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RecentProjects />
                <ActivityFeed />
            </div>

            {/* Footer metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <FooterCard
                    icon={<CheckCircle size={13} className="text-green-400" />}
                    bgClass="bg-green-500/8 border-green-500/15"
                    title="Session Messages"
                    value={messageCount > 0 ? `${messageCount} exchange${messageCount !== 1 ? 's' : ''}` : 'Ready'}
                />
                <FooterCard
                    icon={<Zap size={13} className="text-indigo-400" />}
                    bgClass="bg-indigo-500/8 border-indigo-500/15"
                    title="Active Module"
                    value={currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}
                />
                <FooterCard
                    icon={<Cpu size={13} className="text-sky-400" />}
                    bgClass="bg-sky-500/8 border-sky-500/15"
                    title="Session Uptime"
                    value={uptime || '0s'}
                    className="col-span-2 md:col-span-1"
                />
            </div>
        </div>
    );
}

/* ================================================================== */
/*  ChatCTA — prominent card to start / continue chatting              */
/* ================================================================== */
function ChatCTA({ messageCount, onEnterChat }: { messageCount: number; onEnterChat: () => void }) {
    const lastMsg = useStore((s) => s.agentHistory[s.agentHistory.length - 1]);

    return (
        <motion.button
            onClick={onEnterChat}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-500/8 via-indigo-500/8 to-blue-500/8 border border-purple-500/15 hover:border-purple-500/30 transition-all group text-left"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                    <MessageSquare size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    {messageCount > 0 ? (
                        <>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-bold text-white">Continue Conversation</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                    {messageCount} message{messageCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {lastMsg && (
                                <p className="text-[11px] text-gray-500 truncate">
                                    {lastMsg.role === 'user' ? 'You' : 'indii'}: {lastMsg.text?.slice(0, 80)}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-bold text-white">Chat with indii</span>
                            <p className="text-[11px] text-gray-500">
                                Ask anything — generate art, manage your business, get creative direction.
                            </p>
                        </>
                    )}
                </div>
                <div className="flex-shrink-0 p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                    <Send size={16} />
                </div>
            </div>
        </motion.button>
    );
}

/* ================================================================== */
/*  ChatEmptyState — shown when no messages in chat mode               */
/* ================================================================== */
function ChatEmptyState({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
    const suggestions = [
        { text: 'Generate album cover art', icon: '🎨' },
        { text: 'Write a press release for my single', icon: '📝' },
        { text: 'Help me plan a tour', icon: '🗺️' },
        { text: 'Review my distribution strategy', icon: '📊' },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full py-16 text-center">
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
                I can generate images, produce videos, write marketing copy, manage your releases, and more.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md">
                {suggestions.map((s, i) => (
                    <motion.button
                        key={s.text}
                        onClick={() => onQuickAction(s.text)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-white/8 transition-all text-left text-xs text-gray-300"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                    >
                        <span className="text-base">{s.icon}</span>
                        {s.text}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  AssetSpotlightCompact — vertical list for chat sidebar             */
/* ================================================================== */
function AssetSpotlightCompact() {
    const generatedHistory = useStore((s) => s.generatedHistory);
    const setModule = useStore((s) => s.setModule);
    const setSelectedItem = useStore((s) => s.setSelectedItem);

    const assets = generatedHistory.slice(0, 6);

    if (assets.length === 0) return null;

    return (
        <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-purple-400" />
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Creations</h4>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {assets.map((a) => (
                    <button
                        key={a.id}
                        onClick={() => { setSelectedItem(a); setModule('creative'); }}
                        className="aspect-square rounded-md overflow-hidden bg-gray-900 border border-white/5 hover:border-purple-500/30 transition-colors"
                    >
                        {(a.type === 'image' || a.type === 'video') && a.url ? (
                            <img src={a.thumbnailUrl || a.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Sparkles size={14} className="text-gray-700" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Local helpers                                                       */
/* ================================================================== */
function StatusPill({ icon, label, dotColor }: { icon: React.ReactNode; label: string; dotColor: string }) {
    return (
        <div className="text-[10px] text-stone-500 flex items-center gap-1.5 bg-[#161b22] px-2.5 py-1.5 rounded-full border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            {icon}
            <span>{label}</span>
        </div>
    );
}

function FooterCard({ icon, bgClass, title, value, className = '' }: {
    icon: React.ReactNode;
    bgClass: string;
    title: string;
    value: string;
    className?: string;
}) {
    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${bgClass} ${className}`}>
            <div className="p-1.5 rounded bg-black/20">{icon}</div>
            <div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{title}</div>
                <div className="text-xs font-semibold text-gray-200 mt-0.5">{value}</div>
            </div>
        </div>
    );
}
