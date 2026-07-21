import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackGetMock = vi.fn();
const releaseGetMock = vi.fn();

const firestoreInstance = {
    collection: vi.fn((name: string) => {
        if (name === 'tracks') return { doc: vi.fn(() => ({ get: trackGetMock })) };
        if (name === 'users') return { doc: vi.fn(() => ({ collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: releaseGetMock })) })) })) };
        if (name === 'releases') return { doc: vi.fn(() => ({ get: releaseGetMock })) };
        throw new Error(`unexpected collection ${name}`);
    }),
};

vi.mock('firebase-admin', () => {
    const firestore = vi.fn(() => firestoreInstance);
    return { firestore, default: { firestore } };
});

import { auditSampleClearance } from '../auditSampleClearance.js';
import { McpContext } from '../../types.js';

const context = (uid: string): McpContext => ({
    user: { uid, admin: false } as never,
});

describe('auditSampleClearance MCP tool (P7a metadata-declaration check)', () => {
    beforeEach(() => {
        trackGetMock.mockReset();
        releaseGetMock.mockReset();
    });

    it('returns DECLARED-BUT-UNVERIFIED when samples are declared but unverified', async () => {
        trackGetMock.mockResolvedValue({
            exists: true,
            data: () => ({ samples: [{ source: 'some-song' }], clearanceStatus: 'unverified' }),
        });

        const result = await auditSampleClearance.handler({ trackId: 'track-123' }, context('user-1'));
        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.data.verdict).toBe('DECLARED-BUT-UNVERIFIED');
        expect(payload.data.samplesDeclarationCount).toBe(1);
        expect(payload.data.fingerprintAnalysisAvailable).toBe(false);
        expect(payload.warnings.join(' ')).toContain('CRITICAL');
        expect(payload.warnings.join(' ')).not.toMatch(/fingerprint match/i);
    });

    it('returns NONE-DECLARED when no samples or interpolations exist', async () => {
        trackGetMock.mockResolvedValue({ exists: true, data: () => ({}) });

        const result = await auditSampleClearance.handler({ trackId: 'track-clean' }, context('user-1'));
        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.data.verdict).toBe('NONE-DECLARED');
        expect(payload.data.samplesDeclarationCount).toBe(0);
    });

    it('counts interpolations alongside samples in the declaration count', async () => {
        trackGetMock.mockResolvedValue({
            exists: true,
            data: () => ({ samples: [{ source: 'a' }], interpolations: [{ source: 'b' }, { source: 'c' }] }),
        });

        const result = await auditSampleClearance.handler({ trackId: 'track-multi' }, context('user-1'));
        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);

        expect(payload.data.verdict).toBe('DECLARED-BUT-UNVERIFIED');
        expect(payload.data.samplesDeclarationCount).toBe(3);
    });

    it('fails closed with NOT_FOUND when the track does not exist', async () => {
        trackGetMock.mockResolvedValue({ exists: false });

        const result = await auditSampleClearance.handler({ trackId: 'ghost-track' }, context('user-1'));
        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);

        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('NOT_FOUND');
    });

    it('rejects a missing/invalid trackId without any Firestore access', async () => {
        const result = await auditSampleClearance.handler({}, context('user-1'));

        expect(result.isError).toBe(true);
        expect(trackGetMock).not.toHaveBeenCalled();

        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
        expect(payload.error.code).toBe('INVALID_ARGUMENT');
        expect(payload.error.message).toContain('trackId');
    });

    it('never claims a fingerprint match — P7a is metadata-only', async () => {
        trackGetMock.mockResolvedValue({
            exists: true,
            data: () => ({ samples: [{ source: 'x' }], clearanceStatus: 'verified' }),
        });

        const result = await auditSampleClearance.handler({ trackId: 'track-1' }, context('user-1'));
        const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);

        expect(payload.data.fingerprintAnalysisAvailable).toBe(false);
        expect(JSON.stringify(payload)).not.toMatch(/fingerprint match/i);
    });
});
