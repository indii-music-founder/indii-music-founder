import { describe, it, expect } from 'vitest';
import { ERNMapper } from './ERNMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { Deal } from './types/ern';

const MOCK_METADATA_BASE: ExtendedGoldenMetadata = {
    trackTitle: 'Test Track',
    artistName: 'Test Artist',
    isrc: 'USTEST12345',
    explicit: false,
    genre: 'Pop',
    labelName: 'Test Label',
    dpid: 'PADPIDA001',
    splits: [],
    pro: 'None',
    publisher: 'Self',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single',
    releaseDate: '2025-01-01',
    territories: ['Worldwide'],
    distributionChannels: [], // To be overridden
    upc: '123456789012',
    catalogNumber: 'TEST001',
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    }
};

describe('ERNMapper Deal Generation', () => {
    const defaultOptions = {
        messageId: 'MSG-1',
        sender: { partyId: 'SENDER', partyName: 'Sender' },
        recipient: { partyId: 'RECIPIENT', partyName: 'Recipient' },
        createdDateTime: '2025-01-01T00:00:00Z'
    };

    const getDeals = (metadata: ExtendedGoldenMetadata): Deal[] => {
        const ern = ERNMapper.mapMetadataToERN(metadata, defaultOptions);
        return ern.dealList || [];
    };

    it('should generate Streaming deals when "streaming" channel is present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming']
        };

        const deals = getDeals(metadata);

        // Expect 3 deals: SubscriptionModel (Premium), AdvertisementSupportedModel, SubscriptionModel (NonInteractive)
        expect(deals).toHaveLength(3);

        const subDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'SubscriptionModel' &&
            d.dealTerms.usage[0].useType === 'OnDemandStream'
        );
        expect(subDeal).toBeDefined();

        const adDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'AdvertisementSupportedModel' &&
            d.dealTerms.usage[0].useType === 'OnDemandStream'
        );
        expect(adDeal).toBeDefined();
    });

    it('should generate Download deals when "download" channel is present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['download']
        };

        const deals = getDeals(metadata);

        // Expect 2 deals: PayAsYouGo (PermanentDownload generic) + PayAsYouGo (Download specific)
        expect(deals.length).toBe(2);

        const commercialModels = deals.map(d => d.dealTerms.commercialModelType);
        expect(commercialModels.every(m => m === 'PayAsYouGoModel')).toBe(true);
        expect(deals.every(d => d.dealTerms.usage[0].useType === 'PermanentDownload')).toBe(true);
    });

    it('should generate Fallback deals when no channels are present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: []
        };

        const deals = getDeals(metadata);

        // Fallback: Streaming + Download defaults -> 2 deals
        expect(deals.length).toBe(2);

        const types = deals.map(d => d.dealTerms.commercialModelType);
        expect(types).toContain('SubscriptionModel');
        expect(types).toContain('PayAsYouGoModel');
    });

    it('should generate correct release date in deals', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming'],
            releaseDate: '2025-12-25'
        };

        const deals = getDeals(metadata);
        const deal = deals[0];

        expect(deal.dealTerms.releaseDisplayStartDate).toBe('2025-12-25');
        expect(deal.dealTerms.validityPeriod.startDate).toBe('2025-12-25');
    });
});
