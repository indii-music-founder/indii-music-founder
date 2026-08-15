import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const add = vi.fn().mockResolvedValue({ id: 'audit-123' });
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

import { persistAuditEvent } from './logAuditEvent';

describe('persistAuditEvent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('binds an agent tool outcome to the authenticated owner and server time', async () => {
        const result = await persistAuditEvent('owner-123', {
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            agentId: 'creative-director',
            status: 'success',
        });

        expect(mocks.collection).toHaveBeenCalledWith('audit_logs');
        expect(mocks.add).toHaveBeenCalledWith({
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            status: 'success',
            agentId: 'creative-director',
            userId: 'owner-123',
            timestamp: 'SERVER_TIMESTAMP',
            source: 'Studio_Agent',
        });
        expect(result).toMatchObject({ logId: 'audit-123', status: 'success' });
    });

    it('rejects unbounded or invalid client-supplied audit fields', async () => {
        await expect(persistAuditEvent('owner-123', {
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            agentId: 'x'.repeat(121),
            status: 'success',
        })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
