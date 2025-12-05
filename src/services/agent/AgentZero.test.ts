import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentZero } from './AgentZero';
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

describe('AgentZero', () => {
    let agentZero: AgentZero;
    const mockAddAgentMessage = vi.fn();
    const mockUpdateAgentMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        agentZero = new AgentZero();

        (useStore.getState as any).mockReturnValue({
            agentHistory: [],
            addAgentMessage: mockAddAgentMessage,
            updateAgentMessage: mockUpdateAgentMessage
        });

        // Mock AI response helper
        (AI.parseJSON as any).mockImplementation((text: string) => JSON.parse(text));
    });

    it('executes a simple task immediately (Executor Mode)', async () => {
        // Mock AI to return a tool call then a final response
        const streamMock1 = {
            getReader: () => {
                let count = 0;
                return {
                    read: async () => {
                        count++;
                        if (count === 1) return { done: false, value: { text: () => JSON.stringify({ tool: 'test_tool', args: {} }) } };
                        return { done: true, value: undefined };
                    }
                };
            }
        };

        const streamMock2 = {
            getReader: () => {
                let count = 0;
                return {
                    read: async () => {
                        count++;
                        if (count === 1) return { done: false, value: { text: () => JSON.stringify({ final_response: 'Task done.' }) } };
                        return { done: true, value: undefined };
                    }
                };
            }
        };

        (AI.generateContentStream as any)
            .mockResolvedValueOnce(streamMock1) // First turn: Tool call
            .mockResolvedValueOnce(streamMock2); // Second turn: Final response

        await agentZero.execute('Simple task', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), { text: 'Task done.' });
    });

    it('handles streaming responses correctly', async () => {
        const streamMock = {
            getReader: () => {
                let count = 0;
                return {
                    read: async () => {
                        count++;
                        if (count === 1) return { done: false, value: { text: () => '{"final_' } };
                        if (count === 2) return { done: false, value: { text: () => 'response": "Done"}' } };
                        return { done: true, value: undefined };
                    }
                };
            }
        };
        (AI.generateContentStream as any).mockResolvedValue(streamMock);

        await agentZero.execute('Stream test', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), { text: '{"final_' });
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), { text: '{"final_response": "Done"}' });
    });

    it('handles tool execution errors gracefully', async () => {
        // Mock tool failure
        (TOOL_REGISTRY.test_tool as any).mockRejectedValueOnce(new Error('Tool failed'));

        const streamMock1 = {
            getReader: () => {
                let count = 0;
                return {
                    read: async () => {
                        count++;
                        if (count === 1) return { done: false, value: { text: () => JSON.stringify({ tool: 'test_tool', args: {} }) } };
                        return { done: true, value: undefined };
                    }
                };
            }
        };

        const streamMock2 = {
            getReader: () => {
                let count = 0;
                return {
                    read: async () => {
                        count++;
                        if (count === 1) return { done: false, value: { text: () => JSON.stringify({ final_response: 'Tool failed, but I handled it.' }) } };
                        return { done: true, value: undefined };
                    }
                };
            }
        };

        (AI.generateContentStream as any)
            .mockResolvedValueOnce(streamMock1)
            .mockResolvedValueOnce(streamMock2);

        await agentZero.execute('Fail tool', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        // Verify that the error was logged or handled (in this case, we expect the agent to continue to the next turn)
        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), { text: 'Tool failed, but I handled it.' });
    });
});
