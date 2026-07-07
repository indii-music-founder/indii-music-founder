import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent } from './AgentBuilder';
import { PromptService } from './PromptService';
import { MembershipService } from '@/services/MembershipService';
import { AgentTestHarness } from './test/AgentTestHarness';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { importWithRetry } from '@/utils/dynamicImport';

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

vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    const generateContent = vi.fn();
    const generateContentStream = vi.fn().mockImplementation(async (...args: any[]) => {
        const result = await generateContent(...args);
        return {
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => result?.response?.text?.() || '' };
                }
            },
            response: Promise.resolve(result)
        };
    });
    return {
        AutonomousIntelligence: {
            generateContent,
            generateContentStream,
            embedContent: vi.fn()
        }
    };
});

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
        vi.mocked(MembershipService.checkBudget).mockResolvedValue({ allowed: true, remainingBudget: 100, requiresApproval: false });
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
        harness.mockAutonomousIntelligenceResponse('Echo: hi');

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
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        const aiSpy = vi.mocked(AutonomousIntelligence.generateContent);
        
        vi.mocked(AutonomousIntelligence.generateContentStream).mockImplementation(async (...args: any[]) => {
            const result = await aiSpy(args[0], args[1], args[2], args[3], args[4], args[5]);
            return {
                stream: {
                    [Symbol.asyncIterator]: async function* () {
                        yield { text: () => result?.response?.text?.() || '' };
                    }
                },
                response: Promise.resolve(result)
            } as any;
        });

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
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        // 2. Second call: Autonomous sees tool result and finishes
        aiSpy.mockResolvedValueOnce({
            response: {
                text: () => 'Task completed successfully',
                candidates: [{
                    content: { parts: [{ text: 'Task completed successfully' }] }
                }],
                usageMetadata: {}
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        const result = await harness.run('Do work');
        console.log('DIAGNOSTIC - SDK result:', result);

        expect(mockTool).toHaveBeenCalled();
        expect(result.text).toBe('Task completed successfully');
    });
});
