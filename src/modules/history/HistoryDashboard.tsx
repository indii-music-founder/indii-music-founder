import React, { useMemo, useState } from 'react';
import { useStore } from '@/core/store';
import { formatSmartDate, cn } from '@/lib/utils';
import { MessageSquare, Calendar, Trash2, X, Edit2, Check, Clock, Search, Filter, Activity, FileText, Image as ImageIcon, Music, Video as VideoIcon, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationSession } from '@/core/store/slices/agent';

export default function HistoryDashboard() {
    const sessions = useStore(state => state.sessions);
    const activeSessionId = useStore(state => state.activeSessionId);
    const setActiveSession = useStore(state => state.setActiveSession);
    const deleteSession = useStore(state => state.deleteSession);
    const updateSessionTitle = useStore(state => state.updateSessionTitle);
    const fileNodes = useStore(state => state.fileNodes);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'agent' | 'file'>('all');

    // Combine sessions and files into a single unified timeline
    const timelineItems = useMemo(() => {
        const items: Array<{ type: 'agent' | 'file'; id: string; title: string; timestamp: number; data: unknown }> = [];

        if (filterType === 'all' || filterType === 'agent') {
            Object.values(sessions).forEach(session => {
                items.push({
                    type: 'agent',
                    id: session.id,
                    title: session.title || 'Temporal Stream',
                    timestamp: session.updatedAt,
                    data: session
                });
            });
        }

        if (filterType === 'all' || filterType === 'file') {
            fileNodes.forEach((file: { id: string; name: string; createdAt?: number; _mockTimestamp?: number }) => {
                // Approximate timestamp if missing, ideally files have createdAt
                items.push({
                    type: 'file',
                    id: file.id,
                    title: file.name,
                    timestamp: file.createdAt || file._mockTimestamp || parseInt(file.id, 36) % 10000000000 + 1700000000000,
                    data: file
                });
            });
        }

        // Sort descending
        return items
            .filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [sessions, fileNodes, filterType, searchQuery]);

    const getFileIcon = (fileType: string) => {
        switch (fileType) {
            case 'image': return <ImageIcon size={16} className="text-blue-400" />;
            case 'video': return <VideoIcon size={16} className="text-pink-400" />;
            case 'audio': return <Music size={16} className="text-green-400" />;
            default: return <FileText size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="flex h-full bg-background overflow-hidden relative text-white">
            {/* Ambient Background Effect */}
            <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

            {/* Left Sidebar (Filters) */}
            <div className="w-64 border-r border-white/5 bg-surface/30 backdrop-blur-xl flex flex-col z-10">
                <div className="p-6">
                    <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-2">
                        <Activity size={24} className="text-purple-500" />
                        HISTORY
                    </h1>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Unified Activity Feed</p>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <FilterItem
                        icon={Clock}
                        label="All Activity"
                        active={filterType === 'all'}
                        onClick={() => setFilterType('all')}
                    />
                    <FilterItem
                        icon={Bot}
                        label="Agent Sessions"
                        active={filterType === 'agent'}
                        onClick={() => setFilterType('agent')}
                    />
                    <FilterItem
                        icon={FileText}
                        label="Asset Creation"
                        active={filterType === 'file'}
                        onClick={() => setFilterType('file')}
                    />
                </nav>
            </div>

            {/* Main Content (Timeline) */}
            <div className="flex-1 flex flex-col z-10 min-w-0">
                {/* Search Bar */}
                <div className="h-20 border-b border-white/5 flex items-center px-8 bg-surface/20 backdrop-blur-md">
                    <div className="relative w-full max-w-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search history, agent sessions, or files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all shadow-inner"
                        />
                    </div>
                </div>

                {/* Feed */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative">
                            {/* Timeline Line */}
                            <div className="absolute left-[27px] top-4 bottom-0 w-px bg-white/10" />

                            {timelineItems.length === 0 ? (
                                <div className="text-center py-20 text-gray-500">
                                    <Clock size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium text-gray-400">No activity found</p>
                                    <p className="text-sm">Try adjusting your filters or search query.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <AnimatePresence>
                                        {timelineItems.map((item, i) => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.2, delay: i * 0.02 }}
                                                key={`${item.type}-${item.id}`}
                                                className="relative pl-16 group"
                                            >
                                                {/* Timeline Dot */}
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] z-10 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                                </div>

                                                <div className="bg-surface/30 border border-white/5 rounded-xl p-4 hover:bg-surface/50 transition-colors flex items-center justify-between group-hover:border-white/10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0">
                                                            {item.type === 'agent' ? <Bot size={20} className="text-purple-400" /> : getFileIcon(item.data.fileType)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-gray-200">{item.title}</h3>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                                                                <span>{formatSmartDate(item.timestamp)}</span>
                                                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                                                <span className="uppercase tracking-widest">{item.type}</span>
                                                                {item.type === 'agent' && (
                                                                    <>
                                                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                                                        <span className="flex items-center gap-1"><MessageSquare size={10} /> {item.data.messages?.length || 0} msgs</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {item.type === 'agent' && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveSession(item.id);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 text-xs font-bold rounded transition-colors"
                                                                >
                                                                    Resume
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteSession(item.id)}
                                                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterItem({ icon: Icon, label, active, onClick }: { icon: React.ElementType, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                active
                    ? "bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.1)] border border-purple-500/30"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
            )}
        >
            <Icon size={16} />
            <span>{label}</span>
        </button>
    );
}
