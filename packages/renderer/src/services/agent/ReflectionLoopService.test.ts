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
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateContent: vi.fn(),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
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

    describe('Max Iterations Hard Cap', () => {
        it('should force acceptance at maxIterations without calling the model', async () => {
            const result = await service.evaluate('task', 'response', 3);

            expect(result.shouldIterate).toBe(false);
            expect(result.score).toBe(-1);
            expect(result.feedback).toContain('Max iterations');
            expect(vi.mocked(GenAI.generateContent)).not.toHaveBeenCalled();
        });

        it('should force acceptance when iterationCount exceeds maxIterations', async () => {
            const result = await service.evaluate('task', 'response', 5);

            expect(result.shouldIterate).toBe(false);
            expect(result.score).toBe(-1);
            expect(vi.mocked(GenAI.generateContent)).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // Error Resilience
    // ====================================================================

    describe('Error Resilience', () => {
        it('should accept output when AI evaluation fails', async () => {
            vi.mocked(GenAI.generateContent).mockRejectedValue(new Error('API timeout'));

            const result = await service.evaluate('task', 'response', 1);

            expect(result.shouldIterate).toBe(false);
            expect(result.score).toBe(-1);
            expect(result.feedback).toContain('API timeout');
        });

        it('should handle malformed JSON from the model', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(
                mockAIResponse('This is not JSON at all, but score is 6')
            );

            const result = await service.evaluate('task', 'response', 1);

            // Should fall back to regex score extraction
            expect(result.score).toBe(6);
            expect(result.shouldIterate).toBe(true); // 6 < 7 threshold
        });

        it('should handle JSON wrapped in markdown code blocks', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(
                mockAIResponse('```json\n{"score": 8, "shouldIterate": false, "feedback": "PASS"}\n```')
            );

            const result = await service.evaluate('task', 'response', 1);

            expect(result.score).toBe(8);
            expect(result.shouldIterate).toBe(false);
            expect(result.feedback).toBe('PASS');
        });
    });

    // ====================================================================
    // Iteration Prompt Builder
    // ====================================================================

    describe('buildIterationPrompt()', () => {
        it('should include reflection feedback and original task', () => {
            const prompt = service.buildIterationPrompt(
                'Write a professional bio',
                'He is a musician.',
                {
                    score: 4,
                    shouldIterate: true,
                    feedback: 'Bio is too short. Add accomplishments and genre.',
                    iterationCount: 1,
                    maxIterations: 3,
                }
            );

            expect(prompt).toContain('REFLECTION FEEDBACK');
            expect(prompt).toContain('scored 4/10');
            expect(prompt).toContain('Iteration: 1/3');
            expect(prompt).toContain('Bio is too short');
            expect(prompt).toContain('Write a professional bio');
            expect(prompt).toContain('He is a musician.');
            expect(prompt).toContain('Do NOT apologize');
        });

        it('should truncate long previous responses', () => {
            const longResponse = 'X'.repeat(3000);

            const prompt = service.buildIterationPrompt(
                'Task',
                longResponse,
                {
                    score: 3,
                    shouldIterate: true,
                    feedback: 'Improve it',
                    iterationCount: 1,
                    maxIterations: 3,
                }
            );

            expect(prompt).toContain('[... truncated]');
            expect(prompt.length).toBeLessThan(longResponse.length);
        });
    });

    // ====================================================================
    // Model Call Verification
    // ====================================================================

    describe('Model Call Parameters', () => {
        it('should use the FAST model with low temperature', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 8,
                shouldIterate: false,
                feedback: 'PASS',
            })));

            await service.evaluate('task', 'response', 1);

            expect(vi.mocked(GenAI.generateContent)).toHaveBeenCalledWith(
                expect.stringContaining('Task Being Evaluated'),
                'gemini-3-flash-preview',
                expect.objectContaining({
                    temperature: 0.2,
                    maxOutputTokens: 200,
                }),
                expect.stringContaining('quality evaluation critic')
            );
        });

        it('should truncate long responses before sending to evaluation', async () => {
            vi.mocked(GenAI.generateContent).mockResolvedValue(mockAIResponse(JSON.stringify({
                score: 7,
                shouldIterate: false,
                feedback: 'PASS',
            })));

            const longResponse = 'Y'.repeat(10000);
            await service.evaluate('task', longResponse, 1);

            const evaluationPrompt = vi.mocked(GenAI.generateContent).mock.calls[0]![0] as string;
            expect(evaluationPrompt).toContain('[... truncated for evaluation]');
            expect(evaluationPrompt.length).toBeLessThan(longResponse.length);
        });
    });
});
