import { describe, expect, it } from 'vitest';
import {
    meetingRoomAddressedAgents,
    validateBoardroomSteps,
    type BoardroomActionStep,
} from '@/services/agent/orchestration/BoardroomActionPlan';

describe('BoardroomActionPlan — Meeting Room worker & addressing support', () => {
    it('continues rejecting workers when allowWorkers is omitted (Boardroom HQ contract)', () => {
        const steps: BoardroomActionStep[] = [
            { id: 'step-1', agentId: 'finance.tax', task: 'Estimate tax reserve', dependencies: [] },
        ];
        expect(() => validateBoardroomSteps(steps)).toThrow('department owner');
    });

    it('accepts scoped workers when allowWorkers is true', () => {
        const steps: BoardroomActionStep[] = [
            { id: 'step-1', agentId: 'finance.tax', task: 'Estimate tax reserve', dependencies: [] },
            { id: 'step-2', agentId: 'legal.contracts', task: 'Review split sheet', dependencies: ['step-1'] },
        ];
        expect(() => validateBoardroomSteps(steps, { allowWorkers: true })).not.toThrow();
    });

    it('resolves addressed heads and seated workers by ID, suffix, or display name', () => {
        const seated = ['creative', 'finance.tax', 'legal.contracts'];
        expect(
            meetingRoomAddressedAgents('Creative, Tax Specialist & legal.contracts: check the rollout terms.', seated)
        ).toEqual(['creative', 'finance.tax', 'legal.contracts']);
    });

    it('ignores unseated department heads so they are not routed or rewritten', () => {
        const seated = ['creative', 'finance.tax'];
        expect(
            meetingRoomAddressedAgents('Creative & Legal Department: review this.', seated)
        ).toEqual([]);
        expect(
            meetingRoomAddressedAgents('Marketing: draft a campaign.', seated)
        ).toEqual([]);
    });
});
