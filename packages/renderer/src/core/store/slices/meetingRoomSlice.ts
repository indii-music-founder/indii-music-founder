import { StateCreator } from 'zustand';
import type { BoardroomWorkbenchTarget, BoardroomWorkspaceLayout, BoardroomWorkspaceTab, ReferencedAsset } from '@/core/store/slices/boardroomSlice';
import type {
    ConversationSession,
    MeetingRoomCategory,
    MeetingRoomCollaborationMode,
    MeetingRoomConfig,
} from '@/core/store/slices/agent/agentSessionSlice';
import {
    normalizeMeetingRoomAgentIds,
} from '@/services/agent/departments';
import type { StoreState } from '@/core/store/types';
import { logger } from '@/utils/logger';

export type MeetingRoomWorkspaceTab = BoardroomWorkspaceTab | 'memory';
export type MeetingRoomAssetScope = 'room' | 'project';

export interface MeetingRoomRoundtableStatus {
    active: boolean;
    currentRound: number;
    maxRounds: number;
    activeAgentId: string | null;
}

export interface CreateMeetingRoomInput {
    title: string;
    missionBrief?: string;
    participants?: string[];
    includeConductor?: boolean;
    collaborationMode?: MeetingRoomCollaborationMode;
    maxRoundtableRounds?: number;
    category?: MeetingRoomCategory;
    isolateMemory?: boolean;
    projectId?: string | null;
}

export interface MeetingRoomSlice {
    activeMeetingRoomId: string | null;
    meetingRoomWorkspaceLayout: BoardroomWorkspaceLayout;
    meetingRoomWorkspaceTab: MeetingRoomWorkspaceTab;
    meetingRoomAssetScope: MeetingRoomAssetScope;
    meetingRoomWorkbenchTarget: BoardroomWorkbenchTarget;
    meetingRoomRoundtableStatus: MeetingRoomRoundtableStatus | null;

    createMeetingRoom: (input: CreateMeetingRoomInput) => string;
    selectMeetingRoom: (roomId: string) => void;
    leaveMeetingRoomContext: () => void;
    assignMeetingRoomToProject: (roomId: string, projectId: string | null) => void;
    updateMeetingRoomConfig: (
        roomId: string,
        updates: Partial<Omit<MeetingRoomConfig, 'includeConductor'>> & { title?: string }
    ) => Promise<void>;
    pinAssetToMeetingRoom: (roomId: string, asset: ReferencedAsset) => Promise<void>;
    unpinAssetFromMeetingRoom: (roomId: string, assetId: string) => Promise<void>;
    archiveMeetingRoom: (roomId: string) => void;
    deleteMeetingRoom: (roomId: string) => void;

    setMeetingRoomWorkspaceLayout: (layout: BoardroomWorkspaceLayout) => void;
    setMeetingRoomWorkspaceTab: (tab: MeetingRoomWorkspaceTab) => void;
    setMeetingRoomAssetScope: (scope: MeetingRoomAssetScope) => void;
    setMeetingRoomWorkbenchTarget: (target: BoardroomWorkbenchTarget) => void;
    openMeetingRoomWorkbench: (target?: BoardroomWorkbenchTarget, layout?: 'split' | 'stage') => void;
    setMeetingRoomRoundtableStatus: (status: MeetingRoomRoundtableStatus | null) => void;
}

function clampRoundtableRounds(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 2;
    return Math.min(3, Math.max(1, Math.round(value)));
}

function defaultMeetingRoomConfig(input: CreateMeetingRoomInput): MeetingRoomConfig {
    return {
        missionBrief: (input.missionBrief ?? '').trim(),
        includeConductor: input.includeConductor ?? true,
        collaborationMode: input.collaborationMode ?? 'dag',
        maxRoundtableRounds: clampRoundtableRounds(input.maxRoundtableRounds),
        referencedAssets: [],
        category: input.category ?? 'concept-lab',
        isolateMemory: input.isolateMemory ?? true,
    };
}

async function persistRoomUpdate(
    roomId: string,
    updates: Partial<ConversationSession>
): Promise<void> {
    try {
        const { sessionService } = await import('@/services/agent/SessionService');
        await sessionService.updateSession(roomId, updates);
    } catch (error) {
        logger.warn(`[MeetingRoomSlice] Failed to persist room update for ${roomId}:`, error);
    }
}

