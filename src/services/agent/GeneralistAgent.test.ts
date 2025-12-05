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

        // Mock AI response helper
        (AI.parseJSON as any).mockImplementation((text: string) => JSON.parse(text));
    });

    it('executes a simple task immediately (Executor Mode)', async () => {
        // Mock AI to return a tool call then a final response using unary generateContent
        (AI.generateContent as any)
            .mockResolvedValueOnce({ text: () => JSON.stringify({ tool: 'test_tool', args: {} }) }) // First turn: Tool call
            .mockResolvedValueOnce({ text: () => JSON.stringify({ final_response: 'Task done.' }) }); // Second turn: Final response

        await generalistAgent.execute('Simple task', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        // GeneralistAgent returns the final text, it doesn't strictly update the store with the final response text *inside* the loop 
        // in the way AgentZero did for the final return. 
        // Wait, GeneralistAgent loop breaks on final_response and returns { text: finalResponseText }.
        // The store definition in useStore only happens for thoughts/tools inside execute if onProgress is hooked up, 
        // OR via the recursive calls. 
        // Actually, GeneralistAgent.ts I wrote DOES NOT write to the store directly for the final response. 
        // It returns it. The Executor writes it.
        // So we should verify the return value.
    });

    it('returns the final response correctly', async () => {
        (AI.generateContent as any)
            .mockResolvedValueOnce({ text: () => JSON.stringify({ final_response: 'Task done.' }) });

        const result = await generalistAgent.execute('Simple task', {} as any);
        expect(result.text).toBe('Task done.');
    });

    it('handles tool execution errors gracefully', async () => {
        // Mock tool failure
        (TOOL_REGISTRY.test_tool as any).mockRejectedValueOnce(new Error('Tool failed'));

        (AI.generateContent as any)
            .mockResolvedValueOnce({ text: () => JSON.stringify({ tool: 'test_tool', args: {} }) })
            .mockResolvedValueOnce({ text: () => JSON.stringify({ final_response: 'Tool failed, but I handled it.' }) });

        const result = await generalistAgent.execute('Fail tool', {} as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        expect(result.text).toBe('Tool failed, but I handled it.');
    });
});
