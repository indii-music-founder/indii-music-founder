
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import { AgentConfig } from '@/services/agent/types';
import { AI } from '@/services/ai/AIService';
import { ContextManager } from '@/services/ai/context/ContextManager';

// Mock AI Service to intercept calls
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContentStream: vi.fn().mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Mock Response' }; })(),
            response: Promise.resolve({
                text: () => 'Mock Response',
                usage: () => ({ promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 }),
                functionCalls: () => []
            })
        })
    }
}));

describe('📚 Keeper: Context Integrity', () => {
    let agent: BaseAgent;

    // Helper to generate a large string
    const generateLargeString = (tokenCount: number) => {
        // Roughly 4 chars per token
        return 'a'.repeat(tokenCount * 4);
    };

    beforeEach(() => {
        vi.clearAllMocks();

        const config: AgentConfig = {
            id: 'keeper-agent',
            name: 'Keeper',
            description: 'The Guardian of Context',
            color: 'blue',
            category: 'specialist',
            systemPrompt: 'You are a test agent.',
            tools: []
        };

        agent = new BaseAgent(config);
    });

    it('should NOT send an infinitely growing history to the AI', async () => {
        // 1. Create a massive chat history string that DEFINITELY exceeds typical limits
        const massiveHistory = generateLargeString(50000); // 50k tokens -> 200k chars

        const context: any = {
            chatHistoryString: massiveHistory,
            orgId: 'test-org',
            projectId: 'test-project'
        };

        // 2. Execute the agent
        await agent.execute('Hello', context);

        // 3. Inspect the payload sent to AI
        const generateCall = vi.mocked(AI.generateContentStream).mock.calls[0];
        const payload = generateCall[0];

        // Extract the full prompt text sent to the model
        // @ts-ignore - inspecting the complex payload structure
        const fullPromptText = payload.contents[0].parts[0].text;

        // 4. Assert Truncation
        // The original history is 200k chars.
        // We expect the payload to be SIGNIFICANTLY smaller than the history alone
        // because we are truncating history to ~32k chars (8k tokens).
        // Allowing for some overhead (system prompt + tools), let's say 100k chars total is a safe upper bound.

        console.log(`Original History Length: ${massiveHistory.length}`);
        console.log(`Sent Prompt Length: ${fullPromptText.length}`);

        expect(fullPromptText.length).toBeLessThan(massiveHistory.length);
        expect(fullPromptText.length).toBeLessThan(100000);
    });
});
