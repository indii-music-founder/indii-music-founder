import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent } from './AgentBuilder';
import { AgentTestHarness } from './test/AgentTestHarness';
import { PromptService } from './PromptService';
import { AI } from '@/services/ai/AIService';

// Mock global dependencies
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    db: {}
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        embedContent: vi.fn(),
        generateContentStream: vi.fn()
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

        // Mock AI to respond "Echo: hi"
        harness.mockAIResponse('Echo: hi');

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

        // Mock sequence for generateContentStream
        const aiSpy = vi.mocked(AI.generateContentStream);

        aiSpy.mockResolvedValueOnce({
            stream: (async function* () {
                yield { text: () => 'Thinking...' };
            })(),
            response: Promise.resolve({
                text: () => 'Thinking...',
                functionCalls: () => [{ name: 'testTool', args: {} }]
            })
        } as any);

        const result = await harness.run('Do work');

        expect(mockTool).toHaveBeenCalled();
        expect(result.text).toContain('[Tool: testTool] Output: Success: "tool result"');
    });
});
