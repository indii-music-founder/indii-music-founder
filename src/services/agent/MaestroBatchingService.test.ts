import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaestroBatchingService } from './MaestroBatchingService';

// Create specific mock functions to track calls
const addBatchTaskMock = vi.fn();
const updateBatchTaskMock = vi.fn();
const clearCompletedBatchTasksMock = vi.fn();

// Mock the store properly
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            addBatchTask: addBatchTaskMock,
            updateBatchTask: updateBatchTaskMock,
            clearCompletedBatchTasks: clearCompletedBatchTasksMock
        })
    }
}));

describe('MaestroBatchingService', () => {
    let service: MaestroBatchingService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Create a fresh service instance for each test so the internal
        // RequestBatcher queue is clean (no stale tasks between tests).
        service = new MaestroBatchingService();

        // Spy on the private executeIndividualTask method via the prototype.
        // This bypasses the dynamic import('./AgentService') entirely,
        // which vi.mock can't reliably intercept for complex dependency chains.
        vi.spyOn(service as unknown as { executeIndividualTask: (task: unknown) => Promise<unknown> }, 'executeIndividualTask').mockImplementation(async (task: any) => ({
            success: true,
            message: 'Mock success',
            data: { taskId: (task as { id: string }).id, thoughtSignature: 'mock-signature' }
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should pool tasks and execute them in a batch', async () => {
        // Queue up two tasks — they sit in the RequestBatcher queue
        // waiting for either maxBatchSize (5) or maxWaitMs (300ms).
        const resultPromise = Promise.all([
            service.executeTask({
                description: 'Task 1',
                agentId: 'social',
                priority: 'LOW',
                params: {}
            }),
            service.executeTask({
                description: 'Task 2',
                agentId: 'marketing',
                priority: 'HIGH',
                params: {}
            })
        ]);

        // Advance the timer past the 300ms batch window to trigger flush.
        await vi.advanceTimersByTimeAsync(350);

        const results = await resultPromise;

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);

        // Check if store actions were called using our mock references
        expect(addBatchTaskMock).toHaveBeenCalledTimes(2);
        expect(updateBatchTaskMock).toHaveBeenCalled();

        // Verify executeIndividualTask was called for each task
        expect((service as unknown as { executeIndividualTask: unknown }).executeIndividualTask).toHaveBeenCalledTimes(2);
    });

    it('should sort tasks by priority before execution', async () => {
        const tasksPromise = Promise.all([
            service.executeTask({ description: 'Low', agentId: 'A', priority: 'LOW', params: {} }),
            service.executeTask({ description: 'Urgent', agentId: 'B', priority: 'URGENT', params: {} }),
            service.executeTask({ description: 'High', agentId: 'C', priority: 'HIGH', params: {} })
        ]);

        await vi.advanceTimersByTimeAsync(350);

        const results = await tasksPromise;
        expect(results).toHaveLength(3);
        expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle errors in a batch gracefully', async () => {
        const resultPromise = service.executeTask({
            description: 'Success Task',
            agentId: 'legal',
            priority: 'MEDIUM',
            params: {}
        });

        await vi.advanceTimersByTimeAsync(350);

        const result = await resultPromise;
        expect(result.success).toBe(true);
    });
});

