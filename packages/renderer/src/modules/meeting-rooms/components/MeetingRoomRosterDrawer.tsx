import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Lock, Users, X } from 'lucide-react';
import type { ConversationSession } from '@/core/store/slices/agent/agentSessionSlice';
import type { ProjectMetadata } from '@/services/dashboard/DashboardService';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

export interface MeetingRoomRosterDrawerProps {
    isOpen: boolean;
    room: ConversationSession;
    projects: ProjectMetadata[];
    onClose: () => void;
    onSaveBrief: (brief: string) => void;
    onAssignProject: (projectId: string | null) => void;
}

function getParticipantRoleLabel(agentId: string): string {
    if (agentId === 'generalist') return 'Coordinator';
    if (agentId.includes('.')) return 'Scoped Worker';
    return 'Department Head';
}

export function MeetingRoomRosterDrawer({
    isOpen,
    room,
    projects,
    onClose,
    onSaveBrief,
    onAssignProject,
}: MeetingRoomRosterDrawerProps) {
    const participants = room.participants ?? [];
    const [briefDraftState, setBriefDraftState] = useState<{ roomId: string; text: string } | null>(null);
    const [savedBriefNotice, setSavedBriefNotice] = useState(false);

    const briefDraft = briefDraftState?.roomId === room.id
        ? briefDraftState.text
        : (room.meetingRoom?.missionBrief ?? '');

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSaveBrief = () => {
        onSaveBrief(briefDraft.trim());
        setBriefDraftState(null);
        setSavedBriefNotice(true);
        setTimeout(() => setSavedBriefNotice(false), 1500);
    };

    const drawerContent = (
        <div
            className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xs flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Room Roster and Mission Brief"
            data-testid="meeting-room-roster-drawer"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md h-full bg-[#0b0b11] border-l border-white/15 flex flex-col text-white shadow-2xl"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <Users size={15} className="text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">
                            Roster &amp; Mission Brief
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close roster drawer"
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                    >
                        <X size={15} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                    {/* Assigned Project */}
                    <div className="space-y-1.5">
                        <label htmlFor="drawer-project-select" className="text-[11px] font-bold uppercase tracking-wider text-white/60 block">
                            Assigned Project
                        </label>
                        <select
                            id="drawer-project-select"
                            value={room.projectId ?? ''}
                            onChange={(e) => onAssignProject(e.target.value || null)}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-400"
                        >
                            <option value="" className="bg-zinc-900">
                                General / Unassigned
                            </option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id} className="bg-zinc-900">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Mission Brief */}
                    <div className="space-y-2">
                        <label htmlFor="drawer-mission-brief" className="text-[11px] font-bold uppercase tracking-wider text-white/60 block">
                            Mission Brief
                        </label>
                        <textarea
                            id="drawer-mission-brief"
                            rows={3}
                            value={briefDraft}
                            onChange={(e) => setBriefDraftState({ roomId: room.id, text: e.target.value })}
                            placeholder="Room goal, target audience, constraints..."
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                        />
                        <button
                            type="button"
                            onClick={handleSaveBrief}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-400/40 text-xs font-bold text-indigo-200 transition-colors"
                        >
                            <Check size={12} />
                            <span>{savedBriefNotice ? 'Brief Saved' : 'Save Brief'}</span>
                        </button>
                    </div>

                    {/* Read-only Locked Room Roster */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                                Locked Room Roster
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300/90">
                                <Lock size={10} />
                                <span>{participants.length} seated</span>
                            </span>
                        </div>

                        <div
                            data-testid="stationary-roster-notice"
                            className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed"
                        >
                            <Lock size={12} className="shrink-0 mt-0.5 text-amber-300" />
                            <span>
                                Stationary Roster — Agents stay fixed for the life of this room. Create a new Meeting Room to assemble a different team.
                            </span>
                        </div>

                        <div className="space-y-1.5" data-testid="locked-roster-list">
                            {participants.map(agentId => {
                                const identity = resolveAgentVisualIdentity(agentId);
                                const roleLabel = getParticipantRoleLabel(agentId);
                                return (
                                    <div
                                        key={agentId}
                                        data-testid={`locked-roster-agent-${agentId}`}
                                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate">
                                                {identity.displayName}
                                            </div>
                                            <div className="text-[10px] text-white/45 font-mono">
                                                {roleLabel} • {agentId}
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/60 shrink-0">
                                            <Lock size={9} />
                                            <span>Locked</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : drawerContent;
}
