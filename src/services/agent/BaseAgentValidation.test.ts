import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';
import { AgentConfig } from './types';
import { GenAI } from '@/services/ai/GenAI';

// Mock dependencies
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateSpeech: vi.fn()
    }
}));

// Mock MembershipService
vi.mock('@/services/membership/MembershipService', () => ({
    MembershipService: {
        recordSpend: vi.fn()
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
        // Setup AI mock
        (GenAI.generateContent as any)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Calling tool...',
                    functionCalls: () => [{
                        name: 'test_tool',
                        args: {
                            requiredString: 'valid',
                            positiveNumber: 10
                        }
                    }],
                    candidates: [{
                        content: {
                            role: 'model',
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
                    }]
                }
            })
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Tool execution confirmed.',
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: 'Tool execution confirmed.' }]
                        }
                    }]
                }
            });

        const response = await agent.execute('Task');

        expect(testToolHandler).toHaveBeenCalled();
        expect(response.text).toContain('Tool execution confirmed');
    });

    it('should block tool execution when args are invalid', async () => {
        (GenAI.generateContent as any)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Calling tool with invalid args...',
                    functionCalls: () => [{
                        name: 'test_tool',
                        args: {
                            requiredString: 'valid',
                            positiveNumber: -5 // Invalid
                        }
                    }],
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [
                                { text: 'Calling tool with invalid args...' },
                                {
                                    functionCall: {
                                        name: 'test_tool',
                                        args: {
                                            requiredString: 'valid',
                                            positiveNumber: -5
                                        }
                                    }
                                }
                            ]
                        }
                    }]
                }
            })
            .mockResolvedValueOnce({
                response: {
                    text: () => 'I see there was a validation error.',
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: 'I see there was a validation error.' }]
                        }
                    }]
                }
            });

        const response = await agent.execute('Task');

        expect(testToolHandler).not.toHaveBeenCalled();
        expect(response.text).toContain('validation error');
    });
});
