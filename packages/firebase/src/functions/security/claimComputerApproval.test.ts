import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(), update: vi.fn(), protect: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) { super(message); }
    },
}));
vi.mock('firebase-admin/firestore', () => {
    class Timestamp {
        constructor(private readonly millis: number) {}
        toMillis() { return this.millis; }
    }
    return {
        Timestamp,
        FieldValue: { serverTimestamp: () => 'server-time' },
        getFirestore: () => ({
            doc: () => ({}),
            runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ get: mocks.get, update: mocks.update }),
        }),
    };
});
vi.mock('../../middleware/appCheck', () => ({ validateAppCheckV2: vi.fn() }));
vi.mock('../security/arcjet', () => ({ protectAuthenticatedApiRequest: mocks.protect }));
vi.mock('../../config/secrets', () => ({ arcjetKey: {} }));

import { Timestamp } from 'firebase-admin/firestore';
import { claimComputerApproval } from './claimComputerApproval';

const invoke = claimComputerApproval as unknown as (request: unknown) => Promise<unknown>;
const args = { x: 10, y: 20 };
let currentCreatedMs = Date.now() - 1000;
const request = () => ({
    auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
    data: { approvalId: 'approval-1', expected: {
        agentId: 'generalist', toolName: 'computer_click', args, createdAtMs: currentCreatedMs,
    } },
});

describe('claimComputerApproval expiry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentCreatedMs = Date.now() - 1000;
        mocks.get.mockImplementation(async () => ({
            exists: true,
            data: () => ({ status: 'pending', agentId: 'generalist', toolName: 'computer_click',
                args, createdAt: new Timestamp(currentCreatedMs) }),
        }));
    });

    it('claims a fresh matching approval', async () => {
        await expect(invoke(request())).resolves.toMatchObject({ status: 'claimed' });
        expect(mocks.update).toHaveBeenCalledOnce();
    });

    it('rejects an expired approval before writing a claim', async () => {
        const expiredMs = Date.now() - 6 * 60_000;
        currentCreatedMs = expiredMs;
        mocks.get.mockImplementation(async () => ({
            exists: true,
            data: () => ({ status: 'pending', agentId: 'generalist', toolName: 'computer_click',
                args, createdAt: new Timestamp(expiredMs) }),
        }));
        await expect(invoke(request())).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
