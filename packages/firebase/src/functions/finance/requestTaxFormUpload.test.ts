import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { processRequestTaxFormUpload } from './requestTaxFormUpload';

const setMock = vi.fn();
const collaboratorGetMock = vi.fn();

const docMock = vi.fn((path: string) => {
    if (path.includes('tax_collaborators')) {
        return { get: collaboratorGetMock };
    }
    return { set: setMock };
});
const collectionDocMock = vi.fn(() => ({ set: setMock }));
const collectionMock = vi.fn(() => ({ doc: collectionDocMock }));

const firestoreMock = Object.assign(
    vi.fn(() => ({ doc: docMock, collection: collectionMock })),
    { FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') } },
);

vi.mocked(admin.firestore).mockImplementation(firestoreMock as never);

describe('processRequestTaxFormUpload', () => {
    beforeEach(() => {
        setMock.mockReset().mockResolvedValue(undefined);
        collaboratorGetMock.mockReset();
        docMock.mockClear();
        collectionMock.mockClear();
        collectionDocMock.mockClear();
    });

    it('rejects a missing collaboratorId', async () => {
        await expect(processRequestTaxFormUpload('uid-1', '')).rejects.toThrow(HttpsError);
    });

    it('throws not-found when the collaborator does not belong to the caller', async () => {
        collaboratorGetMock.mockResolvedValueOnce({ exists: false });
        await expect(processRequestTaxFormUpload('uid-1', 'collab-1')).rejects.toThrow(/not found/i);
    });

    it('mints a token, stores the request, and returns a 7-day upload URL', async () => {
        collaboratorGetMock.mockResolvedValueOnce({ exists: true });
        const before = Date.now();

        const result = await processRequestTaxFormUpload('uid-1', 'collab-1');

        expect(result.uploadUrl).toMatch(/^https:\/\/app\.indii\.music\/tax-form-upload\?token=[a-f0-9]{64}$/);
        expect(result.expiresAt).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
        expect(setMock).toHaveBeenCalledWith(
            expect.objectContaining({
                artistUid: 'uid-1',
                collaboratorId: 'collab-1',
                consumedAt: null,
            })
        );
    });

    it('scopes the collaborator lookup to the caller\'s own uid path', async () => {
        collaboratorGetMock.mockResolvedValueOnce({ exists: true });
        await processRequestTaxFormUpload('uid-1', 'collab-1');
        expect(docMock).toHaveBeenCalledWith('users/uid-1/tax_collaborators/collab-1');
    });
});
