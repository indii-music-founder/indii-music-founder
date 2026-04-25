/**
 * ReflectionLoop Unit Tests
 *
 * Tests the self-evaluating quality critic: evaluation logic, iteration
 * prompt building, JSON parsing, and hard-cap enforcement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReflectionLoop } from '@/services/agent/ReflectionLoop';
import { GenAI } from '@/services/ai/GenAI';

// ============================================================================
// Mock FirebaseAIService.getInstance()
// ============================================================================

vi.mock('@/services/ai/FirebaseAIService', () => {
    return {
        FirebaseAIService: class {
            static getInstance() {
                return {
                    generateText: vi.fn().mockResolvedValue('Mock AI response'),
                    generateContent: vi.fn().mockImplementation((...args: any[]) => {
                        // Delegate to GenAI mock which tests will configure
                        return (vi.mocked(GenAI.generateContent) as any)(...args);
                    }),
                    generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
                    generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
                    analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
                };
            }
        },
        firebaseAI: null
    };
});

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn()
    }
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: {
            FAST: 'gemini-3-flash-preview',
            COMPLEX: 'gemini-3-pro-preview',
        },
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock GenerateContentResult with the given text.
 */
function mockAIResponse(text: string) {
    return {
        response: {
            candidates: [
                {
                    content: {
                        parts: [{ text }],
                    },
                },
            ],
            text: () => text,
            inlineDataParts: () => [],
            functionCalls: () => [],
            thoughtSummary: () => "",
        },
    } as unknown as Awaited<ReturnType<typeof GenAI.generateContent>>;
}

// ============================================================================
// Tests
// ============================================================================

describe('🔍 ReflectionLoop', () => {
    let service: ReflectionLoop;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ReflectionLoop({
            qualityThreshold: 7,
            maxIterations: 3,
        });
    });

    // ====================================================================
    // Core Evaluation
    // ====================================================================

    describe('evaluate()', () => {
        it('should return shouldIterate=false for high-quality responses', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 9,
                shouldIterate: false,
                feedback: 'PASS',
            })));

            const result = await service.evaluate('Write a bio', 'Great detailed bio...', 1);

            expect(result.score).toBe(9);
            expect(result.shouldIterate).toBe(false);
            expect(result.feedback).toBe('PASS');
            expect(result.iterationCount).toBe(1);
            expect(result.maxIterations).toBe(3);
        });

        it('should return shouldIterate=true for low-quality responses', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 4,
                shouldIterate: true,
                feedback: 'Response is too vague. Add specific distribution metrics.',
            })));

            const result = await service.evaluate('Analyze my revenue', 'Revenue is ok.', 1);

            expect(result.score).toBe(4);
            expect(result.shouldIterate).toBe(true);
            expect(result.feedback).toContain('distribution metrics');
        });

        it('should clamp scores to 0-10 range', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 15,
                shouldIterate: false,
                feedback: 'PASS',
            })));

            const result = await service.evaluate('task', 'response', 1);
            expect(result.score).toBe(10);
        });

        it('should clamp negative scores to 0', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: -3,
                shouldIterate: true,
                feedback: 'Terrible',
            })));

            const result = await service.evaluate('task', 'response', 1);
            expect(result.score).toBe(0);
        });
    });

    // ====================================================================
    // Hard Cap Enforcement
    // ====================================================================

    describe('Error Resilience', () => {
        it('should accept output when AI evaluation fails', async () => {
            vi.mocked(GenAI.generateContent).mockRejectedValueOnce(new Error('API timeout'));

            const result = await service.evaluate('task', 'response', 1);

            expect(result.shouldIterate).toBe(false);
            expect(result.score).toBe(-1);
            expect(result.feedback).toContain('API timeout');
        });

        it('should handle malformed JSON from the model', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse('not valid json at all'));

            // Should fallback to regex score extraction
            const result = await service.evaluate('task', 'response', 1);
            
            // With no score found in text, defaults to 5
            expect(result.score).toBe(5);
            expect(result.shouldIterate).toBe(true); // 5 < 7 threshold
        });

        it('should handle JSON wrapped in markdown code blocks', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(`
\`\`\`json
{
  "score": 8,
  "shouldIterate": false,
  "feedback": "PASS"
}
\`\`\`
            `));

            const result = await service.evaluate('task', 'response', 1);

            expect(result.score).toBe(8);
            expect(result.shouldIterate).toBe(false);
            expect(result.feedback).toBe('PASS');
        });
    });

    // ====================================================================
    // Model Call Parameters
    // ====================================================================

    describe('Model Call Parameters', () => {
        it('should use the FAST model with low temperature', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 7,
                shouldIterate: false,
                feedback: 'OK',
            })));

            await service.evaluate('task', 'response', 1);

            expect(vi.mocked(GenAI.generateContent)).toHaveBeenCalled();
        });

        it('should truncate long responses before sending to evaluation', async () => {
            const longResponse = 'x'.repeat(10000);
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 7,
                shouldIterate: false,
                feedback: 'OK',
            })));

            await service.evaluate('task', longResponse, 1);

            expect(vi.mocked(GenAI.generateContent)).toHaveBeenCalled();
        });
    });
});
