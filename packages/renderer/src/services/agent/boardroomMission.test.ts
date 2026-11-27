import { describe, it, expect, vi, beforeEach } from 'vitest';

const state: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({
    useStore: { getState: () => state, setState: (patch: Record<string, unknown>) => Object.assign(state, patch) },
}));

import { stopBoardroomMission } from '@/services/agent/boardroomMission';

describe('stopBoardroomMission (spec W4/D2)', () => {
    beforeEach(() => {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, {
            agentAbortController: new AbortController(),
            stopAgent: vi.fn(() => { state.agentAbortController = null; }),
            a2aMessages: [
                { id: 'pending', fromAgent: 'generalist', toAgent: 'legal', content: 'x', timestamp: 1, requiresApproval: true, approved: false },
                { id: 'done', fromAgent: 'generalist', toAgent: 'creative', content: 'y', timestamp: 2, requiresApproval: true, approved: true },
                { id: 'note', fromAgent: 'generalist', toAgent: 'brand', content: 'z', timestamp: 3 },
            ],
            boardroomControlRevocation: 0,
        });
    });

    it('stops the run, rejects pending approvals and revokes browser control', () => {
        const result = stopBoardroomMission();

        expect(state.stopAgent).toHaveBeenCalledTimes(1);
        const messages = state.a2aMessages as Array<{ id: string; rejected?: boolean; approved?: boolean }>;
        expect(messages.find(m => m.id === 'pending')).toMatchObject({ approved: false, rejected: true });
        expect(messages.find(m => m.id === 'done')).toMatchObject({ approved: true });
        expect(messages.find(m => m.id === 'done')?.rejected).toBeUndefined();
        expect(state.boardroomControlRevocation).toBe(1);
        expect(state.boardroomControl).toMatchObject({ holder: 'artist', grantId: null, revision: 1 });
        expect(result).toEqual({ stoppedRun: true, cancelledApprovals: 1 });
    });

    it('still revokes control when no run is active', () => {
        state.agentAbortController = null;
        state.a2aMessages = [];
        expect(stopBoardroomMission()).toEqual({ stoppedRun: false, cancelledApprovals: 0 });
        expect(state.boardroomControlRevocation).toBe(1);
        expect(state.boardroomControl).toMatchObject({ holder: 'artist', grantId: null, revision: 1 });
    });
});
