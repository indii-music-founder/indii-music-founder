import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { proactiveService } from '../ProactiveService';
import { agentService } from '../AgentService';
import { events } from '@/core/events';

// Mock dependencies
vi.mock('../AgentService', () => ({
    agentService: {
        runAgent: vi.fn().mockResolvedValue({ role: 'model', text: 'Task executing', timestamp: Date.now() })
    }
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user-123' }
    }
}));

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue({}),
    doc: vi.fn(),
    getDocs: (...args: any[]) => mockGetDocs(...args)
}));

describe('ProactiveService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Default: no tasks
        mockGetDocs.mockResolvedValue({ docs: [] });
    });

    afterEach(() => {
        vi.useRealTimers();
        proactiveService.dispose();
    });

    it('should execute scheduled task when triggered manually', async () => {
        // Mock getDocs to return a task when called by polling
        mockGetDocs.mockResolvedValueOnce({
            docs: [
                {
                    id: 'task-1',
                    data: () => ({
                        agentId: 'marketing',
                        task: 'Follow up',
                        triggerType: 'schedule',
                        executeAt: Date.now() - 5000,
                        status: 'pending',
                        userId: 'test-user-123'
                    })
                }
            ]
        });

        // Trigger polling manually for testing instead of relying on intervals
        // @ts-ignore - reaching into private method for test
        await proactiveService.checkScheduledTasks();

        expect(agentService.runAgent).toHaveBeenCalledWith(
            'marketing',
            expect.stringContaining('Follow up'),
            expect.any(Object)
        );
    });

    it('should trigger an agent on system events', async () => {
        mockGetDocs.mockResolvedValueOnce({
            docs: [
                {
                    id: 'sub-1',
                    data: () => ({
                        agentId: 'researcher',
                        task: 'Analyze result',
                        triggerType: 'event',
                        eventPattern: 'TASK_COMPLETED',
                        status: 'pending',
                        userId: 'test-user-123'
                    })
                }
            ]
        });

        // Emit event
        events.emit('TASK_COMPLETED', { taskId: 'original-task' });

        // Wait for it to be called
        await vi.waitFor(() => {
            if ((agentService.runAgent as any).mock.calls.length === 0) {
                throw new Error('Not called yet');
            }
        }, { timeout: 2000 });

        expect(agentService.runAgent).toHaveBeenCalledWith(
            'researcher',
            expect.stringContaining('Analyze result'),
            expect.any(Object)
        );
    });

    it('should send system alerts through EventBus', async () => {
        const spy = vi.fn();
        events.on('SYSTEM_ALERT', spy);
        events.emit('SYSTEM_ALERT', { level: 'success', message: 'Test notification' });
        expect(spy).toHaveBeenCalledWith({ level: 'success', message: 'Test notification' });
    });
});
