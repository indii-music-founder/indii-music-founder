import React, { useMemo, useState } from 'react';
import {
    Archive,
    Brain,
    Columns,
    FolderKanban,
    Globe,
    Layers,
    LayoutGrid,
    Lock,
    Maximize2,
    MessagesSquare,
    Pin,
    Plus,
    Radio,
    Square,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { BoardroomConversationPanel } from '@/modules/boardroom/components/BoardroomConversationPanel';
import { BoardroomWorkbenchView } from '@/modules/boardroom/components/BoardroomWorkbenchView';
import { BoardroomBrowserView } from '@/modules/boardroom/components/BoardroomBrowserView';
import { BoardroomModulePreview } from '@/modules/boardroom/components/BoardroomModulePreview';
import { BoardroomAgentFeedView } from '@/modules/boardroom/components/BoardroomAgentFeedView';
import { MeetingRoomSidebar } from '@/modules/meeting-rooms/components/MeetingRoomSidebar';
import { CreateMeetingRoomModal } from '@/modules/meeting-rooms/components/CreateMeetingRoomModal';
import { MeetingRoomRosterDrawer } from '@/modules/meeting-rooms/components/MeetingRoomRosterDrawer';
import { MeetingRoomMemoryPanel } from '@/modules/meeting-rooms/components/MeetingRoomMemoryPanel';
import type { MeetingRoomWorkspaceTab } from '@/core/store/slices/meetingRoomSlice';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { cn } from '@/lib/utils';

export function MeetingRoomsModule() {
    const {
        sessions,
        projects,
        currentProjectId,
        activeMeetingRoomId,
        meetingRoomWorkspaceLayout,
        meetingRoomWorkspaceTab,
        meetingRoomAssetScope,
        meetingRoomRoundtableStatus,
        isCommandMenuOpen,
        createMeetingRoom,
        selectMeetingRoom,
        assignMeetingRoomToProject,
        updateMeetingRoomConfig,
        pinAssetToMeetingRoom,
        unpinAssetFromMeetingRoom,
        archiveMeetingRoom,
        deleteMeetingRoom,
        setMeetingRoomWorkspaceLayout,
        setMeetingRoomWorkspaceTab,
        setMeetingRoomAssetScope,
        openMeetingRoomWorkbench,
        stopAgent,
    } = useStore(
        useShallow(state => ({
            sessions: state.sessions ?? {},
            projects: state.projects ?? [],
            currentProjectId: state.currentProjectId,
            activeMeetingRoomId: state.activeMeetingRoomId,
            meetingRoomWorkspaceLayout: state.meetingRoomWorkspaceLayout ?? 'closed',
            meetingRoomWorkspaceTab: state.meetingRoomWorkspaceTab ?? 'memory',
            meetingRoomAssetScope: state.meetingRoomAssetScope ?? 'room',
            meetingRoomRoundtableStatus: state.meetingRoomRoundtableStatus ?? null,
            isCommandMenuOpen: state.isCommandMenuOpen ?? false,
            createMeetingRoom: state.createMeetingRoom,
            selectMeetingRoom: state.selectMeetingRoom,
            assignMeetingRoomToProject: state.assignMeetingRoomToProject,
            updateMeetingRoomConfig: state.updateMeetingRoomConfig,
            pinAssetToMeetingRoom: state.pinAssetToMeetingRoom,
            unpinAssetFromMeetingRoom: state.unpinAssetFromMeetingRoom,
            archiveMeetingRoom: state.archiveMeetingRoom,
            deleteMeetingRoom: state.deleteMeetingRoom,
            setMeetingRoomWorkspaceLayout: state.setMeetingRoomWorkspaceLayout,
            setMeetingRoomWorkspaceTab: state.setMeetingRoomWorkspaceTab,
            setMeetingRoomAssetScope: state.setMeetingRoomAssetScope,
            openMeetingRoomWorkbench: state.openMeetingRoomWorkbench,
            stopAgent: state.stopAgent,
        }))
    );

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isRosterOpen, setIsRosterOpen] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    const meetingRooms = useMemo(
        () => Object.values(sessions).filter(s => s.namespace === 'meeting-room'),
        [sessions]
    );

    const activeRoom = activeMeetingRoomId && sessions[activeMeetingRoomId]?.namespace === 'meeting-room'
        ? sessions[activeMeetingRoomId]
        : null;

    const roomConfig = activeRoom?.meetingRoom;
    const collaborationMode = roomConfig?.collaborationMode ?? 'dag';
    const maxRounds = roomConfig?.maxRoundtableRounds ?? 2;
    const pinnedAssets = roomConfig?.referencedAssets ?? [];

    const workspaceTabs: Array<{ id: MeetingRoomWorkspaceTab; label: string; icon: React.ElementType }> = [
        { id: 'memory', label: 'Memory', icon: Brain },
        { id: 'workbench', label: 'Workbench', icon: Layers },
        { id: 'browser', label: 'Browser', icon: Globe },
        { id: 'module', label: 'Studio', icon: LayoutGrid },
        { id: 'agent-feed', label: 'Feed', icon: Radio },
    ];

    const toggleWorkspaceTab = (tab: MeetingRoomWorkspaceTab) => {
        if (meetingRoomWorkspaceLayout !== 'closed' && meetingRoomWorkspaceTab === tab) {
            setMeetingRoomWorkspaceLayout('closed');
        } else {
            setMeetingRoomWorkspaceTab(tab);
            if (meetingRoomWorkspaceLayout === 'closed') {
                setMeetingRoomWorkspaceLayout('split');
            }
        }
    };

    const commitTitleEdit = () => {
        if (activeRoom && titleDraft.trim() && titleDraft.trim() !== activeRoom.title) {
            void updateMeetingRoomConfig(activeRoom.id, { title: titleDraft.trim() });
        }
        setEditingTitle(false);
    };

    return (
        <div
            data-testid="meeting-rooms-module"
            className="h-full w-full flex bg-bg-dark text-white min-h-0 min-w-0 overflow-hidden"
        >
            <MeetingRoomSidebar
                rooms={meetingRooms}
                projects={projects}
                activeRoomId={activeRoom?.id ?? null}
                currentProjectId={currentProjectId}
                onSelectRoom={selectMeetingRoom}
                onOpenCreateModal={() => setIsCreateOpen(true)}
            />

            {/* Main Room Canvas */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                {activeRoom ? (
                    <>
                        {/* Room Header */}
                        <header className="px-4 py-2.5 border-b border-white/10 bg-[#08080e]/90 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                {editingTitle ? (
                                    <input
                                        type="text"
                                        value={titleDraft}
                                        autoFocus
                                        onChange={(e) => setTitleDraft(e.target.value)}
                                        onBlur={commitTitleEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') commitTitleEdit();
                                            if (e.key === 'Escape') setEditingTitle(false);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-white/10 border border-indigo-400 text-sm font-bold text-white focus:outline-none"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTitleDraft(activeRoom.title);
                                            setEditingTitle(true);
                                        }}
                                        title="Click to rename room"
                                        className="text-sm font-bold text-white hover:text-indigo-300 truncate max-w-[240px] shrink-0 text-left"
                                        data-testid="active-room-title"
                                    >
                                        {activeRoom.title}
                                    </button>
                                )}

                                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-white/60 shrink-0">
                                    {roomConfig?.category ?? 'concept-lab'}
                                </span>

                                <label className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/80 shrink-0">
                                    <FolderKanban size={11} className="text-indigo-400 shrink-0" />
                                    <select
                                        value={activeRoom.projectId ?? ''}
                                        onChange={(e) => assignMeetingRoomToProject(activeRoom.id, e.target.value || null)}
                                        aria-label="Assigned Project"
                                        data-testid="active-room-project-select"
                                        className="bg-transparent text-[11px] font-semibold text-white/90 focus:outline-none cursor-pointer"
                                    >
                                        <option value="" className="bg-zinc-900">
                                            General
                                        </option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id} className="bg-zinc-900">
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setIsRosterOpen(true)}
                                    data-testid="open-room-roster-btn"
                                    title="View locked room roster & mission brief"
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-white/80 shrink-0"
                                >
                                    <Users size={12} className="text-indigo-400" />
                                    <span>{activeRoom.participants.length} seated</span>
                                    <Lock size={10} className="text-white/40" />
                                </button>
                            </div>

                            {/* Controls: Collaboration Mode + Workspace Dock + Room Actions */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                {/* DAG vs Roundtable Toggle */}
                                <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => void updateMeetingRoomConfig(activeRoom.id, { collaborationMode: 'dag' })}
                                        data-testid="room-mode-dag-btn"
                                        className={cn(
                                            'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                                            collaborationMode === 'dag'
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-white/60 hover:text-white'
                                        )}
                                    >
                                        DAG
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void updateMeetingRoomConfig(activeRoom.id, { collaborationMode: 'roundtable' })}
                                        data-testid="room-mode-roundtable-btn"
                                        className={cn(
                                            'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                                            collaborationMode === 'roundtable'
                                                ? 'bg-purple-600 text-white'
                                                : 'text-white/60 hover:text-white'
                                        )}
                                    >
                                        Riff
                                    </button>
                                    {collaborationMode === 'roundtable' && (
                                        <select
                                            value={maxRounds}
                                            onChange={(e) => void updateMeetingRoomConfig(activeRoom.id, {
                                                maxRoundtableRounds: Number(e.target.value),
                                            })}
                                            aria-label="Roundtable rounds"
                                            className="ml-1 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-purple-200 border border-white/10"
                                        >
                                            <option value={1}>1 rd</option>
                                            <option value={2}>2 rds</option>
                                            <option value={3}>3 rds</option>
                                        </select>
                                    )}
                                </div>

                                {/* Workspace Dock */}
                                <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                                    {workspaceTabs.map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = meetingRoomWorkspaceLayout !== 'closed' && meetingRoomWorkspaceTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => toggleWorkspaceTab(tab.id)}
                                                data-testid={`room-dock-${tab.id}`}
                                                className={cn(
                                                    'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                                                    isActive
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                                )}
                                            >
                                                <Icon size={11} />
                                                <span className="hidden lg:inline">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => archiveMeetingRoom(activeRoom.id)}
                                    title="Archive Room"
                                    aria-label="Archive Room"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-amber-300"
                                >
                                    <Archive size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deleteMeetingRoom(activeRoom.id)}
                                    title="Delete Room"
                                    aria-label="Delete Room"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-red-400"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </header>

                        {/* Live Roundtable Status Banner */}
                        {meetingRoomRoundtableStatus?.active && (
                            <div
                                data-testid="roundtable-status-banner"
                                className="px-4 py-2 bg-purple-950/50 border-b border-purple-500/30 flex items-center justify-between gap-3 shrink-0"
                            >
                                <div className="flex items-center gap-2 text-xs text-purple-200">
                                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                    <span className="font-bold">
                                        Round {meetingRoomRoundtableStatus.currentRound} of {meetingRoomRoundtableStatus.maxRounds}
                                    </span>
                                    {meetingRoomRoundtableStatus.activeAgentId && (
                                        <span className="text-purple-300/80">
                                            • {resolveAgentVisualIdentity(meetingRoomRoundtableStatus.activeAgentId).displayName}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={stopAgent}
                                    data-testid="roundtable-stop-btn"
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-[11px] font-bold text-red-200"
                                >
                                    <Square size={10} />
                                    <span>Stop / Interject</span>
                                </button>
                            </div>
                        )}

                        {/* Pinned Room References Bar */}
                        {pinnedAssets.length > 0 && (
                            <div className="px-4 py-1.5 bg-white/[0.02] border-b border-white/5 flex items-center gap-2 overflow-x-auto shrink-0">
                                <Pin size={11} className="text-indigo-400 shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">
                                    Pinned:
                                </span>
                                {pinnedAssets.map(asset => (
                                    <span
                                        key={asset.id}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-200 shrink-0"
                                    >
                                        <span className="truncate max-w-[140px]">{asset.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => void unpinAssetFromMeetingRoom(activeRoom.id, asset.id)}
                                            aria-label={`Unpin ${asset.name}`}
                                            className="hover:text-white"
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Split Conversation + Workspace Content */}
                        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                            {meetingRoomWorkspaceLayout !== 'stage' && (
                                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                                    <BoardroomConversationPanel
                                        messages={activeRoom.messages ?? []}
                                        filterSessionId={activeRoom.id}
                                        filterProjectId={activeRoom.projectId ?? currentProjectId}
                                        assetScope={meetingRoomAssetScope}
                                        onAssetScopeChange={setMeetingRoomAssetScope}
                                        onInspectInWorkbench={(itemId) => openMeetingRoomWorkbench({ kind: 'asset', itemId }, 'split')}
                                        emptyStateSlot={
                                            <div className="max-w-md text-xs text-white/50 bg-white/[0.03] border border-white/10 rounded-xl p-3">
                                                {roomConfig?.missionBrief
                                                    ? `Mission Brief: ${roomConfig.missionBrief}`
                                                    : 'Drop a prompt or asset below to collaborate with this room’s roster.'}
                                            </div>
                                        }
                                    />
                                </div>
                            )}

                            {meetingRoomWorkspaceLayout !== 'closed' && (
                                <section
                                    data-testid="meeting-room-workspace-pane"
                                    className={cn(
                                        'flex flex-col min-h-0 min-w-0 border-l border-white/10 bg-zinc-950 overflow-hidden',
                                        meetingRoomWorkspaceLayout === 'stage' ? 'flex-1' : 'w-[42%] shrink-0'
                                    )}
                                >
                                    <div className="px-3 py-1.5 border-b border-white/10 bg-[#09090d] flex items-center justify-between shrink-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                            {workspaceTabs.find(t => t.id === meetingRoomWorkspaceTab)?.label}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setMeetingRoomWorkspaceLayout(
                                                    meetingRoomWorkspaceLayout === 'stage' ? 'split' : 'stage'
                                                )}
                                                aria-label="Toggle workspace size"
                                                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
                                            >
                                                {meetingRoomWorkspaceLayout === 'stage' ? <Columns size={13} /> : <Maximize2 size={13} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMeetingRoomWorkspaceLayout('closed')}
                                                aria-label="Close workspace pane"
                                                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
                                        {meetingRoomWorkspaceTab === 'memory' && (
                                            <MeetingRoomMemoryPanel room={activeRoom} />
                                        )}
                                        {meetingRoomWorkspaceTab === 'workbench' && (
                                            <BoardroomWorkbenchView
                                                filterSessionId={activeRoom.id}
                                                filterProjectId={activeRoom.projectId ?? currentProjectId}
                                                assetScope={meetingRoomAssetScope}
                                                onAssetScopeChange={setMeetingRoomAssetScope}
                                                onPinAsset={(asset) => void pinAssetToMeetingRoom(activeRoom.id, asset)}
                                            />
                                        )}
                                        {meetingRoomWorkspaceTab === 'browser' && (
                                            <BoardroomBrowserView isVisible={!isCreateOpen && !isRosterOpen && !isCommandMenuOpen} />
                                        )}
                                        {meetingRoomWorkspaceTab === 'module' && (
                                            <BoardroomModulePreview />
                                        )}
                                        {meetingRoomWorkspaceTab === 'agent-feed' && (
                                            <BoardroomAgentFeedView />
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>

                        <MeetingRoomRosterDrawer
                            isOpen={isRosterOpen}
                            room={activeRoom}
                            projects={projects}
                            onClose={() => setIsRosterOpen(false)}
                            onSaveBrief={(brief) => void updateMeetingRoomConfig(activeRoom.id, { missionBrief: brief })}
                            onAssignProject={(pid) => assignMeetingRoomToProject(activeRoom.id, pid)}
                        />
                    </>
                ) : (
                    <div
                        data-testid="meeting-rooms-empty-state"
                        className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                            <MessagesSquare size={24} className="text-indigo-400" />
                        </div>
                        <div className="max-w-md space-y-1.5">
                            <h2 className="text-lg font-bold text-white">Project Meeting Rooms</h2>
                            <p className="text-xs text-white/55 leading-relaxed">
                                Spin up persistent rooms with dedicated stationary teams of department heads and specialist workers, room-scoped assets, and isolated long-term memory you can promote anytime.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(true)}
                            data-testid="empty-create-meeting-room-btn"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
                        >
                            <Plus size={14} />
                            <span>Create First Meeting Room</span>
                        </button>
                    </div>
                )}
            </div>

            <CreateMeetingRoomModal
                isOpen={isCreateOpen}
                projects={projects}
                defaultProjectId={currentProjectId}
                onClose={() => setIsCreateOpen(false)}
                onCreate={(input) => createMeetingRoom(input)}
            />
        </div>
    );
}

export default MeetingRoomsModule;
