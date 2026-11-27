import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mocks = vi.hoisted(() => ({
    validateAppCheckV2: vi.fn(),
    requireVerifiedCreativeUser: vi.fn(() => 'user-123'),
    requireVerifiedServerEntitlement: vi.fn(async () => ({ tier: 'pro' })),
    entitlementTierToBudgetTier: vi.fn(() => 'pro'),
    protectAuthenticatedApiRequest: vi.fn(async () => ({ allowed: true, status: 200, message: 'OK' })),
    policyClassForServerEntitlement: vi.fn(() => 'authenticated_pro'),
    checkOperationBudget: vi.fn(async () => ({ allowed: true, operationId: 'op-ad-eval-1' })),
    finalizeOperationReservation: vi.fn(async () => undefined),
    evaluateMock: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts: unknown, handler: unknown) => handler,
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('../billing/enforceOperationCost', () => ({
    requireVerifiedCreativeUser: mocks.requireVerifiedCreativeUser,
    checkOperationBudget: mocks.checkOperationBudget,
    finalizeOperationReservation: mocks.finalizeOperationReservation,
}));

vi.mock('../auth/entitlements', () => ({
    requireVerifiedServerEntitlement: mocks.requireVerifiedServerEntitlement,
    entitlementTierToBudgetTier: mocks.entitlementTierToBudgetTier,
}));

vi.mock('../security/arcjet', () => ({
    protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest,
    policyClassForServerEntitlement: mocks.policyClassForServerEntitlement,
}));

vi.mock('../../config/secrets', () => ({
    arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../../lib/vertexClient', () => ({
    getVertexAIClient: vi.fn(),
}));

import { evaluateVideoAdCutRequest, VIDEO_AD_PASS_THRESHOLD } from './evaluateVideoAdCut';

function makeRequest(data: unknown): CallableRequest<unknown> {
    return {
        data,
        auth: { uid: 'user-123', token: { email_verified: true, admin: false } },
        rawRequest: { headers: {}, ip: '127.0.0.1' },
    } as unknown as CallableRequest<unknown>;
}

const VALID_PAYLOAD = {
    variantId: 'cut_9x16_15s',
    shape: '9:16',
    durationSeconds: 15,
    briefSummary: '15s Reels ad for Midnight Signal debut single.',
    keyframeBase64List: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
    mimeType: 'image/jpeg',
};

describe('evaluateVideoAdCutRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireVerifiedCreativeUser.mockReturnValue('user-123');
        mocks.requireVerifiedServerEntitlement.mockResolvedValue({ tier: 'pro' });
        mocks.protectAuthenticatedApiRequest.mockResolvedValue({ allowed: true, status: 200, message: 'OK' });
        mocks.checkOperationBudget.mockResolvedValue({ allowed: true, operationId: 'op-ad-eval-1' });
        mocks.evaluateMock.mockResolvedValue(
            JSON.stringify({
                firstTwoSecondHook: 9.4,
                mobileLegibility: 9.2,
                safeZoneIntegrity: 9.5,
                audioVisualPacing: 9.1,
                brandAlignment: 9.3,
                overallScore: 9.3,
                overallPass: true,
                gapsFound: 'None',
            }),
        );
    });

    it('maps Arcjet denials (429 and 403) to resource-exhausted and permission-denied HttpsError', async () => {
        mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
            allowed: false,
            status: 429,
            message: 'Rate limit exceeded',
        });
        await expect(
            evaluateVideoAdCutRequest(makeRequest(VALID_PAYLOAD), { evaluate: mocks.evaluateMock }),
        ).rejects.toMatchObject({ code: 'resource-exhausted' });

        mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
            allowed: false,
            status: 403,
            message: 'Request blocked by policy',
        });
        await expect(
            evaluateVideoAdCutRequest(makeRequest(VALID_PAYLOAD), { evaluate: mocks.evaluateMock }),
        ).rejects.toMatchObject({ code: 'permission-denied' });

        expect(mocks.evaluateMock).not.toHaveBeenCalled();
    });

    it('rejects invalid request payloads fail-closed (empty keyframes, invalid shape, unsupported mimeType)', async () => {
        await expect(
            evaluateVideoAdCutRequest(
                makeRequest({ ...VALID_PAYLOAD, keyframeBase64List: [] }),
                { evaluate: mocks.evaluateMock },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(
            evaluateVideoAdCutRequest(
                makeRequest({ ...VALID_PAYLOAD, shape: '21:9' }),
                { evaluate: mocks.evaluateMock },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(
            evaluateVideoAdCutRequest(
                makeRequest({ ...VALID_PAYLOAD, mimeType: 'video/mp4' }),
                { evaluate: mocks.evaluateMock },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(
            evaluateVideoAdCutRequest(
                makeRequest({ ...VALID_PAYLOAD, variantId: '   ', keyframeBase64List: ['data:image/jpeg;base64,'] }),
                { evaluate: mocks.evaluateMock },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });

        expect(mocks.checkOperationBudget).not.toHaveBeenCalled();
    });

    it('denies evaluation when budget check returns allowed: false', async () => {
        mocks.checkOperationBudget.mockResolvedValueOnce({ allowed: false, operationId: '' });
        await expect(
            evaluateVideoAdCutRequest(makeRequest(VALID_PAYLOAD), { evaluate: mocks.evaluateMock }),
        ).rejects.toMatchObject({ code: 'resource-exhausted' });

        expect(mocks.evaluateMock).not.toHaveBeenCalled();
    });

    it('invokes Gemini 4 Neon evaluator, clamps scores, forces overallPass=false below threshold, and settles reservation', async () => {
        mocks.evaluateMock.mockResolvedValueOnce(
            JSON.stringify({
                firstTwoSecondHook: 11.4,
                mobileLegibility: -2,
                safeZoneIntegrity: 8.6,
                audioVisualPacing: 8.5,
                brandAlignment: 8.8,
                overallScore: 8.74,
                // Even if raw model hallucinates overallPass=true below 9.0, server forces false
                overallPass: true,
                gapsFound: 'Subtitle overlaps bottom Reels chrome',
                refinementPatch: {
                    fontScaleMultiplier: 1.5, // clamped to 1.25
                    extraSafeMarginPct: 0.06,
                    headlineOverride: 'DROP FRIDAY',
                },
            }),
        );

        const result = await evaluateVideoAdCutRequest(makeRequest(VALID_PAYLOAD), {
            evaluate: mocks.evaluateMock,
        });

        expect(mocks.evaluateMock).toHaveBeenCalledTimes(1);
        const [calledInput] = mocks.evaluateMock.mock.calls[0]!;
        expect(calledInput.model).toBe('gemini-4-neon');
        expect(calledInput.keyframes).toHaveLength(1);
        expect(calledInput.keyframes[0]).toEqual({
            mimeType: 'image/jpeg',
            data: '/9j/4AAQSkZJRg==',
        });

        expect(result.variantId).toBe('cut_9x16_15s');
        expect(result.model).toBe('gemini-4-neon');
        expect(result.firstTwoSecondHook).toBe(10);
        expect(result.mobileLegibility).toBe(0);
        expect(result.overallScore).toBe(8.7);
        expect(result.overallScore).toBeLessThan(VIDEO_AD_PASS_THRESHOLD);
        expect(result.overallPass).toBe(false);
        expect(result.refinementPatch).toEqual({
            fontScaleMultiplier: 1.25,
            extraSafeMarginPct: 0.06,
            headlineOverride: 'DROP FRIDAY',
        });
        expect(mocks.finalizeOperationReservation).toHaveBeenCalledWith({
            userId: 'user-123',
            operationId: 'op-ad-eval-1',
            outcome: 'SETTLED',
            expectedType: 'video',
        });
    });

    it('finalizes reservation and throws failed-precondition on malformed JSON without double-settling or masking errors', async () => {
        mocks.evaluateMock.mockResolvedValueOnce('not-valid-json');
        mocks.finalizeOperationReservation.mockRejectedValueOnce(new Error('Ledger unavailable'));

        await expect(
            evaluateVideoAdCutRequest(makeRequest(VALID_PAYLOAD), { evaluate: mocks.evaluateMock }),
        ).rejects.toMatchObject({ code: 'failed-precondition' });

        expect(mocks.finalizeOperationReservation).toHaveBeenCalledTimes(1);
    });
});
