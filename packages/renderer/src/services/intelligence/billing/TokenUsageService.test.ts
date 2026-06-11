import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenUsageService } from './TokenUsageService';
import * as firestore from 'firebase/firestore';
// Mock Firestore
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
}));

// Mock DB
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('TokenUsageService', () => {
    const mockUserId = 'test-user-123';
    const mockDate = new Date().toISOString().split('T')[0];
    const docId = `${mockUserId}_${mockDate}`;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('trackUsage', () => {
        it('should try to update existing doc first', async () => {
            await TokenUsageService.trackUsage(mockUserId, 'gemini-pro', 100, 50);

            expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'user_usage_stats', docId);
            // increment() is mocked to return undefined, so incremented fields read as undefined.
            // Assert the daily counters AND the new per-model cost-attribution fields are written.
            expect(firestore.updateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
                tokensUsed: undefined,
                inputTokens: undefined,
                outputTokens: undefined,
                requestCount: undefined,
                estimatedCostUsd: undefined,
                'models.gemini-pro.model': 'gemini-pro',
                'models.gemini-pro.costUsd': undefined,
                lastUpdated: undefined
            }));
        });

        it('attributes estimated USD cost per model on create path', async () => {
            vi.mocked(firestore.updateDoc).mockRejectedValueOnce({ code: 'not-found' });

            // gemini-3.1-pro-preview is a known token model: 1000 in @ $1.25/1M + 2000 out @ $10/1M
            await TokenUsageService.trackUsage(mockUserId, 'gemini-3.1-pro-preview', 1000, 2000);

            const setDocArgs = vi.mocked(firestore.setDoc).mock.calls[0][1] as Record<string, unknown>;
            const expectedCost = (1000 / 1_000_000) * 1.25 + (2000 / 1_000_000) * 10.0;
            expect(setDocArgs.estimatedCostUsd as number).toBeCloseTo(expectedCost, 9);
            expect(setDocArgs.inputTokens).toBe(1000);
            expect(setDocArgs.outputTokens).toBe(2000);
            const models = setDocArgs.models as Record<string, { model: string; costUsd: number }>;
            expect(models['gemini-3_1-pro-preview'].model).toBe('gemini-3.1-pro-preview');
            expect(models['gemini-3_1-pro-preview'].costUsd).toBeCloseTo(expectedCost, 9);
        });

        it('should create new doc if update fails with not-found', async () => {
            vi.mocked(firestore.updateDoc).mockRejectedValueOnce({ code: 'not-found' });

            await TokenUsageService.trackUsage(mockUserId, 'gemini-pro', 100, 50);

            expect(firestore.setDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
                userId: mockUserId,
                tokensUsed: 150,
                requestCount: 1
            }));
        });
    });

    describe('checkQuota', () => {
        it('should allow if no usage doc exists', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined
            } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

            const allowed = await TokenUsageService.checkQuota(mockUserId);
            expect(allowed).toBe(true);
        });

        it('should allow if usage is under limit', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ tokensUsed: 5000 })
            } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

            const allowed = await TokenUsageService.checkQuota(mockUserId);
            expect(allowed).toBe(true);
        });

        it('should throw QuotaExceededError if usage is over limit', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ tokensUsed: 100001 }) // Limit is 100k
            } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

            await expect(TokenUsageService.checkQuota(mockUserId))
                .rejects.toThrow('Daily Intelligence token limit exceeded');
        });

        it('should throw EMERGENCY_STOP when quota is disabled', async () => {
            // Mock GLOBAL_EMERGENCY_STOP to true for this test
            (TokenUsageService as any).GLOBAL_EMERGENCY_STOP = true;
            await expect(TokenUsageService.checkQuota(mockUserId))
                .rejects.toThrow('EMERGENCY STOP');
        });
    });
});
