import React, { useMemo, memo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { formatSmartDate, cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MessageSquare, Calendar, Trash2, X, Edit2, Check, Archive, ArchiveRestore, Search, Briefcase, FolderOutput } from 'lucide-react';
import { motion } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ConversationSession } from '@/core/store/slices/agent';

const HistoryItem = memo(({
    session,
    isActive,
    index,
    onSelect,
    onDelete,
    onRename,
    onArchive,
    onUnarchive,
    onUpdateProject
}: {
    key?: React.Key,
    session: ConversationSession,
    isActive: boolean,
    index: number,
    onSelect: (id: string) => void,
    onDelete: (id: string) => void,
    onRename: (id: string, title: string) => void,
    onArchive: (id: string) => void,
    onUnarchive: (id: string) => void,
    onUpdateProject: (id: string, projectId: string) => void
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [tempTitle, setTempTitle] = React.useState(session.title || '');
    const projects = (useStore(state => state.projects) || []);
    const project = session.projectId ? projects.find(p => p.id === session.projectId) : undefined;

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
                    "w-full text-left p-4 rounded-xl transition-all duration-300 border focus-visible:ring-2 focus-visible:ring-dept-creative focus-visible:outline-none block",
                    isActive
                        ? 'bg-dept-creative/10 border-dept-creative/40 shadow-[0_0_20px_rgba(0,255,102,0.1)]'
                        : 'hover:bg-white/5 border-transparent'
                )}
                aria-current={isActive ? 'true' : undefined}
            >
                <div className="flex justify-between items-start mb-2">
                    {isEditing ? (
                        <div className="flex items-center gap-2 w-full pr-12" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="bg-white/10 border border-dept-creative/50 rounded px-2 py-1 text-[13px] font-bold text-white w-full focus:outline-none"
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
                            isActive ? 'text-dept-creative' : 'text-gray-200'
                        )}>
                            {session.title || 'Temporal Stream'}
                        </h4>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 font-mono tracking-wider uppercase mt-1">
                    {project && (
                        <span className="flex items-center gap-1 text-[9px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-gray-300">
                            <Briefcase size={8} className="text-gray-400" />
                            {project.name}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5" aria-label={`${session.messages?.length || 0} messages`}>
                        <MessageSquare size={10} className="text-dept-creative/50" aria-hidden="true" />
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
                        className="p-2 hover:bg-white/10 hover:text-white rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative focus-visible:outline-none"
                        onClick={handleEditClick}
                        aria-label="Rename session"
                    >
                        <Edit2 size={12} />
                    </button>
                )}
                <button
                    className="p-2 hover:bg-white/10 hover:text-white rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative focus-visible:outline-none"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (session.isArchived) {
                            onUnarchive(session.id);
                        } else {
                            onArchive(session.id);
                        }
                    }}
                    aria-label={session.isArchived ? 'Restore session' : 'Archive session'}
                >
                    {session.isArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                </button>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button
                            className="p-2 hover:bg-white/10 hover:text-white rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative focus-visible:outline-none"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Move to project"
                        >
                            <FolderOutput size={12} />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="z-50 min-w-[200px] overflow-hidden rounded-md border border-white/10 bg-[#1A1A1A] text-white shadow-xl animate-in fade-in-80 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                            sideOffset={4}
                            align="end"
                        >
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5 mb-1">
                                Move to Project
                            </div>
                            <DropdownMenu.Item
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-white/10 focus:bg-white/10 focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateProject(session.id, '');
                                }}
                            >
                                <span className="flex-1 truncate">Inbox (Unassigned)</span>
                            </DropdownMenu.Item>
                            {projects.filter(p => p.status === 'active' || p.status === 'paused').map((p) => (
                                <DropdownMenu.Item
                                    key={p.id}
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-white/10 focus:bg-white/10 focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateProject(session.id, p.id);
                                    }}
                                >
                                    <span className="flex-1 truncate">{p.name}</span>
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <button
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                    onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await ConfirmDialog.call({
                            title: 'Delete Session',
                            message: `Are you sure you want to delete "${session.title || 'Temporal Stream'}"? This cannot be undone.`,
                            confirmText: 'Delete',
                            variant: 'destructive'
                        });
                        if (ok) onDelete(session.id);
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
                    className="absolute left-0 top-3 bottom-3 w-[3px] bg-dept-creative rounded-r-full shadow-[0_0_10px_rgba(0,255,102,0.8)] pointer-events-none"
                    aria-hidden="true"
                />
            )}
        </motion.li>
    );
});

