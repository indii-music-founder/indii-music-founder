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
import type { WorkflowStep, WorkflowExecution } from './types';

describe('WorkflowStateService', () => {
    const userId = 'test-user';

    const mockSteps: WorkflowStep[] = [
        { id: 'step_0', agentId: 'brand', prompt: 'Analyze brand', priority: 'HIGH' },
        { id: 'step_1', agentId: 'marketing', prompt: 'Create strategy', priority: 'MEDIUM' },
        { id: 'step_2', agentId: 'social', prompt: 'Draft posts', priority: 'LOW' },
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
                [{ from: 'step_0', to: 'step_1', condition: () => true }], // Conditions are runtime-only.
                'session-123'
            );

            const savedDoc = mockSet.mock.calls[0]![1] as WorkflowExecution;
            expect(execution.id).toBe('test-execution-id');
            expect(execution.workflowId).toBe('CAMPAIGN_LAUNCH');
            expect(execution.userId).toBe(userId);
            expect(execution.status).toBe('PLANNED');
            expect(Object.keys(execution.steps)).toHaveLength(3);
            expect(execution.steps['step_0']!.status).toBe('PLANNED');
            expect(execution.steps['step_1']!.status).toBe('PLANNED');
            expect(execution.steps['step_2']!.status).toBe('PLANNED');
            expect(savedDoc.edges).toEqual([{ from: 'step_0', to: 'step_1' }]);
            expect(savedDoc.edges[0]!.condition).toBeUndefined();
            expect(mockSet).toHaveBeenCalledOnce();
        });
    });

    describe('getExecution', () => {
        it('should normalize legacy lowercase status records from Firestore', async () => {
            mockGet.mockResolvedValue({
                id: 'legacy-exec',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'awaiting_approval', idempotencyKey: 'test-key-1' },
                },
                createdAt: 1000,
                updatedAt: 1000,
            });

            const execution = await workflowStateService.getExecution(userId, 'legacy-exec');

            expect(execution?.status).toBe('EXECUTING');
            expect(execution?.steps['step_0']!.status).toBe('STEP_COMPLETE');
            expect(execution?.steps['step_1']!.status).toBe('AWAITING_HUMAN');
            expect(execution?.edges).toEqual([]);
        });
    });

    describe('advanceStep', () => {
        it('should mark a step as complete and advance the index', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-1',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'EXECUTING',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'EXECUTING_GENERATION', startedAt: 1000, idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'PLANNED', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'PLANNED', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-1', 'step_0', 'Brand audit complete');

            expect(result.steps['step_0']!.status).toBe('STEP_COMPLETE');
            expect(result.steps['step_0']!.result).toBe('Brand audit complete');
            expect(result.status).toBe('EXECUTING');
            expect(mockSet).toHaveBeenCalledOnce();
        });

        it('should mark the workflow as completed when all steps are done', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-2',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'EXECUTING',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'STEP_COMPLETE', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'STEP_COMPLETE', result: 'Done', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'EXECUTING_GENERATION', startedAt: 2000, idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 2000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-2', 'step_2', 'Social posts drafted');

            expect(result.steps['step_2']!.status).toBe('STEP_COMPLETE');
            expect(result.status).toBe('COMPLETED');
        });
    });

    describe('failStep', () => {
        it('should mark a step and the workflow as failed while preserving remaining planned steps', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-3',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'EXECUTING',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'STEP_COMPLETE', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'EXECUTING_GENERATION', startedAt: 1500, idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'PLANNED', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1500,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.failStep(userId, 'exec-3', 'step_1', 'API timeout');

            expect(result.steps['step_1']!.status).toBe('FAILED');
            expect(result.steps['step_1']!.error).toBe('API timeout');
            expect(result.steps['step_2']!.status).toBe('PLANNED'); // Preserved for resume
            expect(result.status).toBe('FAILED');
        });
    });

    describe('cancelExecution', () => {
        it('should cancel the execution and all non-terminal steps', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-4',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'EXECUTING',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'STEP_COMPLETE', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'PLANNED', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'PLANNED', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            await workflowStateService.cancelExecution(userId, 'exec-4');

            const savedDoc = mockSet.mock.calls[0]![1] as WorkflowExecution;
            expect(savedDoc.status).toBe('CANCELLED');
            expect(savedDoc.steps['step_0']!.status).toBe('STEP_COMPLETE'); // Already complete — not cancelled
            expect(savedDoc.steps['step_1']!.status).toBe('CANCELLED');
            expect(savedDoc.steps['step_2']!.status).toBe('CANCELLED');
        });
    });

    describe('getResumableExecutions', () => {
        it('should return only non-terminal executions', async () => {
            const executions: WorkflowExecution[] = [
                { id: '1', workflowId: 'A', userId, status: 'COMPLETED', steps: {}, edges: [], createdAt: 1, updatedAt: 1 },
                { id: '2', workflowId: 'B', userId, status: 'FAILED', steps: {}, edges: [], createdAt: 2, updatedAt: 2 },
                { id: '3', workflowId: 'C', userId, status: 'CANCELLED', steps: {}, edges: [], createdAt: 3, updatedAt: 3 },
                { id: '4', workflowId: 'D', userId, status: 'PLANNED', steps: {}, edges: [], createdAt: 4, updatedAt: 4 },
                { id: '5', workflowId: 'E', userId, status: 'EXECUTING', steps: {}, edges: [], createdAt: 5, updatedAt: 5 },
            ];

            mockList.mockResolvedValue(executions);

            const result = await workflowStateService.getResumableExecutions(userId);

            expect(result).toHaveLength(3);
            expect(result.map(e => e.id)).toEqual(['2', '4', '5']);
        });
    });
});
