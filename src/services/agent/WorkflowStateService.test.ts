import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    Timestamp: {
        now: vi.fn(() => ({ seconds: 1000, nanoseconds: 0 })),
    },
}));

// Mock FirestoreService — must be a real constructor function, not an arrow function
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockList = vi.fn().mockResolvedValue([]);

function MockFirestoreService() {
    return { set: mockSet, get: mockGet, list: mockList };
}

vi.mock('../FirestoreService', () => ({
    FirestoreService: MockFirestoreService,
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-execution-id'),
}));

import { workflowStateService } from './WorkflowStateService';
import type { WorkflowStep } from './WorkflowRegistry';
import type { WorkflowExecution } from './types';

describe('WorkflowStateService', () => {
    const userId = 'test-user';

    const mockSteps: WorkflowStep[] = [
        { agentId: 'brand', prompt: 'Analyze brand', priority: 'HIGH' },
        { agentId: 'marketing', prompt: 'Create strategy', priority: 'MEDIUM' },
        { agentId: 'social', prompt: 'Draft posts', priority: 'LOW' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createExecution', () => {
        it('should create a new execution with all steps as planned', async () => {
            const execution = await workflowStateService.createExecution(
                userId,
                'CAMPAIGN_LAUNCH',
                mockSteps,
                'session-123'
            );

            expect(execution.id).toBe('test-execution-id');
            expect(execution.workflowId).toBe('CAMPAIGN_LAUNCH');
            expect(execution.userId).toBe(userId);
            expect(execution.status).toBe('planned');
            expect(execution.steps).toHaveLength(3);
            expect(execution.steps[0]!.status).toBe('planned');
            expect(execution.steps[1]!.status).toBe('planned');
            expect(execution.steps[2]!.status).toBe('planned');
            expect(execution.currentStepIndex).toBe(0);
            expect(mockSet).toHaveBeenCalledOnce();
        });
    });

    describe('advanceStep', () => {
        it('should mark a step as complete and advance the index', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-1',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                currentStepIndex: 0,
                steps: [
                    { stepIndex: 0, agentId: 'brand', prompt: 'Analyze brand', status: 'executing', startedAt: 1000, idempotencyKey: 'test-key-0' },
                    { stepIndex: 1, agentId: 'marketing', prompt: 'Create strategy', status: 'planned', idempotencyKey: 'test-key-1' },
                    { stepIndex: 2, agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                ],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-1', 0, 'Brand audit complete');

            expect(result.steps[0]!.status).toBe('step_complete');
            expect(result.steps[0]!.result).toBe('Brand audit complete');
            expect(result.currentStepIndex).toBe(1);
            expect(result.status).toBe('executing');
            expect(mockSet).toHaveBeenCalledOnce();
        });

        it('should mark the workflow as completed when all steps are done', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-2',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                currentStepIndex: 2,
                steps: [
                    { stepIndex: 0, agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    { stepIndex: 1, agentId: 'marketing', prompt: 'Create strategy', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-1' },
                    { stepIndex: 2, agentId: 'social', prompt: 'Draft posts', status: 'executing', startedAt: 2000, idempotencyKey: 'test-key-2' },
                ],
                createdAt: 1000,
                updatedAt: 2000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-2', 2, 'Social posts drafted');

            expect(result.steps[2]!.status).toBe('step_complete');
            expect(result.status).toBe('completed');
        });
    });

    describe('failStep', () => {
        it('should mark a step and the workflow as failed while preserving remaining planned steps', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-3',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                currentStepIndex: 1,
                steps: [
                    { stepIndex: 0, agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    { stepIndex: 1, agentId: 'marketing', prompt: 'Create strategy', status: 'executing', startedAt: 1500, idempotencyKey: 'test-key-1' },
                    { stepIndex: 2, agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                ],
                createdAt: 1000,
                updatedAt: 1500,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.failStep(userId, 'exec-3', 1, 'API timeout');

            expect(result.steps[1]!.status).toBe('failed');
            expect(result.steps[1]!.error).toBe('API timeout');
            expect(result.steps[2]!.status).toBe('planned'); // Preserved for resume
            expect(result.status).toBe('failed');
        });
    });

    describe('cancelExecution', () => {
        it('should cancel the execution and all non-terminal steps', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-4',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                currentStepIndex: 0,
                steps: [
                    { stepIndex: 0, agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    { stepIndex: 1, agentId: 'marketing', prompt: 'Create strategy', status: 'planned', idempotencyKey: 'test-key-1' },
                    { stepIndex: 2, agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                ],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            await workflowStateService.cancelExecution(userId, 'exec-4');

            const savedDoc = mockSet.mock.calls[0]![1] as WorkflowExecution;
            expect(savedDoc.status).toBe('cancelled');
            expect(savedDoc.steps[0]!.status).toBe('step_complete'); // Already complete — not cancelled
            expect(savedDoc.steps[1]!.status).toBe('cancelled');
            expect(savedDoc.steps[2]!.status).toBe('cancelled');
        });
    });

    describe('getResumableExecutions', () => {
        it('should return only non-terminal executions', async () => {
            const executions: WorkflowExecution[] = [
                { id: '1', workflowId: 'A', userId, status: 'completed', steps: [], currentStepIndex: 0, createdAt: 1, updatedAt: 1 },
                { id: '2', workflowId: 'B', userId, status: 'failed', steps: [], currentStepIndex: 0, createdAt: 2, updatedAt: 2 },
                { id: '3', workflowId: 'C', userId, status: 'cancelled', steps: [], currentStepIndex: 0, createdAt: 3, updatedAt: 3 },
                { id: '4', workflowId: 'D', userId, status: 'planned', steps: [], currentStepIndex: 0, createdAt: 4, updatedAt: 4 },
                { id: '5', workflowId: 'E', userId, status: 'executing', steps: [], currentStepIndex: 0, createdAt: 5, updatedAt: 5 },
            ];

            mockList.mockResolvedValue(executions);

            const result = await workflowStateService.getResumableExecutions(userId);

            expect(result).toHaveLength(3);
            expect(result.map(e => e.id)).toEqual(['2', '4', '5']);
        });
    });
});
