
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralistAgent } from './specialists/GeneralistAgent';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';
import { TOOL_REGISTRY } from './tools';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/ai/AIService');
vi.mock('./tools', () => ({
    TOOL_REGISTRY: {
        test_tool: vi.fn().mockResolvedValue('Tool executed successfully')
    },
    BASE_TOOLS: 'Available Tools: test_tool'
}));

// Helper to mock stream response
const mockStream = (jsonResponse: any) => {
    const text = JSON.stringify(jsonResponse);
    return {
        // This makes it an AsyncIterable
        [Symbol.asyncIterator]: async function* () {
            yield {
                text: () => text,
                functionCalls: () => [],
            };
        }
    };
};

const mockResponse = (jsonResponse: any) => {
    const text = JSON.stringify(jsonResponse);
    return Promise.resolve({
        text: () => text,
        functionCalls: () => [],
        usage: () => ({ totalTokens: 100 })
    });
};

describe('GeneralistAgent', () => {
    let generalistAgent: GeneralistAgent;
    const mockAddAgentMessage = vi.fn();
    const mockUpdateAgentMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        generalistAgent = new GeneralistAgent();

        vi.mocked(useStore.getState).mockReturnValue({
            agentHistory: [],
            addAgentMessage: mockAddAgentMessage,
            updateAgentMessage: mockUpdateAgentMessage,
            currentOrganizationId: 'org1',
            currentProjectId: 'proj1'
        } as any);

        // Mock AI response helper (simple pass-through for test)
        vi.mocked(AI.parseJSON).mockImplementation((text: string | undefined) => text ? JSON.parse(text) : {});
    });

    it('executes a simple task immediately (Executor Mode)', async () => {
        // Mock AI to return a tool call then a final response
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce({
                stream: mockStream({ tool: 'test_tool', args: {} }) as any,
                response: mockResponse({ tool: 'test_tool', args: {} }) as any
            })
            .mockResolvedValueOnce({
                stream: mockStream({ final_response: 'Task done.' }) as any,
                response: mockResponse({ final_response: 'Task done.' }) as any
            });

        await generalistAgent.execute('Simple task', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
    });

    it('returns the final response correctly', async () => {
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce({
                stream: mockStream({ final_response: 'Task done.' }) as any,
                response: mockResponse({ final_response: 'Task done.' }) as any
            });

        const result = await generalistAgent.execute('Simple task', {} as any);
        expect(result.text).toBe('Task done.');
    });

    it('handles tool execution errors gracefully', async () => {
        // Mock tool failure
        vi.mocked(TOOL_REGISTRY.test_tool).mockRejectedValueOnce(new Error('Tool failed'));

        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce({
                stream: mockStream({ tool: 'test_tool', args: {} }) as any,
                response: mockResponse({ tool: 'test_tool', args: {} }) as any
            })
            .mockResolvedValueOnce({
                stream: mockStream({ final_response: 'Tool failed, but I handled it.' }) as any,
                response: mockResponse({ final_response: 'Tool failed, but I handled it.' }) as any
            });

        const result = await generalistAgent.execute('Fail tool', {} as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        expect(result.text).toBe('Tool failed, but I handled it.');
    });
});
