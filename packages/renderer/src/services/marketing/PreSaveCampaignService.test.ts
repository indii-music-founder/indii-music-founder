import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callables: new Map<string, ReturnType<typeof vi.fn>>(),
    httpsCallable: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ functions: { app: 'functions' } }));
vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

import { PreSaveCampaignService } from './PreSaveCampaignService';

describe('PreSaveCampaignService', () => {
    beforeEach(() => {
        mocks.callables.clear();
        mocks.httpsCallable.mockReset();
        mocks.httpsCallable.mockImplementation((_functions, name: string) => {
            const callable = mocks.callables.get(name);
            if (!callable) throw new Error(`Missing callable mock: ${name}`);
            return callable;
        });
    });

    it('creates campaigns through the deployed callable and returns its durable id', async () => {
        const save = vi.fn().mockResolvedValue({ data: { campaignId: 'campaign-123' } });
        mocks.callables.set('createPreSaveCampaign', save);
        const service = new PreSaveCampaignService();

        const campaignId = await service.createCampaign({
            title: 'Midnight Frequencies',
            releaseDate: Date.UTC(2026, 8, 1),
            coverArtUrl: '',
            links: { spotify: 'https://open.spotify.com/album/abc123' },
            captureEmails: true,
            capturePhones: false,
            themeColor: '#22c55e',
        });

        expect(campaignId).toBe('campaign-123');
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Midnight Frequencies' }));
    });

    it('loads only the public campaign projection from the backend', async () => {
        const campaign = {
            id: 'campaign-123',
            title: 'Midnight Frequencies',
            releaseDate: Date.UTC(2026, 8, 1),
            coverArtUrl: '',
            links: { spotify: 'https://open.spotify.com/album/abc123' },
            captureEmails: true,
            capturePhones: false,
            themeColor: '#22c55e',
            status: 'active' as const,
        };
        mocks.callables.set('getPreSaveCampaign', vi.fn().mockResolvedValue({ data: campaign }));
        const service = new PreSaveCampaignService();

        await expect(service.getCampaign('campaign-123')).resolves.toEqual(campaign);
    });

    it('rejects a malformed persistence response instead of fabricating a URL', async () => {
        mocks.callables.set('createPreSaveCampaign', vi.fn().mockResolvedValue({
            data: { campaignId: 'not a routable id' },
        }));
        const service = new PreSaveCampaignService();

        await expect(service.createCampaign({
            title: 'Midnight Frequencies',
            releaseDate: Date.UTC(2026, 8, 1),
            coverArtUrl: '',
            links: { spotify: 'https://open.spotify.com/album/abc123' },
            captureEmails: true,
            capturePhones: false,
            themeColor: '#22c55e',
        })).rejects.toThrow(/no valid campaign ID/i);
    });

    it('records fan leads through the server-only callable', async () => {
        const register = vi.fn().mockResolvedValue({
            data: { presaved: true, campaignId: 'campaign-123', leadId: 'lead-123' },
        });
        mocks.callables.set('presaveRegister', register);
        const service = new PreSaveCampaignService();

        const result = await service.recordLead('campaign-123', {
            leadId: 'lead-123',
            dsp: 'spotify',
            email: 'fan@example.com',
            optInMarketing: true,
        });

        expect(result.presaved).toBe(true);
        expect(register).toHaveBeenCalledWith({
            campaignId: 'campaign-123',
            leadId: 'lead-123',
            dsp: 'spotify',
            email: 'fan@example.com',
            optInMarketing: true,
        });
    });

    it('uses the resolvable Studio hosting origin by default', () => {
        const service = new PreSaveCampaignService();
        expect(service.getCampaignUrl('campaign_12345678')).toBe(
            'https://app.indii.music/presave/campaign_12345678',
        );
        expect(() => service.getCampaignUrl('campaign id')).toThrow(/invalid campaign ID/i);
    });
});
