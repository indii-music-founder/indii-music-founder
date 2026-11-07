import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    deterministicSpokenIntentFallback,
    judgeSpokenConversationIntent,
} from '../liveConversationJudgments';

const mockHttpsCallable = vi.fn();

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
                        bargeInStop: { probability: 0.92 },
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
                        bargeInStop: { probability: 0.05 },
                        intent: { choice: 'agent_reassignment', confidence: 0.88 },
                        targetSpecialist: { choice: 'legal' },
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
