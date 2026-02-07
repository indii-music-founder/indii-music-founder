import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentExecutionContext } from './context/AgentExecutionContext';
import { TransactionManager } from './context/TransactionManager';
import { StateManager } from './context/StateManager';
import { LoopDetector } from './LoopDetector';
import { AgentContext } from './types';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
        setState: vi.fn(),
    }
}));

describe('Phase 3: Architectural Improvements', () => {

    describe('LoopDetector', () => {
        let detector: LoopDetector;

        beforeEach(() => {
            detector = new LoopDetector();
        });

        it('should detect immediate repetition', () => {
            detector.recordToolCall('test_tool', { arg: 1 });
            const result = detector.detectLoop('test_tool', { arg: 1 });
            expect(result.isLoop).toBe(true);
            expect(result.reason).toContain('consecutively');
        });

        it('should detect alternating patterns (A-B-A-B)', () => {
            detector.recordToolCall('tool_a', {});
            detector.recordToolCall('tool_b', {});
            detector.recordToolCall('tool_a', {});

            const result = detector.detectLoop('tool_b', {});
            expect(result.isLoop).toBe(true);
            expect(result.reason).toContain('Alternating pattern');
        });

        it('should allow non-looping sequences', () => {
            detector.recordToolCall('tool_a', {});
            detector.recordToolCall('tool_b', {});
            const result = detector.detectLoop('tool_c', {});
            expect(result.isLoop).toBe(false);
        });
    });

    describe('Transaction Management', () => {
        let context: AgentContext;

        beforeEach(() => {
            vi.clearAllMocks();
            context = {
                id: 'test-agent',
                userId: 'user-1',
                projectId: 'proj-1'
            } as any;

            // Mock store state
            (useStore.getState as any).mockReturnValue({
                projects: [{ id: 'proj-1', name: 'Test Project' }]
            });
        });

        it('should start a transaction and snapshot state', async () => {
            const manager = new TransactionManager();
            const txId = await manager.beginTransaction(context);

            expect(txId).toBeDefined();
            expect((manager as any).stateManager.hasSnapshot(txId)).toBe(true);
        });

        it('should commit a transaction (clearing snapshot)', async () => {
            const manager = new TransactionManager();
            const txId = await manager.beginTransaction(context);

            await manager.commit(txId);
            expect((manager as any).stateManager.hasSnapshot(txId)).toBe(false);
        });

        it('should rollback a transaction (restoring state)', async () => {
            const manager = new TransactionManager();
            const txId = await manager.beginTransaction(context);

            // Simulate state change (in a real integration test, we'd change the store)

            await manager.rollback(txId);
            expect((manager as any).stateManager.hasSnapshot(txId)).toBe(false);
            // Verify setState was called to restore (this depends on StateManager implementation details)
            expect(useStore.setState).toHaveBeenCalled();
        });
    });

    describe('AgentExecutionContext', () => {
        it('should manage transaction lifecycle', async () => {
            const contextMock = { id: 'ctx-1' } as any;
            // @ts-expect-error - accessing private constructor for test
            const executionContext = new AgentExecutionContext(contextMock);

            // Start
            await executionContext.start();
            expect((executionContext as any).activeTransactionId).toBeDefined();

            // Commit
            await executionContext.commit();
            expect((executionContext as any).activeTransactionId).toBeNull();
        });

        it('should rollback on failure', async () => {
            const contextMock = { id: 'ctx-2' } as any;
            // @ts-expect-error - accessing private constructor for test
            const executionContext = new AgentExecutionContext(contextMock);

            await executionContext.start();
            const txId = (executionContext as any).activeTransactionId;

            await executionContext.rollback();
            expect((executionContext as any).activeTransactionId).toBeNull();
            // Need reference to the internal TM to verify snapshot was cleared
            const tm = (executionContext as any).transactionManager;
            expect(tm.stateManager.hasSnapshot(txId)).toBe(false);
        });
    });
});
