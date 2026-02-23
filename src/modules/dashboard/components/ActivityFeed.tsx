import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    MessageSquare, Bot, Sparkles, Zap, Clock,
} from 'lucide-react';

interface FeedItem {
    id: string;
    icon: React.ReactNode;
    text: string;
    time: string;
    color: string;
}

export default function ActivityFeed() {
    const { agentHistory, sessions, activeSessionId } = useStore(
        useShallow((s) => ({
            agentHistory: s.agentHistory,
            sessions: s.sessions,
            activeSessionId: s.activeSessionId,
        }))
    );

    const feedItems = useMemo<FeedItem[]>(() => {
        const items: FeedItem[] = [];

        // Pull recent messages (last 6)
        const recent = agentHistory.slice(-6).reverse();
        for (const msg of recent) {
            const isAgent = msg.role === 'model';
            items.push({
                id: msg.id,
                icon: isAgent
                    ? <Bot size={12} className="text-purple-400" />
                    : <MessageSquare size={12} className="text-blue-400" />,
                text: isAgent
                    ? `indii responded: "${truncate(msg.text, 55)}"`
                    : `You asked: "${truncate(msg.text, 55)}"`,
                time: formatTime(msg.timestamp),
                color: isAgent ? 'border-l-purple-500/40' : 'border-l-blue-500/40',
            });
        }

        // Count sessions
        const sessionCount = Object.keys(sessions).length;
        if (sessionCount > 0) {
            items.push({
                id: 'sessions',
                icon: <Sparkles size={12} className="text-amber-400" />,
                text: `${sessionCount} conversation${sessionCount !== 1 ? 's' : ''} this session`,
                time: '',
                color: 'border-l-amber-500/40',
            });
        }

        // System boot entry
        items.push({
            id: 'boot',
            icon: <Zap size={12} className="text-green-400" />,
            text: 'System initialized — all departments online',
            time: '',
            color: 'border-l-green-500/40',
        });

        return items.slice(0, 7);
    }, [agentHistory, sessions]);

    return (
        <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-gray-400" />
                <h3 className="text-sm font-bold text-white">Activity</h3>
            </div>

            {/* Feed */}
            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                {feedItems.map((item, i) => (
                    <motion.div
                        key={item.id}
                        className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border-l-2 ${item.color} bg-black/10 hover:bg-white/5 transition-colors`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                    >
                        <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-gray-300 leading-relaxed">{item.text}</p>
                            {item.time && (
                                <p className="text-[9px] text-gray-600 mt-0.5">{item.time}</p>
                            )}
                        </div>
                    </motion.div>
                ))}

                {feedItems.length <= 2 && (
                    <div className="text-center py-4">
                        <p className="text-[10px] text-gray-600 italic">
                            Start a conversation with indii to see activity here
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function truncate(s: string, max: number): string {
    if (!s) return '';
    const clean = s.replace(/\n/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
