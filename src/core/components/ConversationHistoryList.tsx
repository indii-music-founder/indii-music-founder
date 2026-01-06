import React from 'react';
import { useStore } from '@/core/store';
import { MessageSquare, Calendar, Trash2, Archive, Edit2, X } from 'lucide-react';
import { motion } from 'framer-motion';

// Helper to format date relative or absolute
const formatDate = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const ConversationHistoryList = ({ onClose }: { onClose: () => void }) => {
    const sessions = useStore(state => state.sessions);
    const activeSessionId = useStore(state => state.activeSessionId);
    const setActiveSession = useStore(state => state.setActiveSession);
    const deleteSession = useStore(state => state.deleteSession);

    // Sort by updated desc
    const sortedSessions = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div className="flex flex-col h-full bg-black/40 text-white w-64 border-r border-white/5 backdrop-blur-3xl">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="font-bold text-[13px] uppercase tracking-[0.2em] text-gray-400">Archives</h3>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {sortedSessions.length === 0 && (
                    <div className="text-center text-gray-500 mt-12 text-xs italic font-light">
                        No temporal logs found.
                    </div>
                )}

                {sortedSessions.map((session, index) => (
                    <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 40,
                            delay: index * 0.03
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 border ${session.id === activeSessionId
                            ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                            : 'hover:bg-white/5 border-transparent'
                            }`}
                        onClick={() => setActiveSession(session.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h4 className={`text-[13px] font-bold truncate pr-6 tracking-tight ${session.id === activeSessionId ? 'text-purple-300' : 'text-gray-200'
                                }`}>
                                {session.title || 'Temporal Stream'}
                            </h4>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono tracking-wider uppercase">
                            <span className="flex items-center gap-1.5">
                                <MessageSquare size={10} className="text-purple-500/50" />
                                {session.messages?.length || 0}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/10"></span>
                            <span className="flex items-center gap-1.5">
                                <Calendar size={10} className="text-gray-600" />
                                {formatDate(session.updatedAt)}
                            </span>
                        </div>

                        {/* Delete Action (Glow reveal) */}
                        <div className="absolute right-3 top-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <button
                                className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-600 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>

                        {/* Active Indicator Line */}
                        {session.id === activeSessionId && (
                            <motion.div
                                layoutId="activeHighlight"
                                className="absolute left-0 top-3 bottom-3 w-[3px] bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                            />
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
