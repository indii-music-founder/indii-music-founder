import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAdAccountId: vi.fn(),
    createCampaign: vi.fn(),
    createAdSet: vi.fn(),
    createAd: vi.fn(),
    pauseAd: vi.fn(),
    firestoreDocGet: vi.fn(),
    firestoreDocSet: vi.fn(),
    validateAppCheckV2: vi.fn(),
}));

vi.mock('firebase-admin', () => {
    const firestore = vi.fn(() => ({
        collection: vi.fn((colName: string) => ({
            doc: vi.fn((docId: string) => ({
                get: mocks.firestoreDocGet,
                set: mocks.firestoreDocSet,
                collection: vi.fn((subColName: string) => ({
                    doc: vi.fn((subDocId: string) => ({
                        get: mocks.firestoreDocGet,
                        set: mocks.firestoreDocSet,
                    })),
                })),
            })),
        })),
    }));
    Object.assign(firestore, {
        FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
        Timestamp: { now: () => ({ toDate: () => new Date() }) },
    });
    return { default: { firestore }, firestore };
});

vi.mock('firebase-functions/v2/https', () => ({
    HttpsError: class HttpsError extends Error {
        constructor(readonly code: string, message: string) {
            super(message);
            this.name = 'HttpsError';
        }
    },
    onCall: vi.fn((_options, handler) => handler),
}));

