import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';

const mockGetBoardroomDispatchPlan = vi.hoisted(() => vi.fn(async (agents: string[]) => ({
    type: 'BOARDROOM_DISPATCH_PLAN',
    code: 'BOARDROOM_DISPATCH_READY',
    executedAgentIds: agents,
    deferredAgentIds: [],
    maxIterationsPerAgent: 4,
    nextContinuationAgentId: null,
    leaseId: 'lease-1',
    leaseExpiresAtMs: Date.now() + 60000,
    sideEffectOwnerAgentId: null,
})));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        getBoardroomDispatchPlan: mockGetBoardroomDispatchPlan,
    },
}));

vi.mock('@/config/boardroomIntentPolicy', () => ({
    boardroomConversationIsReadOnly: (intent: string | null) => intent === 'discussion' || intent === 'capability',
}));

vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        running: false,
        ingestFromSession: vi.fn().mockResolvedValue(0),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MeetingRoomOrchestrator } from '@/services/agent/orchestration/MeetingRoomOrchestrator';
import { createMeetingRoomSlice } from '@/core/store/slices/meetingRoomSlice';
import { buildAgentSessionState } from '@/core/store/slices/agent/agentSessionSlice';
import { buildAgentUIState } from '@/core/store/slices/agent/agentUISlice';
import { createBoardroomSlice } from '@/core/store/slices/boardroomSlice';
import type { StoreState } from '@/core/store/types';

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        createSession: vi.fn().mockResolvedValue('r1'),
        updateSession: vi.fn().mockResolvedValue(undefined),
        deleteSession: vi.fn().mockResolvedValue(undefined),
        subscribeToMessages: vi.fn(() => () => {}),
        appendMessage: vi.fn().mockResolvedValue(undefined),
    },
}));

function buildStore() {
    return createStore<StoreState>()((set, get, api) => {
        const ui = buildAgentUIState(set as never, get as never);
        const session = buildAgentSessionState(set as never, get as never);
        const boardroom = createBoardroomSlice(set as never, get as never, api as never);
        const meetingRoom = createMeetingRoomSlice(set, get, api);
        return {
            currentProjectId: 'proj-1',
            projects: [],
            generatedHistory: [],
            uploadedImages: [],
            ...ui,
            ...session,
            ...boardroom,
            ...meetingRoom,
        } as unknown as StoreState;
    });
}

