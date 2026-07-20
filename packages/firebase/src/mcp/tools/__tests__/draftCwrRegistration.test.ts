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

vi.mocked(admin.firestore).mockImplementation(firestoreMock);
vi.mocked(admin.storage).mockImplementation(vi.fn(() => ({ bucket: bucketMock })));

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

    it('generates CWR with all record types and stores to GCS', async () => {
        const result = await draftCwrRegistration.handler(
            {
                releaseId: 'release-1',
                writers: [
                    { name: 'John Composer', ipi: '123456789' },
                    { name: 'Jane Writer' },
                ],
            },
            context('user-1'),
        );
        const payload = JSON.parse((result.content[0] as { text: string }).text);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.resource.type).toBe('cwr_draft');

        // CWR contains all required record types
        const cwrDraft = payload.data.cwrDraft as string;
        expect(cwrDraft).toContain('HDR|');
        expect(cwrDraft).toContain('GRH|');
        expect(cwrDraft).toContain('NWR|');
        expect(cwrDraft).toContain('SWR|');
        expect(cwrDraft).toContain('SPT|');
        expect(cwrDraft).toContain('GRT|');
        expect(cwrDraft).toContain('TRL|');

        // Storage: CWR saved to uid-scoped path
        const storagePath = payload.data.storagePath as string;
        expect(storagePath).toMatch(/^users\/user-1\/cwr\//);
        expect(storagePath).toMatch(/.V21$/);
        expect(fileMock).toHaveBeenCalledWith(storagePath);

        // Firestore: metadata document created
        expect(setMock).toHaveBeenCalledTimes(1);
        const written = setMock.mock.calls[0][0];
        expect(written.releaseId).toBe('release-1');
        expect(written.status).toBe('draft_unsubmitted');
        expect(written.writerCount).toBe(2);

        // Evidence entry references storage artifact
        expect(payload.evidence).toEqual([{ type: 'storage_object', reference: storagePath }]);

        // Honest warnings: DRAFT, not submitted
        const warnings = (payload.warnings || []) as string[];
        expect(warnings.join(' ')).toContain('DRAFT');
        expect(warnings.join(' ')).toContain('has NOT been submitted');
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
