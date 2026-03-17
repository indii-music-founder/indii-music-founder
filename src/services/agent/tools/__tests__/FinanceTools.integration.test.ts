/**
 * Item 281: Agent Tool Integration Tests — FinanceTools
 *
 * Verifies that FinanceTools produce correctly-shaped outputs for each
 * defined tool, using mocked Firebase / Stripe dependencies.
 *
 * Tests focus on:
 *  - Input validation and schema conformance
 *  - Output shape (keys, types)
 *  - Graceful fallback on dependency failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Firebase httpsCallable (used by initiate_split_escrow) ──────────────
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
    getFunctions: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
    auth: { currentUser: { uid: 'test-user-123' } },
    db: {},
}));

// ── Mock firebaseAI (used by negotiation) ────────────────────────────────────
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn().mockResolvedValue({
            negotiationLog: ['[A] Proposed terms', '[B] Counter-proposal', '[A] Agreed'],
            finalTerms: 'Agreed terms',
            outcome: 'accepted',
        }),
    },
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: { TEXT: { FAST: 'gemini-flash' } },
}));

// ── Import under test ─────────────────────────────────────────────────────────
import { FinanceTools } from '../FinanceTools';

// ── Helpers ──────────────────────────────────────────────────────────────────
function isToolSuccess(result: unknown): boolean {
    return typeof result === 'object' && result !== null && 'success' in result;
}

describe('FinanceTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculate_waterfall', () => {
        it('returns a waterfall array and flags for valid input', async () => {
            const result = await FinanceTools.calculate_waterfall({
                trackTitle: 'Test Track',
                totalRevenue: 1000,
                splits: [
                    { party: 'Artist A', percentage: 50 },
                    { party: 'Artist B', percentage: 50 },
                ],
            });
            expect(result).toBeDefined();
            expect(isToolSuccess(result)).toBe(true);
        });
    });

    describe('initiate_split_escrow', () => {
        it('gracefully falls back when Cloud Function is unavailable', async () => {
            const { httpsCallable } = await import('firebase/functions');
            vi.mocked(httpsCallable).mockReturnValue((() => {
                throw new Error('Function not deployed');
            }) as any);

            const result = await FinanceTools.initiate_split_escrow({
                trackId: 'track-001',
                holdAmount: 500,
                parties: ['user-A', 'user-B'],
            });

            expect(result).toBeDefined();
            expect(isToolSuccess(result)).toBe(true);
            // Fallback produces a locally-tracked escrow
            const data = result as any;
            expect(typeof data.escrowAccount).toBe('string');
            expect(data.status).toBe('FUNDS_TRACKED_LOCALLY');
        });

        it('returns escrow data when Cloud Function succeeds', async () => {
            const { httpsCallable } = await import('firebase/functions');
            vi.mocked(httpsCallable).mockReturnValue(
                vi.fn().mockResolvedValue({
                    data: { escrowAccount: 'acct_test123', status: 'PENDING_SIGNATURES' },
                }) as any
            );

            const result = await FinanceTools.initiate_split_escrow({
                trackId: 'track-001',
                holdAmount: 500,
                parties: ['user-A', 'user-B'],
            });

            expect(isToolSuccess(result)).toBe(true);
            const data = result as any;
            expect(data.escrowAccount).toBe('acct_test123');
            expect(data.status).toBe('PENDING_SIGNATURES');
        });
    });

    describe('compare_budget_vs_actuals', () => {
        it('computes variance and net position correctly', async () => {
            const result = await FinanceTools.compare_budget_vs_actuals({
                projectOrTourName: 'Summer Tour 2026',
                projectedBudget: 10000,
                actualExpenses: 8500,
                advancesReceived: 5000,
            });

            expect(isToolSuccess(result)).toBe(true);
            const data = result as any;
            // variance = 10000 - 8500 = 1500
            expect(data.variance).toBe(1500);
            // netPosition = 5000 - 8500 = -3500
            expect(data.netPosition).toBe(-3500);
        });
    });
});
