import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentExecutor } from '../AgentExecutor';
import { TraceService } from '../../observability/TraceService';
import { agentRegistry } from '../../registry';

// Mock dependencies
vi.mock('../../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn(),
        addStep: vi.fn(),
        completeTrace: vi.fn(),
        failTrace: vi.fn()
    }
}));

vi.mock('../../registry', () => ({
    agentRegistry: {
        get: vi.fn()
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-uid' }
    }
}));

describe('AgentExecutor', () => {
    let executor: AgentExecutor;

    beforeEach(() => {
        executor = new AgentExecutor();
        vi.clearAllMocks();
    });

    it('should start a trace, execute agent, and complete trace on success', async () => {
        const mockAgent = {
            id: 'mock-agent',
            name: 'Mock Agent',
            execute: vi.fn().mockResolvedValue('Agent Output')
        };

        vi.mocked(agentRegistry.get).mockReturnValue(mockAgent as any);
        vi.mocked(TraceService.startTrace).mockResolvedValue('mock-trace-id');

        const context: any = { activeModule: 'test', projectHandle: { name: 'p1' } };
        const result = await executor.execute('mock-agent', 'Do something', context);

        expect(result).toBe('Agent Output');

        // Verify Trace Flow
        expect(TraceService.startTrace).toHaveBeenCalledWith(
            'test-uid', 'mock-agent', 'Do something', expect.anything()
        );
        expect(mockAgent.execute).toHaveBeenCalled();
        expect(TraceService.completeTrace).toHaveBeenCalledWith('mock-trace-id', 'Agent Output');
        expect(TraceService.failTrace).not.toHaveBeenCalled();
    });

    it('should intercept progress events and log them to trace', async () => {
        const mockAgent = {
            id: 'mock-agent',
            name: 'Mock Agent',
            execute: vi.fn().mockImplementation(async (goal, ctx, onProgress) => {
                onProgress({ type: 'thought', content: 'Thinking...' });
                onProgress({ type: 'tool', toolName: 'testTool', content: '{ "arg": 1 }' });
                return 'Done';
            })
        };

        vi.mocked(agentRegistry.get).mockReturnValue(mockAgent as any);
        vi.mocked(TraceService.startTrace).mockResolvedValue('mock-trace-id');

        await executor.execute('mock-agent', 'Do something', {} as any);

        expect(TraceService.addStep).toHaveBeenCalledWith('mock-trace-id', 'thought', 'Thinking...');
        expect(TraceService.addStep).toHaveBeenCalledWith('mock-trace-id', 'tool_call', { tool: 'testTool', args: '{ "arg": 1 }' });
    });

    it('should fail trace if agent throws error', async () => {
        const mockAgent = {
            id: 'mock-agent',
            name: 'Mock Agent',
            execute: vi.fn().mockRejectedValue(new Error('Agent Failed'))
        };

        vi.mocked(agentRegistry.get).mockReturnValue(mockAgent as any);
        vi.mocked(TraceService.startTrace).mockResolvedValue('mock-trace-id');

        await expect(executor.execute('mock-agent', 'Fail', {} as any))
            .rejects.toThrow('Agent Failed');

        expect(TraceService.failTrace).toHaveBeenCalledWith('mock-trace-id', 'Agent Failed');
        expect(TraceService.completeTrace).not.toHaveBeenCalled();
    });
});
