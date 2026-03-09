
import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from '../registry';

// Mock TOOL_REGISTRY to avoid circular dependency issues in test environment
vi.mock('../tools', () => ({
    TOOL_REGISTRY: {
        save_memory: vi.fn(),
        recall_memories: vi.fn(),
        verify_output: vi.fn(),
        request_approval: vi.fn()
    }
}));

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentProjectId: 'test-project',
            currentOrganizationId: 'org-1',
            requestApproval: vi.fn().mockResolvedValue(true)
        }),
        setState: vi.fn()
    }
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
    remoteConfig: { defaultConfig: {} },
    auth: { currentUser: { uid: 'test-user', getIdToken: vi.fn(() => Promise.resolve('mock-token')) } },
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => 'Mock Response',
                functionCalls: () => [],
                usage: () => ({
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30
                })
            }
        }),
        generateContentStream: vi.fn().mockResolvedValue({
            stream: (async function* () {
                yield { text: () => 'Mock Response' };
            })(),
            response: Promise.resolve({
                text: () => 'Mock Response',
                functionCalls: () => [],
                usage: () => ({
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30
                })
            })
        })
    }
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remaining: 100 })
    }
}));



describe('Specialist Agents Connection', () => {
    it('should have Brand, Road, and Marketing agents registered', async () => {
        const brandAgent = await agentRegistry.getAsync('brand');
        const roadAgent = await agentRegistry.getAsync('road');
        const marketingAgent = await agentRegistry.getAsync('marketing');

        expect(brandAgent).toBeDefined();
        expect(brandAgent?.id).toBe('brand');

        expect(roadAgent).toBeDefined();
        expect(roadAgent?.id).toBe('road');

        expect(marketingAgent).toBeDefined();
        expect(marketingAgent?.id).toBe('marketing');
    });

    // Skipped: This test makes real network calls (GeminiRetrievalService) that timeout in CI.
    // The RAG agent's execute() path triggers ensureFileSearchStore → fetch, which
    // requires a real Firebase Auth token. The mock only provides getIdToken but the
    // downstream fetch still fails/hangs. This should be an integration test, not unit.
    it.skip('should inherit Agent Zero superpowers via BaseAgent', async () => {
        const brandAgent = await agentRegistry.getAsync('brand');
        if (!brandAgent) throw new Error('Brand agent not found');

        // We can't easily inspect the private/protected execution logic without spying on GenAI.generateContent
        // But we can check if the tools are being passed correctly

        const { GenAI } = await import('@/services/ai/GenAI');
        await brandAgent.execute('Test Task', {});

        const tools = (GenAI.generateContent as any).mock.calls[0]?.[4] || []; // safe access

        // Create a flat list of all function declarations from all tool objects
        const allFunctionDeclarations = tools.flatMap((t: any) => t.functionDeclarations || []);

        const hasSaveMemory = allFunctionDeclarations.some((f: any) => f.name === 'save_memory');
        const hasVerifyOutput = allFunctionDeclarations.some((f: any) => f.name === 'verify_output');

        expect(hasSaveMemory).toBe(true);
        expect(hasVerifyOutput).toBe(true);
    });
});
