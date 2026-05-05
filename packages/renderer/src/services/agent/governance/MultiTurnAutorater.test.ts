import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiTurnAutorater, type AutoraterScore, type TraceMessage } from './MultiTurnAutorater';

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateStructuredData: vi.fn(),
    },
}));

vi.mock('../fine-tuned-models', () => ({
    getFineTunedModel: vi.fn(() => 'tuned-creative-v1'),
}));

const addDocMock = vi.fn(() => Promise.resolve({ id: 'mock-doc-id' }));
vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    return {
        ...actual,
        collection: vi.fn(() => ({ id: 'mock-coll-id' })),
        addDoc: (...args: unknown[]) => addDocMock(...args as []),
        serverTimestamp: vi.fn(() => 'mock-timestamp'),
    };
});

import { GenAI } from '@/services/ai/GenAI';

const goal = 'Test goal';
const messages: TraceMessage[] = [
    { role: 'user', content: 'hello' },
    { role: 'model', content: 'hi back' },
];

const passingScore: AutoraterScore = {
    goalCompletion: 10,
    adherence: 9,
    coherence: 9,
    toolEfficiency: 10,
    reasoning: 'all good',
    overallPass: true,
};

const failingScore: AutoraterScore = {
    goalCompletion: 5,
    adherence: 5,
    coherence: 5,
    toolEfficiency: 5,
    reasoning: 'meh',
    overallPass: false,
};

describe('MultiTurnAutorater', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('evaluateTrace', () => {
        it('returns the structured score from GenAI', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            const result = await MultiTurnAutorater.evaluateTrace('trace-1', messages, goal);
            expect(result).toEqual(passingScore);
            expect(GenAI.generateStructuredData).toHaveBeenCalledOnce();
        });

        it('returns null when GenAI returns null', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(null);
            const result = await MultiTurnAutorater.evaluateTrace('trace-2', messages, goal);
            expect(result).toBeNull();
        });

        it('returns null and does not throw when GenAI rejects', async () => {
            vi.mocked(GenAI.generateStructuredData).mockRejectedValue(new Error('boom'));
            const result = await MultiTurnAutorater.evaluateTrace('trace-3', messages, goal);
            expect(result).toBeNull();
        });

        it('embeds guidelines into the prompt when provided', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            await MultiTurnAutorater.evaluateTrace('trace-4', messages, goal, ['No looping', 'Use schemas']);
            const prompt = vi.mocked(GenAI.generateStructuredData).mock.calls[0]?.[0] as string;
            expect(prompt).toContain('No looping');
            expect(prompt).toContain('Use schemas');
        });
    });

    describe('evaluateAndRegister', () => {
        it('registers high-quality traces (goalCompletion >= 9, toolEfficiency >= 9, overallPass)', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            await MultiTurnAutorater.evaluateAndRegister('user-1', 'creative', 'trace-5', messages, goal);
            expect(addDocMock).toHaveBeenCalledOnce();
            const call = addDocMock.mock.calls[0] as unknown as unknown[];
            const payload = call[1] as Record<string, unknown>;
            expect(payload.agentId).toBe('creative');
            expect(payload.traceId).toBe('trace-5');
            expect(payload.targetModel).toBe('tuned-creative-v1');
            expect(payload.qualityAverage).toBe(9.5);
            expect(payload.status).toBe('pending_export');
        });

        it('does NOT register low-quality traces', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(failingScore);
            await MultiTurnAutorater.evaluateAndRegister('user-2', 'creative', 'trace-6', messages, goal);
            expect(addDocMock).not.toHaveBeenCalled();
        });

        it('does NOT register when overallPass is false even with high scores', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue({
                ...passingScore,
                overallPass: false,
            });
            await MultiTurnAutorater.evaluateAndRegister('user-3', 'creative', 'trace-7', messages, goal);
            expect(addDocMock).not.toHaveBeenCalled();
        });

        it('does NOT register when toolEfficiency drops below 9', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue({
                ...passingScore,
                toolEfficiency: 8,
            });
            await MultiTurnAutorater.evaluateAndRegister('user-4', 'creative', 'trace-8', messages, goal);
            expect(addDocMock).not.toHaveBeenCalled();
        });

        it('returns the score regardless of registration outcome', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(failingScore);
            const result = await MultiTurnAutorater.evaluateAndRegister('user-5', 'creative', 'trace-9', messages, goal);
            expect(result).toEqual(failingScore);
        });

        it('does not throw if Firestore write fails', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            addDocMock.mockRejectedValueOnce(new Error('firestore down'));
            await expect(
                MultiTurnAutorater.evaluateAndRegister('user-6', 'creative', 'trace-10', messages, goal)
            ).resolves.toEqual(passingScore);
        });
    });
});
