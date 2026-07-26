import { describe, expect, it, vi } from 'vitest';

import { policyClassForServerEntitlement } from '../security/arcjet';
import { requireVerifiedCreativeAdmissionV1 } from './legacyAdmission';

const rawRequest = { headers: {} };
const context = {
    auth: { uid: 'owner-1', token: { email_verified: true } },
    rawRequest,
} as unknown as Parameters<typeof requireVerifiedCreativeAdmissionV1>[0];

describe('requireVerifiedCreativeAdmissionV1', () => {
    it('uses only server-resolved entitlement to choose a rate policy', async () => {
        const policyForEntitlement = vi.fn<typeof policyClassForServerEntitlement>(() => 'founder');
        const protect = vi.fn().mockResolvedValue({ allowed: true });
        const result = await requireVerifiedCreativeAdmissionV1(context, 'legacy-edit', {
            validateAppCheck: vi.fn(),
            requireVerifiedEmail: vi.fn(() => 'owner-1'),
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: 'founder' }),
            policyForEntitlement,
            protect,
            operationId: () => 'operation-1',
        });

        expect(result.userId).toBe('owner-1');
        expect(policyForEntitlement).toHaveBeenCalledWith({ tier: 'founder', isAdmin: false });
        expect(protect).toHaveBeenCalledWith(rawRequest, expect.objectContaining({
            userId: 'owner-1', policy: 'founder', operationId: 'legacy-edit:operation-1',
        }));
    });

    it('fails closed when Arcjet denies the request', async () => {
        await expect(requireVerifiedCreativeAdmissionV1(context, 'legacy-edit', {
            validateAppCheck: vi.fn(),
            requireVerifiedEmail: vi.fn(() => 'owner-1'),
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: 'free' }),
            policyForEntitlement: vi.fn<typeof policyClassForServerEntitlement>(() => 'verified-free'),
            protect: vi.fn().mockResolvedValue({
                allowed: false,
                status: 429,
                code: 'RATE_LIMITED',
                message: 'Too many requests.',
                retryAfterSeconds: 10,
            }),
        })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
});
