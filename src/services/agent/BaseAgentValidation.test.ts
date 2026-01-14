import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';
import { AgentConfig } from './types';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn()
    }
}));

describe('BaseAgent Tool Validation', () => {
    let agent: BaseAgent;
    const testToolSchema = z.object({
        requiredString: z.string(),
        positiveNumber: z.number().positive()
    });

    const testToolHandler = vi.fn().mockResolvedValue({ success: true, data: 'ok' });

    beforeEach(() => {
        vi.clearAllMocks();

        const config: AgentConfig = {
            id: 'generalist',
            name: 'Test Agent',
            description: 'Test',
            color: '#fff',
            category: 'specialist',
            systemPrompt: 'sys prompt',
            tools: [
                {
                    functionDeclarations: [
                        createTool(
                            'test_tool',
                            'A test tool',
                            testToolSchema
                        )
                    ]
                }
            ],
            functions: {
                test_tool: testToolHandler
            }
        };

        agent = new BaseAgent(config);
    });

    it('should execute tool when args are valid', async () => {
        // Setup AI mock to call the tool via generateContentStream
        const aiMock = await import('@/services/ai/AIService');
        vi.mocked(aiMock.AI.generateContentStream).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => 'Calling tool...' };
                }
            },
            response: Promise.resolve({
                text: () => 'Response Text',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: 10
                    }
                }]
            })
        } as any);

        const response = await agent.execute('Task');

        expect(testToolHandler).toHaveBeenCalled();
        expect((response.data as any).success).toBe(true);
    });

    it('should block tool execution when args are invalid', async () => {
        // Setup AI mock to call the tool with INVALID args via generateContentStream
        const aiMock = await import('@/services/ai/AIService');
        vi.mocked(aiMock.AI.generateContentStream).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => 'Calling tool...' };
                }
            },
            response: Promise.resolve({
                text: () => 'Response Text',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: -5 // Invalid: must be positive
                    }
                }]
            })
        } as any);

        const response = await agent.execute('Task');

        expect(testToolHandler).not.toHaveBeenCalled(); // Handler should NOT be called
        const result = response.data as any;
        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation Error');
        expect(response.text).toContain('Error');
    });
});
