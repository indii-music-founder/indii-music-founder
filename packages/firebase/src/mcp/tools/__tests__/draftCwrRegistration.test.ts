import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import { draftCwrRegistration } from '../draftCwrRegistration.js';
import { McpContext } from '../../types.js';
import * as admin from 'firebase-admin';

const setMock = vi.fn();
const saveMock = vi.fn();
const fileMock = vi.fn(() => ({ save: saveMock }));
const bucketMock = vi.fn(() => ({ file: fileMock }));
const releaseGetMock = vi.fn();

let autoIdCounter = 0;
const docMock = vi.fn((id?: string) => ({
    id: id ?? `auto-id-${++autoIdCounter}`,
    set: setMock,
    get: releaseGetMock,
    collection: vi.fn(() => ({ doc: docMock })),
}));
const collectionMock = vi.fn(() => ({ doc: docMock }));

const firestoreMock = Object.assign(
    vi.fn(() => ({ collection: collectionMock })),
    { FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') } },
);

// These doubles model only the collection/doc/bucket/file surface this tool
// actually calls, not the full Firestore/Storage SDK shape (ISSUE-1212) — cast
// documents that the mismatch with the real return type is deliberate.
vi.mocked(admin.firestore).mockImplementation(firestoreMock as unknown as typeof admin.firestore);
vi.mocked(admin.storage).mockImplementation(
    vi.fn(() => ({ bucket: bucketMock })) as unknown as typeof admin.storage,
);

const context = (uid: string, admin_flag = false): McpContext => ({
    user: { uid, admin: admin_flag } as never,
});

describe('draftCwrRegistration MCP tool', () => {
    beforeEach(() => {
        setMock.mockReset().mockResolvedValue(undefined);
        saveMock.mockReset().mockResolvedValue(undefined);
        fileMock.mockClear();
        bucketMock.mockClear();
        docMock.mockClear();
        collectionMock.mockClear();
        releaseGetMock.mockReset().mockResolvedValue({ exists: true, data: () => ({ title: 'Test Track' }) });
    });

    it('rejects legacy names-only arguments without writing an invalid CWR artifact (structural-only)', async () => {
        const result = await draftCwrRegistration.handler({ releaseId: 'release-1', writers: [{ name: 'John Composer', ipi: '123456789' }] }, context('user-1'));
        const payload = JSON.parse((result.content[0] as { text: string }).text);
        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(payload.error.message).toContain('reviewed sender, publisher, writer and territorial shares');
        expect(saveMock).not.toHaveBeenCalled();
        expect(setMock).not.toHaveBeenCalled();
    });

    it('fails closed with INVALID_ARGUMENT when writers array is empty', async () => {
        const result = await draftCwrRegistration.handler(
            { releaseId: 'release-1', writers: [] },
            context('user-1'),
        );
        const payload = JSON.parse((result.content[0] as { text: string }).text);

        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(setMock).not.toHaveBeenCalled();
    });
});
