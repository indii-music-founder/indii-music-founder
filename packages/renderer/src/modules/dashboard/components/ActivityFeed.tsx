import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    MessageSquare, Bot, Sparkles, Zap, Clock, CheckCircle, Package, AlertCircle
} from 'lucide-react';
import { events, EventType, AgentActionEvent, SystemAlertEvent } from '@/core/events';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

/** Union of all payloads ActivityFeed handles. */
type ActivityEventPayload =
    | AgentActionEvent
    | SystemAlertEvent
    | { title?: string }        // TASK_COMPLETED
    | { name?: string };        // ASSET_FINALIZED

interface FeedItem {
    id: string;
    icon: React.ReactNode;
    text: string;
    time: string;
    color: string;
    timestamp: number;
}

export default function ActivityFeed() {
    const { agentHistory, sessions } = useStore(
        useShallow((s) => ({
            agentHistory: s.agentHistory,
            sessions: s.sessions,
        }))
    );

    const [customEvents, setCustomEvents] = React.useState<FeedItem[]>([]);

    React.useEffect(() => {
        const handleEvent = (type: EventType, data: ActivityEventPayload) => {
            const id = `event-${Date.now()}-${secureRandomAlphanumeric(9)}`;
            let item: FeedItem | null = null;

            switch (type) {
                case 'TASK_COMPLETED':
                    item = {
                        id,
                        icon: <CheckCircle size={12} className="text-green-400" />,
                        text: `Task completed: ${'title' in data && data.title ? data.title : 'Process finished'}`,
                        time: formatTime(Date.now()),
                        color: 'border-l-green-500/40',
                        timestamp: Date.now()
                    };
                    break;
                case 'ASSET_FINALIZED':
                    item = {
                        id,
                        icon: <Package size={12} className="text-blue-400" />,
                        text: `Asset finalized: ${'name' in data && data.name ? data.name : 'New media created'}`,
                        time: formatTime(Date.now()),
                        color: 'border-l-blue-500/40',
                        timestamp: Date.now()
                    };
                    break;
                case 'SYSTEM_ALERT': {
                    const alert = data as SystemAlertEvent;
                    item = {
                        id,
                        icon: <AlertCircle size={12} className={alert.level === 'error' ? 'text-red-400' : 'text-amber-400'} />,
                        text: alert.message,
                        time: formatTime(Date.now()),
                        color: alert.level === 'error' ? 'border-l-red-500/40' : 'border-l-amber-500/40',
                        timestamp: Date.now()
                    };
                    break;
                }
                case 'AGENT_ACTION': {
                    const action = data as AgentActionEvent;
                    item = {
                        id,
                        icon: <Zap size={12} className="text-purple-400" />,
                        text: `${action.action}: ${action.details}`,
                        time: formatTime(Date.now()),
                        color: 'border-l-purple-500/40',
                        timestamp: Date.now()
                    };
                    break;
                }
            }

            if (item) {
                setCustomEvents(prev => [item!, ...prev].slice(0, 10));
            }
        };

        const types: EventType[] = ['TASK_COMPLETED', 'ASSET_FINALIZED', 'SYSTEM_ALERT', 'AGENT_ACTION'];
        types.forEach(t => events.on<ActivityEventPayload>(t, (data) => handleEvent(t, data)));

        return () => {
            types.forEach(t => events.off<ActivityEventPayload>(t, (data) => handleEvent(t, data)));
        };

    }, []);

    const feedItems = useMemo<FeedItem[]>(() => {
        const items: FeedItem[] = [...customEvents];

        // Pull recent messages (last 4 to make room for events)
        const recent = agentHistory.slice(-4).reverse();
        for (const msg of recent) {
            const isAgent = msg.role === 'model';
            items.push({
                id: msg.id,
                icon: isAgent
                    ? <Bot size={12} className="text-purple-400" />
                    : <MessageSquare size={12} className="text-blue-400" />,
                text: isAgent
                    ? `indii: "${truncate(msg.text, 50)}"`
                    : `You: "${truncate(msg.text, 50)}"`,
                time: formatTime(msg.timestamp),
                color: isAgent ? 'border-l-purple-500/40' : 'border-l-blue-500/40',
                timestamp: msg.timestamp
            });
        }

        // Add boot message if empty
        if (items.length === 0) {
            items.push({
                id: 'boot',
                icon: <Zap size={12} className="text-green-400" />,
                text: 'System initialized — awaiting input',
                time: '',
                color: 'border-l-green-500/40',
                timestamp: 0 // Always at the bottom
            });
        }

        return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
    }, [agentHistory, customEvents]);

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
