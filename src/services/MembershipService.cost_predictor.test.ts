
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { CostPredictor } from '@/services/ai/utils/CostPredictor';
import { getDoc } from 'firebase/firestore';

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {}
}));

// Mock Firestore SDK
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => 'mock-doc-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn(),
    FieldValue: { serverTimestamp: vi.fn() },
    query: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    getCountFromServer: vi.fn()
}));

// Mock Store
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger\'s Cost Predictor Integration)', () => {
    const MOCK_USER_ID = 'ledger-veo-user';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: Free Tier ($1.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });
    });

    it('💸 "The Predictive Stop": Blocks Veo 3.1 generation if predicted cost exceeds budget', async () => {
        // 1. Setup: User has low funds remaining
        // Free Limit: $1.00. Current Spend: $0.98. Remaining: $0.02.
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({
                totalSpend: 0.98,
                updatedAt: Date.now()
            })
        });

        // 2. Mock Cost Predictor for Veo 3.1
        // Veo cost is typically $0.05 per generation (based on ai-models.ts or assumption)
        // We force it to return $0.05
        const VEO_COST = 0.05;
        const spyPredict = vi.spyOn(CostPredictor, 'predictVideoCost').mockReturnValue({
            model: 'veo-3.1',
            estimatedCostUsd: VEO_COST,
            estimatedCredits: 50,
            unit: 'generation',
            details: 'Veo 3.1 Premium'
        });

        // 3. Execution: Simulate the check that happens before generation
        // "Verify Wallet Logic": We get the cost, then check the budget.
        const prediction = CostPredictor.predictVideoCost(5); // 5 seconds
        const budgetCheck = await MembershipService.checkBudget(prediction.estimatedCostUsd);

        // 4. Assertions
        // Cost ($0.05) > Remaining ($0.02) -> BLOCKED
        expect(budgetCheck.allowed).toBe(false);
        expect(budgetCheck.remainingBudget).toBeCloseTo(0.02);

        console.log(`💸 [Ledger] Predicted Cost: $${prediction.estimatedCostUsd.toFixed(2)} | Budget: $0.02`);
        console.log(`   🛑 STOP SWITCH ACTIVATED! User cannot afford Veo 3.1.`);
    });

    it('💸 allows Veo 3.1 generation if budget permits', async () => {
        // 1. Setup: User has funds
        // Current Spend: $0.50. Remaining: $0.50.
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({
                totalSpend: 0.50,
                updatedAt: Date.now()
            })
        });

        const VEO_COST = 0.05;
        vi.spyOn(CostPredictor, 'predictVideoCost').mockReturnValue({
            model: 'veo-3.1',
            estimatedCostUsd: VEO_COST,
            estimatedCredits: 50,
            unit: 'generation',
            details: 'Veo 3.1 Premium'
        });

        const prediction = CostPredictor.predictVideoCost(5);
        const budgetCheck = await MembershipService.checkBudget(prediction.estimatedCostUsd);

        expect(budgetCheck.allowed).toBe(true);
        expect(budgetCheck.remainingBudget).toBeCloseTo(0.50); // Returns remaining BEFORE charge
    });
});
