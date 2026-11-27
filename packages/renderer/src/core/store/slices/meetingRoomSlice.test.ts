import { createStore } from 'zustand/vanilla';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUpdateSession = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateSession = vi.hoisted(() => vi.fn().mockResolvedValue('room-1'));
const mockDeleteSession = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSubscribeToMessages = vi.hoisted(() => vi.fn(() => () => {}));

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        createSession: mockCreateSession,
        updateSession: mockUpdateSession,
        deleteSession: mockDeleteSession,
        subscribeToMessages: mockSubscribeToMessages,
        appendMessage: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/core/context/ToastContext', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createBoardroomSlice } from '@/core/store/slices/boardroomSlice';
import { createMeetingRoomSlice } from '@/core/store/slices/meetingRoomSlice';
import { buildAgentSessionState } from '@/core/store/slices/agent/agentSessionSlice';
import { buildAgentUIState } from '@/core/store/slices/agent/agentUISlice';
import { sessionService } from '@/services/agent/SessionService';
import type { StoreState } from '@/core/store/types';

function createTestStore() {
    return createStore<StoreState>()((set, get, api) => {
        const ui = buildAgentUIState(set as never, get as never);
        const session = buildAgentSessionState(set as never, get as never);
        const boardroom = createBoardroomSlice(set as never, get as never, api as never);
        const meetingRoom = createMeetingRoomSlice(set, get, api);
        return {
            currentProjectId: 'proj-1',
            projects: [],
            ...ui,
            ...session,
            ...boardroom,
            ...meetingRoom,
        } as unknown as StoreState;
    });
}

