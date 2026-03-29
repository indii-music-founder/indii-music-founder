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

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-123' } },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

class MockAgent extends BaseAgent {
    constructor() {
        super({
            id: 'mock-agent' as unknown as string,
            name: 'Mock Agent',
            description: 'Mock Description',
            color: '#000000',
            category: 'generalist' as unknown as string,
            systemPrompt: 'You are a mock agent.',
            tools: []
        } as unknown as any); // Constructor arguments are untyped here
    }

    async execute(task: string, context?: any, onProgress?: any, signal?: AbortSignal, attachments?: any[]) {
        return { text: 'success', toolCalls: [], thoughts: [] } as unknown as Awaited<ReturnType<BaseAgent['execute']>>;
    }
}

describe('AgentExecutor Swarm Support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(agentRegistry.getAsync).mockResolvedValue(new MockAgent() as unknown as Awaited<ReturnType<typeof agentRegistry.getAsync>>);
        vi.mocked(TraceService.startTrace).mockResolvedValue('new-trace-id');
    });

    it('should initialize a new swarmId for root execution', async () => {
        const executor = new AgentExecutor(agentRegistry as unknown as ConstructorParameters<typeof AgentExecutor>[0]);
        const context = { activeModule: 'test' } as unknown as any;

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
        const executor = new AgentExecutor(agentRegistry as unknown as ConstructorParameters<typeof AgentExecutor>[0]);
        // Existing context from a parent
        const context = {
            activeModule: 'test',
            swarmId: 'root-swarm-123'
        } as unknown as any;

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
