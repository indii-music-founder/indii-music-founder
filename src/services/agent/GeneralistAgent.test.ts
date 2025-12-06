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
        getReader: () => {
            let read = false;
            return {
                read: async () => {
                    if (!read) {
                        read = true;
                        return { done: false, value: { text: () => text } };
                    }
                    return { done: true, value: undefined };
                }
            };
        }
    };
};

describe('GeneralistAgent', () => {
    let generalistAgent: GeneralistAgent;
    const mockAddAgentMessage = vi.fn();
    const mockUpdateAgentMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        generalistAgent = new GeneralistAgent();

        (useStore.getState as any).mockReturnValue({
            agentHistory: [],
            addAgentMessage: mockAddAgentMessage,
            updateAgentMessage: mockUpdateAgentMessage,
            currentOrganizationId: 'org1',
            currentProjectId: 'proj1'
        });

        // Mock AI response helper (simple pass-through for test)
        (AI.parseJSON as any).mockImplementation((text: string) => JSON.parse(text));
    });

    it('executes a simple task immediately (Executor Mode)', async () => {
        // Mock AI to return a tool call then a final response
        (AI.generateContentStream as any)
            .mockResolvedValueOnce(mockStream({ tool: 'test_tool', args: {} })) // First turn: Tool call
            .mockResolvedValueOnce(mockStream({ final_response: 'Task done.' })); // Second turn: Final response

        await generalistAgent.execute('Simple task', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
    });

    it('returns the final response correctly', async () => {
        (AI.generateContentStream as any)
            .mockResolvedValueOnce(mockStream({ final_response: 'Task done.' }));

        const result = await generalistAgent.execute('Simple task', {} as any);
        expect(result.text).toBe('Task done.');
    });

    it('handles tool execution errors gracefully', async () => {
        // Mock tool failure
        (TOOL_REGISTRY.test_tool as any).mockRejectedValueOnce(new Error('Tool failed'));

        (AI.generateContentStream as any)
            .mockResolvedValueOnce(mockStream({ tool: 'test_tool', args: {} }))
            .mockResolvedValueOnce(mockStream({ final_response: 'Tool failed, but I handled it.' }));

        const result = await generalistAgent.execute('Fail tool', {} as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        expect(result.text).toBe('Tool failed, but I handled it.');
    });
});
