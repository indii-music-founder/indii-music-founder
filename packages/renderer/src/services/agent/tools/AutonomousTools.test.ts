import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    collection: vi.fn(() => 'marketplace-drops-collection'),
    serverTimestamp: vi.fn(() => 'server-time'),
    getState: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: 'firestore-db' }));
vi.mock('firebase/firestore', () => ({
    addDoc: mocks.addDoc,
    collection: mocks.collection,
    serverTimestamp: mocks.serverTimestamp,
}));
vi.mock('@/utils/dynamicImport', () => ({
    importWithRetry: vi.fn(async () => ({
        useStore: { getState: mocks.getState },
    })),
}));

import { AutonomousTools } from './AutonomousTools';

describe('AutonomousTools.create_artifact_drop', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getState.mockReturnValue({
            userProfile: { id: 'user-1', displayName: 'Artist Name' },
        });
        mocks.addDoc.mockResolvedValue({ id: 'drop-1' });
    });

    it('saves an unpublished draft and makes no live-commerce claim', async () => {
        const result = await AutonomousTools.create_artifact_drop({
            title: 'Studio Artifact',
            description: 'One of one',
            priceUsd: 25,
            artworkUrl: 'https://example.com/art.jpg',
            licenseType: 'Personal',
        });

        expect(mocks.addDoc).toHaveBeenCalledWith(
            'marketplace-drops-collection',
            expect.objectContaining({ status: 'draft_unpublished' })
        );
        expect(result).toMatchObject({
            success: true,
            data: {
                dropId: 'drop-1',
                status: 'draft_unpublished',
                publicationUrl: null,
                checkoutConfigured: false,
                fulfillmentConfigured: false,
            },
        });
        expect(result.message).toContain('not live');
    });
});
