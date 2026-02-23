import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { motion } from 'motion/react';
import { CheckCircle, Cpu, Zap, Clock } from 'lucide-react';

/* ── Widgets ──────────────────────────────────────────────────────── */
import StatsRibbon from './StatsRibbon';
import RecentProjects from './RecentProjects';
import ActivityFeed from './ActivityFeed';
import AssetSpotlight from './AssetSpotlight';

// ─── Stable session start ────────────────────────────────────────────
const SESSION_START = Date.now();

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
/*  AgentWorkspace — HQ Dashboard                                      */
/* ================================================================== */
export default function AgentWorkspace() {
    const { currentModule, agentHistory, userProfile } = useStore(
        useShallow((s) => ({
            currentModule: s.currentModule,
            agentHistory: s.agentHistory,
            userProfile: s.userProfile,
        }))
    );

    const uptime = useUptime(SESSION_START);
    const messageCount = agentHistory.length;
    const firstName = (userProfile?.displayName ?? 'Creator').split(' ')[0];

    return (
        <div className="max-w-5xl mx-auto space-y-4 px-2">
            {/* Header */}
            <div className="flex items-end justify-between">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-xl font-bold text-white mb-0.5">
                        Good {getGreeting()}, {firstName}.
                    </h1>
                    <p className="text-xs text-stone-400">
                        Here's what's happening across your workspace.
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

            {/* Asset Spotlight — browse your creations */}
            <AssetSpotlight />

            {/* Projects + Activity side by side */}
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
