import { beforeEach, describe, expect, it, vi } from 'vitest';

const addMock = vi.fn();
const collectionMock = vi.fn(() => ({ add: addMock }));
const firestoreMock = vi.fn(() => ({ collection: collectionMock }));

vi.mock('firebase-admin', () => ({
    firestore: firestoreMock,
}));

import { auditSampleClearance } from '../auditSampleClearance.js';
import { McpContext } from '../../types.js';

const context = (uid: string): McpContext => ({
    user: { uid, admin: false } as never,
});

describe('auditSampleClearance MCP tool (fail-closed stub)', () => {
    beforeEach(() => {
        addMock.mockClear();
        collectionMock.mockClear();
        firestoreMock.mockClear();
    });

    it('fails closed with BACKEND_UNAVAILABLE and never touches Firestore', async () => {
        const result = await auditSampleClearance.handler({ trackId: 'track-123' }, context('user-1'));

        expect(result.isError).toBe(true);
        expect(firestoreMock).not.toHaveBeenCalled();
        expect(collectionMock).not.toHaveBeenCalled();
        expect(addMock).not.toHaveBeenCalled();

        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
        expect(payload).toMatchObject({
            schemaVersion: 'mcp-operation-result.v1',
            tool: 'audit_sample_clearance',
            status: 'failed',
            actorUid: 'user-1',
            resource: { type: 'track', id: 'track-123', ownerUid: 'user-1' },
            error: {
                code: 'BACKEND_UNAVAILABLE',
                retryable: false,
            },
        });
        expect(payload.error.message).toContain('No sample-clearance analysis backend exists yet');
        expect(payload.error.message).toContain('no audit was performed');
        // Honest failure: never claims success or a job id.
        expect(payload.error.message).not.toMatch(/success/i);
    });

    it('rejects a missing/invalid trackId without any Firestore access', async () => {
        const result = await auditSampleClearance.handler({}, context('user-1'));

        expect(result.isError).toBe(true);
        expect(firestoreMock).not.toHaveBeenCalled();

        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(payload.error.message).toContain('trackId');
    });
});
