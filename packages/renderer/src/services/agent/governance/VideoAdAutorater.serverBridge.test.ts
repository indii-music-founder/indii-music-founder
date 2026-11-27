import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateStructuredData: vi.fn(),
    runCreativeVisionCheck: vi.fn(),
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(),
    callableFn: vi.fn(),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: (...args: unknown[]) => mocks.generateStructuredData(...args),
    },
}));

vi.mock('@/services/agent/governance/BrandVisionQC', () => ({
    runCreativeVisionCheck: (...args: unknown[]) => mocks.runCreativeVisionCheck(...args),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: (...args: unknown[]) => mocks.getFunctions(...args),
    httpsCallable: (...args: unknown[]) => mocks.httpsCallable(...args),
}));

import { VideoAdAutorater } from '@/services/agent/governance/VideoAdAutorater';

const BASE_INPUT = {
    variantId: 'cut_9x16_15s',
    shape: '9:16' as const,
    durationSeconds: 15,
    briefSummary: '15s Reels hook ad for Midnight Signal.',
    keyframeBase64List: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
};

describe('VideoAdAutorater server callable bridge (evaluateVideoAdCut)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getFunctions.mockReturnValue({ app: 'mock' });
        mocks.httpsCallable.mockReturnValue(mocks.callableFn);
        mocks.runCreativeVisionCheck.mockResolvedValue({
            approved: true,
            reason: 'Matches brand palette.',
        });
    });

    it('uses evaluateVideoAdCut server callable when available and skips client fallback', async () => {
        mocks.callableFn.mockResolvedValueOnce({
            data: {
                firstTwoSecondHook: 9.5,
                mobileLegibility: 9.4,
                safeZoneIntegrity: 9.6,
                audioVisualPacing: 9.2,
                brandAlignment: 9.5,
                overallScore: 9.4,
                overallPass: true,
                gapsFound: 'None',
            },
        });

        const result = await VideoAdAutorater.evaluateCut(BASE_INPUT);

        expect(mocks.httpsCallable).toHaveBeenCalledWith({ app: 'mock' }, 'evaluateVideoAdCut');
        expect(mocks.callableFn).toHaveBeenCalledWith({
            variantId: 'cut_9x16_15s',
            shape: '9:16',
            durationSeconds: 15,
            briefSummary: '15s Reels hook ad for Midnight Signal.',
            keyframeBase64List: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
            mimeType: 'image/jpeg',
        });
        expect(mocks.generateStructuredData).not.toHaveBeenCalled();
        expect(result.score?.overallScore).toBe(9.4);
        expect(result.score?.overallPass).toBe(true);
    });

    it.each([
        'functions/permission-denied',
        'functions/resource-exhausted',
        'functions/unauthenticated',
        'functions/invalid-argument',
        'functions/internal',
    ])('fails closed without client fallback or BrandVisionQC when server callable rejects with %s', async (errorCode) => {
        const err = Object.assign(new Error('Denied by server policy'), { code: errorCode });
        mocks.callableFn.mockRejectedValueOnce(err);

        const result = await VideoAdAutorater.evaluateCut({
            ...BASE_INPUT,
            brandKit: { primaryColors: ['#FFE135'], forbiddenElements: [], vibe: 'Minimalist' },
        });

        expect(result.score).toBeNull();
        expect(result.brandQc?.approved).toBe(false);
        expect(mocks.generateStructuredData).not.toHaveBeenCalled();
        expect(mocks.runCreativeVisionCheck).not.toHaveBeenCalled();
    });

    it('falls back to AutonomousIntelligence using Gemini 4 Neon (CONDUCTOR) when callable is unavailable or uninitialized', async () => {
        mocks.getFunctions.mockImplementationOnce(() => {
            throw new Error("Firebase: No Firebase App '[DEFAULT]' has been created");
        });
        mocks.generateStructuredData.mockResolvedValueOnce({
            firstTwoSecondHook: 9.2,
            mobileLegibility: 9.1,
            safeZoneIntegrity: 9.3,
            audioVisualPacing: 9.0,
            brandAlignment: 9.2,
            overallScore: 9.2,
            overallPass: true,
            gapsFound: 'None',
        });

        const uninitializedResult = await VideoAdAutorater.evaluateCut(BASE_INPUT);
        expect(uninitializedResult.score?.overallScore).toBe(9.2);
        expect(mocks.generateStructuredData).toHaveBeenCalledTimes(1);
        expect(mocks.generateStructuredData.mock.calls[0]?.[4]).toBe('gemini-4-neon');

        mocks.callableFn.mockRejectedValueOnce(
            Object.assign(new Error('Service unavailable'), { code: 'functions/unavailable' }),
        );
        mocks.generateStructuredData.mockResolvedValueOnce({
            firstTwoSecondHook: 9.3,
            mobileLegibility: 9.2,
            safeZoneIntegrity: 9.4,
            audioVisualPacing: 9.1,
            brandAlignment: 9.3,
            overallScore: 9.3,
            overallPass: true,
            gapsFound: 'None',
        });

        const unavailableResult = await VideoAdAutorater.evaluateCut(BASE_INPUT);
        expect(unavailableResult.score?.overallScore).toBe(9.3);
        expect(mocks.generateStructuredData).toHaveBeenCalledTimes(2);
        expect(mocks.generateStructuredData.mock.calls[1]?.[4]).toBe('gemini-4-neon');
    });
});
