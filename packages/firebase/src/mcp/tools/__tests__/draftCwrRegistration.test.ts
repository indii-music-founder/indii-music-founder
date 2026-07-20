import { beforeEach, describe, expect, it, vi } from 'vitest';

// users/{uid}/releases/{id} chain and top-level releases/{id} chain.
const ownedReleaseGet = vi.fn();
const topReleaseGet = vi.fn();

const releasesDocMock = vi.fn(() => ({ get: ownedReleaseGet }));
const userDocMock = vi.fn(() => ({
    get: vi.fn(),
    collection: vi.fn(() => ({ doc: releasesDocMock })),
}));
const topDocMock = vi.fn(() => ({ get: topReleaseGet }));

const collectionMock = vi.fn((name: string) => {
    if (name === 'users') return { doc: userDocMock };
    return { doc: topDocMock };
});

vi.mock('firebase-admin', () => ({
    firestore: vi.fn(() => ({ collection: collectionMock })),
}));

import { draftCwrRegistration } from '../draftCwrRegistration.js';
import { McpContext } from '../../types.js';

const context = (uid: string): McpContext => ({ user: { uid } } as never);

const parse = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe('draftCwrRegistration MCP tool', () => {
    beforeEach(() => {
        ownedReleaseGet.mockReset();
        topReleaseGet.mockReset();
        collectionMock.mockClear();
    });

    it('drafts an in-handler CWR structural draft with honest warnings', async () => {
        ownedReleaseGet.mockResolvedValue({ exists: true, data: () => ({ title: 'Midnight Run' }) });

        const result = await draftCwrRegistration.handler(
            {
                releaseId: 'rel-1',
                writers: [{ name: 'Jane Doe', ipi: '123456789' }, { name: 'Sam Smith' }],
            },
            context('user-1')
        );
        const payload = parse(result);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.resource.type).toBe('cwr_draft');
        expect(payload.data.recordCount).toBe(7); // HDR+GRH+NWR+2xSWR+GRT+TRL

        const draft: string = payload.data.cwrDraft;
        expect(draft).toContain('HDR|');
        expect(draft).toContain('NWR|WORK TITLE:MIDNIGHT RUN');
        expect(draft).toContain('SWR|SEQ:01|WRITER NAME:JANE DOE|IPI:123456789|ROLE:CA|SHARE:UNSPECIFIED');
        expect(draft).toContain('SWR|SEQ:02|WRITER NAME:SAM SMITH|IPI:UNKNOWN');
        expect(draft).toContain('GRT|');
        expect(draft).toContain('TRL|');

        const warnings: string[] = payload.warnings;
        expect(warnings.join(' ')).toContain('NOT fixed-width validated');
        expect(warnings.join(' ')).toContain('No society or IPI verification');
        expect(warnings.join(' ')).toContain('NOT been submitted to any PRO');
        expect(warnings.join(' ')).toContain('Writer shares are not yet specified');
    });

    it('fails closed with workTitle arg fallback missing on an untitled release', async () => {
        ownedReleaseGet.mockResolvedValue({ exists: true, data: () => ({}) });

        const result = await draftCwrRegistration.handler(
            { releaseId: 'rel-1', writers: [{ name: 'Jane Doe' }] },
            context('user-1')
        );
        const payload = parse(result);
        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('INVALID_ARGUMENT');

        const ok = await draftCwrRegistration.handler(
            { releaseId: 'rel-1', workTitle: 'Fallback Song', writers: [{ name: 'Jane Doe' }] },
            context('user-1')
        );
        expect(parse(ok).data.cwrDraft).toContain('WORK TITLE:FALLBACK SONG');
    });

    it('fails closed on an invalid IPI without touching Firestore', async () => {
        const result = await draftCwrRegistration.handler(
            { releaseId: 'rel-1', writers: [{ name: 'Jane Doe', ipi: 'abc' }] },
            context('user-1')
        );
        const payload = parse(result);

        expect(result.isError).toBe(true);
        expect(payload.status).toBe('failed');
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(ownedReleaseGet).not.toHaveBeenCalled();
    });

    it('fails closed on a cross-tenant releaseId (ownership helper throws)', async () => {
        ownedReleaseGet.mockResolvedValue({ exists: false, data: () => undefined });
        topReleaseGet.mockResolvedValue({ exists: true, data: () => ({ userId: 'someone-else' }) });

        const result = await draftCwrRegistration.handler(
            { releaseId: 'other-users-release', writers: [{ name: 'Jane Doe' }] },
            context('user-1')
        );
        const payload = parse(result);

        expect(result.isError).toBe(true);
        expect(payload.status).toBe('failed');
        expect(payload.error.message).toContain('Forbidden');
        expect(payload.data).toBeUndefined();
    });
});