describe('meetingRoomSlice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // vitest.config.ts enables restoreMocks: true, so restore mock implementations before each test.
        mockUpdateSession.mockResolvedValue(undefined);
        mockCreateSession.mockResolvedValue('room-1');
        mockDeleteSession.mockResolvedValue(undefined);
        mockSubscribeToMessages.mockReturnValue(() => {});
    });

    it('creates a persistent Meeting Room with heads + workers and leaves Boardroom HQ untouched', () => {
        const store = createTestStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Album Visuals Lab',
            missionBrief: 'Explore brutalist cover art',
            participants: ['creative', 'finance.tax', 'legal.contracts'],
            includeConductor: false,
            collaborationMode: 'roundtable',
            maxRoundtableRounds: 5, // clamped to 3
            category: 'concept-lab',
        });

        const state = store.getState();
        expect(state.activeMeetingRoomId).toBe(roomId);
        expect(state.activeSessionId).toBe(roomId);
        expect(state.sessions[roomId]?.namespace).toBe('meeting-room');
        expect(state.sessions[roomId]?.participants).toEqual(['creative', 'finance.tax', 'legal.contracts']);
        expect(state.sessions[roomId]?.meetingRoom?.maxRoundtableRounds).toBe(3);
        expect(state.sessions[roomId]?.meetingRoom?.isolateMemory).toBe(true);

        // Boardroom HQ slice remains completely isolated
        expect(state.activeAgents).toEqual(['generalist']);
    });

    it('enforces stationary room rosters after creation while allowing brief, mode, and asset updates', async () => {
        const store = createTestStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Deal Review',
            participants: ['legal', 'finance.tax'],
            includeConductor: true,
        });

        // No runtime toggle API exists for stationary Meeting Rooms
        expect('toggleMeetingRoomAgent' in store.getState()).toBe(false);
        expect(store.getState().sessions[roomId]?.participants).toEqual(['generalist', 'legal', 'finance.tax']);

        // Direct addParticipant calls cannot mutate a stationary Meeting Room roster
        store.getState().addParticipant(roomId, 'marketing');
        expect(store.getState().sessions[roomId]?.participants).toEqual(['generalist', 'legal', 'finance.tax']);

        // Passing disallowed roster fields at runtime preserves stationary participants & includeConductor
        await store.getState().updateMeetingRoomConfig(roomId, {
            title: 'Deal Review v2',
            missionBrief: 'Focus on mechanical royalties',
            collaborationMode: 'roundtable',
            maxRoundtableRounds: 3,
            ...( { participants: ['marketing'], includeConductor: false } as unknown as Record<string, unknown> ),
        });

        const updatedRoom = store.getState().sessions[roomId];
        expect(updatedRoom?.title).toBe('Deal Review v2');
        expect(updatedRoom?.meetingRoom?.missionBrief).toBe('Focus on mechanical royalties');
        expect(updatedRoom?.meetingRoom?.collaborationMode).toBe('roundtable');
        expect(updatedRoom?.participants).toEqual(['generalist', 'legal', 'finance.tax']);
        expect(updatedRoom?.meetingRoom?.includeConductor).toBe(true);

        // Asset pinning remains mutable per room
        await store.getState().pinAssetToMeetingRoom(roomId, {
            id: 'asset-1',
            name: 'Cover v1',
            type: 'url',
            value: 'https://example.com/cover.png',
        });
        expect(store.getState().sessions[roomId]?.meetingRoom?.referencedAssets).toHaveLength(1);

        await store.getState().unpinAssetFromMeetingRoom(roomId, 'asset-1');
        expect(store.getState().sessions[roomId]?.meetingRoom?.referencedAssets).toHaveLength(0);
    });

    it('falls back activeMeetingRoomId cleanly when archiving the active room', () => {
        const store = createTestStore();
        const firstId = store.getState().createMeetingRoom({ title: 'Room One' });
        const secondId = store.getState().createMeetingRoom({ title: 'Room Two' });
        expect(store.getState().activeMeetingRoomId).toBe(secondId);

        store.getState().archiveMeetingRoom(secondId);
        expect(store.getState().activeMeetingRoomId).toBe(firstId);
        expect(store.getState().sessions[secondId]?.isArchived).toBe(true);
    });

    it('assigns and reassigns Meeting Rooms to different projects or unassigned general scope', async () => {
        const store = createTestStore();
        const assignedRoomId = store.getState().createMeetingRoom({
            title: 'Tour Launch Room',
            projectId: 'proj-2',
        });
        expect(store.getState().sessions[assignedRoomId]?.projectId).toBe('proj-2');
        await new Promise(resolve => setTimeout(resolve, 50));

        const unassignedRoomId = store.getState().createMeetingRoom({
            title: 'Cross-Project Lab',
            projectId: null,
        });
        expect(store.getState().sessions[unassignedRoomId]?.projectId).toBeUndefined();
        await new Promise(resolve => setTimeout(resolve, 50));

        store.getState().assignMeetingRoomToProject(assignedRoomId, 'proj-3');
        expect(store.getState().sessions[assignedRoomId]?.projectId).toBe('proj-3');
        await vi.waitFor(() => {
            expect(sessionService.updateSession).toHaveBeenCalledWith(
                assignedRoomId,
                expect.objectContaining({ projectId: 'proj-3' })
            );
        }, { timeout: 1000 });

        store.getState().assignMeetingRoomToProject(assignedRoomId, null);
        expect(store.getState().sessions[assignedRoomId]?.projectId).toBeUndefined();
        await vi.waitFor(() => {
            expect(sessionService.updateSession).toHaveBeenCalledWith(
                assignedRoomId,
                expect.objectContaining({ projectId: undefined })
            );
        }, { timeout: 3000 });
    });

    it('clears activeSessionId on leaveMeetingRoomContext when no matching direct session exists', () => {
        const store = createTestStore();
        const roomId = store.getState().createMeetingRoom({ title: 'Isolated Lab' });
        expect(store.getState().activeSessionId).toBe(roomId);

        store.getState().leaveMeetingRoomContext();
        expect(store.getState().activeSessionId).toBeNull();
        expect(store.getState().agentHistory).toEqual([]);
    });
});
