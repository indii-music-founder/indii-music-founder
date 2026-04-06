/**
 * Unit tests for agentPlanSlice — Structured Progress Updates store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentPlanSlice, type AgentPlanSlice } from '@/core/store/slices/agentPlanSlice';
import type { AgentPlanEvent } from '@/types/AgentPlan';

// Minimal Zustand-compatible test harness
function createTestSlice(): AgentPlanSlice {
    let state: AgentPlanSlice;
    const set = (partial: Partial<AgentPlanSlice> | ((s: AgentPlanSlice) => Partial<AgentPlanSlice>)) => {
        const patch = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...patch };
    };
    const get = () => state;
    state = createAgentPlanSlice(set as any, get as any, {} as any);
    return new Proxy({} as AgentPlanSlice, {
        get: (_target, prop: string) => {
            const val = state[prop as keyof AgentPlanSlice];
            return typeof val === 'function' ? val.bind(state) : val;
        },
    });
}

const makePlan = (overrides?: Partial<AgentPlanEvent>): AgentPlanEvent => ({
    planId: 'test-plan-1',
    title: 'Test Plan',
    steps: [
        { id: 'step-1', label: 'Step 1', status: 'pending' },
        { id: 'step-2', label: 'Step 2', status: 'pending' },
        { id: 'step-3', label: 'Step 3', status: 'pending' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
});

describe('agentPlanSlice', () => {
    let slice: AgentPlanSlice;

    beforeEach(() => {
        slice = createTestSlice();
    });

    describe('setPlan', () => {
        it('should set the active plan', () => {
            const plan = makePlan();
            slice.setPlan(plan);
            expect(slice.activePlan).not.toBeNull();
            expect(slice.activePlan?.planId).toBe('test-plan-1');
            expect(slice.activePlan?.steps).toHaveLength(3);
        });

        it('should replace existing active plan', () => {
            slice.setPlan(makePlan());
            const newPlan = makePlan({ planId: 'plan-2', title: 'Plan 2' });
            slice.setPlan(newPlan);
            expect(slice.activePlan?.planId).toBe('plan-2');
            expect(slice.activePlan?.title).toBe('Plan 2');
        });
    });

    describe('updatePlanStep', () => {
        it('should update a step status to running', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'running');
            const step = slice.activePlan?.steps.find(s => s.id === 'step-1');
            expect(step?.status).toBe('running');
            expect(step?.startedAt).toBeDefined();
        });

        it('should update a step status to done', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'running');
            slice.updatePlanStep('test-plan-1', 'step-1', 'done');
            const step = slice.activePlan?.steps.find(s => s.id === 'step-1');
            expect(step?.status).toBe('done');
            expect(step?.completedAt).toBeDefined();
        });

        it('should update a step status to failed with error', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'failed', 'Network timeout');
            const step = slice.activePlan?.steps.find(s => s.id === 'step-1');
            expect(step?.status).toBe('failed');
            expect(step?.error).toBe('Network timeout');
        });

        it('should not update if plan ID does not match', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('wrong-plan', 'step-1', 'running');
            const step = slice.activePlan?.steps.find(s => s.id === 'step-1');
            expect(step?.status).toBe('pending');
        });

        it('should move plan to history when all steps are terminal', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'done');
            slice.updatePlanStep('test-plan-1', 'step-2', 'done');
            slice.updatePlanStep('test-plan-1', 'step-3', 'done');
            expect(slice.planHistory).toHaveLength(1);
            expect(slice.planHistory[0]!.planId).toBe('test-plan-1');
        });

        it('should not move to history when steps are mixed terminal and non-terminal', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'done');
            slice.updatePlanStep('test-plan-1', 'step-2', 'running');
            expect(slice.planHistory).toHaveLength(0);
        });

        it('should treat skipped as terminal', () => {
            slice.setPlan(makePlan());
            slice.updatePlanStep('test-plan-1', 'step-1', 'done');
            slice.updatePlanStep('test-plan-1', 'step-2', 'skipped');
            slice.updatePlanStep('test-plan-1', 'step-3', 'failed', 'Skipped too');
            expect(slice.planHistory).toHaveLength(1);
        });
    });

    describe('clearPlan', () => {
        it('should clear the active plan', () => {
            slice.setPlan(makePlan());
            slice.clearPlan();
            expect(slice.activePlan).toBeNull();
        });

        it('should move active plan to history when clearing', () => {
            slice.setPlan(makePlan());
            slice.clearPlan();
            expect(slice.planHistory).toHaveLength(1);
        });

        it('should not duplicate in history if already there', () => {
            slice.setPlan(makePlan());
            // Complete all steps to push to history automatically
            slice.updatePlanStep('test-plan-1', 'step-1', 'done');
            slice.updatePlanStep('test-plan-1', 'step-2', 'done');
            slice.updatePlanStep('test-plan-1', 'step-3', 'done');
            // Now clear — should not duplicate
            slice.clearPlan();
            expect(slice.planHistory).toHaveLength(1);
        });

        it('should be a no-op when no plan is active', () => {
            slice.clearPlan();
            expect(slice.activePlan).toBeNull();
            expect(slice.planHistory).toHaveLength(0);
        });
    });
});
