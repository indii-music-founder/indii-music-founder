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

        // Expect 2 deals: SubscriptionModel + OnDemandStream, AdvertisementSupportedModel + OnDemandStream
        expect(deals).toHaveLength(2);

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

        // Expect 1 deal: PayAsYouGoModel + PermanentDownload
        expect(deals).toHaveLength(1);

        const downloadDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'PayAsYouGoModel' &&
            d.dealTerms.usage[0].useType === 'PermanentDownload'
        );
        expect(downloadDeal).toBeDefined();
    });

    it('should generate both Streaming and Download deals when both channels are present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming', 'download']
        };

        const deals = getDeals(metadata);

        // Expect 3 deals total
        expect(deals).toHaveLength(3);
    });

    it('should fallback to default deals if no channels are specified (empty array)', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: []
        };

        const deals = getDeals(metadata);

        // Fallback: Streaming + Download
        expect(deals.length).toBeGreaterThan(0);

        const subDeal = deals.find(d => d.dealTerms.commercialModelType === 'SubscriptionModel');
        const downloadDeal = deals.find(d => d.dealTerms.commercialModelType === 'PayAsYouGoModel');

        expect(subDeal).toBeDefined();
        expect(downloadDeal).toBeDefined();
    });

    it('should correctly set territories and start date', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            territories: ['US', 'CA'],
            releaseDate: '2025-05-01',
            distributionChannels: ['streaming']
        };

        const deals = getDeals(metadata);
        const deal = deals[0];

        expect(deal.dealTerms.territoryCode).toEqual(['US', 'CA']);
        expect(deal.dealTerms.validityPeriod.startDate).toBe('2025-05-01');
        expect(deal.dealTerms.releaseDisplayStartDate).toBe('2025-05-01');
    });

    it('should ignore "physical" channel and fallback if it is the only channel', () => {
        // According to current implementation logic:
        // if channels = ['physical'], streaming/download checks fail.
        // deals.length is 0.
        // Fallback triggers.

        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['physical']
        };

        const deals = getDeals(metadata);

        // Expect fallback behavior (Streaming + Download)
        // This confirms the "ignore" behavior effectively leads to default digital deals for this mapper
        expect(deals.length).toBeGreaterThan(0);
        const subDeal = deals.find(d => d.dealTerms.commercialModelType === 'SubscriptionModel');
        expect(subDeal).toBeDefined();
    });
});
