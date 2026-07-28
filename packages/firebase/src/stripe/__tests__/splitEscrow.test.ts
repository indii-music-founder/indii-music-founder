import { describe, it, expect, vi, beforeEach } from 'vitest';
import functionsTest from 'firebase-functions-test';
import { initiateSplitEscrow, signEscrow, releaseEscrow } from '../splitEscrow';

const testEnv = functionsTest();

// Mock Stripe config
vi.mock('../config', () => ({
    stripe: {
        paymentIntents: {
            create: vi.fn(),
            capture: vi.fn(),
        },
        transfers: {
            create: vi.fn(),
        },
    },
}));

// Mock Firebase Admin
vi.mock('firebase-admin', () => {
    const mockRunTransaction = vi.fn((cb) => {
        return cb({
            get: vi.fn(),
            update: vi.fn(),
        });
    });

    const docMock = {
        get: vi.fn(),
        update: vi.fn(),
    };

    const addMock = vi.fn();
    const collectionMock = {
        add: addMock,
        doc: vi.fn(() => docMock),
    };

    const dbMock = {
        collection: vi.fn(() => collectionMock),
        runTransaction: mockRunTransaction,
    };

    const fieldValueMock = {
        serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
    };

    return {
        firestore: Object.assign(vi.fn(() => dbMock), { FieldValue: fieldValueMock })
    };
});

describe('Split Escrow Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STRIPE_PLATFORM_ACCOUNT_ID = 'acct_12345';
    });

    describe('initiateSplitEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(initiateSplitEscrow);
            await expect(wrapped({ data: { trackId: '123', holdAmount: 1000, parties: ['user1'] } } as any))
                .rejects.toThrow('User must be signed in.');
        });

        it('should validate inputs', async () => {
            const wrapped = testEnv.wrap(initiateSplitEscrow);
            await expect(wrapped({ data: { holdAmount: 1000, parties: ['user1'] }, auth: { uid: 'user1' } } as any))
                .rejects.toThrow('trackId, holdAmount (positive cents), and non-empty parties array are required.');
        });
    });

    describe('signEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(signEscrow);
            await expect(wrapped({ data: { escrowDocId: 'escrow123' } } as any))
                .rejects.toThrow('User must be signed in.');
        });
    });

    describe('releaseEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(releaseEscrow);
            await expect(wrapped({ data: { escrowDocId: 'escrow123' } } as any))
                .rejects.toThrow('User must be signed in.');
        });
    });
});
