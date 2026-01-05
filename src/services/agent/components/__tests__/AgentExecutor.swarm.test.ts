import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentExecutor } from '../AgentExecutor';
import { TraceService } from '../../observability/TraceService';
import { BaseAgent } from '../../BaseAgent';

// Mock Dependencies
vi.mock('../../observability/TraceService');

// Mock agentRegistry import
vi.mock('../../registry', () => ({
    agentRegistry: {
        getAsync: vi.fn()
    }
}));
import { agentRegistry } from '../../registry';

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { uid: 'user-123' } } }));

class MockAgent extends BaseAgent {
    constructor() {
        super({
            id: 'mock-agent' as any,
            name: 'Mock Agent',
            description: 'Mock Description',
            color: '#000000',
            category: 'generalist' as any,
            systemPrompt: 'You are a mock agent.',
            tools: []
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async execute(task: string, context?: any, onProgress?: any, signal?: AbortSignal, attachments?: any[]) {
        return { text: 'success', toolCalls: [], thoughts: [] } as any;
    }
}

describe('AgentExecutor Swarm Support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (agentRegistry.getAsync as any).mockResolvedValue(new MockAgent());
        (TraceService.startTrace as any).mockResolvedValue('new-trace-id');
    });

    it('should initialize a new swarmId for root execution', async () => {
        const executor = new AgentExecutor();
        const context: any = { activeModule: 'test' };

        // execute(agentId, userGoal, context, ...)
        await executor.execute('mock-agent', 'Do something', context);

        expect(TraceService.startTrace).toHaveBeenCalledWith(
            'user-123',
            'mock-agent', // agent.id
            'Do something',
            expect.objectContaining({
                swarmId: null // Root call initially null, startTrace handles it
            }),
            undefined
        );

        // Context should now have the swarmId (which TraceService logic would have set as traceId)
        expect(context.swarmId).toBe('new-trace-id');
    });

    it('should propagate existing swarmId to child agents', async () => {
        const executor = new AgentExecutor();
        // Existing context from a parent
        const context: any = {
            activeModule: 'test',
            swarmId: 'root-swarm-123'
        };

        // execute(agentId, userGoal, context, onProgress, signal, parentTraceId, attachments)
        await executor.execute('mock-agent', 'Sub task', context, undefined, undefined, 'parent-trace-456');

        expect(TraceService.startTrace).toHaveBeenCalledWith(
            'user-123',
            'mock-agent',
            'Sub task',
            expect.objectContaining({
                swarmId: 'root-swarm-123'
            }),
            'parent-trace-456'
        );
    });
});
