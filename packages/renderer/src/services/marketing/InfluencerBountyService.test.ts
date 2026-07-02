import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBountyCallable = vi.hoisted(() => vi.fn(async () => ({
    data: {
        success: true,
        refCode: 'REF-1234',
        link: 'https://indii.vip/ref/REF-1234',
    },
})));

const collectionMock = vi.hoisted(() => vi.fn());
const getDocsMock = vi.hoisted(() => vi.fn());
const queryMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ args })));
const whereMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ args })));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'user-1' } },
    functionsWest1: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions: unknown, name: string) => {
        if (name === 'createInfluencerBounty') {
            return createBountyCallable;
        }

        return vi.fn();
    }),
}));

vi.mock('firebase/firestore', () => ({
    collection: collectionMock,
    getDocs: getDocsMock,
    query: queryMock,
    where: whereMock,
}));

describe('InfluencerBountyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes the selected action through when creating a bounty link', async () => {
        const { influencerBountyService } = await import('./InfluencerBountyService');

        const result = await influencerBountyService.generateBountyLink('@artist', 'Lead Song', 75, 'TikTok');

        expect(createBountyCallable).toHaveBeenCalledWith({
            influencerHandle: '@artist',
            trackName: 'Lead Song',
            rewardAmount: 75,
            action: 'TikTok',
        });
        expect(result.targetUrl).toBe('https://indii.vip/ref/REF-1234');
        expect(result.referralCode).toBe('REF-1234');
    });

    it('loads persisted bounty links from influencerBounties for the current user', async () => {
        getDocsMock.mockResolvedValue({
            docs: [
                {
                    id: 'ref-2',
                    data: () => ({
                        userId: 'user-1',
                        influencerHandle: '@beta',
                        trackName: 'Second Song',
                        rewardAmount: 125,
                        action: 'IG Reel',
                        refCode: 'REF-2',
                        link: 'https://indii.vip/ref/REF-2',
                        status: 'active',
                        createdAt: { toMillis: () => 2000 },
                    }),
                },
                {
                    id: 'ref-1',
                    data: () => ({
                        userId: 'user-1',
                        influencerHandle: '@alpha',
                        trackName: 'First Song',
                        rewardAmount: 75,
                        action: 'TikTok',
                        refCode: 'REF-1',
                        link: 'https://indii.vip/ref/REF-1',
                        status: 'active',
                        createdAt: { toMillis: () => 1000 },
                    }),
                },
            ],
        });

        const { influencerBountyService } = await import('./InfluencerBountyService');

        const links = await influencerBountyService.listBountyLinks();

        expect(collectionMock).toHaveBeenCalledWith({}, 'influencerBounties');
        expect(whereMock).toHaveBeenCalledWith('userId', '==', 'user-1');
        expect(links).toHaveLength(2);
        expect(links[0].referralCode).toBe('REF-2');
        expect(links[0].targetUrl).toBe('https://indii.vip/ref/REF-2');
        expect(links[1].referralCode).toBe('REF-1');
        expect(links[1].action).toBe('TikTok');
    });

    it('rejects tracking and payout requests honestly', async () => {
        const { influencerBountyService } = await import('./InfluencerBountyService');

        await expect(influencerBountyService.trackEvent('REF-1234', 'click')).rejects.toThrow(
            'Influencer bounty tracking is not available until the event pipeline is deployed.'
        );
        await expect(influencerBountyService.initiatePayout('@artist', 250)).rejects.toThrow(
            'Influencer bounty payouts are not available until Stripe transfer automation is deployed.'
        );
        await expect(influencerBountyService.getTopInfluencers('org-1')).resolves.toEqual([]);
    });
});
