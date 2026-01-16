/**
 * GeneralistAgent Tests - Native Function Calling
 * 
 * These tests verify the GeneralistAgent's behavior using Gemini's native
 * function calling API instead of the legacy JSON parsing approach.
 */

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
        test_tool: vi.fn().mockResolvedValue('Tool executed successfully'),
        generate_image: vi.fn().mockResolvedValue({ success: true, message: 'Image generated' })
    },
    BASE_TOOLS: 'Available Tools: test_tool, generate_image'
}));

// Helper to mock a text-only response (no function calls)
const mockTextResponse = (text: string) => ({
    stream: {
        [Symbol.asyncIterator]: async function* () {
            yield { text: () => text };
        }
    },
    response: Promise.resolve({
        text: () => text,
        functionCalls: () => null, // No function calls
        usage: () => ({ totalTokens: 100 })
    })
});

// Helper to mock a native function call response
const mockFunctionCallResponse = (name: string, args: Record<string, unknown>) => ({
    stream: {
        [Symbol.asyncIterator]: async function* () {
            yield { text: () => `Calling tool ${name}...` };
        }
    },
    response: Promise.resolve({
        text: () => `Calling tool ${name}...`,
        functionCalls: () => [{ name, args }],
        usage: () => ({ totalTokens: 100 })
    })
});

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
            currentProjectId: 'proj1',
            uploadedImages: []
        } as any);
    });

    it('executes a tool via native function calling', async () => {
        // First call returns a function call, second call returns final response
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce(mockFunctionCallResponse('test_tool', {}) as any)
            .mockResolvedValueOnce(mockTextResponse('Task completed successfully.') as any);

        await generalistAgent.execute('Run the test tool', { currentOrganizationId: 'org1', currentProjectId: 'proj1' } as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
    });

    it('returns the final text response correctly', async () => {
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce(mockTextResponse('This is my helpful response.') as any);

        const result = await generalistAgent.execute('Help me with something', {} as any);

        expect(result.text).toBe('This is my helpful response.');
    });

    it('handles tool execution errors gracefully', async () => {
        // Mock tool to throw an error
        vi.mocked(TOOL_REGISTRY.test_tool).mockRejectedValueOnce(new Error('Tool crashed'));

        // First call returns function call that will fail
        // Second call returns recovery response
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce(mockFunctionCallResponse('test_tool', {}) as any)
            .mockResolvedValueOnce(mockTextResponse('I encountered an error but recovered.') as any);

        const result = await generalistAgent.execute('Run failing tool', {} as any);

        expect(TOOL_REGISTRY.test_tool).toHaveBeenCalled();
        // The agent should continue and eventually return
        expect(result.text).toContain('error');
    });

    it('detects and prevents infinite loops', async () => {
        // Simulate the AI calling the same tool repeatedly
        vi.mocked(AI.generateContentStream)
            .mockResolvedValue(mockFunctionCallResponse('test_tool', { same: 'args' }) as any);

        const result = await generalistAgent.execute('Loop forever', {} as any);

        // Should detect the loop and stop
        expect(result.error || result.text).toBeDefined();
        // Tool should be called at most twice before loop detection kicks in
        expect(vi.mocked(TOOL_REGISTRY.test_tool).mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('has proper tool declarations for native function calling', () => {
        expect(generalistAgent.tools).toBeDefined();
        expect(generalistAgent.tools.length).toBeGreaterThan(0);

        const declarations = generalistAgent.tools[0]?.functionDeclarations || [];
        expect(declarations.length).toBeGreaterThan(5); // Should have multiple tools

        // Verify critical tools are declared
        const toolNames = declarations.map((d: any) => d.name);
        expect(toolNames).toContain('generate_image');
        expect(toolNames).toContain('generate_video');
        expect(toolNames).toContain('save_memory');
    });
});