function findFallbackRoomId(
    sessions: Record<string, ConversationSession>,
    excludedRoomId: string,
    projectId?: string
): string | null {
    const candidates = Object.values(sessions)
        .filter(s => s.namespace === 'meeting-room' && s.id !== excludedRoomId && !s.isArchived)
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const sameProject = projectId
        ? candidates.find(s => !s.projectId || s.projectId === projectId)
        : undefined;
    return sameProject?.id ?? candidates[0]?.id ?? null;
}

export const createMeetingRoomSlice: StateCreator<StoreState, [], [], MeetingRoomSlice> = (set, get) => ({
    activeMeetingRoomId: null,
    meetingRoomWorkspaceLayout: 'closed',
    meetingRoomWorkspaceTab: 'memory',
    meetingRoomAssetScope: 'room',
    meetingRoomWorkbenchTarget: null,
    meetingRoomRoundtableStatus: null,

    createMeetingRoom: (input) => {
        const state = get();
        const currentActive = state.activeSessionId;
        const currentSession = currentActive ? state.sessions[currentActive] : undefined;
        if (currentActive && currentSession && !currentSession.namespace) {
            set({ lastDirectSessionId: currentActive });
        }

        const config = defaultMeetingRoomConfig(input);
        const requestedParticipants = input.participants !== undefined
            ? input.participants
            : ['creative', 'marketing'];
        const normalizedParticipants = normalizeMeetingRoomAgentIds(
            requestedParticipants,
            { includeConductor: config.includeConductor }
        );
        const finalParticipants = normalizedParticipants.length > 0
            ? normalizedParticipants
            : ['generalist'];

        const roomTitle = input.title.trim() || 'Untitled Meeting Room';
        const resolvedProjectId =
            input.projectId === null || input.projectId === ''
                ? null
                : (input.projectId ?? state.currentProjectId);
        const roomId = state.createSession(
            roomTitle,
            finalParticipants,
            'meeting-room',
            resolvedProjectId,
            {
                source: 'meeting-room',
                meetingRoom: config,
            }
        );

        set({
            activeMeetingRoomId: roomId,
            meetingRoomAssetScope: 'room',
        });
        state.setActiveSession(roomId);
        return roomId;
    },

    selectMeetingRoom: (roomId) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;

        const currentActive = state.activeSessionId;
        const currentSession = currentActive ? state.sessions[currentActive] : undefined;
        if (currentActive && currentSession && !currentSession.namespace) {
            set({ lastDirectSessionId: currentActive });
        }

        set({
            activeMeetingRoomId: roomId,
            meetingRoomAssetScope: 'room',
        });
        state.setActiveSession(roomId);
    },

    leaveMeetingRoomContext: () => {
        const state = get();
        const activeSession = state.activeSessionId ? state.sessions[state.activeSessionId] : undefined;
        if (!activeSession || activeSession.namespace !== 'meeting-room') return;

        const projectId = state.currentProjectId;
        let targetSessionId = state.lastDirectSessionId;
        const targetSession = targetSessionId ? state.sessions[targetSessionId] : undefined;
        const isMatch = targetSession && !targetSession.namespace && (!targetSession.projectId || targetSession.projectId === projectId);

        if (!targetSessionId || !isMatch) {
            const fallback = Object.values(state.sessions).find(
                s => !s.namespace && (!s.projectId || s.projectId === projectId)
            );
            targetSessionId = fallback ? fallback.id : null;
        }

        if (targetSessionId) {
            state.setActiveSession(targetSessionId);
        } else {
            set({ activeSessionId: null, agentHistory: [] });
        }
    },

    assignMeetingRoomToProject: (roomId, projectId) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;
        state.updateSessionProject(roomId, projectId || null);
    },

    updateMeetingRoomConfig: async (roomId, updates) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;

        // Meeting Rooms have stationary rosters: participants and includeConductor are locked after creation.
        const existingConfig: MeetingRoomConfig = room.meetingRoom ?? defaultMeetingRoomConfig({ title: room.title });
        const nextConfig: MeetingRoomConfig = {
            ...existingConfig,
            ...(updates.missionBrief !== undefined ? { missionBrief: updates.missionBrief } : {}),
            ...(updates.collaborationMode !== undefined ? { collaborationMode: updates.collaborationMode } : {}),
            ...(updates.maxRoundtableRounds !== undefined
                ? { maxRoundtableRounds: clampRoundtableRounds(updates.maxRoundtableRounds) }
                : {}),
            ...(updates.referencedAssets !== undefined ? { referencedAssets: updates.referencedAssets } : {}),
            ...(updates.category !== undefined ? { category: updates.category } : {}),
            ...(updates.isolateMemory !== undefined ? { isolateMemory: updates.isolateMemory } : {}),
            includeConductor: existingConfig.includeConductor,
        };

        const nextTitle = updates.title !== undefined ? (updates.title.trim() || room.title) : room.title;
        const updatedAt = Date.now();

        set(prev => {
            const current = prev.sessions[roomId];
            if (!current) return {};
            return {
                sessions: {
                    ...prev.sessions,
                    [roomId]: {
                        ...current,
                        title: nextTitle,
                        meetingRoom: nextConfig,
                        updatedAt,
                    },
                },
            };
        });

        await persistRoomUpdate(roomId, {
            title: nextTitle,
            meetingRoom: nextConfig,
            updatedAt,
        });
    },

    pinAssetToMeetingRoom: async (roomId, asset) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;

        const existingAssets = room.meetingRoom?.referencedAssets ?? [];
        if (existingAssets.some(a => a.id === asset.id)) return;
        const nextAssets = [...existingAssets, asset];
        await state.updateMeetingRoomConfig(roomId, { referencedAssets: nextAssets });
    },

    unpinAssetFromMeetingRoom: async (roomId, assetId) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;

        const existingAssets = room.meetingRoom?.referencedAssets ?? [];
        const nextAssets = existingAssets.filter(a => a.id !== assetId);
        await state.updateMeetingRoomConfig(roomId, { referencedAssets: nextAssets });
    },

    archiveMeetingRoom: (roomId) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;
        state.archiveSession(roomId);
        if (state.activeMeetingRoomId === roomId) {
            const fallbackId = findFallbackRoomId(state.sessions, roomId, state.currentProjectId);
            set({ activeMeetingRoomId: fallbackId });
            if (fallbackId) {
                state.setActiveSession(fallbackId);
            }
        }
    },

    deleteMeetingRoom: (roomId) => {
        const state = get();
        const room = state.sessions[roomId];
        if (!room || room.namespace !== 'meeting-room') return;
        const fallbackId = state.activeMeetingRoomId === roomId
            ? findFallbackRoomId(state.sessions, roomId, state.currentProjectId)
            : state.activeMeetingRoomId;
        state.deleteSession(roomId);
        if (state.activeMeetingRoomId === roomId) {
            set({ activeMeetingRoomId: fallbackId });
            if (fallbackId && get().sessions[fallbackId]) {
                state.setActiveSession(fallbackId);
            }
        }
    },

    setMeetingRoomWorkspaceLayout: (layout) => set({ meetingRoomWorkspaceLayout: layout }),

    setMeetingRoomWorkspaceTab: (tab) => set((state) => ({
        meetingRoomWorkspaceTab: tab,
        meetingRoomWorkspaceLayout: state.meetingRoomWorkspaceLayout === 'closed' ? 'split' : state.meetingRoomWorkspaceLayout,
    })),

    setMeetingRoomAssetScope: (scope) => set({ meetingRoomAssetScope: scope }),

    setMeetingRoomWorkbenchTarget: (target) => set({ meetingRoomWorkbenchTarget: target }),

    openMeetingRoomWorkbench: (target, layout) => set((state) => ({
        meetingRoomWorkspaceLayout: layout || (state.meetingRoomWorkspaceLayout === 'closed' ? 'split' : state.meetingRoomWorkspaceLayout),
        meetingRoomWorkspaceTab: 'workbench',
        ...(target !== undefined ? { meetingRoomWorkbenchTarget: target } : {}),
    })),

    setMeetingRoomRoundtableStatus: (status) => set({ meetingRoomRoundtableStatus: status }),
});
