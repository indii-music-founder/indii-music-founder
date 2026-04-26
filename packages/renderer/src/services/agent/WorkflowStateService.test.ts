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
                [], // No edges
                'session-123'
            );

            expect(execution.id).toBe('test-execution-id');
            expect(execution.workflowId).toBe('CAMPAIGN_LAUNCH');
            expect(execution.userId).toBe(userId);
            expect(execution.status).toBe('planned');
            expect(Object.keys(execution.steps)).toHaveLength(3);
            expect(execution.steps['step_0']!.status).toBe('planned');
            expect(execution.steps['step_1']!.status).toBe('planned');
            expect(execution.steps['step_2']!.status).toBe('planned');
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
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'executing', startedAt: 1000, idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'planned', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-1', 'step_0', 'Brand audit complete');

            expect(result.steps['step_0']!.status).toBe('step_complete');
            expect(result.steps['step_0']!.result).toBe('Brand audit complete');
            expect(result.status).toBe('executing');
            expect(mockSet).toHaveBeenCalledOnce();
        });

        it('should mark the workflow as completed when all steps are done', async () => {
            const storedExecution: WorkflowExecution = {
                id: 'exec-2',
                workflowId: 'CAMPAIGN_LAUNCH',
                userId,
                status: 'executing',
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'executing', startedAt: 2000, idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 2000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.advanceStep(userId, 'exec-2', 'step_2', 'Social posts drafted');

            expect(result.steps['step_2']!.status).toBe('step_complete');
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
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'executing', startedAt: 1500, idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1500,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            const result = await workflowStateService.failStep(userId, 'exec-3', 'step_1', 'API timeout');

            expect(result.steps['step_1']!.status).toBe('failed');
            expect(result.steps['step_1']!.error).toBe('API timeout');
            expect(result.steps['step_2']!.status).toBe('planned'); // Preserved for resume
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
                steps: {
                    'step_0': { stepId: 'step_0', agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete', result: 'Done', idempotencyKey: 'test-key-0' },
                    'step_1': { stepId: 'step_1', agentId: 'marketing', prompt: 'Create strategy', status: 'planned', idempotencyKey: 'test-key-1' },
                    'step_2': { stepId: 'step_2', agentId: 'social', prompt: 'Draft posts', status: 'planned', idempotencyKey: 'test-key-2' },
                },
                edges: [],
                createdAt: 1000,
                updatedAt: 1000,
            };

            mockGet.mockResolvedValue({ ...storedExecution });

            await workflowStateService.cancelExecution(userId, 'exec-4');

            const savedDoc = mockSet.mock.calls[0]![1] as WorkflowExecution;
            expect(savedDoc.status).toBe('cancelled');
            expect(savedDoc.steps['step_0']!.status).toBe('step_complete'); // Already complete — not cancelled
            expect(savedDoc.steps['step_1']!.status).toBe('cancelled');
            expect(savedDoc.steps['step_2']!.status).toBe('cancelled');
        });
    });

    describe('getResumableExecutions', () => {
        it('should return only non-terminal executions', async () => {
            const executions: WorkflowExecution[] = [
                { id: '1', workflowId: 'A', userId, status: 'completed', steps: {}, edges: [], createdAt: 1, updatedAt: 1 },
                { id: '2', workflowId: 'B', userId, status: 'failed', steps: {}, edges: [], createdAt: 2, updatedAt: 2 },
                { id: '3', workflowId: 'C', userId, status: 'cancelled', steps: {}, edges: [], createdAt: 3, updatedAt: 3 },
                { id: '4', workflowId: 'D', userId, status: 'planned', steps: {}, edges: [], createdAt: 4, updatedAt: 4 },
                { id: '5', workflowId: 'E', userId, status: 'executing', steps: {}, edges: [], createdAt: 5, updatedAt: 5 },
            ];

            mockList.mockResolvedValue(executions);

            const result = await workflowStateService.getResumableExecutions(userId);

            expect(result).toHaveLength(3);
            expect(result.map(e => e.id)).toEqual(['2', '4', '5']);
        });
    });
});