describe('MeetingRoomOrchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('executes DAG steps with scoped workers when allowWorkers is enabled', async () => {
        const store = buildStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Tax & Contracts Room',
            missionBrief: 'Verify sync agreement tax impact',
            participants: ['finance.tax', 'legal.contracts'],
            includeConductor: false,
            collaborationMode: 'dag',
        });

        const responseId = 'resp-dag-1';
        store.getState().addMessageToSession(roomId, {
            id: responseId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });

        const executeMock = vi.fn(async (agentId: string) => ({
            text: `Completed step for ${agentId}`,
            toolCalls: [{ name: 'analyze_clause', args: {}, result: { success: true, message: `Verified by ${agentId}` } }],
        }));

        const orchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('action'),
                determineOrchestrationPath: vi.fn().mockResolvedValue({
                    type: 'parallel',
                    subtasks: [
                        { agentId: 'finance.tax', subtask: 'Check withholding rate' },
                        { agentId: 'legal.contracts', subtask: 'Check territory clause' },
                    ],
                }),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await orchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Review this sync licensing deal' },
            context: { projectId: 'proj-1' },
            responseId,
            store,
        });

        expect(executeMock).toHaveBeenCalledTimes(2);
        expect(executeMock.mock.calls.map(c => c[0])).toEqual(['finance.tax', 'legal.contracts']);
        const finalMsg = store.getState().sessions[roomId]?.messages.find(m => m.id === responseId);
        expect(finalMsg?.isStreaming).toBe(false);
        expect(finalMsg?.text).toContain('Verified by finance.tax');
        expect(finalMsg?.text).toContain('Verified by legal.contracts');
    });

    it('runs bounded Roundtable rounds, shares newly created room assets in Round 2, and stops on [CONVERGED]', async () => {
        const store = buildStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Cover Lab',
            missionBrief: 'Neon noir vinyl packaging',
            participants: ['creative', 'marketing'],
            includeConductor: true,
            collaborationMode: 'roundtable',
            maxRoundtableRounds: 3,
        });

        const responseId = 'resp-rt-1';
        store.getState().addMessageToSession(roomId, {
            id: responseId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });

        let callIdx = 0;
        const executeMock = vi.fn(async (agentId: string, prompt: string) => {
            callIdx += 1;
            if (callIdx === 1 && agentId === 'creative') {
                // Simulate creative generating a room-tagged asset during Round 1
                store.setState({
                    generatedHistory: [{
                        id: 'gen-asset-round1',
                        type: 'image',
                        url: 'https://example.com/neon-v1.png',
                        prompt: 'Neon noir vinyl cover v1',
                        timestamp: Date.now() + 5,
                        projectId: 'proj-1',
                        sessionId: roomId,
                    }],
                });
                return { text: 'Generated Neon noir vinyl cover v1.' };
            }
            if (callIdx === 2 && agentId === 'marketing') {
                return { text: 'Strong hook, let us sharpen contrast for social thumbnails.' };
            }
            // Round 2: both agents receive Round 1 outputs + new asset, then converge
            expect(prompt).toContain('PRIOR ROUND PEER CONTRIBUTIONS');
            expect(prompt).toContain('NEWLY GENERATED ROOM ASSETS TO CRITIQUE / BUILD ON');
            expect(prompt).toContain('Neon noir vinyl cover v1');
            return { text: '[CONVERGED] Ready to ship.' };
        });

        const orchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('discussion'),
                determineOrchestrationPath: vi.fn(),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await orchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Let us iterate on the cover concept' },
            context: { projectId: 'proj-1' },
            responseId,
            store,
        });

        // Stopped early after Round 2 because both converged (did not run Round 3)
        expect(executeMock).toHaveBeenCalledTimes(4);
        const finalMsg = store.getState().sessions[roomId]?.messages.find(m => m.id === responseId);
        expect(finalMsg?.text).toContain('Roundtable converged after 2 round(s)');
        expect(store.getState().meetingRoomRoundtableStatus).toBeNull();
    });

    it('honors AbortSignal mid-roundtable for Stop / Interject', async () => {
        const store = buildStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Interruptible Room',
            participants: ['creative', 'marketing'],
            includeConductor: false,
            collaborationMode: 'roundtable',
            maxRoundtableRounds: 3,
        });

        const responseId = 'resp-abort';
        store.getState().addMessageToSession(roomId, {
            id: responseId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });

        const controller = new AbortController();
        const executeMock = vi.fn(async () => {
            controller.abort();
            return { text: 'First turn completed before pause.' };
        });

        const orchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('discussion'),
                determineOrchestrationPath: vi.fn(),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await orchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Brainstorm rollout' },
            context: { projectId: 'proj-1' },
            responseId,
            signal: controller.signal,
            store,
        });

        expect(executeMock).toHaveBeenCalledTimes(1);
        const finalMsg = store.getState().sessions[roomId]?.messages.find(m => m.id === responseId);
        expect(finalMsg?.text).toContain('Roundtable paused by user');
        expect(store.getState().meetingRoomRoundtableStatus).toBeNull();
    });

    it('constrains DAG execution strictly to the room stationary roster even when Conductor is seated', async () => {
        const store = buildStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Locked Duo Room',
            missionBrief: 'Visuals only',
            participants: ['creative'],
            includeConductor: true,
            collaborationMode: 'dag',
        });

        const responseId = 'resp-dag-stationary';
        store.getState().addMessageToSession(roomId, {
            id: responseId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });

        const executeMock = vi.fn(async (agentId: string) => ({
            text: `Handled by ${agentId}`,
            toolCalls: [{ name: 'draft_concept', args: {}, result: { success: true, message: `Handled by ${agentId}` } }],
        }));

        const orchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('action'),
                determineOrchestrationPath: vi.fn().mockResolvedValue({
                    type: 'parallel',
                    subtasks: [
                        // Router proposes unseated 'legal' + seated 'creative'
                        { agentId: 'legal', subtask: 'Review licensing terms' },
                        { agentId: 'creative', subtask: 'Create moodboard' },
                    ],
                }),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await orchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Draft artwork and check contract' },
            context: { projectId: 'proj-1' },
            responseId,
            store,
        });

        // Unseated 'legal' must be remapped to seated 'generalist'; room roster remains unchanged
        expect(executeMock.mock.calls.map(c => c[0])).toEqual(['generalist', 'creative']);
        expect(store.getState().sessions[roomId]?.participants).toEqual(['generalist', 'creative']);
    });

    it('fails closed in DAG mode on admission rejection and finalizes streaming on abort', async () => {
        const store = buildStore();
        const roomId = store.getState().createMeetingRoom({
            title: 'Admission & Abort Room',
            participants: ['creative', 'marketing'],
            includeConductor: false,
            collaborationMode: 'dag',
        });

        const failClosedId = 'resp-dag-fail-closed';
        store.getState().addMessageToSession(roomId, {
            id: failClosedId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });

        mockGetBoardroomDispatchPlan.mockRejectedValueOnce(new Error('budget exhausted'));
        const executeMock = vi.fn();
        const orchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('action'),
                determineOrchestrationPath: vi.fn().mockResolvedValue({
                    type: 'parallel',
                    subtasks: [{ agentId: 'creative', subtask: 'Create artwork' }],
                }),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await orchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Generate cover artwork' },
            context: { projectId: 'proj-1' },
            responseId: failClosedId,
            store,
        });

        expect(executeMock).not.toHaveBeenCalled();
        const failedMsg = store.getState().sessions[roomId]?.messages.find(m => m.id === failClosedId);
        expect(failedMsg?.isStreaming).toBe(false);
        expect(failedMsg?.text).toContain('temporarily unavailable');

        // Abort mid-intent planning must finalize responseId instead of leaving isStreaming: true
        const abortId = 'resp-dag-abort';
        store.getState().addMessageToSession(roomId, {
            id: abortId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
        });
        const abortController = new AbortController();
        const abortOrchestrator = new MeetingRoomOrchestrator({
            executor: { execute: executeMock },
            orchestrator: {
                determineBoardroomIntent: vi.fn(async () => {
                    abortController.abort();
                    return 'action' as const;
                }),
                determineOrchestrationPath: vi.fn(),
            },
            appendRunMessage: (s, msg, sid) => {
                if (sid) s.getState().addMessageToSession(sid, msg);
            },
            notifyLiveConversationIfActive: vi.fn(),
        });

        await abortOrchestrator.executeMeetingRoomRequest({
            roomId,
            task: { rawUserUtterance: 'Generate video teaser' },
            context: { projectId: 'proj-1' },
            responseId: abortId,
            signal: abortController.signal,
            store,
        });

        const abortedMsg = store.getState().sessions[roomId]?.messages.find(m => m.id === abortId);
        expect(abortedMsg?.isStreaming).toBe(false);
        expect(abortedMsg?.text).toContain('paused by user');
    });
});
