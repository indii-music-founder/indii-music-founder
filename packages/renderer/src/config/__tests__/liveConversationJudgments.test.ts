import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    deterministicSpokenIntentFallback,
    judgeSpokenConversationIntent,
    parseSpokenIntentAnswers,
} from '../liveConversationJudgments';

const mockHttpsCallable = vi.fn();

describe('spoken intent answer composition (pure contract)', () => {
    const fallback = { action: 'general_conversation' as const, confidence: 0.9 };
    it.each([null, true, '0.92', NaN, Infinity, -0.1, 1.1])('does not stop for invalid Noul %s', noul => {
        expect(parseSpokenIntentAnswers({ bargeInStop: { noul } }, fallback)).toBe(fallback);
    });
    it('reads canonical Noul and ignores obsolete probability wrappers', () => {
        expect(parseSpokenIntentAnswers({ bargeInStop: { noul: 0.92 } }, fallback).action).toBe('barge_in_stop');
        expect(parseSpokenIntentAnswers({ bargeInStop: { probability: 0.92 } }, fallback)).toBe(fallback);
    });
    it.each([undefined, null, true, '0.9', NaN, -1, 1.1])('does not manufacture missing or invalid intent confidence %s', confidence => {
        expect(parseSpokenIntentAnswers({ intent: { choice: 'barge_in_stop', confidence } }, fallback)).toBe(fallback);
    });
    it.each(['nonexistent-agent', 'none'])('rejects a reassignment without a valid target (%s)', choice => {
        expect(parseSpokenIntentAnswers({
            intent: { choice: 'agent_reassignment', confidence: 0.9 },
            targetSpecialist: { choice, confidence: 0.9 },
        }, fallback)).toBe(fallback);
    });
    it('requires the specialist answer to carry its own valid confidence', () => {
        expect(parseSpokenIntentAnswers({
            intent: { choice: 'agent_reassignment', confidence: 0.9 },
            targetSpecialist: { choice: 'legal' },
        }, fallback)).toBe(fallback);
    });
    it('rejects undeclared intent even when a specialist answer is otherwise valid', () => {
        expect(parseSpokenIntentAnswers({
            intent: { choice: 'execute_anything', confidence: 1 },
            targetSpecialist: { choice: 'legal', confidence: 1 },
        }, fallback)).toBe(fallback);
    });
    it('preserves a deterministic stop when model answers are malformed', () => {
        const stop = deterministicSpokenIntentFallback('stop');
        expect(parseSpokenIntentAnswers(null, stop)).toBe(stop);
    });
});

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn(() => mockHttpsCallable),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgmentsAvailable: vi.fn(() => true),
}));

describe('liveConversationJudgments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deterministicSpokenIntentFallback', () => {
        it('detects single-word and phrasal barge-in stops with high confidence', () => {
            expect(deterministicSpokenIntentFallback('stop').action).toBe('barge_in_stop');
            expect(deterministicSpokenIntentFallback('wait a second').action).toBe('barge_in_stop');
            expect(deterministicSpokenIntentFallback('hold on please').action).toBe('barge_in_stop');
            expect(deterministicSpokenIntentFallback('shut up').action).toBe('barge_in_stop');
            expect(deterministicSpokenIntentFallback('be quiet').action).toBe('barge_in_stop');
        });

        it('detects direct agent addressing and maps to valid agent id', () => {
            const legalTurn = deterministicSpokenIntentFallback('ask legal about the contract terms');
            expect(legalTurn.action).toBe('agent_reassignment');
            expect(legalTurn.targetAgentId).toBe('legal');

            const financeTurn = deterministicSpokenIntentFallback('hey finance what is our recoupment');
            expect(financeTurn.action).toBe('agent_reassignment');
            expect(financeTurn.targetAgentId).toBe('finance');

            const distroTurn = deterministicSpokenIntentFallback('let distribution prepare the dsp metadata');
            expect(distroTurn.action).toBe('agent_reassignment');
            expect(distroTurn.targetAgentId).toBe('distribution');
        });

        it('defaults general studio chat to general_conversation', () => {
            const chat = deterministicSpokenIntentFallback('I want to brainstorm some new album concepts for the fall');
            expect(chat.action).toBe('general_conversation');
        });
    });

    describe('judgeSpokenConversationIntent (Jev System One)', () => {
        it('bypasses callable for deterministic stop commands (0ms fast path)', async () => {
            const verdict = await judgeSpokenConversationIntent('stop right there');
            expect(verdict.action).toBe('barge_in_stop');
            expect(mockHttpsCallable).not.toHaveBeenCalled();
        });

        it('parses Jev Noul bargeInStop probability when stop condition holds', async () => {
            mockHttpsCallable.mockResolvedValueOnce({
                data: {
                    answers: {
                        bargeInStop: { noul: 0.92 },
                        intent: { choice: 'barge_in_stop', confidence: 0.95 },
                        targetSpecialist: { choice: 'none' },
                    },
                },
            });

            // Colloquial interrupt without literal keywords in BARGE_IN_WORDS
            const verdict = await judgeSpokenConversationIntent('Cease all operations right now');
            expect(verdict.action).toBe('barge_in_stop');
            expect(verdict.confidence).toBe(0.92);
        });

        it('routes to specialist via speculative Jev Choice fan-out', async () => {
            mockHttpsCallable.mockResolvedValueOnce({
                data: {
                    answers: {
                        bargeInStop: { noul: 0.05 },
                        intent: { choice: 'agent_reassignment', confidence: 0.88 },
                        targetSpecialist: { choice: 'legal', confidence: 0.88 },
                    },
                },
            });

            const verdict = await judgeSpokenConversationIntent('Who owns the master recording rights under this agreement?');
            expect(verdict.action).toBe('agent_reassignment');
            expect(verdict.targetAgentId).toBe('legal');
        });

        it('falls back gracefully on network or service error', async () => {
            mockHttpsCallable.mockRejectedValueOnce(new Error('Network offline'));

            const verdict = await judgeSpokenConversationIntent('Hello my friend');
            expect(verdict.action).toBe('general_conversation');
        });
    });
});
