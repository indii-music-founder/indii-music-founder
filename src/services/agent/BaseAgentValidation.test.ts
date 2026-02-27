import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';
import { AgentConfig } from './types';

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

    beforeEach(async () => {
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
        const { GenAI } = await import('@/services/ai/GenAI');
        
        // Setup AI mock to call the tool
        (GenAI.generateContent as any).mockResolvedValueOnce({
            response: {
                text: () => 'Calling tool...',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: 10
                    }
                }]
            }
        });

        (GenAI.generateContent as any).mockResolvedValueOnce({
            response: {
                text: () => 'Tool execution confirmed.'
            }
        });

        const response = await agent.execute('Task');

        expect(testToolHandler).toHaveBeenCalled();
        expect(response.text).toContain('Tool execution confirmed');
    });

    it('should block tool execution when args are invalid', async () => {
        const { GenAI } = await import('@/services/ai/GenAI');
        
        (GenAI.generateContent as any).mockResolvedValueOnce({
            response: {
                text: () => 'Calling tool with invalid args...',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: -5 // Invalid
                    }
                }]
            }
        });

        (GenAI.generateContent as any).mockResolvedValueOnce({
            response: {
                text: () => 'I see there was a validation error.'
            }
        });

        const response = await agent.execute('Task');

        expect(testToolHandler).not.toHaveBeenCalled();
        expect(response.text).toContain('validation error');
    });
});
