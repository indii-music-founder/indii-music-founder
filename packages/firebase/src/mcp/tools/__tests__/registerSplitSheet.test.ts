import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import { registerSplitSheet } from '../registerSplitSheet.js';
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

vi.mocked(admin.firestore).mockImplementation(firestoreMock);
vi.mocked(admin.storage).mockImplementation(vi.fn(() => ({ bucket: bucketMock })));

const context = (uid: string, admin = false): McpContext => ({
    user: { uid, admin } as never,
});

const validCollaborators = [
    { name: 'Zed Writer', percentage: 40 },
    { name: 'Ana Producer', percentage: 60 },
];

describe('registerSplitSheet MCP tool', () => {
    beforeEach(() => {
        setMock.mockReset().mockResolvedValue(undefined);
        saveMock.mockReset().mockResolvedValue(undefined);
        fileMock.mockClear();
        bucketMock.mockClear();
        docMock.mockClear();
        collectionMock.mockClear();
        releaseGetMock.mockReset();
    });

    it('writes a whitelisted doc + storage artifact and returns honest warnings', async () => {
        const result = await registerSplitSheet.handler(
            { trackId: 'track-1', collaborators: validCollaborators, idempotencyKey: 'split-key-0001', extraneous: 'do-not-store' },
            context('user-1'),
        );
        const payload = JSON.parse((result.content[0] as { text: string }).text);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.resource.type).toBe('split_sheet');
        expect(payload.resource.ownerUid).toBe('user-1');

        // Deterministic doc id from idempotency key
        expect(payload.resource.id).toMatch(/^split_[0-9a-f]{48}$/);

        // Firestore write: whitelisted fields only, no raw args
        expect(collectionMock).toHaveBeenCalledWith('split_sheets');
        expect(setMock).toHaveBeenCalledTimes(1);
        const written = setMock.mock.calls[0][0];
        expect(Object.keys(written).sort()).toEqual(['collaborators', 'createdAt', 'initiatorUid', 'pdfStoragePath', 'sha256', 'status', 'textStoragePath', 'trackId']);
        expect(written.trackId).toBe('track-1');
        expect(written.initiatorUid).toBe('user-1');
        expect(written.status).toBe('recorded_unsigned');
        expect(written.collaborators).toEqual([
            { name: 'Zed Writer', percentage: 40 },
            { name: 'Ana Producer', percentage: 60 },
        ]);
        expect(JSON.stringify(written)).not.toContain('do-not-store');

        // Storage artifacts (text + PDF) under caller's own scope
        expect(fileMock).toHaveBeenCalledWith(`users/user-1/split_sheets/${payload.resource.id}.txt`);
        expect(fileMock).toHaveBeenCalledWith(`users/user-1/split_sheets/${payload.resource.id}.pdf`);
        const savedText = saveMock.mock.calls[0][0] as string;
        expect(savedText).toContain('track: track-1');
        expect(savedText).toContain('initiator: user-1');
        // Deterministic ordering: sorted by name (Ana before Zed)
        expect(savedText.indexOf('Ana Producer')).toBeLessThan(savedText.indexOf('Zed Writer'));
        // PDF bytes saved as second call
        const savedPdfBytes = saveMock.mock.calls[1][0];
        expect(savedPdfBytes).toBeInstanceOf(Buffer);

        // Evidence entries reference both artifacts
        expect(payload.evidence).toHaveLength(2);
        expect(payload.evidence[0]).toEqual({
            type: 'storage_object',
            reference: `users/user-1/split_sheets/${payload.resource.id}.txt`,
            sha256: written.sha256,
        });
        expect(payload.evidence[0].sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(payload.evidence[1]).toEqual({
            type: 'storage_object',
            reference: `users/user-1/split_sheets/${payload.resource.id}.pdf`,
        });

        // Honest warnings: recorded but not countersigned, PDF is draft
        expect(payload.warnings.join(' ')).toContain('NOT countersigned');
        expect(payload.warnings.join(' ')).toContain('DRAFT');
    });

    it('fails closed with INVALID_ARGUMENT when percentages do not sum to 100', async () => {
        const result = await registerSplitSheet.handler(
            { trackId: 'track-1', collaborators: [{ name: 'A', percentage: 50 }, { name: 'B', percentage: 49 }] },
            context('user-1'),
        );
        const payload = JSON.parse((result.content[0] as { text: string }).text);

        expect(result.isError).toBe(true);
        expect(payload.status).toBe('failed');
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(setMock).not.toHaveBeenCalled();
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('rejects empty collaborator names and non-finite percentages', async () => {
        for (const collaborators of [
            [{ name: '  ', percentage: 100 }],
            [{ name: 'A', percentage: Number.NaN }],
            [{ name: 'A', percentage: 0 }],
            [],
        ]) {
            const result = await registerSplitSheet.handler({ trackId: 't', collaborators }, context('user-1'));
            const payload = JSON.parse((result.content[0] as { text: string }).text);
            expect(payload.error.code).toBe('INVALID_ARGUMENT');
        }
        expect(setMock).not.toHaveBeenCalled();
    });

    it('verifies release ownership when releaseId is supplied and fails closed when not owned', async () => {
        releaseGetMock.mockResolvedValue({ exists: false, data: () => undefined });

        const result = await registerSplitSheet.handler(
            { trackId: 'track-1', releaseId: 'someone-elses-release', collaborators: validCollaborators },
            context('user-1'),
        );
        const payload = JSON.parse((result.content[0] as { text: string }).text);

        expect(result.isError).toBe(true);
        expect(payload.error.message).toContain('Forbidden');
        expect(setMock).not.toHaveBeenCalled();
        expect(saveMock).not.toHaveBeenCalled();
    });
});
