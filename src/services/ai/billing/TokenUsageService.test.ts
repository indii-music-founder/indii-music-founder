import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenUsageService } from './TokenUsageService';
import * as firestore from 'firebase/firestore';
import { AppErrorCode, AppException } from '@/shared/types/errors';

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
    db: {}
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
            expect(firestore.updateDoc).toHaveBeenCalledWith(undefined, {
                tokensUsed: undefined, // increment mock returns undefined
                requestCount: undefined,
                lastUpdated: undefined
            });
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
            } as any);

            const allowed = await TokenUsageService.checkQuota(mockUserId);
            expect(allowed).toBe(true);
        });

        it('should allow if usage is under limit', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ tokensUsed: 5000 })
            } as any);

            const allowed = await TokenUsageService.checkQuota(mockUserId);
            expect(allowed).toBe(true);
        });

        it('should throw QuotaExceededError if usage is over limit', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ tokensUsed: 100001 }) // Limit is 100k
            } as any);

            await expect(TokenUsageService.checkQuota(mockUserId))
                .rejects.toThrow('Daily AI token limit exceeded');
        });
    });
});
