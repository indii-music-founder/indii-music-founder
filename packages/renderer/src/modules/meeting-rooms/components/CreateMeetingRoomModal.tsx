import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Shield, Sparkles, Users, X } from 'lucide-react';
import type {
    MeetingRoomCategory,
    MeetingRoomCollaborationMode,
} from '@/core/store/slices/agent/agentSessionSlice';
import type { CreateMeetingRoomInput } from '@/core/store/slices/meetingRoomSlice';
import type { ProjectMetadata } from '@/services/dashboard/DashboardService';
import { listMeetingRoomSelectableDepartments } from '@/services/agent/departments';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { cn } from '@/lib/utils';

export interface CreateMeetingRoomModalProps {
    isOpen: boolean;
    projects: ProjectMetadata[];
    defaultProjectId: string;
    onClose: () => void;
    onCreate: (input: CreateMeetingRoomInput) => void;
}

const CATEGORIES: Array<{ id: MeetingRoomCategory; label: string }> = [
    { id: 'concept-lab', label: 'Concept Lab' },
    { id: 'release', label: 'Release War Room' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'legal-finance', label: 'Legal & Finance' },
    { id: 'custom', label: 'Custom' },
];

export function CreateMeetingRoomModal({
    isOpen,
    projects,
    defaultProjectId,
    onClose,
    onCreate,
}: CreateMeetingRoomModalProps) {
    const departments = listMeetingRoomSelectableDepartments();

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<MeetingRoomCategory>('concept-lab');
    const [projectIdOverride, setProjectIdOverride] = useState<string | null>(null);
    const projectId = projectIdOverride ?? defaultProjectId;
    const [missionBrief, setMissionBrief] = useState('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>(['creative', 'marketing']);
    const [includeConductor, setIncludeConductor] = useState(true);
    const [collaborationMode, setCollaborationMode] = useState<MeetingRoomCollaborationMode>('dag');
    const [maxRoundtableRounds, setMaxRoundtableRounds] = useState(2);
    const [isolateMemory, setIsolateMemory] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setProjectIdOverride(null);
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleClose = () => {
        setProjectIdOverride(null);
        onClose();
    };

    const toggleSpecialist = (agentId: string) => {
        setSelectedAgents(prev =>
            prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
        );
    };

    const totalSelectedCount = selectedAgents.length + (includeConductor ? 1 : 0);
    const canSubmit = Boolean(title.trim()) && totalSelectedCount > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        onCreate({
            title: title.trim(),
            missionBrief: missionBrief.trim(),
            participants: selectedAgents,
            includeConductor,
            collaborationMode,
            maxRoundtableRounds,
            category,
            isolateMemory,
            projectId: projectId || null,
        });
        setTitle('');
        setMissionBrief('');
        setProjectIdOverride(null);
        onClose();
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[100000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-meeting-room-title"
            data-testid="create-meeting-room-modal"
            onClick={handleClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#0d0d14] border border-white/15 shadow-2xl overflow-hidden text-white"
            >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-indigo-400" />
                        <h2 id="create-meeting-room-title" className="text-sm font-bold">
                            Create Meeting Room
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close modal"
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 space-y-1">
                            <label htmlFor="room-title-input" className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                                Room Name
                            </label>
                            <input
                                id="room-title-input"
                                data-testid="room-title-input"
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Album Visuals Lab"
                                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="room-category-select" className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                                Category
                            </label>
                            <select
                                id="room-category-select"
                                value={category}
                                onChange={(e) => setCategory(e.target.value as MeetingRoomCategory)}
                                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-400"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id} className="bg-zinc-900">
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="room-project-select" className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                            Assigned Project
                        </label>
                        <select
                            id="room-project-select"
                            data-testid="room-project-select"
                            value={projectId}
                            onChange={(e) => setProjectIdOverride(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-400"
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

                    <div className="space-y-1">
                        <label htmlFor="room-brief-input" className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                            Mission Brief (injected into every turn)
                        </label>
                        <textarea
                            id="room-brief-input"
                            data-testid="room-brief-input"
                            rows={2}
                            value={missionBrief}
                            onChange={(e) => setMissionBrief(e.target.value)}
                            placeholder="Define project goals, aesthetic direction, deliverables, or constraints..."
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                        />
                    </div>

                    {/* Collaboration & Memory Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 block">
                                Collaboration Loop
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCollaborationMode('dag')}
                                    className={cn(
                                        'flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                        collaborationMode === 'dag'
                                            ? 'bg-indigo-600/30 border-indigo-400 text-white'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                    )}
                                >
                                    DAG Action Plan
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCollaborationMode('roundtable')}
                                    data-testid="mode-roundtable-btn"
                                    className={cn(
                                        'flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                        collaborationMode === 'roundtable'
                                            ? 'bg-purple-600/30 border-purple-400 text-white'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                    )}
                                >
                                    Roundtable Riff
                                </button>
                            </div>
                            {collaborationMode === 'roundtable' && (
                                <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="text-white/60">Max Riff Rounds:</span>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setMaxRoundtableRounds(n)}
                                                className={cn(
                                                    'w-7 h-7 rounded-lg font-bold border text-xs',
                                                    maxRoundtableRounds === n
                                                        ? 'bg-purple-600 border-purple-400 text-white'
                                                        : 'bg-white/5 border-white/10 text-white/60'
                                                )}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                                    <Sparkles size={13} className="text-emerald-400" />
                                    Include Indii Conductor
                                </span>
                                <input
                                    type="checkbox"
                                    checked={includeConductor}
                                    onChange={(e) => setIncludeConductor(e.target.checked)}
                                    className="rounded accent-indigo-500"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                                    <Shield size={13} className="text-indigo-400" />
                                    Isolate Room Long-Term Memory
                                </span>
                                <input
                                    type="checkbox"
                                    checked={isolateMemory}
                                    onChange={(e) => setIsolateMemory(e.target.checked)}
                                    className="rounded accent-indigo-500"
                                />
                            </label>
                            <p className="text-[10px] text-white/40 leading-snug">
                                Isolated room memories stay scoped to this room until you explicitly promote them to global memory.
                            </p>
                        </div>
                    </div>

                    {/* Roster Picker (Heads + Scoped Workers) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                                Room Roster (Department Heads &amp; Workers)
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300">
                                {totalSelectedCount} seated
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90">
                            <Lock size={11} className="shrink-0 text-amber-300" />
                            <span>
                                Stationary roster — agents stay fixed in this room until you delete it.
                            </span>
                        </div>
                        {totalSelectedCount === 0 && (
                            <p className="text-[11px] text-red-300">
                                Select at least one specialist or enable Indii Conductor before creating this room.
                            </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {departments.map(dept => {
                                const headIdentity = resolveAgentVisualIdentity(dept.headId);
                                const isHeadSelected = selectedAgents.includes(dept.headId);
                                return (
                                    <div
                                        key={dept.id}
                                        className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleSpecialist(dept.headId)}
                                            data-testid={`roster-pick-${dept.headId}`}
                                            className={cn(
                                                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                                isHeadSelected
                                                    ? 'bg-indigo-600/30 border-indigo-400 text-white'
                                                    : 'bg-white/5 border-white/5 text-white/70 hover:text-white'
                                            )}
                                        >
                                            <span>{headIdentity.displayName}</span>
                                            <span className="text-[9px] uppercase text-white/40">Head</span>
                                        </button>

                                        {dept.workerIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pl-1">
                                                {dept.workerIds.map(workerId => {
                                                    const workerIdentity = resolveAgentVisualIdentity(workerId);
                                                    const isWorkerSelected = selectedAgents.includes(workerId);
                                                    return (
                                                        <button
                                                            key={workerId}
                                                            type="button"
                                                            onClick={() => toggleSpecialist(workerId)}
                                                            data-testid={`roster-pick-${workerId}`}
                                                            className={cn(
                                                                'px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors',
                                                                isWorkerSelected
                                                                    ? 'bg-cyan-600/30 border-cyan-400 text-cyan-100'
                                                                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                                            )}
                                                        >
                                                            {workerIdentity.displayName}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/10 bg-black/40 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        data-testid="submit-create-room-btn"
                        disabled={!canSubmit}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white transition-colors"
                    >
                        Create Room
                    </button>
                </div>
            </form>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
