/**
 * ISSUE-667 regression suite: marketing services must throw typed
 * MarketingProviderUnavailableError when provider callables are missing or
 * rejected — never fabricated fallbacks (queued blasts, 'pending' statuses,
 * zero-filled analytics, fake revocations).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingProviderUnavailableError } from './providerErrors';

const httpsCallableMock = vi.fn();

vi.mock('@/services/firebase', () => ({ functionsWest1: {} }));
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (...args: unknown[]) => httpsCallableMock(...args),
}));

import { SMSMarketingService } from './SMSMarketingService';
import { EmailMarketingService } from './EmailMarketingService';
import { SocialAutoPosterService } from './SocialAutoPosterService';

const member = { phone: '+15550001111', isSuperfan: true, subscribedAt: 0 };
const emailMember = { email: 'fan@example.com', subscribedAt: 0 };

describe('marketing provider honesty (ISSUE-667)', () => {
    beforeEach(() => {
        httpsCallableMock.mockReset();
    });

    describe('when the provider callable is unavailable', () => {
        beforeEach(() => {
            httpsCallableMock.mockReturnValue(
                vi.fn().mockRejectedValue(new Error('functions/not-found'))
            );
        });

        it('broadcastSMS throws instead of pretending the blast was queued', async () => {
            const svc = new SMSMarketingService();
            await expect(svc.broadcastSMS([member], { id: 'm1', text: 'hi' }))
                .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
        });

        it('getSMSStatus throws instead of returning a fabricated "pending"', async () => {
            const svc = new SMSMarketingService();
            await expect(svc.getSMSStatus('m1'))
                .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
        });

        it('syncMembers throws instead of pretending the sync was queued', async () => {
            const svc = new EmailMarketingService();
            await expect(svc.syncMembers([emailMember], 'mailchimp', 'list1'))
                .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
        });

        it('getCampaignStats throws instead of returning zero-filled analytics', async () => {
            const svc = new EmailMarketingService();
            await expect(svc.getCampaignStats('c1', 'klaviyo'))
                .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
        });

        it('getPostInsights throws instead of returning zero-filled metrics', async () => {
            const svc = new SocialAutoPosterService();
            await expect(svc.getPostInsights('ext1', 'tiktok'))
                .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
        });
    });

    it('revokePost throws — there is no revoke backend, so no fake cancellations', async () => {
        const svc = new SocialAutoPosterService();
        await expect(svc.revokePost('p1'))
            .rejects.toBeInstanceOf(MarketingProviderUnavailableError);
    });

    it('broadcastSMS returns the real recipient count when Twilio accepts', async () => {
        httpsCallableMock.mockReturnValue(
            vi.fn().mockResolvedValue({ data: { sent: 1, failed: 0, status: 'sent' } })
        );
        const svc = new SMSMarketingService();
        await expect(svc.broadcastSMS([member], { id: 'm1', text: 'hi' })).resolves.toBe(1);
    });
});