vi.mock('firebase-functions/v2', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../middleware/appCheck', () => ({
    validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('./facebookAdsExecutor', () => ({
    getAdAccountId: mocks.getAdAccountId,
    createCampaign: mocks.createCampaign,
    createAdSet: mocks.createAdSet,
    createAd: mocks.createAd,
    pauseAd: mocks.pauseAd,
}));

import {
    createAdCampaign,
    createAdSet,
    createAd,
    getAdInsights,
    pauseAdCampaign,
    getSocialPostInsights,
    syncEmailList,
    deployEmailCampaign,
    getEmailCampaignStats,
    sendSMSBlast,
    getSMSDeliveryStatus,
} from './marketingCallables';

describe('marketingCallables contract & security tests (ISSUE-1435)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('auth & App Check enforcement', () => {
        it('rejects unauthenticated calls across all endpoints', async () => {
            const unauthRequest = { auth: null, data: {} } as any;

            await expect((createAdCampaign as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((createAdSet as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((createAd as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((getAdInsights as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((pauseAdCampaign as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((getSocialPostInsights as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((syncEmailList as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((deployEmailCampaign as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((getEmailCampaignStats as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((sendSMSBlast as any)(unauthRequest)).rejects.toThrow('User session required');
            await expect((getSMSDeliveryStatus as any)(unauthRequest)).rejects.toThrow('User session required');

            expect(mocks.validateAppCheckV2).toHaveBeenCalled();
        });
    });

    describe('createAdCampaign', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when Meta ad account is not connected', async () => {
            mocks.getAdAccountId.mockResolvedValue(null);

            await expect(
                (createAdCampaign as any)({
                    auth,
                    data: { platform: 'meta', dailyBudget: 25, totalDays: 7 },
                }),
            ).rejects.toThrow(/Meta ad account is not connected/);
        });

        it('rejects unsupported platform with honest error', async () => {
            await expect(
                (createAdCampaign as any)({
                    auth,
                    data: { platform: 'unsupported_platform', dailyBudget: 25, totalDays: 7 },
                }),
            ).rejects.toThrow(/not currently supported/);
        });

        it('creates campaign when Meta ad account is connected', async () => {
            mocks.getAdAccountId.mockResolvedValue('act_998877');
            mocks.createCampaign.mockResolvedValue({ success: true, campaignId: 'camp-meta-1' });

            const res = await (createAdCampaign as any)({
                auth,
                data: { platform: 'meta', dailyBudget: 20, totalDays: 5, name: 'Summer Single' },
            });

            expect(res).toEqual({ campaignId: 'camp-meta-1' });
            expect(mocks.createCampaign).toHaveBeenCalledWith(
                'user-123',
                'act_998877',
                expect.objectContaining({
                    name: 'Summer Single',
                    dailyBudgetMinor: 2000,
                    status: 'PAUSED',
                }),
            );
        });
    });

    describe('createAdSet', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when Meta ad account is not connected', async () => {
            mocks.getAdAccountId.mockResolvedValue(null);

            await expect(
                (createAdSet as any)({
                    auth,
                    data: { campaignId: 'camp-1', platform: 'meta' },
                }),
            ).rejects.toThrow(/Meta ad account is not connected/);
        });

        it('creates ad set when connected', async () => {
            mocks.getAdAccountId.mockResolvedValue('act_998877');
            mocks.createAdSet.mockResolvedValue({ success: true, adSetId: 'adset-meta-1' });

            const res = await (createAdSet as any)({
                auth,
                data: {
                    campaignId: 'camp-1',
                    platform: 'meta',
                    targetAgeRange: [18, 34],
                    targetInterests: ['Indie Rock'],
                    placements: ['instagram_feed'],
                },
            });

            expect(res).toEqual({ adSetId: 'adset-meta-1' });
            expect(mocks.createAdSet).toHaveBeenCalledWith(
                'user-123',
                'act_998877',
                expect.objectContaining({
                    campaignId: 'camp-1',
                    targeting: expect.objectContaining({ age_min: 18, age_max: 34 }),
                }),
            );
        });
    });

    describe('createAd', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when Meta ad account is not connected', async () => {
            mocks.getAdAccountId.mockResolvedValue(null);

            await expect(
                (createAd as any)({
                    auth,
                    data: { adSetId: 'adset-1', creativeId: 'cr-1', headline: 'Listen Now' },
                }),
            ).rejects.toThrow(/Meta ad account is not connected/);
        });

        it('creates ad when connected', async () => {
            mocks.getAdAccountId.mockResolvedValue('act_998877');
            mocks.createAd.mockResolvedValue({ success: true, adId: 'ad-meta-1' });

            const res = await (createAd as any)({
                auth,
                data: { adSetId: 'adset-1', creativeId: 'cr-1', headline: 'Listen Now', body: 'New track out now' },
            });

            expect(res).toEqual({ adId: 'ad-meta-1' });
        });
    });

    describe('getAdInsights', () => {
        const auth = { uid: 'user-123' };

        it('fails closed with unavailable when no metrics are synced (never fakes zeros)', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: false });

            await expect(
                (getAdInsights as any)({
                    auth,
                    data: { adId: 'ad-123' },
                }),
            ).rejects.toThrow(/Ad insights reporting is not yet available/);
        });

        it('returns real synced metrics when present in Firestore', async () => {
            mocks.firestoreDocGet.mockResolvedValue({
                exists: true,
                data: () => ({ impressions: 5400, clicks: 320, spend: 45.2, ctr: 5.9, cpc: 0.14 }),
            });

            const res = await (getAdInsights as any)({
                auth,
                data: { adId: 'ad-123' },
            });

            expect(res).toEqual({ impressions: 5400, clicks: 320, spend: 45.2, ctr: 5.9, cpc: 0.14 });
        });
    });

    describe('pauseAdCampaign', () => {
        const auth = { uid: 'user-123' };

        it('pauses campaign via executor', async () => {
            mocks.pauseAd.mockResolvedValue({ success: true });

            const res = await (pauseAdCampaign as any)({
                auth,
                data: { campaignId: 'camp-1' },
            });

            expect(res).toEqual({ success: true });
        });
    });

    describe('getSocialPostInsights', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when post or insights are not found', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: false });

            await expect(
                (getSocialPostInsights as any)({
                    auth,
                    data: { externalId: 'post-1', platform: 'instagram' },
                }),
            ).rejects.toThrow(/Social post insights unavailable/);
        });
    });

    describe('syncEmailList & deployEmailCampaign', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when email provider is unconfigured', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: false });

            await expect(
                (syncEmailList as any)({
                    auth,
                    data: { provider: 'mailchimp', listId: 'l1', members: [] },
                }),
            ).rejects.toThrow(/Email marketing provider 'mailchimp' is not configured/);
        });

        it('deploys campaign when configured', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: true, data: () => ({ apiKey: 'valid-key' }) });
            mocks.firestoreDocSet.mockResolvedValue({});

            const res = await (deployEmailCampaign as any)({
                auth,
                data: { provider: 'mailchimp', subject: 'Newsletter #1', listId: 'l1' },
            });

            expect(res.status).toBe('queued');
            expect(res.campaignId).toBeDefined();
        });
    });

    describe('sendSMSBlast & getSMSDeliveryStatus', () => {
        const auth = { uid: 'user-123' };

        it('fails closed when Twilio is unconfigured', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: false });

            await expect(
                (sendSMSBlast as any)({
                    auth,
                    data: { phones: ['+15550001111'], text: 'New music is live!' },
                }),
            ).rejects.toThrow(/SMS provider 'Twilio' is not configured/);
        });

        it('fails closed when SMS delivery status is unavailable', async () => {
            mocks.firestoreDocGet.mockResolvedValue({ exists: false });

            await expect(
                (getSMSDeliveryStatus as any)({
                    auth,
                    data: { messageId: 'sms-123' },
                }),
            ).rejects.toThrow(/SMS delivery status unavailable/);
        });
    });
});
