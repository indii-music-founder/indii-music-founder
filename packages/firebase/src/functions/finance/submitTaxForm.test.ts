import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import * as admin from 'firebase-admin';
import { processSubmitTaxForm } from './submitTaxForm';

const VALID_TOKEN = 'a'.repeat(64);
const VALID_INPUT = {
    token: VALID_TOKEN,
    fileBase64: Buffer.from('dummy pdf bytes').toString('base64'),
    fileName: 'w9.pdf',
    contentType: 'application/pdf',
};

function futureDate(daysFromNow: number) {
    return { toDate: () => new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000) };
}

describe('processSubmitTaxForm', () => {
    let requestData: Record<string, unknown> | null;
    let requestDeleted: boolean;
    let collaboratorExists: boolean;
    let saveMock: ReturnType<typeof vi.fn>;
    let updateMock: ReturnType<typeof vi.fn>;
    let bucketFileMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        requestData = {
            artistUid: 'artist-1',
            collaboratorId: 'collab-1',
            consumedAt: null,
            expiresAt: futureDate(7),
        };
        requestDeleted = false;
        collaboratorExists = true;
        saveMock = vi.fn().mockResolvedValue(undefined);
        updateMock = vi.fn().mockResolvedValue(undefined);

        const txGet = vi.fn(async () => ({
            exists: requestData !== null,
            data: () => requestData,
        }));
        const txUpdate = vi.fn();
        const txDelete = vi.fn(() => { requestDeleted = true; });

        const requestRef = { path: 'taxFormRequests/token' };
        const requestDocMock = vi.fn(() => requestRef);
        const taxFormRequestsCollection = { doc: requestDocMock };

        const collaboratorRef = {
            get: vi.fn(async () => ({ exists: collaboratorExists })),
            update: updateMock,
        };

        bucketFileMock = vi.fn(() => ({ save: saveMock }));
        const bucketMock = vi.fn(() => ({ file: bucketFileMock }));

        const firestoreMock = Object.assign(
            vi.fn(() => ({
                collection: vi.fn((name: string) => {
                    if (name === 'taxFormRequests') return taxFormRequestsCollection;
                    throw new Error(`Unexpected collection: ${name}`);
                }),
                doc: vi.fn((path: string) => {
                    if (path.includes('tax_collaborators')) return collaboratorRef;
                    throw new Error(`Unexpected doc path: ${path}`);
                }),
                runTransaction: vi.fn(async (handler: (tx: unknown) => Promise<unknown>) =>
                    handler({ get: txGet, update: txUpdate, delete: txDelete })
                ),
            })),
            { FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') } },
        );

        vi.mocked(admin.firestore).mockImplementation(firestoreMock as never);
        vi.mocked(admin.storage).mockImplementation(vi.fn(() => ({ bucket: bucketMock })) as never);
    });

    it('rejects an invalid token format', async () => {
        const result = await processSubmitTaxForm({ ...VALID_INPUT, token: 'not-hex' });
        expect(result.status).toBe(400);
    });

    it('rejects an unsupported content type', async () => {
        const result = await processSubmitTaxForm({ ...VALID_INPUT, contentType: 'application/zip' });
        expect(result.status).toBe(400);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('rejects a file over the 20MB limit', async () => {
        const big = Buffer.alloc(21 * 1024 * 1024).toString('base64');
        const result = await processSubmitTaxForm({ ...VALID_INPUT, fileBase64: big });
        expect(result.status).toBe(400);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('returns 404 when the token does not exist', async () => {
        requestData = null;
        const result = await processSubmitTaxForm(VALID_INPUT);
        expect(result.status).toBe(404);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('returns 409 and does not re-upload when the token was already consumed', async () => {
        requestData!.consumedAt = 'SOME_TIMESTAMP';
        const result = await processSubmitTaxForm(VALID_INPUT);
        expect(result.status).toBe(409);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('returns 404 and deletes the request doc when the token has expired', async () => {
        requestData!.expiresAt = futureDate(-1);
        const result = await processSubmitTaxForm(VALID_INPUT);
        expect(result.status).toBe(404);
        expect(requestDeleted).toBe(true);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('returns 404 when the collaborator record no longer exists', async () => {
        collaboratorExists = false;
        const result = await processSubmitTaxForm(VALID_INPUT);
        expect(result.status).toBe(404);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('uploads to the correct owner-scoped path and marks the collaborator on_file', async () => {
        const result = await processSubmitTaxForm(VALID_INPUT);

        expect(result.status).toBe(200);
        expect(bucketFileMock).toHaveBeenCalledWith(expect.stringMatching(/^tax_docs\/artist-1\/collab-1\/\d+-w9\.pdf$/));
        expect(saveMock).toHaveBeenCalledWith(expect.any(Buffer), { contentType: 'application/pdf' });
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'on_file', fileName: 'w9.pdf' })
        );
    });
});
