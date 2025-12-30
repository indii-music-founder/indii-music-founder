import { describe, it, expect } from 'vitest';
import { ERNMapper } from './ERNMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

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
    releaseType: 'Single' as any,
    releaseDate: '2025-01-01',
    territories: ['Worldwide'],
    distributionChannels: [],
    upc: '123456789012',
    catalogNumber: 'TEST001',
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    },
    id: 'uuid-123',
    releaseTitle: 'Test Track',
    cLineYear: 2025,
    cLineText: 'Test Label',
    pLineYear: 2025,
    pLineText: 'Test Label',
    language: 'en'
};

const options = {
    messageId: 'MSG-001',
    sender: { partyId: 'PADPIDA0000000001', partyName: 'SENDER-ID' },
    recipient: { partyId: 'PADPIDA0000000002', partyName: 'RECIPIENT-ID' },
    createdDateTime: '2025-01-01T12:00:00Z',
};

const getDeals = (metadata: ExtendedGoldenMetadata) => {
    const ern = ERNMapper.mapMetadataToERN(metadata, options);
    return ern.dealList;
};

describe('ERNMapper Deal Generation', () => {
    it('should map basic metadata to ERN message', () => {
        const ern = ERNMapper.mapMetadataToERN(MOCK_METADATA_BASE, options);

        expect(ern.messageHeader.messageId).toBe(options.messageId);
        expect(ern.releaseList).toHaveLength(1);
        expect(ern.dealList.length).toBeGreaterThan(0);

        const mainRelease = ern.releaseList[0];
        expect(mainRelease.releaseTitle.titleText).toBe('Test Track');
        expect(mainRelease.releaseId.icpn).toBe(MOCK_METADATA_BASE.upc);
    });

    it('should generate Streaming deals correctly', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming']
        };

        const deals = getDeals(metadata);

        // Expect 4 deals:
        // 1. SubscriptionModel OnDemandStream Stream
        // 2. AdvertisementSupportedModel OnDemandStream Stream
        // 3. SubscriptionModel NonInteractiveStream Stream
        // 4. AdvertisementSupportedModel NonInteractiveStream Stream
        expect(deals).toHaveLength(4);

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

    it('should generate Download deals correctly', () => {
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

        // Expect 5 deals total (4 streaming + 1 download)
        expect(deals).toHaveLength(5);
    });

    it('should fallback to default deals if no channels are specified (empty array)', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: []
        };

        const deals = getDeals(metadata);

        // Fallback: Streaming (Subscription) + Download
        expect(deals.length).toBe(2);

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
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['physical']
        };

        const deals = getDeals(metadata);

        // Expect fallback behavior (2 deals)
        expect(deals.length).toBe(2);
    });

    it('should map AI generation info correctly', () => {
        const aiMetadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            aiGeneratedContent: {
                isFullyAIGenerated: true,
                isPartiallyAIGenerated: false,
                aiToolsUsed: ['Suno', 'Udio'],
                humanContribution: 'Prompting and selection'
            }
        };

        const ern = ERNMapper.mapMetadataToERN(aiMetadata, options);
        const release = ern.releaseList[0];

        expect(release.aiGenerationInfo).toBeDefined();
        expect(release.aiGenerationInfo?.isFullyAIGenerated).toBe(true);
        expect(release.aiGenerationInfo?.aiToolsUsed).toContain('Suno');
    });
});
