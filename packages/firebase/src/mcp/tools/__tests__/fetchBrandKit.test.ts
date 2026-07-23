import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const docMock = vi.fn(() => ({ get: getMock }));
const collectionMock = vi.fn(() => ({ doc: docMock }));

vi.mock('firebase-admin', () => ({
    firestore: vi.fn(() => ({ collection: collectionMock })),
}));

import { fetchBrandKit } from '../fetchBrandKit.js';
import { McpContext } from '../../types.js';
import { textContent } from './mcpContent';

const context = (uid: string, admin = false): McpContext => ({
    user: { uid, admin } as never,
});

describe('fetchBrandKit MCP tool', () => {
    beforeEach(() => {
        getMock.mockReset();
        docMock.mockClear();
        collectionMock.mockClear();
    });

    it('returns the authenticated user brandKit from Firestore instead of a hardcoded stub', async () => {
        getMock.mockResolvedValueOnce({
            exists: true,
            data: () => ({
                brandKit: {
                    colors: ['#111111', '#fafafa'],
                    fonts: 'Inter',
                    brandDescription: 'Noir club visuals',
                    negativePrompt: 'generic stock photos',
                    socials: { instagram: '@indii' },
                    brandAssets: [{ url: 'gs://bucket/logo.png', description: 'Logo', category: 'logo' }],
                    referenceImages: [{ url: 'gs://bucket/ref.png', description: 'Reference', category: 'other' }],
                    releaseDetails: { title: 'Midnight' },
                },
            }),
        });

        const result = await fetchBrandKit.handler({ artistId: 'user-1' }, context('user-1'));
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBeUndefined();
        expect(collectionMock).toHaveBeenCalledWith('users');
        expect(docMock).toHaveBeenCalledWith('user-1');
        expect(payload).toMatchObject({
            artistId: 'user-1',
            source: 'users/user-1.brandKit',
            brandKit: {
                colors: ['#111111', '#fafafa'],
                fonts: 'Inter',
                brandDescription: 'Noir club visuals',
            },
            assetCounts: { brandAssets: 1, referenceImages: 1 },
        });
    });

    it('denies cross-user reads for non-admin callers', async () => {
        const result = await fetchBrandKit.handler({ artistId: 'user-2' }, context('user-1'));

        expect(result.isError).toBe(true);
        expect(textContent(result)).toContain('Forbidden');
        expect(getMock).not.toHaveBeenCalled();
    });
});
