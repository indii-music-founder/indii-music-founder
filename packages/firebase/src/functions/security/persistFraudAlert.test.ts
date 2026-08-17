import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const add = vi.fn().mockResolvedValue({ id: 'fraud-1' });
    const collection = vi.fn(() => ({ add }));
    const firestore = Object.assign(vi.fn(() => ({ collection })), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    });
    return { add, collection, firestore };
});

vi.mock('firebase-admin', () => ({ firestore: mocks.firestore }));

vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    };
});

import { SubscriptionTier } from '../../shared/subscription/types';
import { admitFraudAlertWriteRequest } from './persistFraudAlert';

function admittedRequest() {
    return {
        auth: { uid: 'owner-123', token: { admin: false } },
        app: { appId: 'verified-app' },
        rawRequest: { method: 'POST', headers: {} },
        data: {},
    } as never;
}

describe('admitFraudAlertWriteRequest', () => {
    beforeEach(() => vi.clearAllMocks());

    it('admits a verified, entitled request that passes Arcjet protection', async () => {
        const uid = await admitFraudAlertWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn() as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.STUDIO }) as never,
            protect: vi.fn().mockResolvedValue({ allowed: true }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        });

        expect(uid).toBe('owner-123');
    });

    it('fails closed when Arcjet blocks the request', async () => {
        await expect(admitFraudAlertWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn() as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.STUDIO }) as never,
            protect: vi.fn().mockResolvedValue({
                allowed: false,
                status: 403,
                code: 'REQUEST_BLOCKED',
                message: 'Request blocked by security policy.',
            }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        })).rejects.toMatchObject({ code: 'permission-denied' });
        expect(mocks.add).not.toHaveBeenCalled();
    });

    it('fails closed when the entitlement cannot be resolved', async () => {
        const entitlementError = new Error('No entitlement found.');
        (entitlementError as { code?: string }).code = 'permission-denied';

        await expect(admitFraudAlertWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn() as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockRejectedValue(entitlementError) as never,
            protect: vi.fn().mockResolvedValue({ allowed: true }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        })).rejects.toMatchObject({ code: 'permission-denied' });
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
