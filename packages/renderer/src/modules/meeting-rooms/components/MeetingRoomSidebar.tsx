import React, { useMemo, useState } from 'react';
import { Archive, FolderKanban, MessagesSquare, Plus, Search, Users } from 'lucide-react';
import type { ConversationSession } from '@/core/store/slices/agent/agentSessionSlice';
import type { ProjectMetadata } from '@/services/dashboard/DashboardService';
import { projectBucketMatches } from '@/core/constants';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { isWorker } from '@/services/agent/departments';
import { cn } from '@/lib/utils';

export interface MeetingRoomSidebarProps {
    rooms: ConversationSession[];
    projects: ProjectMetadata[];
    activeRoomId: string | null;
    currentProjectId: string;
    onSelectRoom: (roomId: string) => void;
    onOpenCreateModal: () => void;
}

export function MeetingRoomSidebar({
    rooms,
    projects,
    activeRoomId,
    currentProjectId,
    onSelectRoom,
    onOpenCreateModal,
}: MeetingRoomSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [projectFilter, setProjectFilter] = useState<'project' | 'all'>('project');

    const projectNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of projects) {
            map.set(p.id, p.name);
        }
        return map;
    }, [projects]);

    const filteredRooms = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return rooms
            .filter(room => Boolean(room.isArchived) === showArchived)
            .filter(room => {
                if (projectFilter === 'all') return true;
                return !room.projectId || projectBucketMatches(room.projectId, currentProjectId);
            })
            .filter(room => {
                if (!q) return true;
                const brief = room.meetingRoom?.missionBrief?.toLowerCase() ?? '';
                const projectName = (room.projectId ? projectNameMap.get(room.projectId) : '')?.toLowerCase() ?? '';
                return room.title.toLowerCase().includes(q) || brief.includes(q) || projectName.includes(q);
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [rooms, showArchived, projectFilter, currentProjectId, searchQuery, projectNameMap]);

    return (
        <aside
            data-testid="meeting-room-sidebar"
            className="w-72 shrink-0 border-r border-white/10 bg-[#08080c] flex flex-col min-h-0 overflow-hidden"
        >
            {/* Header & New Room CTA */}
            <div className="p-3 border-b border-white/10 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <MessagesSquare size={15} className="text-indigo-400 shrink-0" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-200 truncate">
                            Meeting Rooms
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenCreateModal}
                        data-testid="create-meeting-room-btn"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors shrink-0"
                    >
                        <Plus size={12} />
                        <span>New Room</span>
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search rooms..."
                        aria-label="Search meeting rooms"
                        className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                    <div className="flex items-center bg-white/5 rounded-md p-0.5 border border-white/5">
                        <button
                            type="button"
                            onClick={() => setProjectFilter('project')}
                            className={cn(
                                'px-2 py-0.5 rounded font-semibold transition-colors',
                                projectFilter === 'project' ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
                            )}
                        >
                            This Project
                        </button>
                        <button
                            type="button"
                            onClick={() => setProjectFilter('all')}
                            className={cn(
                                'px-2 py-0.5 rounded font-semibold transition-colors',
                                projectFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
                            )}
                        >
                            All
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowArchived(prev => !prev)}
                        className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-md border transition-colors font-semibold',
                            showArchived
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-white/5 border-white/5 text-white/50 hover:text-white'
                        )}
                    >
                        <Archive size={10} />
                        <span>{showArchived ? 'Archived' : 'Active'}</span>
                    </button>
                </div>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {filteredRooms.length === 0 ? (
                    <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-white/40">
                            {showArchived ? 'No archived meeting rooms.' : 'No active meeting rooms yet.'}
                        </p>
                        {!showArchived && (
                            <button
                                type="button"
                                onClick={onOpenCreateModal}
                                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline"
                            >
                                Create your first room
                            </button>
                        )}
                    </div>
                ) : (
                    filteredRooms.map(room => {
                        const isSelected = room.id === activeRoomId;
                        const mode = room.meetingRoom?.collaborationMode ?? 'dag';
                        const rounds = room.meetingRoom?.maxRoundtableRounds ?? 2;
                        const participants = room.participants ?? [];

                        return (
                            <button
                                key={room.id}
                                type="button"
                                onClick={() => onSelectRoom(room.id)}
                                data-testid={`meeting-room-item-${room.id}`}
                                className={cn(
                                    'w-full text-left p-2.5 rounded-xl border transition-all space-y-1.5',
                                    isSelected
                                        ? 'bg-indigo-600/20 border-indigo-400/50 shadow-sm'
                                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/15'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-bold text-white truncate">
                                        {room.title}
                                    </span>
                                    <span className={cn(
                                        'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0',
                                        mode === 'roundtable'
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                                    )}>
                                        {mode === 'roundtable' ? `Riff ×${rounds}` : 'DAG'}
                                    </span>
                                </div>

                                {room.meetingRoom?.missionBrief && (
                                    <p className="text-[11px] text-white/50 line-clamp-2 leading-snug">
                                        {room.meetingRoom.missionBrief}
                                    </p>
                                )}

                                <div className="flex items-center gap-1 text-[10px] text-indigo-200/75">
                                    <FolderKanban size={10} className="text-indigo-400 shrink-0" />
                                    <span
                                        data-testid={`room-project-badge-${room.id}`}
                                        className="truncate"
                                    >
                                        {room.projectId
                                            ? (projectNameMap.get(room.projectId) ?? room.projectId)
                                            : 'General'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                                        <Users size={10} className="text-white/30 shrink-0" />
                                        {participants.slice(0, 3).map(agentId => {
                                            const identity = resolveAgentVisualIdentity(agentId);
                                            const worker = isWorker(agentId);
                                            return (
                                                <span
                                                    key={agentId}
                                                    className={cn(
                                                        'px-1.5 py-0.2 rounded text-[9px] font-semibold truncate max-w-[82px]',
                                                        worker
                                                            ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/25'
                                                            : 'bg-white/10 text-white/75'
                                                    )}
                                                    title={identity.displayName}
                                                >
                                                    {identity.displayName}
                                                </span>
                                            );
                                        })}
                                        {participants.length > 3 && (
                                            <span className="text-[9px] text-white/40">
                                                +{participants.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-mono text-white/30 shrink-0">
                                        {room.messages?.length ?? 0}m
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