export const ConversationHistoryList = ({ className, onClose }: { className?: string; onClose?: () => void }) => {
    const { sessions, activeSessionId, setActiveSession, deleteSession, updateSessionTitle, updateSessionProject, archiveSession, unarchiveSession, setRightPanelView } = useStore(
        useShallow(state => ({
            sessions: state.sessions,
            activeSessionId: state.activeSessionId,
            setActiveSession: state.setActiveSession,
            deleteSession: state.deleteSession,
            updateSessionTitle: state.updateSessionTitle,
            updateSessionProject: state.updateSessionProject,
            archiveSession: state.archiveSession,
            unarchiveSession: state.unarchiveSession,
            setRightPanelView: state.setRightPanelView,
        }))
    );
    
    const currentProjectId = useStore(state => state.currentProjectId);
    const projects = useStore(state => state.projects) || [];

    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeTab, setActiveTab] = React.useState<'active' | 'archived'>('active');

    const handleSelect = React.useCallback((id: string) => {
        setActiveSession(id);
        setRightPanelView('messages');
    }, [setActiveSession, setRightPanelView]);

    // Grouping helper
    const categorizeDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        if (date > lastWeek) return 'Previous 7 Days';
        return 'Older';
    };

    const groupedSessions = useMemo(() => {
        const filtered = Object.values(sessions).filter(s => {
            const matchesSearch = s.title?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTab = activeTab === 'archived' ? s.isArchived : !s.isArchived;
            // Only show sessions for the current project. If a session lacks a projectId, assume it belongs to the active project (or Inbox).
            // This ensures backwards compatibility.
            const matchesProject = !s.projectId || s.projectId === currentProjectId;
            return matchesSearch && matchesTab && matchesProject;
        }).sort((a, b) => b.updatedAt - a.updatedAt);

        const groups: Record<string, typeof filtered> = {
            'Today': [],
            'Yesterday': [],
            'Previous 7 Days': [],
            'Older': []
        };

        filtered.forEach(s => {
            groups[categorizeDate(s.updatedAt)].push(s);
        });

        return groups;
    }, [sessions, searchQuery, activeTab, currentProjectId]);

    return (
        <div className={cn("flex flex-col h-full bg-black/40 text-white w-64 border-r border-white/5 backdrop-blur-3xl", className)}>
            <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/5">
                <div className="flex justify-between items-center">
                    <h3 id="history-title" className="font-bold text-[13px] uppercase tracking-[0.2em] text-gray-400">Sessions</h3>
                    <button
                        onClick={() => onClose ? onClose() : setRightPanelView('messages')}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                        aria-label="Close history panel"
                    >
                        <X size={14} />
                    </button>
                </div>
                
                <div className="flex bg-black/40 p-1 rounded-lg">
                    <button
                        className={cn("flex-1 text-[11px] py-1.5 rounded-md font-medium transition-colors", activeTab === 'active' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300')}
                        onClick={() => setActiveTab('active')}
                    >
                        Active
                    </button>
                    <button
                        className={cn("flex-1 text-[11px] py-1.5 rounded-md font-medium transition-colors", activeTab === 'archived' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300')}
                        onClick={() => setActiveTab('archived')}
                    >
                        Archived
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-creative/50"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 m-0">
                {Object.values(groupedSessions).every(g => g.length === 0) && (
                    <div className="text-center text-gray-500 mt-12 text-xs italic font-light">
                        No {activeTab} sessions found.
                    </div>
                )}

                {Object.entries(groupedSessions).map(([groupName, groupSessions]) => {
                    if (groupSessions.length === 0) return null;
                    return (
                        <div key={groupName} className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-1">{groupName}</h4>
                            <ul className="space-y-1" aria-labelledby="history-title">
                                {groupSessions.map((session, index) => (
                                    <HistoryItem
                                        key={session.id}
                                        session={session}
                                        isActive={session.id === activeSessionId}
                                        index={index}
                                        onSelect={handleSelect}
                                        onDelete={deleteSession}
                                        onRename={updateSessionTitle}
                                        onArchive={archiveSession}
                                        onUnarchive={unarchiveSession}
                                        onUpdateProject={updateSessionProject}
                                    />
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
