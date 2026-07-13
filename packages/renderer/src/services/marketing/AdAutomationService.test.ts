import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { AdAutomationService } from './AdAutomationService';

vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

/**
 * ISSUE-845: getAdInsights() used to coerce any backend/network failure
 * into real-looking zero metrics ({impressions: 0, clicks: 0, ...}),
 * indistinguishable from a genuinely zero-performance ad. These prove it
 * now returns a typed available/unavailable result instead.
 */
describe('AdAutomationService.getAdInsights (ISSUE-845)', () => {
    let service: AdAutomationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdAutomationService();
    });

    it('returns available: true with the real metrics when the callable succeeds', async () => {
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockResolvedValue({
                data: { impressions: 1000, clicks: 50, spend: 25.5, ctr: 5, cpc: 0.51 },
            }) as unknown as ReturnType<typeof httpsCallable>
        );

        const result = await service.getAdInsights('ad-123');

        expect(result.available).toBe(true);
        if (result.available) {
            expect(result.impressions).toBe(1000);
            expect(result.spend).toBe(25.5);
        }
    });

    it('returns available: false with a real error code instead of fabricated zero metrics when the callable fails', async () => {
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockRejectedValue(new Error('Cloud Function not deployed')) as unknown as ReturnType<typeof httpsCallable>
        );

        const result = await service.getAdInsights('ad-456');

        expect(result.available).toBe(false);
        if (result.available === false) {
            expect(result.errorCode).toBe('INSIGHTS_UNAVAILABLE');
            expect(result.reason).toContain('Cloud Function not deployed');
        }
        // The old behavior returned these as real-looking zeros — confirm they're gone.
        expect(result).not.toHaveProperty('impressions');
        expect(result).not.toHaveProperty('spend');
    });
});
