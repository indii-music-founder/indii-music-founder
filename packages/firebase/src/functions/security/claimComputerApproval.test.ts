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
        static fromMillis(millis: number) { return new Timestamp(millis); }
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
import { claimComputerApproval, completeComputerApproval } from './claimComputerApproval';

const invoke = claimComputerApproval as unknown as (request: unknown) => Promise<unknown>;
const invokeComplete = completeComputerApproval as unknown as (request: unknown) => Promise<unknown>;
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
                args, createdAt: Timestamp.fromMillis(currentCreatedMs) }),
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
                args, createdAt: Timestamp.fromMillis(expiredMs) }),
        }));
        await expect(invoke(request())).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(mocks.update).not.toHaveBeenCalled();
    });
});

describe('completeComputerApproval', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('transitions a claimed approval to executed on success', async () => {
        mocks.get.mockImplementation(async () => ({
            exists: true,
            data: () => ({ status: 'claimed', agentId: 'generalist', toolName: 'computer_click' }),
        }));

        const result = await invokeComplete({
            auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
            data: { approvalId: 'approval-1', success: true },
        });

        expect(result).toMatchObject({ id: 'approval-1', status: 'executed', success: true });
        expect(mocks.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                status: 'executed',
                result: expect.objectContaining({ success: true }),
            })
        );
    });

    it('transitions a claimed approval to failed on error', async () => {
        mocks.get.mockImplementation(async () => ({
            exists: true,
            data: () => ({ status: 'claimed', agentId: 'generalist', toolName: 'computer_click' }),
        }));

        const result = await invokeComplete({
            auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
            data: { approvalId: 'approval-1', success: false, error: 'OS click rejected' },
        });

        expect(result).toMatchObject({ id: 'approval-1', status: 'failed', success: false });
        expect(mocks.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                status: 'failed',
                result: expect.objectContaining({ success: false, error: 'OS click rejected' }),
            })
        );
    });

    it('rejects when approval is not claimed', async () => {
        mocks.get.mockImplementation(async () => ({
            exists: true,
            data: () => ({ status: 'pending', agentId: 'generalist', toolName: 'computer_click' }),
        }));

        await expect(
            invokeComplete({
                auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
                data: { approvalId: 'approval-1', success: true },
            })
        ).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
