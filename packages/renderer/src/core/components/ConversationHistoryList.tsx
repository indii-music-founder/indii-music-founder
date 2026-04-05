import React, { useMemo, memo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { formatSmartDate, cn } from '@/lib/utils';
import { MessageSquare, Calendar, Trash2, X, Edit2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ConversationSession } from '@/core/store/slices/agent';

const HistoryItem = memo(({
    session,
    isActive,
    index,
    onSelect,
    onDelete,
    onRename
}: {
    session: ConversationSession,
    isActive: boolean,
    index: number,
    onSelect: (id: string) => void,
    onDelete: (id: string) => void,
    onRename: (id: string, title: string) => void
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [tempTitle, setTempTitle] = React.useState(session.title || '');

    const handleRename = (e: React.MouseEvent | React.FormEvent) => {
        e.stopPropagation();
        if (tempTitle.trim() && tempTitle !== session.title) {
            onRename(session.id, tempTitle.trim());
        }
        setIsEditing(false);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    return (
        <motion.li
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
            className="group relative"
        >
            <button
                onClick={() => onSelect(session.id)}
                className={cn(
                    "w-full text-left p-4 rounded-xl transition-all duration-300 border focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none block",
                    isActive
                        ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                        : 'hover:bg-white/5 border-transparent'
                )}
                aria-current={isActive ? 'true' : undefined}
            >
                <div className="flex justify-between items-start mb-2">
                    {isEditing ? (
                        <div className="flex items-center gap-2 w-full pr-12" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="bg-white/10 border border-purple-500/50 rounded px-2 py-1 text-[13px] font-bold text-white w-full focus:outline-none"
                                value={tempTitle}
                                onChange={e => setTempTitle(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleRename(e);
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                            />
                            <button
                                onClick={handleRename}
                                className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    ) : (
                        <h4 className={cn(
                            "text-[13px] font-bold truncate pr-12 tracking-tight transition-colors",
                            isActive ? 'text-purple-300' : 'text-gray-200'
                        )}>
                            {session.title || 'Temporal Stream'}
                        </h4>
                    )}
                </div>

                <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono tracking-wider uppercase">
                    <span className="flex items-center gap-1.5" aria-label={`${session.messages?.length || 0} messages`}>
                        <MessageSquare size={10} className="text-purple-500/50" aria-hidden="true" />
                        {session.messages?.length || 0}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/10" aria-hidden="true"></span>
                    <span className="flex items-center gap-1.5" aria-label={`Last updated ${formatSmartDate(session.updatedAt)}`}>
                        <Calendar size={10} className="text-gray-600" aria-hidden="true" />
                        {formatSmartDate(session.updatedAt)}
                    </span>
                </div>
            </button>

            {/* Actions (Glow reveal) */}
            <div className="absolute right-3 top-4 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 group-focus-within:translate-x-0 z-10">
                {!isEditing && (
                    <button
                        className="p-2 hover:bg-white/10 hover:text-white rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                        onClick={handleEditClick}
                        aria-label="Rename session"
                    >
                        <Edit2 size={12} />
                    </button>
                )}
                <button
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                    }}
                    aria-label={`Delete session: ${session.title || 'Temporal Stream'}`}
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Active Indicator Line */}
            {isActive && (
                <motion.div
                    layoutId="activeHighlight"
                    className="absolute left-0 top-3 bottom-3 w-[3px] bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)] pointer-events-none"
                    aria-hidden="true"
                />
            )}
        </motion.li>
    );
});

export const ConversationHistoryList = ({ className, onClose }: { className?: string; onClose?: () => void }) => {
    const { sessions, activeSessionId, setActiveSession, deleteSession, updateSessionTitle, setRightPanelView } = useStore(
        useShallow(state => ({
            sessions: state.sessions,
            activeSessionId: state.activeSessionId,
            setActiveSession: state.setActiveSession,
            deleteSession: state.deleteSession,
            updateSessionTitle: state.updateSessionTitle,
            setRightPanelView: state.setRightPanelView,
        }))
    );

    const handleSelect = (id: string) => {
        setActiveSession(id);
        setRightPanelView('messages');
    };

    // Bolt Optimization: Memoize sorted sessions to prevent re-sorting on every render
    const sortedSessions = useMemo(() => {
        return Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
    }, [sessions]);

    return (
        <div className={cn("flex flex-col h-full bg-black/40 text-white w-64 border-r border-white/5 backdrop-blur-3xl", className)}>
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 id="history-title" className="font-bold text-[13px] uppercase tracking-[0.2em] text-gray-400">Archives</h3>
                <button
                    onClick={() => onClose ? onClose() : setRightPanelView('messages')}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                    aria-label="Close history panel"
                >
                    <X size={14} />
                </button>
            </div>

            <ul aria-labelledby="history-title" className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 m-0 list-none">
                {sortedSessions.length === 0 && (
                    <li className="text-center text-gray-500 mt-12 text-xs italic font-light">
                        No temporal logs found.
                    </li>
                )}

                {sortedSessions.map((session, index) => (
                    <HistoryItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        index={index}
                        onSelect={handleSelect}
                        onDelete={deleteSession}
                        onRename={updateSessionTitle}
                    />
                ))}
            </ul>
        </div>
    );
};
