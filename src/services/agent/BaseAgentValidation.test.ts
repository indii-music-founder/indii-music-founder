import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';
import { AgentConfig } from './types';

// Mock dependencies
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn()
    },
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
        const aiMock = await import('@/services/ai/GenAI');
        vi.mocked(aiMock.GenAI.generateContent)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Calling tool...',
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'Calling tool...' },
                                {
                                    functionCall: {
                                        name: 'test_tool',
                                        args: {
                                            requiredString: 'valid',
                                            positiveNumber: 10
                                        }
                                    }
                                }
                            ]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as any)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Tool execution confirmed.',
                    candidates: [{
                        content: {
                            parts: [{ text: 'Tool execution confirmed.' }]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as any);

        const response = await agent.execute('Task');

        expect(testToolHandler).toHaveBeenCalled();
        expect(response.text).toContain('Tool execution confirmed');
    });

    it('should block tool execution when args are invalid', async () => {
        // Setup AI mock to call the tool with INVALID args via generateContentStream
        const aiMock = await import('@/services/ai/GenAI');
        vi.mocked(aiMock.GenAI.generateContent)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Calling tool...',
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'Calling tool...' },
                                {
                                    functionCall: {
                                        name: 'test_tool',
                                        args: {
                                            requiredString: 'valid',
                                            positiveNumber: -5 // Invalid
                                        }
                                    }
                                }
                            ]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as any)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'I see there was a validation error.',
                    candidates: [{
                        content: {
                            parts: [{ text: 'I see there was a validation error.' }]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as any);

        const response = await agent.execute('Task');

        expect(testToolHandler).not.toHaveBeenCalled(); // Handler should NOT be called
        // The error would be in the conversation history/prompt, and the agent responds to it
        expect(response.text).toContain('validation error');
    });
});
