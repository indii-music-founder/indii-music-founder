import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent } from './AgentBuilder';
import { AgentTestHarness } from './test/AgentTestHarness';
import { PromptService } from './PromptService';
import { AutonomousGenAI as AI } from '@/services/intelligence/AutonomousGenAI';

// Mock global dependencies
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: { defaultConfig: {} },
    functions: {},
    storage: {},
    db: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('@/services/intelligence/AutonomousGenAI', () => ({
    AutonomousGenAI: {
        generateContent: vi.fn(),
        embedContent: vi.fn(),
        generateContentStream: vi.fn()
    }
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remaining: 100 })
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn().mockReturnValue({
            currentOrganizationId: 'org-test',
            currentProjectId: 'proj-test'
        })
    }
}));


describe('Agent SDK Integration', () => {
    beforeEach(() => {
        PromptService.clear();
        vi.clearAllMocks();
    });

    it('should build and execute an agent using the SDK', async () => {
        // 1. Register Prompt
        PromptService.register('echo-agent-system', 'You are an Echo Agent. You say {{word}}.');

        // 2. Build Agent
        const agentConfig = createAgent('generalist')
            .withName('Echo Agent')
            .withSystemPrompt(PromptService.get('echo-agent-system', { word: 'hello' }))
            .build();

        expect(agentConfig.name).toBe('Echo Agent');
        expect(agentConfig.systemPrompt).toContain('hello');

        // 3. Test with Harness
        const harness = new AgentTestHarness(agentConfig);

        // Mock Autonomous to respond "Echo: hi"
        harness.mockAutonomousGenAIResponse('Echo: hi');

        const result = await harness.run('Say hi');

        expect(result.text).toBe('Echo: hi');
    });

    it('should validate tool execution with Test Harness', async () => {
        const mockTool = vi.fn().mockResolvedValue({ success: true, data: 'tool result' });

        const agentConfig = createAgent('generalist')
            .withName('Tool Agent')
            .withSystemPrompt('Use tools')
            .withTool({
                functionDeclarations: [{
                    name: 'testTool',
                    description: 'A test tool',
                    parameters: { type: 'OBJECT', properties: {} }
                }]
            }, mockTool)
            .build();

        const harness = new AgentTestHarness(agentConfig);

        // Mock sequence for generateContent (Tool Call -> Final Result)
        const { AutonomousGenAI } = await import('@/services/intelligence/AutonomousGenAI');
        const aiSpy = vi.mocked(AutonomousGenAI.generateContent);

        // 1. First call: Autonomous requests tool execution
        aiSpy.mockResolvedValueOnce({
            response: {
                text: () => 'Thinking...',
                candidates: [{
                    content: {
                        parts: [{ functionCall: { name: 'testTool', args: {} } }]
                    }
                }],
                usageMetadata: {}
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContent>>);

        // 2. Second call: Autonomous sees tool result and finishes
        aiSpy.mockResolvedValueOnce({
            response: {
                text: () => 'Task completed successfully',
                candidates: [{
                    content: { parts: [{ text: 'Task completed successfully' }] }
                }],
                usageMetadata: {}
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContent>>);

        const result = await harness.run('Do work');

        expect(mockTool).toHaveBeenCalled();
        expect(result.text).toBe('Task completed successfully');
    });
});
